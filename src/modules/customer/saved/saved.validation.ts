import { z } from "zod";

export const savedProductSchema = z
  .object({
    source: z.enum(["local", "ebay"]),
    id: z.string().trim().min(1).max(160).optional(),
    productId: z.string().trim().min(1).max(160).optional(),
    listName: z.string().trim().min(1).max(80).default("default"),
    title: z.string().trim().min(1).max(300).optional(),
    brand: z.string().trim().min(1).max(120).optional(),
    price: z.coerce.number().min(0).optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    image: z.string().trim().min(1).max(1000).optional(),
    region: z.string().trim().min(1).max(120).optional()
  })
  .strict()
  .refine((value) => Boolean(value.id || value.productId), {
    message: "Provide id or productId."
  });

export type SavedProductInput = z.infer<typeof savedProductSchema>;

export const savedSearchSchema = z
  .object({
    searchId: z.string().trim().min(1).max(120).optional(),
    query: z.string().trim().min(1).max(200).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    name: z.string().trim().min(1).max(120).optional()
  })
  .strict()
  .refine((value) => Boolean(value.searchId || value.query), {
    message: "Provide searchId or query."
  });

export type SavedSearchInput = z.infer<typeof savedSearchSchema>;

export const savedListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type SavedListQuery = z.infer<typeof savedListQuerySchema>;

export const recommendationsQuerySchema = z.object({
  searchId: z.string().trim().min(1).max(120).optional()
});

export type RecommendationsQuery = z.infer<typeof recommendationsQuerySchema>;
