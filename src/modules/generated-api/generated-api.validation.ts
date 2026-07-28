import { z } from "zod";

const primitiveQuery = z.union([z.string(), z.array(z.string()), z.undefined()]);

export const generatedParamsSchema = z.record(z.string().trim().min(1));

export const generatedQuerySchema = z.record(primitiveQuery);

export const generatedBodySchema = z
  .record(z.unknown())
  .refine((value) => !Array.isArray(value), "Request body must be an object.");
