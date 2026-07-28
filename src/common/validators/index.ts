import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Expected a MongoDB ObjectId");
export const currencySchema = z.string().length(3).toUpperCase();
export const isoDateSchema = z.string().datetime({ offset: true });
export const emailSchema = z.string().email().max(320).toLowerCase();
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/\d/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a symbol");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  sort: z.string().max(64).default("-createdAt")
});

export const marketplaceCodeSchema = z.enum(["EBAY", "CHRONO24", "GRAILZEE"]);
