import { Types } from "mongoose";
import { z } from "zod";

const objectId = (label: string) =>
  z.string().refine((value) => Types.ObjectId.isValid(value), `Invalid ${label}.`);

export const chatListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional()
});

export const chatParamsSchema = z.object({
  chatId: objectId("chat id")
});

export const listingChatParamsSchema = z.object({
  listingId: objectId("listing id")
});

export const chatMessageBodySchema = z.object({
  message: z.string().trim().max(5000).optional()
});

export const openChatBodySchema = z
  .object({
    listingId: objectId("listing id").optional(),
    buyerId: objectId("buyer id").optional(),
    withAdmin: z.coerce.boolean().optional(),
    message: z.string().trim().max(5000).optional()
  })
  .refine((value) => Boolean(value.listingId) || value.withAdmin === true, {
    message: "Provide listingId or set withAdmin to true."
  });

export const adminOpenChatBodySchema = z
  .object({
    chatId: objectId("chat id").optional(),
    listingId: objectId("listing id").optional(),
    buyerId: objectId("buyer id").optional(),
    sellerId: objectId("seller id").optional(),
    customerId: objectId("customer id").optional(),
    message: z.string().trim().max(5000).optional()
  })
  .refine(
    (value) =>
      Boolean(value.chatId) ||
      Boolean(value.listingId) ||
      Boolean(value.customerId) ||
      Boolean(value.buyerId) ||
      Boolean(value.sellerId),
    {
      message: "Provide chatId, listingId, or a customer id."
    }
  );

export type ChatListQueryInput = z.infer<typeof chatListQuerySchema>;
export type ChatMessageBodyInput = z.infer<typeof chatMessageBodySchema>;
export type OpenChatBodyInput = z.infer<typeof openChatBodySchema>;
export type AdminOpenChatBodyInput = z.infer<typeof adminOpenChatBodySchema>;
