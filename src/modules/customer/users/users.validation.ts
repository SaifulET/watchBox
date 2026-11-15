import { z } from "zod";

const queryCoordinate = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.coerce.number()
);

const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const blankToUndefined = (value: unknown): unknown => {
  const first = firstValue(value);
  if (first === null) {
    return undefined;
  }
  if (typeof first === "string" && first.trim() === "") {
    return undefined;
  }
  return first;
};

const optionalText = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().min(min).max(max).optional());

const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().min(min).max(max).optional());

const profileAliases: Record<string, string[]> = {
  displayName: ["displayName", "display_name", "name", "fullName", "full_name", "username", "userName"],
  phone: ["phone", "phoneNumber", "phone_number", "mobile", "mobileNumber"],
  country: ["country", "countryName", "country_name"],
  avatarUrl: ["avatarUrl", "avatar_url", "profileImageUrl", "imageUrl"],
  avatarKey: ["avatarKey", "avatar_key"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon", "lan"]
};

const normalizeProfileBody = (value: unknown): Record<string, unknown> => {
  const body =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const location =
    typeof body.location === "object" && body.location !== null && !Array.isArray(body.location)
      ? (body.location as Record<string, unknown>)
      : {};
  const normalized: Record<string, unknown> = {};
  for (const [field, aliases] of Object.entries(profileAliases)) {
    for (const alias of aliases) {
      const candidate = blankToUndefined(body[alias] ?? location[alias]);
      if (candidate !== undefined) {
        normalized[field] = candidate;
        break;
      }
    }
  }
  return normalized;
};

export const updateProfileSchema = z.preprocess(
  normalizeProfileBody,
  z
    .object({
      displayName: optionalText(2, 120),
      phone: optionalText(3, 40),
      country: optionalText(2, 80),
      avatarUrl: optionalText(1, 2048),
      avatarKey: optionalText(1, 512),
      latitude: optionalCoordinate(-90, 90),
      longitude: optionalCoordinate(-180, 180)
    })
    .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
      path: ["latitude"],
      message: "Latitude and longitude must be sent together."
    })
);

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
