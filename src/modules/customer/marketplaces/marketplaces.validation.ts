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

export const ebaySellerVerificationQuerySchema = z
  .object({
    itemId: z.string().trim().min(1).max(120).optional(),
    sellerUsername: z.string().trim().min(1).max(64).optional(),
    q: z.string().trim().min(1).max(160).default("watch"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    marketplaceId: z.string().trim().min(3).max(32).optional()
  })
  .superRefine((value, context) => {
    if (!value.itemId && !value.sellerUsername) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itemId"],
        message: "Either itemId or sellerUsername is required."
      });
    }
  });

export type EbaySellerVerificationQuery = z.infer<typeof ebaySellerVerificationQuerySchema>;

export const ebayMarketInsightsQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  sampleLimit: z.coerce.number().int().min(5).max(50).default(20),
  marketplaceId: z.string().trim().min(3).max(32).optional()
});

export type EbayMarketInsightsQuery = z.infer<typeof ebayMarketInsightsQuerySchema>;

export const ebayShareListingParamsSchema = z.object({
  listingId: z.string().trim().min(1).max(120)
});

export const ebayShareListingBodySchema = z
  .object({
    sellerAccessToken: z.string().trim().min(1),
    sku: z.string().trim().min(1).max(80).optional(),
    categoryId: z.string().trim().min(1).max(32),
    merchantLocationKey: z.string().trim().min(1).max(64),
    fulfillmentPolicyId: z.string().trim().min(1).max(64),
    paymentPolicyId: z.string().trim().min(1).max(64),
    returnPolicyId: z.string().trim().min(1).max(64),
    marketplaceId: z.string().trim().min(3).max(32).optional(),
    condition: z.string().trim().min(1).max(64).default("USED_EXCELLENT"),
    quantity: z.coerce.number().int().min(1).max(999).default(1),
    price: z.coerce.number().positive().optional(),
    currency: z.string().trim().length(3).default("USD"),
    publish: z.boolean().default(true),
    listingDuration: z.string().trim().min(1).max(32).optional(),
    format: z.enum(["FIXED_PRICE", "AUCTION"]).default("FIXED_PRICE")
  })
  .strict();

export type EbayShareListingParams = z.infer<typeof ebayShareListingParamsSchema>;
export type EbayShareListingInput = z.infer<typeof ebayShareListingBodySchema>;
