import { z } from "zod";

const featureSchema = z.object({
  text: z.string().trim().min(1).max(160),
  active: z.boolean()
});

export const planParamsSchema = z.object({
  planId: z.string().trim().min(1).max(80)
});

export const promotionParamsSchema = z.object({
  promotionId: z.string().trim().min(1).max(80)
});

export const planBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.union([z.string(), z.number()]).transform((value) => String(value)),
  annualPrice: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? undefined : String(value))),
  isPopular: z.boolean().default(false),
  badge: z.string().trim().max(40).optional(),
  features: z.array(featureSchema).min(1).max(20)
});

export const planFeaturesBodySchema = z.object({
  features: z.array(featureSchema).min(1).max(20)
});

export const settingsBodySchema = z.object({
  trialPeriodDays: z.coerce.number().int().min(0).max(365),
  autoRenewal: z.boolean()
});

export const promotionBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((value) => value.toUpperCase()),
  discountType: z.enum(["percentage", "fixed"]).default("percentage"),
  discountValue: z.coerce.number().positive().max(100000),
  duration: z.string().trim().min(1).max(80),
  planIds: z.array(z.string().trim().min(1).max(80)).min(1),
  expiresAt: z.string().datetime().optional()
});

export type PlanBodyInput = z.infer<typeof planBodySchema>;
export type PlanFeaturesBodyInput = z.infer<typeof planFeaturesBodySchema>;
export type SettingsBodyInput = z.infer<typeof settingsBodySchema>;
export type PromotionBodyInput = z.infer<typeof promotionBodySchema>;
