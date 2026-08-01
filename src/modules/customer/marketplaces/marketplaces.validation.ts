import { z } from "zod";

export const ebaySearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(160),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  marketplaceId: z.string().trim().min(3).max(32).optional()
});

export type EbaySearchQuery = z.infer<typeof ebaySearchQuerySchema>;

export const ebayAnalyticsQuerySchema = z.object({
  q: z.string().trim().min(1).max(160),
  itemId: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(10).max(200).default(100),
  marketplaceId: z.string().trim().min(3).max(32).optional()
});

export type EbayAnalyticsQuery = z.infer<typeof ebayAnalyticsQuerySchema>;
