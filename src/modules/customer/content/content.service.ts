import { randomUUID } from "node:crypto";
import { ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { deleteObject, uploadObject } from "../../../infrastructure/storage/s3-storage.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import type { ContentSlug, ContentUpsertBody } from "./content.validation.js";

type ContentImage = {
  key: string;
  url: string;
  contentType: string;
  createdAt: string;
};

type ContentData = {
  slug: ContentSlug;
  title: string;
  content: string;
  summary: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  image: string | null;
  imageKey?: string;
  imageContentType?: string;
};

const titleBySlug: Record<ContentSlug, string> = {
  terms: "Terms and Conditions",
  "privacy-policy": "Privacy Policy",
  about: "About Us"
};

const imageExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const isContentImage = (value: unknown): value is ContentImage =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as ContentImage).key === "string" &&
  typeof (value as ContentImage).url === "string";

const bodyContent = (body: ContentUpsertBody): string | undefined => body.content ?? body.body;

const serializeContentPage = (record: GeneratedApiRecordDocument) => {
  const image = isContentImage(record.data.image) ? record.data.image : undefined;
  const data: ContentData = {
    slug: record.scope.slug as ContentSlug,
    title: typeof record.data.title === "string" ? record.data.title : titleBySlug[record.scope.slug as ContentSlug],
    content: typeof record.data.content === "string" ? record.data.content : "",
    summary: typeof record.data.summary === "string" ? record.data.summary : null,
    seoTitle: typeof record.data.seoTitle === "string" ? record.data.seoTitle : null,
    seoDescription: typeof record.data.seoDescription === "string" ? record.data.seoDescription : null,
    image: image?.url ?? null
  };
  if (image?.key) {
    data.imageKey = image.key;
  }
  if (image?.contentType) {
    data.imageContentType = image.contentType;
  }

  return {
    id: record._id.toString(),
    resource: record.resource,
    scope: record.scope,
    data,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
};

export class ContentService {
  public async listPages() {
    const records = await GeneratedApiRecordModel.find({
      resource: "content-pages",
      deletedAt: null
    }).sort({ "scope.slug": 1 });

    return records.map(serializeContentPage);
  }

  public async getPublicPage(slug: ContentSlug) {
    const record = await GeneratedApiRecordModel.findOne({
      resource: "content-pages",
      "scope.slug": slug,
      status: "active",
      deletedAt: null
    });
    if (!record) {
      throw new ResourceNotFoundError("Content page not found.");
    }
    return serializeContentPage(record);
  }

  public async getAdminPage(slug: ContentSlug) {
    return serializeContentPage(await this.requirePage(slug));
  }

  public async createPage(
    actorId: string,
    slug: ContentSlug,
    body: ContentUpsertBody,
    file: Express.Multer.File | undefined
  ) {
    const existing = await GeneratedApiRecordModel.exists({
      resource: "content-pages",
      "scope.slug": slug,
      deletedAt: null
    });
    if (existing) {
      throw new ConflictError("Content page already exists. Use update instead.");
    }

    const content = bodyContent(body);
    if (!content) {
      throw new ConflictError("Content page body is required.");
    }

    const image = file ? await this.uploadImage(slug, file) : undefined;
    const data = {
      slug,
      title: body.title ?? titleBySlug[slug],
      content,
      summary: body.summary ?? null,
      seoTitle: body.seoTitle ?? null,
      seoDescription: body.seoDescription ?? null,
      image: image ?? null
    };

    const record = await GeneratedApiRecordModel.create({
      resource: "content-pages",
      scope: { slug },
      data,
      status: body.status ?? "active",
      history: [
        {
          action: "content-pages.created",
          actorId,
          actorType: "admin",
          at: new Date(),
          metadata: { slug, imageUrl: image?.url ?? null }
        }
      ]
    });

    return serializeContentPage(record);
  }

  public async updatePage(
    actorId: string,
    slug: ContentSlug,
    body: ContentUpsertBody,
    file: Express.Multer.File | undefined
  ) {
    const record = await this.requirePage(slug);
    const currentImage = isContentImage(record.data.image) ? record.data.image : undefined;
    const nextData = {
      ...record.data
    };
    const content = bodyContent(body);
    if (body.title) {
      nextData.title = body.title;
    }
    if (content) {
      nextData.content = content;
    }
    if (typeof body.summary !== "undefined") {
      nextData.summary = body.summary;
    }
    if (typeof body.seoTitle !== "undefined") {
      nextData.seoTitle = body.seoTitle;
    }
    if (typeof body.seoDescription !== "undefined") {
      nextData.seoDescription = body.seoDescription;
    }

    let image: ContentImage | undefined;
    if (file) {
      image = await this.uploadImage(slug, file);
      nextData.image = image;
    }

    const nextStatus = body.status ?? record.status;
    const dataChanged = JSON.stringify(nextData) !== JSON.stringify(record.data) || nextStatus !== record.status;
    if (!dataChanged && !file) {
      throw new ConflictError("No content page changes were detected.");
    }

    const updated = await GeneratedApiRecordModel.findByIdAndUpdate(
      record._id,
      {
        $set: {
          data: nextData,
          status: nextStatus
        },
        $push: {
          history: {
            action: "content-pages.updated",
            actorId,
            actorType: "admin",
            at: new Date(),
            metadata: { slug, imageUrl: image?.url ?? null }
          }
        }
      },
      { new: true }
    );

    if (image && currentImage?.key) {
      await deleteObject(currentImage.key);
    }

    return serializeContentPage(updated ?? record);
  }

  private async requirePage(slug: ContentSlug): Promise<GeneratedApiRecordDocument> {
    const record = await GeneratedApiRecordModel.findOne({
      resource: "content-pages",
      "scope.slug": slug,
      deletedAt: null
    });
    if (!record) {
      throw new ResourceNotFoundError("Content page not found.");
    }
    return record;
  }

  private async uploadImage(slug: ContentSlug, file: Express.Multer.File): Promise<ContentImage> {
    const extension = imageExtensionByMimeType[file.mimetype];
    if (!extension) {
      throw new ConflictError("Only image/jpeg, image/png, image/webp, and image/gif files are supported.");
    }

    const key = `content-pages/${slug}/${randomUUID()}.${extension}`;
    const url = await uploadObject({
      key,
      body: file.buffer,
      contentType: file.mimetype
    });

    return {
      key,
      url,
      contentType: file.mimetype,
      createdAt: new Date().toISOString()
    };
  }
}
