import { z } from "zod";

export const createOrderSchema = z
  .object({
    listingId: z.string().trim().min(1).max(120),
    quantity: z.coerce.number().int().min(1).max(1).default(1)
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const createProductPaymentIntentSchema = z
  .object({
    quantity: z.coerce.number().int().min(1).max(1).default(1)
  })
  .strict()
  .default({});

export type CreateProductPaymentIntentInput = z.infer<typeof createProductPaymentIntentSchema>;

export const paymentIntentSchema = z.object({}).strict().default({});

export type PaymentIntentInput = z.infer<typeof paymentIntentSchema>;

export const confirmPaymentSchema = z
  .object({
    paymentIntentId: z.string().trim().min(1).max(160).optional()
  })
  .strict()
  .default({});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
