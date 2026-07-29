import { z } from "zod";

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().min(3).max(40).optional(),
    country: z.string().trim().min(2).max(80).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required.");

export const updatePreferencesSchema = z
  .object({
    currency: z.string().trim().length(3).toUpperCase().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one preference field is required.");

export const confirmAvatarSchema = z.object({
  avatarKey: z.string().trim().min(8).max(512)
});

export const updateDarkModeSchema = z
  .object({
    darkMode: z.boolean()
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type ConfirmAvatarInput = z.infer<typeof confirmAvatarSchema>;
export type UpdateDarkModeInput = z.infer<typeof updateDarkModeSchema>;
