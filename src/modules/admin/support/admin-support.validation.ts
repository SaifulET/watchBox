import { Types } from "mongoose";
import { z } from "zod";

export const adminSupportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional()
});

export const adminSupportParamsSchema = z.object({
  ticketId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid ticket id.")
});

export const adminSupportReplySchema = z.object({
  message: z.string().trim().max(5000).optional()
});

export type AdminSupportQueryInput = z.infer<typeof adminSupportQuerySchema>;
export type AdminSupportReplyInput = z.infer<typeof adminSupportReplySchema>;
