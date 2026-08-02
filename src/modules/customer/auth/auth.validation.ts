import { z } from "zod";

const email = z.string().trim().email().transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const token = z.string().min(32).max(2048);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Expected a MongoDB ObjectId.");

export const registerSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(2).max(120)
});

const adminAccessValue = z.string().trim().min(1).max(120);

export const adminRegisterSchema = registerSchema
  .extend({
    permissions: z.array(adminAccessValue).max(100).optional(),
    roles: z.array(adminAccessValue).max(50).optional()
  })
  .strict();

export const loginSchema = z.object({
  email,
  password
});

export const refreshSchema = z.object({
  refreshToken: token
});

export const verifyEmailRequestSchema = z.object({
  email
});

export const verifyEmailConfirmSchema = z.object({
  token
});

export const forgotPasswordSchema = z.object({
  email
});

export const resetPasswordSchema = z
  .object({
    token,
    newPassword: password,
    confirmPassword: password
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

export const changePasswordSchema = z.object({
  currentPassword: password,
  newPassword: password
});

export const sessionParamsSchema = z.object({
  sessionId: objectId
});

export const adminMfaVerifySchema = z.object({
  code: z.string().trim().min(6).max(64)
});

export const adminMfaChallengeSchema = z.object({
  email
});

export const adminVerifyResetCodeSchema = z.object({
  token
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type VerifyEmailRequestInput = z.infer<typeof verifyEmailRequestSchema>;
export type VerifyEmailConfirmInput = z.infer<typeof verifyEmailConfirmSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SessionParamsInput = z.infer<typeof sessionParamsSchema>;
export type AdminMfaVerifyInput = z.infer<typeof adminMfaVerifySchema>;
export type AdminMfaChallengeInput = z.infer<typeof adminMfaChallengeSchema>;
export type AdminVerifyResetCodeInput = z.infer<typeof adminVerifyResetCodeSchema>;
