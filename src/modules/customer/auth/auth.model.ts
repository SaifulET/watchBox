import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import type { AccountKind, AccountStatus, AccountTokenPurpose } from "./auth.types.js";

export type CustomerAccount = {
  email: string;
  passwordHash: string;
  displayName: string;
  status: AccountStatus;
  emailVerified: boolean;
  darkMode: boolean;
  notificationPreferences: {
    emailAlerts: boolean;
  };
  phone?: string;
  country?: string;
  avatarKey?: string;
  avatarUrl?: string;
  preferences: {
    currency: string;
  };
  lastLoginAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminAccount = {
  email: string;
  passwordHash: string;
  displayName: string;
  status: AccountStatus;
  permissions: string[];
  roles: string[];
  mfaEnabled: boolean;
  avatarKey?: string;
  avatarUrl?: string;
  lastLoginAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthSession = {
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

export type AccountToken = {
  accountId: Types.ObjectId;
  accountKind: AccountKind;
  purpose: AccountTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const customerAccountSchema = new Schema<CustomerAccount>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended", "deleted"], default: "active", index: true },
    emailVerified: { type: Boolean, default: false },
    darkMode: { type: Boolean, default: false },
    notificationPreferences: {
      emailAlerts: { type: Boolean, default: true }
    },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
    avatarKey: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    preferences: {
      currency: { type: String, default: "USD" }
    },
    lastLoginAt: Date,
    deletedAt: Date
  },
  { timestamps: true }
);
customerAccountSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null }
  }
);

const adminAccountSchema = new Schema<AdminAccount>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended", "deleted"], default: "active", index: true },
    permissions: { type: [String], default: [] },
    roles: { type: [String], default: [] },
    mfaEnabled: { type: Boolean, default: false },
    avatarKey: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    lastLoginAt: Date,
    deletedAt: Date
  },
  { timestamps: true }
);
adminAccountSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null }
  }
);

const authSessionSchema = new Schema<AuthSession>(
  {
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    accountKind: { type: String, enum: ["customer", "admin"], required: true, index: true },
    refreshTokenHash: { type: String, required: true, index: true },
    ipAddress: String,
    userAgent: String,
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: Date,
    reuseDetectedAt: Date
  },
  { timestamps: true }
);
authSessionSchema.index({ accountKind: 1, accountId: 1, revokedAt: 1 });

const accountTokenSchema = new Schema<AccountToken>(
  {
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    accountKind: { type: String, enum: ["customer", "admin"], required: true, index: true },
    purpose: {
      type: String,
      enum: ["email-verification", "password-reset", "admin-password-reset", "admin-mfa"],
      required: true,
      index: true
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    consumedAt: Date,
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export type CustomerAccountDocument = HydratedDocument<CustomerAccount>;
export type AdminAccountDocument = HydratedDocument<AdminAccount>;
export type AuthSessionDocument = HydratedDocument<AuthSession>;
export type AccountTokenDocument = HydratedDocument<AccountToken>;

export const CustomerAccountModel: Model<CustomerAccount> =
  mongoose.models.CustomerAccount ??
  mongoose.model<CustomerAccount>("CustomerAccount", customerAccountSchema);

export const AdminAccountModel: Model<AdminAccount> =
  mongoose.models.AdminAccount ?? mongoose.model<AdminAccount>("AdminAccount", adminAccountSchema);

export const AuthSessionModel: Model<AuthSession> =
  mongoose.models.AuthSession ?? mongoose.model<AuthSession>("AuthSession", authSessionSchema);

export const AccountTokenModel: Model<AccountToken> =
  mongoose.models.AccountToken ?? mongoose.model<AccountToken>("AccountToken", accountTokenSchema);
