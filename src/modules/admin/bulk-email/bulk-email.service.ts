import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import type { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import type { JobPublisher } from "../../../common/services/job-publisher.js";
import type { EmailProvider } from "../../../infrastructure/external/email/email-provider.js";
import { uploadObject } from "../../../infrastructure/storage/s3-storage.js";
import { AdminAccountModel, CustomerAccountModel } from "../../customer/auth/auth.model.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import type {
  BulkEmailRecipientsQueryInput,
  CreateBulkEmailCampaignInput
} from "./bulk-email.validation.js";

type BulkEmailServiceDependencies = {
  events: DomainEventPublisher;
  email: EmailProvider;
  jobs?: JobPublisher;
};

type RecipientSnapshot = {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  accountType: "customer" | "admin";
};

type RecipientRecord = RecipientSnapshot & {
  createdAt: Date;
};

type ParsedRecipientId = {
  accountType: "customer" | "admin";
  id: string;
};

export const bulkEmailCampaignSendJobType = "bulk-email.campaign.send";
export const bulkEmailCampaignQueue = "watchbox.bulk-email.campaigns";

const defaultTemplates = [
  {
    id: "monthly-product-update",
    name: "Monthly Product Update",
    subject: "Exciting New Updates to Your Workspace",
    body: `<p><strong>Hi there,</strong></p><p>We've been working hard to bring you a better experience. In our latest update, we've introduced several key features designed to streamline your workflow.</p><p>Best regards,<br/>The Modevin Team</p>`
  },
  {
    id: "welcome-email",
    name: "Welcome Email",
    subject: "Welcome to Modevin",
    body: "<p>Welcome to Modevin. We're glad to have you with us.</p>"
  },
  {
    id: "promotion",
    name: "Promotion",
    subject: "A Special Offer for You",
    body: "<p>Enjoy this limited-time promotion from the Modevin team.</p>"
  }
];

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fileExtension = (filename: string): string => {
  const extension = filename.split(".").pop();
  return extension ? `.${extension}` : "";
};

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const recipientPublicId = (accountType: "customer" | "admin", id: string): string =>
  `${accountType}:${id}`;

const parseRecipientId = (value: string): ParsedRecipientId => {
  const [accountType, id] = value.includes(":") ? value.split(":") : ["customer", value];
  return {
    accountType: accountType === "admin" ? "admin" : "customer",
    id: id ?? value
  };
};

const roleLabel = (roles: string[] | undefined, fallback: string): string => {
  if (!roles?.length) {
    return fallback;
  }
  return roles
    .map((role) =>
      role
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    )
    .join(", ");
};

const isRecipientSnapshot = (value: unknown): value is RecipientSnapshot => {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as RecipientSnapshot).id === "string" &&
    typeof (value as RecipientSnapshot).email === "string" &&
    ((value as RecipientSnapshot).accountType === "customer" ||
      (value as RecipientSnapshot).accountType === "admin")
  );
};

const serializeCampaign = (record: GeneratedApiRecordDocument) => ({
  id: record._id.toString(),
  status: record.status,
  data: record.data,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
});

export class BulkEmailService {
  public constructor(private readonly dependencies: BulkEmailServiceDependencies) {}

