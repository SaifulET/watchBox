import { z } from "zod";

const queryCoordinate = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.coerce.number()
);

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

export const avatarUploadUrlSchema = z
  .object({
    contentType: z
      .enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
      .default("image/jpeg"),
    fileName: z.string().trim().min(1).max(180).optional()
  })
  .strict()
  .default({});

export const confirmAvatarSchema = z.object({
  avatarKey: z.string().trim().min(8).max(512)
});

export const updateDarkModeSchema = z
  .object({
    darkMode: z.boolean()
  })
  .strict();

export const nearbyUsersQuerySchema = z
  .object({
    latitude: queryCoordinate.optional(),
    longitude: queryCoordinate.optional(),
    lat: queryCoordinate.optional(),
    lng: queryCoordinate.optional(),
    lan: queryCoordinate.optional()
  })
  .superRefine((value, ctx) => {
    if (value.latitude === undefined && value.lat === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lat"],
        message: "Latitude is required."
      });
    }
    if (value.longitude === undefined && value.lng === undefined && value.lan === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lng"],
        message: "Longitude is required."
      });
    }
  })
  .transform((value) => ({
    latitude: (value.latitude ?? value.lat) as number,
    longitude: (value.longitude ?? value.lng ?? value.lan) as number
  }))
  .pipe(
    z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180)
    })
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type AvatarUploadUrlInput = z.infer<typeof avatarUploadUrlSchema>;
export type ConfirmAvatarInput = z.infer<typeof confirmAvatarSchema>;
export type UpdateDarkModeInput = z.infer<typeof updateDarkModeSchema>;
export type NearbyUsersQueryInput = z.infer<typeof nearbyUsersQuerySchema>;
