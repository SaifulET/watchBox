import { Types } from "mongoose";
import { z } from "zod";

const objectId = (label: string) =>
  z.string().refine((value) => Types.ObjectId.isValid(value), `Invalid ${label}.`);

export const reportReasons = [
  "spam",
  "scam",
  "harassment",
  "unprofessional",
  "fake-listing",
  "other"
] as const;

export const reportStatuses = ["pending", "resolved", "dismissed"] as const;

export const blockUserBodySchema = z.object({
  userId: objectId("user id")
});

export const blockedUserParamsSchema = z.object({
  userId: objectId("user id")
});

export const reportUserBodySchema = z
  .object({
    userId: objectId("user id").optional(),
    listingId: objectId("listing id").optional(),
    reason: z.enum(reportReasons),
    message: z.string().trim().max(5000).optional()
  })
  .refine((value) => Boolean(value.userId) || Boolean(value.listingId), {
    message: "Provide userId or listingId."
  });

export const listingReportParamsSchema = z.object({
  listingId: objectId("listing id")
});

export const reportParamsSchema = z.object({
  reportId: objectId("report id")
});

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.enum(reportStatuses).optional()
});

export const reportStatusBodySchema = z.object({
  status: z.enum(reportStatuses)
});

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const notificationParamsSchema = z.object({
  notificationId: objectId("notification id")
});

export type BlockUserBodyInput = z.infer<typeof blockUserBodySchema>;
export type ReportUserBodyInput = z.infer<typeof reportUserBodySchema>;
export type ReportListQueryInput = z.infer<typeof reportListQuerySchema>;
export type ReportStatusBodyInput = z.infer<typeof reportStatusBodySchema>;
export type NotificationListQueryInput = z.infer<typeof notificationListQuerySchema>;
