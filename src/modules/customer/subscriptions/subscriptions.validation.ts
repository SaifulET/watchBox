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

export const createSellerInvoiceSchema = z.object({
  listingId: z.string().trim().min(1).max(80),
  buyerName: z.string().trim().min(1).max(120),
  buyerEmail: z.string().trim().email().max(254),
  price: z.coerce.number().positive(),
  currency: z.string().trim().min(3).max(8).default("USD")
}).strict();

export type CreateSellerInvoiceInput = z.infer<typeof createSellerInvoiceSchema>;
