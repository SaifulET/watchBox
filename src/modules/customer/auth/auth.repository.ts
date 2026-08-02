import mongoose, { type FilterQuery, type Types, type UpdateQuery } from "mongoose";
import {
  AccountTokenModel,
  AdminAccountModel,
  AuthSessionModel,
  CustomerAccountModel,
  type AccountToken,
  type AccountTokenDocument,
  type AdminAccount,
  type AdminAccountDocument,
  type AuthSession,
  type AuthSessionDocument,
  type CustomerAccount,
  type CustomerAccountDocument
} from "./auth.model.js";
import type { AccountKind, AccountTokenPurpose } from "./auth.types.js";

export class CustomerAccountRepository {
  public create(input: Pick<CustomerAccount, "email" | "passwordHash" | "displayName">) {
    return CustomerAccountModel.create(input);
  }

  public findByEmail(email: string) {
    return CustomerAccountModel.findOne({ email: email.toLowerCase(), deletedAt: null });
  }

  public findById(id: string | Types.ObjectId) {
    return CustomerAccountModel.findOne({ _id: id, deletedAt: null });
  }

  public async updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<CustomerAccount>
  ): Promise<CustomerAccountDocument | null> {
    return CustomerAccountModel.findByIdAndUpdate(id, update, { new: true });
  }
}

export class AdminAccountRepository {
  public create(
    input: Pick<AdminAccount, "email" | "passwordHash" | "displayName" | "permissions" | "roles">
  ) {
    return AdminAccountModel.create(input);
  }

  public async hasActiveAdmin(): Promise<boolean> {
    const existing = await AdminAccountModel.exists({ deletedAt: null });
    return Boolean(existing);
  }

  public findByEmail(email: string) {
    return AdminAccountModel.findOne({ email: email.toLowerCase(), deletedAt: null });
  }

  public findById(id: string | Types.ObjectId) {
    return AdminAccountModel.findOne({ _id: id, deletedAt: null });
  }

  public async updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<AdminAccount>
  ): Promise<AdminAccountDocument | null> {
    return AdminAccountModel.findByIdAndUpdate(id, update, { new: true });
  }
}

export class AuthSessionRepository {
  public create(input: Omit<AuthSession, "createdAt" | "updatedAt">) {
    return AuthSessionModel.create(input);
  }

  public findActiveById(id: string | Types.ObjectId, accountKind: AccountKind) {
    return AuthSessionModel.findOne({
      _id: id,
      accountKind,
      revokedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() })
    });
  }

  public findActiveByAccount(accountId: string | Types.ObjectId, accountKind: AccountKind) {
    return AuthSessionModel.find({
      accountId,
      accountKind,
      revokedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() })
    }).sort({ createdAt: -1 });
  }

  public findActiveByRefreshHash(refreshTokenHash: string, accountKind: AccountKind) {
    return AuthSessionModel.findOne({
      refreshTokenHash,
      accountKind,
      revokedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() })
    });
  }

  public async rotateRefreshToken(
    sessionId: string | Types.ObjectId,
    refreshTokenHash: string,
    expiresAt: Date
  ): Promise<AuthSessionDocument | null> {
    return AuthSessionModel.findByIdAndUpdate(
      sessionId,
      { $set: { refreshTokenHash, expiresAt }, $unset: { reuseDetectedAt: "" } },
      { new: true }
    );
  }

  public async revokeById(sessionId: string | Types.ObjectId): Promise<void> {
    await AuthSessionModel.updateOne(
      { _id: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  public async revokeAll(accountId: string | Types.ObjectId, accountKind: AccountKind): Promise<void> {
    await AuthSessionModel.updateMany(
      { accountId, accountKind, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  public async markReuse(sessionId: string | Types.ObjectId): Promise<void> {
    const now = new Date();
    await AuthSessionModel.updateOne(
      { _id: sessionId },
      { $set: { reuseDetectedAt: now, revokedAt: now } }
    );
  }
}

export class AccountTokenRepository {
  public async create(input: Omit<AccountToken, "createdAt" | "updatedAt">) {
    return AccountTokenModel.create(input);
  }

  public async consumeActive(
    accountKind: AccountKind,
    purpose: AccountTokenPurpose,
    tokenHash: string
  ): Promise<AccountTokenDocument | null> {
    const token = await AccountTokenModel.findOne({
      accountKind,
      purpose,
      tokenHash,
      consumedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() })
    });
    if (!token) {
      return null;
    }
    token.consumedAt = new Date();
    await token.save();
    return token;
  }

  public async removeActiveForAccount(
    accountKind: AccountKind,
    accountId: string | Types.ObjectId,
    purpose: AccountTokenPurpose
  ): Promise<void> {
    await AccountTokenModel.deleteMany({
      accountKind,
      accountId,
      purpose,
      consumedAt: null
    });
  }

  public findOne(filter: FilterQuery<AccountToken>) {
    return AccountTokenModel.findOne(filter);
  }
}

export type AccountDocument = CustomerAccountDocument | AdminAccountDocument;
