import { z } from "zod";

export const earningsTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(["All Users", "Internal"]).optional(),
  subscription: z.string().trim().max(80).optional(),
  q: z.string().trim().max(120).optional()
});

export const earningsTransactionParamsSchema = z.object({
  transactionId: z.string().trim().min(1).max(160)
});

export const earningsRefundParamsSchema = z.object({
  paymentId: z.string().trim().min(1).max(160)
});

export type EarningsTransactionsQueryInput = z.infer<typeof earningsTransactionsQuerySchema>;
