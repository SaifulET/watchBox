import { Types } from "mongoose";
import { z } from "zod";

const jsonArray = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const recipientId = z.string().refine((value) => {
  if (Types.ObjectId.isValid(value)) {
    return true;
  }
  const [accountType, accountId] = value.split(":");
  return ["customer", "admin"].includes(accountType ?? "") && Types.ObjectId.isValid(accountId ?? "");
}, "Invalid recipient id.");

export const bulkEmailRecipientsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional()
});

export const createBulkEmailCampaignSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  templateId: z.string().trim().max(120).optional(),
  templateName: z.string().trim().max(120).optional(),
  recipientIds: z.preprocess(jsonArray, z.array(recipientId).min(1).max(500))
});

export const bulkEmailCampaignParamsSchema = z.object({
  campaignId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid campaign id.")
});

export type BulkEmailRecipientsQueryInput = z.infer<typeof bulkEmailRecipientsQuerySchema>;
export type CreateBulkEmailCampaignInput = z.infer<typeof createBulkEmailCampaignSchema>;
