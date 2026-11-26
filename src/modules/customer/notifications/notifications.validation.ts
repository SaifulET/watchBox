import { Types } from "mongoose";
import { z } from "zod";

export const customerNotificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        return ["1", "true", "yes"].includes(value.toLowerCase());
      }
      return false;
    })
});

export const customerNotificationParamsSchema = z.object({
  notificationId: z
    .string()
    .trim()
    .refine((value) => Types.ObjectId.isValid(value), "Invalid notification id.")
});

export type CustomerNotificationListQueryInput = z.infer<typeof customerNotificationListQuerySchema>;
