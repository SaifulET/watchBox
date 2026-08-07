import { z } from "zod";

export const watchAlertSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    query: z.string().trim().min(1).max(200),
    source: z.enum(["all", "local", "ebay"]).default("all"),
    eventTypes: z
      .array(z.enum(["price_drop", "new_watch", "search_update"]))
      .min(1)
      .default(["price_drop", "new_watch", "search_update"]),
    minDropPercentage: z.coerce.number().min(1).max(100).default(5),
    maxPrice: z.coerce.number().min(0).optional(),
    marketplaceId: z.string().trim().min(3).max(32).optional()
  })
  .strict();

export type WatchAlertInput = z.infer<typeof watchAlertSchema>;

export const watchAlertListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type WatchAlertListQuery = z.infer<typeof watchAlertListQuerySchema>;
