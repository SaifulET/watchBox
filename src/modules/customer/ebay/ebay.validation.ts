import { z } from "zod";

export const ebayConnectQuerySchema = z.object({
  response: z.enum(["json"]).optional()
});

export const ebayOAuthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().min(1),
  expires_in: z.string().optional()
});

export const ebayOAuthDeclinedQuerySchema = z.object({
  state: z.string().trim().min(1).optional(),
  error: z.string().trim().optional(),
  error_description: z.string().trim().optional()
});

export const publishToEbayParamsSchema = z.object({
  listingId: z.string().trim().min(1).max(120)
});

export const publishToEbayBodySchema = z
  .object({
    publish: z.boolean().default(true)
  })
  .strict();

export type EbayConnectQuery = z.infer<typeof ebayConnectQuerySchema>;
export type EbayOAuthCallbackQuery = z.infer<typeof ebayOAuthCallbackQuerySchema>;
export type EbayOAuthDeclinedQuery = z.infer<typeof ebayOAuthDeclinedQuerySchema>;
export type PublishToEbayInput = z.infer<typeof publishToEbayBodySchema>;

const bareStateKey = (query: Record<string, unknown>): string | undefined =>
  Object.entries(query).find(([key, value]) => key.includes(".") && value === "")?.[0];

export const parseEbayOAuthCallbackQuery = (query: unknown): EbayOAuthCallbackQuery => {
  const parsed = ebayOAuthCallbackQuerySchema.safeParse(query);
  if (parsed.success) {
    return parsed.data;
  }
  if (typeof query === "object" && query !== null && !Array.isArray(query)) {
    const candidate = query as Record<string, unknown>;
    if (!candidate.state) {
      const state = bareStateKey(candidate);
      if (state) {
        return ebayOAuthCallbackQuerySchema.parse({
          ...candidate,
          state
        });
      }
    }
  }
  return ebayOAuthCallbackQuerySchema.parse(query);
};
