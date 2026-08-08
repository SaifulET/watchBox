import { z } from "zod";

export const ebaySearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(160),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  marketplaceId: z.string().trim().min(3).max(32).optional()
});

export type EbaySearchQuery = z.infer<typeof ebaySearchQuerySchema>;

export const ebayLocationSearchSchema = z
  .object({
    q: z.string().trim().min(1).max(160).optional(),
    query: z.string().trim().min(1).max(160).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    lan: z.coerce.number().min(-180).max(180).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(10),
    marketplaceId: z.string().trim().min(3).max(32).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    priceCurrency: z.string().trim().length(3).default("USD"),
    searchMode: z.enum(["delivery", "pickup"]).default("delivery"),
    pickupRadius: z.coerce.number().int().min(1).max(100).default(25),
    pickupRadiusUnit: z.enum(["mi", "km"]).default("mi")
  })
  .strict()
  .superRefine((value, context) => {
    if (typeof value.latitude !== "number" && typeof value.lat !== "number") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["latitude"],
        message: "Latitude is required."
      });
    }
    if (
      typeof value.longitude !== "number" &&
      typeof value.lng !== "number" &&
      typeof value.lon !== "number" &&
      typeof value.lan !== "number"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["longitude"],
        message: "Longitude is required."
      });
    }
    if (typeof value.minPrice === "number" && typeof value.maxPrice === "number" && value.minPrice > value.maxPrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minPrice"],
        message: "Minimum price cannot be greater than maximum price."
      });
    }
  })
  .transform((value) => ({
    q: value.q ?? value.query ?? "watch",
    latitude: value.latitude ?? value.lat ?? 0,
    longitude: value.longitude ?? value.lng ?? value.lon ?? value.lan ?? 0,
    limit: value.limit,
    marketplaceId: value.marketplaceId,
    minPrice: value.minPrice,
    maxPrice: value.maxPrice,
    priceCurrency: value.priceCurrency,
    searchMode: value.searchMode,
    pickupRadius: value.pickupRadius,
    pickupRadiusUnit: value.pickupRadiusUnit
  }));

export type EbayLocationSearchInput = z.infer<typeof ebayLocationSearchSchema>;

export const ebayAnalyticsQuerySchema = z.object({
  q: z.string().trim().min(1).max(160),
  itemId: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(10).max(200).default(100),
  marketplaceId: z.string().trim().min(3).max(32).optional()
});

export type EbayAnalyticsQuery = z.infer<typeof ebayAnalyticsQuerySchema>;

export const ebayMarketInsightsQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  sampleLimit: z.coerce.number().int().min(5).max(50).default(20),
  marketplaceId: z.string().trim().min(3).max(32).optional()
});

export type EbayMarketInsightsQuery = z.infer<typeof ebayMarketInsightsQuerySchema>;
