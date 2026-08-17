import { z } from "zod";

const optionalTrimmed = (max = 160) => z.string().trim().min(1).max(max).optional();

export const chrono24SearchQuerySchema = z
  .object({
    q: optionalTrimmed(),
    query: optionalTrimmed(),
    keyword: optionalTrimmed(),
    search: optionalTrimmed(),
    brand: optionalTrimmed(80),
    model: optionalTrimmed(80),
    reference: optionalTrimmed(80),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    condition: optionalTrimmed(80),
    year: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
    country: optionalTrimmed(2),
    sort: z.enum(["relevance", "price_asc", "price_desc", "newest"]).optional(),
    refresh: z.coerce.boolean().default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(24)
  })
  .superRefine((value, context) => {
    if (typeof value.minPrice === "number" && typeof value.maxPrice === "number" && value.minPrice > value.maxPrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minPrice"],
        message: "Minimum price cannot be greater than maximum price."
      });
    }
  })
  .transform((value) => ({
    q: value.q ?? value.query ?? value.keyword ?? value.search,
    brand: value.brand,
    model: value.model,
    reference: value.reference,
    minPrice: value.minPrice,
    maxPrice: value.maxPrice,
    condition: value.condition,
    year: value.year,
    country: value.country,
    sort: value.sort,
    refresh: value.refresh,
    page: value.page,
    limit: value.limit
  }));

export type Chrono24SearchQueryInput = z.infer<typeof chrono24SearchQuerySchema>;

export const chrono24SearchBodySchema = z
  .object({
    q: optionalTrimmed(),
    query: optionalTrimmed(),
    keyword: optionalTrimmed(),
    search: optionalTrimmed(),
    brand: optionalTrimmed(80),
    model: optionalTrimmed(80),
    reference: optionalTrimmed(80),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    condition: optionalTrimmed(80),
    year: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
    country: optionalTrimmed(2),
    sort: z.enum(["relevance", "price_asc", "price_desc", "newest"]).optional(),
    refresh: z.coerce.boolean().default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(24),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    lan: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).optional(),
    imageUrl: z.string().url().optional(),
    modelVersion: optionalTrimmed(80),
    productId: optionalTrimmed(500),
    id: optionalTrimmed(500),
    listingId: optionalTrimmed(500),
    includeItemDetails: z.coerce.boolean().default(true),
    includeMarketDetails: z.coerce.boolean().default(true)
  })
  .strict()
  .superRefine((value, context) => {
    if (typeof value.minPrice === "number" && typeof value.maxPrice === "number" && value.minPrice > value.maxPrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minPrice"],
        message: "Minimum price cannot be greater than maximum price."
      });
    }
  })
  .transform((value) => ({
    q: value.q ?? value.query ?? value.keyword ?? value.search,
    brand: value.brand,
    model: value.model,
    reference: value.reference,
    minPrice: value.minPrice,
    maxPrice: value.maxPrice,
    condition: value.condition,
    year: value.year,
    country: value.country,
    sort: value.sort,
    refresh: value.refresh,
    page: value.page,
    limit: value.limit,
    latitude: value.latitude ?? value.lat,
    longitude: value.longitude ?? value.lng ?? value.lon ?? value.lan,
    radiusKm: value.radiusKm,
    imageUrl: value.imageUrl,
    modelVersion: value.modelVersion,
    productId: value.productId ?? value.id ?? value.listingId,
    includeItemDetails: value.includeItemDetails,
    includeMarketDetails: value.includeMarketDetails
  }));

export type Chrono24SearchBodyInput = z.infer<typeof chrono24SearchBodySchema>;

export const chrono24ProductParamsSchema = z.object({
  id: z.string().trim().min(1).max(500)
});

export const chrono24AnalyticsQuerySchema = z.object({
  brand: optionalTrimmed(80),
  model: optionalTrimmed(80),
  reference: optionalTrimmed(80)
});

export const chrono24LocationSearchSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    lan: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).default(5),
    q: optionalTrimmed(),
    query: optionalTrimmed(),
    keyword: optionalTrimmed(),
    search: optionalTrimmed(),
    brand: optionalTrimmed(80),
    model: optionalTrimmed(80),
    reference: optionalTrimmed(80)
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
  })
  .transform((value) => ({
    latitude: value.latitude ?? value.lat ?? 0,
    longitude: value.longitude ?? value.lng ?? value.lon ?? value.lan ?? 0,
    radiusKm: value.radiusKm,
    q: value.q ?? value.query ?? value.keyword ?? value.search,
    brand: value.brand,
    model: value.model,
    reference: value.reference
  }));

export type Chrono24LocationSearchBody = z.infer<typeof chrono24LocationSearchSchema>;
