import { z } from "zod";

const email = z.string().trim().email().transform((value) => value.toLowerCase());

export const publicContactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email,
    subject: z.string().trim().min(3).max(180),
    message: z.string().trim().min(10).max(4000)
  })
  .strict();

export const publicAccountDeletionSchema = z
  .object({
    email,
    password: z.string().min(8).max(128),
    confirmation: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => value === "DELETE", {
        message: "Type DELETE to confirm account deletion."
      })
  })
  .strict();

export type PublicContactInput = z.infer<typeof publicContactSchema>;
export type PublicAccountDeletionInput = z.infer<typeof publicAccountDeletionSchema>;