  public async listRecipients(input: BulkEmailRecipientsQueryInput): Promise<RecipientSnapshot[]> {
    const limit = input.limit ?? 50;
    const filter: Record<string, unknown> = {
      deletedAt: null,
      status: mongoose.trusted({ $ne: "deleted" })
    };
    if (input.q) {
      const pattern = new RegExp(escapeRegex(input.q), "i");
      filter.$or = [{ displayName: pattern }, { email: pattern }];
    }

    const [customers, admins] = await Promise.all([
      CustomerAccountModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("displayName email status emailVerified createdAt")
        .lean(),
      AdminAccountModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("displayName email status roles createdAt")
        .lean()
    ]);

    const recipientRecords: RecipientRecord[] = [
      ...customers.map((customer) => ({
        id: recipientPublicId("customer", customer._id.toString()),
        name: customer.displayName,
        email: customer.email,
        status:
          customer.status === "active" && !customer.emailVerified
            ? "TRIAL"
            : customer.status.toUpperCase(),
        role: "User",
        accountType: "customer" as const,
        createdAt: customer.createdAt
      })),
      ...admins.map((admin) => ({
        id: recipientPublicId("admin", admin._id.toString()),
        name: admin.displayName,
        email: admin.email,
        status: admin.status.toUpperCase(),
        role: roleLabel(admin.roles, "Admin"),
        accountType: "admin" as const,
        createdAt: admin.createdAt
      }))
    ];

    return recipientRecords
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
      .slice(0, limit)
      .map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        status: recipient.status,
        role: recipient.role,
        accountType: recipient.accountType
      }));
  }

  public async listTemplates() {
    const records = await GeneratedApiRecordModel.find({
      resource: "bulk-email-templates",
      deletedAt: null,
      status: mongoose.trusted({ $ne: "deleted" })
    }).sort({ createdAt: -1 });

    return [
      ...defaultTemplates,
      ...records.map((record) => ({
        id: record._id.toString(),
        name: stringValue(record.data.name, "Untitled Template"),
        subject: stringValue(record.data.subject),
        body: stringValue(record.data.body)
      }))
    ];
  }

  public async createCampaign(
    actorId: string,
    input: CreateBulkEmailCampaignInput,
    files: Express.Multer.File[]
  ) {
    const recipients = await this.resolveRecipients(input.recipientIds);
    const attachments = await Promise.all(files.map((file) => this.storeAttachment(file)));
    const record = await GeneratedApiRecordModel.create({
      resource: "bulk-email-campaigns",
      scope: { key: randomUUID() },
      data: {
        subject: input.subject,
        body: input.body,
        templateId: input.templateId ?? null,
        templateName: input.templateName ?? null,
        recipients,
        attachments,
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0
      },
      status: "draft",
      history: [
        {
          action: "bulk-email.campaign-created",
          actorId,
          actorType: "admin",
          at: new Date(),
          metadata: { recipientCount: recipients.length, attachmentCount: attachments.length }
        }
      ]
    });

    await this.dependencies.events.publish({
      type: "bulk-email.campaign-created",
      aggregateId: record._id.toString(),
      payload: { actorId, recipientCount: recipients.length }
    });

    return serializeCampaign(record);
  }

  public async sendCampaign(actorId: string, campaignId: string) {
    const campaign = await GeneratedApiRecordModel.findOne({
      _id: campaignId,
      resource: "bulk-email-campaigns",
      deletedAt: null
    });
    if (!campaign) {
      throw new ResourceNotFoundError("Bulk email campaign not found.");
    }
    if (campaign.status === "sent") {
      throw new ConflictError("This campaign has already been sent.");
    }
    if (campaign.status === "queued" || campaign.status === "sending") {
      throw new ConflictError("This campaign is already queued for sending.");
    }
    if (!this.dependencies.jobs?.isAvailable()) {
      throw new ConflictError("Email worker queue is unavailable.");
    }

    const recipients = Array.isArray(campaign.data.recipients)
      ? campaign.data.recipients.filter(isRecipientSnapshot)
      : [];
    if (recipients.length === 0) {
      throw new ConflictError("Campaign has no recipients.");
    }

    const queuedAt = new Date();
    campaign.status = "queued";
    campaign.data = {
      ...campaign.data,
      queuedAt: queuedAt.toISOString(),
      queuedBy: actorId,
      recipientCount: recipients.length
    };
    campaign.history.push({
      action: "bulk-email.campaign-queued",
      actorId,
      actorType: "admin",
      at: queuedAt,
      metadata: { recipientCount: recipients.length }
    });
    await campaign.save();

    await this.dependencies.jobs.publish({
      type: bulkEmailCampaignSendJobType,
      idempotencyKey: `${bulkEmailCampaignSendJobType}:${campaign._id.toString()}`,
      queue: {
        name: bulkEmailCampaignQueue,
        deadLetter: true
      },
      payload: {
        campaignId: campaign._id.toString(),
        actorId
      }
    });

    await this.dependencies.events.publish({
      type: "bulk-email.campaign-queued",
      aggregateId: campaign._id.toString(),
      payload: { actorId, recipientCount: recipients.length }
    });

    return serializeCampaign(campaign);
  }

  public async processQueuedCampaign(actorId: string, campaignId: string) {
    const campaign = await GeneratedApiRecordModel.findOne({
      _id: campaignId,
      resource: "bulk-email-campaigns",
      deletedAt: null
    });
    if (!campaign) {
      throw new ResourceNotFoundError("Bulk email campaign not found.");
    }
    if (campaign.status === "sent" || campaign.status === "failed") {
      return serializeCampaign(campaign);
    }
    if (campaign.status !== "queued" && campaign.status !== "draft") {
      throw new ConflictError("This campaign is not ready to be sent.");
    }

    const recipients = Array.isArray(campaign.data.recipients)
      ? campaign.data.recipients.filter(isRecipientSnapshot)
      : [];
    if (recipients.length === 0) {
      throw new ConflictError("Campaign has no recipients.");
    }

    const subject = stringValue(campaign.data.subject);
    const body = stringValue(campaign.data.body);
    const preparedEmail = this.prepareHtmlForEmail(
      this.withAttachmentLinks(body, campaign.data.attachments)
    );
    const sent: Array<{ recipientId: string; providerMessageId: string }> = [];
    const failed: Array<{ recipientId: string; email: string; reason: string }> = [];
    const startedAt = new Date();

    campaign.status = "sending";
    campaign.data = {
      ...campaign.data,
      startedAt: startedAt.toISOString()
    };
    campaign.history.push({
      action: "bulk-email.campaign-send-started",
      actorId,
      actorType: "admin",
      at: startedAt,
      metadata: { recipientCount: recipients.length }
    });
    await campaign.save();

    for (const recipient of recipients) {
      try {
        const result = await this.dependencies.email.send({
          to: recipient.email,
          subject,
          html: preparedEmail.html,
          text: stripHtml(preparedEmail.html),
          ...(preparedEmail.attachments ? { attachments: preparedEmail.attachments } : {})
        });
        sent.push({ recipientId: recipient.id, providerMessageId: result.providerMessageId });
      } catch (error) {
        failed.push({
          recipientId: recipient.id,
          email: recipient.email,
          reason: error instanceof Error ? error.message : "Unknown email send failure."
        });
      }
    }

    campaign.status = failed.length === recipients.length ? "failed" : "sent";
    campaign.data = {
      ...campaign.data,
      sentAt: new Date().toISOString(),
      sentCount: sent.length,
      failedCount: failed.length,
      sent,
      failed
    };
    campaign.history.push({
      action: "bulk-email.campaign-sent",
      actorId,
      actorType: "admin",
      at: new Date(),
      metadata: { sentCount: sent.length, failedCount: failed.length }
    });
    await campaign.save();

    await this.dependencies.events.publish({
      type: "bulk-email.campaign-sent",
      aggregateId: campaign._id.toString(),
      payload: { actorId, sentCount: sent.length, failedCount: failed.length }
    });

    return serializeCampaign(campaign);
  }

  public async recoverQueuedCampaigns(limit = 50) {
    const campaigns = await GeneratedApiRecordModel.find({
      resource: "bulk-email-campaigns",
      status: "queued",
      deletedAt: null
    })
      .sort({ updatedAt: 1 })
      .limit(limit)
      .select("_id data");

    for (const campaign of campaigns) {
      const actorId = stringValue(campaign.data.queuedBy, "worker");
      await this.processQueuedCampaign(actorId, campaign._id.toString());
    }

    return { recoveredCount: campaigns.length };
  }

  private async resolveRecipients(recipientIds: string[]): Promise<RecipientSnapshot[]> {
    const parsedIds = recipientIds.map(parseRecipientId);
    const customerIds = parsedIds
      .filter((recipient) => recipient.accountType === "customer")
      .map((recipient) => recipient.id);
    const adminIds = parsedIds
      .filter((recipient) => recipient.accountType === "admin")
      .map((recipient) => recipient.id);

    const [customers, admins] = await Promise.all([
      customerIds.length > 0
        ? CustomerAccountModel.find({
            _id: mongoose.trusted({ $in: customerIds }),
            deletedAt: null,
            status: mongoose.trusted({ $ne: "deleted" })
          }).select("displayName email status emailVerified")
        : [],
      adminIds.length > 0
        ? AdminAccountModel.find({
            _id: mongoose.trusted({ $in: adminIds }),
            deletedAt: null,
            status: mongoose.trusted({ $ne: "deleted" })
          }).select("displayName email status roles")
        : []
    ]);

    const recipients: RecipientSnapshot[] = [
      ...customers.map((customer) => ({
        id: recipientPublicId("customer", customer._id.toString()),
        name: customer.displayName,
        email: customer.email,
        status:
          customer.status === "active" && !customer.emailVerified
            ? "TRIAL"
            : customer.status.toUpperCase(),
        role: "User",
        accountType: "customer" as const
      })),
      ...admins.map((admin) => ({
        id: recipientPublicId("admin", admin._id.toString()),
        name: admin.displayName,
        email: admin.email,
        status: admin.status.toUpperCase(),
        role: roleLabel(admin.roles, "Admin"),
        accountType: "admin" as const
      }))
    ];
    if (recipients.length === 0) {
      throw new ConflictError("At least one valid recipient is required.");
    }
    return recipients;
  }

  private async storeAttachment(file: Express.Multer.File) {
    const key = `bulk-email/attachments/${randomUUID()}${fileExtension(file.originalname)}`;
    const url = await uploadObject({
      key,
      body: file.buffer,
      contentType: file.mimetype
    });
    return {
      filename: file.originalname,
      contentType: file.mimetype,
      size: file.size,
      key,
      url
    };
  }

  private prepareHtmlForEmail(body: string): {
    html: string;
    attachments?: Array<{ filename: string; content: Buffer; contentType: string; cid: string }>;
  } {
    const attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
      cid: string;
    }> = [];
    let imageIndex = 0;
    const html = body.replace(
      /src=(["'])data:(image\/(?:gif|jpe?g|png|webp));base64,([^"']+)\1/gi,
      (_match: string, quote: string, contentType: string, base64Content: string) => {
        const lowerContentType = contentType.toLowerCase();
        const normalizedContentType =
          lowerContentType === "image/jpg" ? "image/jpeg" : lowerContentType;
        const cid = `bulk-email-inline-${randomUUID()}@modevin`;
        imageIndex += 1;
        attachments.push({
          filename: `inline-image-${imageIndex}.${this.imageExtension(normalizedContentType)}`,
          content: Buffer.from(base64Content.replace(/\s/g, ""), "base64"),
          contentType: normalizedContentType,
          cid
        });
        return `src=${quote}cid:${cid}${quote}`;
      }
    );

    if (attachments.length === 0) {
      return { html };
    }
    return { html, attachments };
  }

  private imageExtension(contentType: string): string {
    if (contentType === "image/jpeg") {
      return "jpg";
    }
    return contentType.replace("image/", "");
  }

  private withAttachmentLinks(body: string, attachments: unknown): string {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return body;
    }
    const links = attachments
      .filter(
        (attachment): attachment is { filename: string; url: string } =>
          typeof attachment === "object" &&
          attachment !== null &&
          typeof (attachment as { filename?: unknown }).filename === "string" &&
          typeof (attachment as { url?: unknown }).url === "string"
      )
      .map((attachment) => `<li><a href="${attachment.url}">${attachment.filename}</a></li>`)
      .join("");
    if (!links) {
      return body;
    }
    return `${body}<hr><p><strong>Attachments</strong></p><ul>${links}</ul>`;
  }
}
