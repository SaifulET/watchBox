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

type InlineImageResponse = {
  image: string;
};

const titleBySlug: Record<ContentSlug, string> = {
  terms: "Terms and Conditions",
  "privacy-policy": "Privacy Policy",
  about: "About Us",
  "account-deletion": "Account Deletion Method"
};

const defaultContentBySlug: Record<ContentSlug, string> = {
  terms: `
<h2>1. Acceptance of these terms</h2>
<p>These Terms and Conditions govern access to WatchBox, including the website, mobile apps, marketplace listings, payments, and related services. By creating an account or using WatchBox, you agree to these terms.</p>
<h2>2. Accounts</h2>
<p>You must provide accurate registration details and keep your login credentials confidential. You are responsible for activity on your account. We may suspend or close an account that is used unlawfully or in breach of these terms.</p>
<h2>3. Marketplace use</h2>
<p>Listings must describe watches honestly, including brand, condition, provenance, and price. Buyers and sellers must complete transactions in good faith. WatchBox may remove listings that are misleading, infringing, or otherwise prohibited.</p>
<h2>4. Payments and subscriptions</h2>
<p>Paid features, fees, and subscription plans are charged as displayed at checkout. Taxes may apply. Chargebacks, refunds, and payment disputes are handled according to the payment provider and applicable law.</p>
<h2>5. Acceptable use</h2>
<p>You may not use WatchBox to commit fraud, scrape data without permission, upload malware, harass others, or interfere with the service. We may investigate and take action, including account termination.</p>
<h2>6. Intellectual property</h2>
<p>WatchBox branding, software, and content we publish remain our property or that of our licensors. You retain rights in content you upload, and grant us a license to host and display it to operate the marketplace.</p>
<h2>7. Disclaimers</h2>
<p>WatchBox provides the marketplace as-is. We do not guarantee that a listing, valuation, or third-party marketplace result is complete or error-free. Your use of third-party services such as eBay is subject to those providers' terms.</p>
<h2>8. Limitation of liability</h2>
<p>To the fullest extent permitted by law, WatchBox is not liable for indirect, incidental, or consequential damages, or for losses arising from listings, buyer-seller disputes, or third-party platforms.</p>
<h2>9. Changes</h2>
<p>We may update these terms. Continued use after an update constitutes acceptance of the revised terms. Material changes will be posted on this page.</p>
<h2>10. Contact</h2>
<p>Questions about these terms can be sent through the public Contact page or to the support email published on WatchBox.</p>
`.trim(),
  "privacy-policy": `
<h2>1. Who we are</h2>
<p>WatchBox operates a luxury watch marketplace and related admin tools. This Privacy Policy explains what personal data we collect, why we collect it, and the choices you have.</p>
<h2>2. Data we collect</h2>
<p>We collect account details such as name, email, password hash, phone, country, and location when you provide them. We also collect listings, messages, purchase and subscription records, device and log data, and support requests.</p>
<h2>3. How we use data</h2>
<p>We use personal data to create and secure your account, operate the marketplace, process payments, send verification and reset codes, provide customer support, prevent fraud, and improve the service.</p>
<h2>4. Sharing</h2>
<p>We share data with service providers that host, store, email, process payments, or power marketplace integrations. We may disclose information when required by law or to protect users and the platform. We do not sell personal data.</p>
<h2>5. Retention</h2>
<p>We keep account and transaction data for as long as needed to provide the service, meet legal obligations, and resolve disputes. Deleted account data is removed or anonymized except where retention is required by law.</p>
<h2>6. Security</h2>
<p>We use access controls, encrypted transport, and hashed passwords. No online service is completely secure, so you should also protect your credentials.</p>
<h2>7. Your rights</h2>
<p>Depending on your location, you may request access, correction, export, or deletion of your personal data. Use the Account Deletion page, in-app account settings, or the Contact form to make a request.</p>
<h2>8. Cookies and similar technology</h2>
<p>We use essential cookies and similar storage to keep you signed in and protect the service. Analytics cookies are used only where needed to understand product usage.</p>
<h2>9. Updates</h2>
<p>We may update this policy. The latest version will always be available on this public page.</p>
`.trim(),
  about: `
<p>WatchBox is a luxury watch marketplace for collectors, dealers, and enthusiasts. Search, list, and manage watches from one account, and reach support when you need help.</p>
`.trim(),
  "account-deletion": `
<h2>How to delete your WatchBox account</h2>
<p>You can delete your customer account from the WatchBox app. Deletion is permanent and cannot be undone.</p>
<h2>What is deleted</h2>
<ul>
<li>Your profile, email, and login credentials</li>
<li>Active sessions and password-reset or verification codes</li>
<li>Access to listings, saved items, and account settings tied to that login</li>
</ul>
<p>We may retain limited records where the law requires it, such as completed payment or tax information, after removing your ability to sign in.</p>
<h2>How to delete your account</h2>
<ol>
<li>Open the WatchBox app and sign in.</li>
<li>Go to Profile or Account settings.</li>
<li>Choose Delete account and confirm.</li>
</ol>
<p>If you cannot access the app, send a deletion request from the Contact page using the email on the account.</p>
`.trim()
};

const defaultPublicPage = (slug: ContentSlug) => {
  const now = new Date().toISOString();
  return {
    id: `default:${slug}`,
    resource: "content-pages",
    scope: { slug },
    data: {
      slug,
      title: titleBySlug[slug],
      content: defaultContentBySlug[slug],
      summary: null,
      seoTitle: titleBySlug[slug],
      seoDescription: null,
      image: null
    },
    status: "active" as const,
    createdAt: now,
    updatedAt: now
  };
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
      return defaultPublicPage(slug);
    }
    return serializeContentPage(record);
  }

  public async getAdminPage(slug: ContentSlug) {
    return serializeContentPage(await this.requirePage(slug));
  }

  public async uploadInlineImage(file: Express.Multer.File | undefined): Promise<InlineImageResponse> {
    if (!file) {
      throw new ConflictError("Image file is required.");
    }

    const image = await this.uploadImage("inline", file);
    return {
      image: image.url
    };
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

  private async uploadImage(folder: string, file: Express.Multer.File): Promise<ContentImage> {
    const extension = imageExtensionByMimeType[file.mimetype];
    if (!extension) {
      throw new ConflictError("Only image/jpeg, image/png, image/webp, and image/gif files are supported.");
    }

    const key = `content-pages/${folder}/${randomUUID()}.${extension}`;
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
