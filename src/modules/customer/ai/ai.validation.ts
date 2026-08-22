import { z } from "zod";

export const imageAnalysisBodySchema = z
  .object({
    imageUrl: z.string().url().optional(),
    modelVersion: z.string().trim().min(1).max(80).optional()
  })
  .strict()
  .default({});

export type ImageAnalysisBody = z.infer<typeof imageAnalysisBodySchema>;

export const aiSearchBodySchema = z
  .object({
    q: z.string().trim().min(1).max(160).optional(),
    keyword: z.string().trim().min(1).max(160).optional(),
    query: z.string().trim().min(1).max(160).optional(),
    search: z.string().trim().min(1).max(160).optional(),
    brand: z.string().trim().min(1).max(80).optional(),
    model: z.string().trim().min(1).max(120).optional(),
    referenceNumber: z.string().trim().min(2).max(80).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    priceMin: z.coerce.number().min(0).optional(),
    priceMax: z.coerce.number().min(0).optional(),
    listingStatus: z.enum(["active", "historical_sold", "historical sold", "sold"]).optional(),
    condition: z.enum(["new", "unworn", "very_good", "very good", "vintage"]).optional(),
    region: z.string().trim().min(2).max(80).optional(),
    imageUrl: z.string().url().optional(),
    modelVersion: z.string().trim().min(1).max(80).optional(),
    visualDepth: z.enum(["fast", "deep"]).optional(),
    candidateImageLimit: z.coerce.number().int().min(0).max(60).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    marketplaceId: z.string().trim().min(3).max(32).optional()
  })
  .strict()
  .default({});

export type AiSearchBody = z.infer<typeof aiSearchBodySchema>;
