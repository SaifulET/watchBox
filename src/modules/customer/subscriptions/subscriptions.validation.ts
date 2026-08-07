import { z } from "zod";

export const checkoutSchema = z
  .object({
    plan: z.enum(["elite_collector"]).default("elite_collector"),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional()
  })
  .strict()
  .default({});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const portalSchema = z
  .object({
    returnUrl: z.string().url().optional()
  })
  .strict()
  .default({});

export type PortalInput = z.infer<typeof portalSchema>;
