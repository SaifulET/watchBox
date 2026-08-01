import { z } from "zod";

export type ContentSlug = "terms" | "privacy-policy" | "about";

const slugAliases: Record<string, ContentSlug> = {
  terms: "terms",
  "terms-and-conditions": "terms",
  "terms-condition": "terms",
  "privacy-policy": "privacy-policy",
  privacy: "privacy-policy",
  about: "about",
  "about-us": "about"
};

export const normalizeContentSlug = (value: string): ContentSlug | undefined =>
  slugAliases[value.trim().toLowerCase()];

export const contentParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((value, ctx) => {
      const slug = normalizeContentSlug(value);
      if (!slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Content slug must be terms, privacy-policy, or about."
        });
        return z.NEVER;
      }
      return slug;
    })
});

export const contentUpsertBodySchema = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    content: z.string().trim().min(1).optional(),
    body: z.string().trim().min(1).optional(),
    summary: z.string().trim().max(500).optional(),
    seoTitle: z.string().trim().max(180).optional(),
    seoDescription: z.string().trim().max(300).optional(),
    status: z.enum(["draft", "active"]).optional()
  })
  .strict()
  .default({});

export type ContentParams = z.infer<typeof contentParamsSchema>;
export type ContentUpsertBody = z.infer<typeof contentUpsertBodySchema>;
