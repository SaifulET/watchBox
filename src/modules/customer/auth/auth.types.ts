import type { Types } from "mongoose";

export type AccountKind = "customer" | "admin";
export type AccountStatus = "active" | "suspended" | "deleted";
export type SessionStatus = "active" | "revoked";
export type AccountTokenPurpose =
  | "email-verification"
  | "password-reset"
  | "admin-password-reset"
  | "admin-mfa";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export type SessionDocumentShape = {
  _id: Types.ObjectId;
  accountId: Types.ObjectId;
  accountKind: AccountKind;
  refreshTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  revokedAt?: Date;
  reuseDetectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
