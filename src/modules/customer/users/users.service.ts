import { randomUUID } from "node:crypto";
import { ResourceNotFoundError } from "../../../common/errors/app-error.js";
import type { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import { getStorageConfig } from "../../../config/storage.config.js";
import {
  AuthSessionRepository,
  CustomerAccountRepository
} from "../auth/auth.repository.js";
import type { CustomerAccountDocument } from "../auth/auth.model.js";
import type {
  ConfirmAvatarInput,
  UpdatePreferencesInput,
  UpdateProfileInput
} from "./users.validation.js";
import { UserRepository } from "./users.repository.js";
import type { CustomerProfile, CustomerStats } from "./users.types.js";

type UserServiceDependencies = {
  events: DomainEventPublisher;
  users?: UserRepository;
  sessions?: AuthSessionRepository;
  customers?: CustomerAccountRepository;
};

const serializeProfile = (account: CustomerAccountDocument): CustomerProfile => {
  const profile: CustomerProfile = {
    id: account._id.toString(),
    email: account.email,
    displayName: account.displayName,
    status: account.status,
    emailVerified: account.emailVerified,
    preferences: account.preferences,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString()
  };
  if (account.phone) {
    profile.phone = account.phone;
  }
  if (account.country) {
    profile.country = account.country;
  }
  if (account.avatarKey) {
    profile.avatarKey = account.avatarKey;
  }
  return profile;
};

export class UserService {
  private readonly users: UserRepository;
  private readonly sessions: AuthSessionRepository;
  private readonly customers: CustomerAccountRepository;

  public constructor(private readonly dependencies: UserServiceDependencies) {
    this.users = dependencies.users ?? new UserRepository();
    this.sessions = dependencies.sessions ?? new AuthSessionRepository();
    this.customers = dependencies.customers ?? new CustomerAccountRepository();
  }

  public async getMe(userId: string): Promise<CustomerProfile> {
    const account = await this.requireAccount(userId);
    return serializeProfile(account);
  }

  public async updateMe(userId: string, input: UpdateProfileInput): Promise<CustomerProfile> {
    const updated = await this.users.updateById(userId, { $set: input });
    if (!updated) {
      throw new ResourceNotFoundError("User profile not found.");
    }
    await this.publish("customer.profile-updated", userId, { fields: Object.keys(input) });
    return serializeProfile(updated);
  }

  public async deleteMe(userId: string): Promise<{ deleted: true }> {
    await this.requireAccount(userId);
    await this.users.softDelete(userId);
    await this.sessions.revokeAll(userId, "customer");
    await this.publish("customer.deleted", userId, {});
    return { deleted: true };
  }

  public async getActivity(userId: string) {
    const account = await this.requireAccount(userId);
    const [activeSessions, recentSessions] = await Promise.all([
      this.users.countActiveSessions(userId),
      this.users.listRecentSessions(userId, 10)
    ]);
    return {
      lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
      activeSessions,
      recentSessions: recentSessions.map((session) => ({
        id: session._id.toString(),
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
        revoked: Boolean(session.revokedAt),
        createdAt: session.createdAt.toISOString()
      }))
    };
  }

  public async getStats(userId: string): Promise<CustomerStats> {
    await this.requireAccount(userId);
    const [listings, orders, savedSearches, watchlists] = await Promise.all([
      this.users.countOwnedDocuments("listings", userId),
      this.users.countOwnedDocuments("orders", userId),
      this.users.countOwnedDocuments("savedsearches", userId),
      this.users.countOwnedDocuments("watchlists", userId)
    ]);
    return { listings, orders, savedSearches, watchlists };
  }

  public async getPreferences(userId: string): Promise<CustomerProfile["preferences"]> {
    const account = await this.requireAccount(userId);
    return account.preferences;
  }

  public async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput
  ): Promise<CustomerProfile["preferences"]> {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      update[`preferences.${key}`] = value;
    }
    const updated = await this.users.updateById(userId, { $set: update });
    if (!updated) {
      throw new ResourceNotFoundError("User profile not found.");
    }
    await this.publish("customer.preferences-updated", userId, { fields: Object.keys(input) });
    return updated.preferences;
  }

  public async createAvatarUploadUrl(userId: string): Promise<{
    avatarKey: string;
    uploadUrl: string;
    method: "PUT";
    expiresInSeconds: number;
  }> {
    await this.requireAccount(userId);
    const storage = getStorageConfig();
    const avatarKey = `avatars/${userId}/${randomUUID()}`;
    const baseUrl =
      storage.provider === "local"
        ? "http://localhost:4000/internal/uploads"
        : (storage.endpoint ?? `https://${storage.bucket}.s3.${storage.region}.amazonaws.com`);
    return {
      avatarKey,
      uploadUrl: `${baseUrl}/${avatarKey}`,
      method: "PUT",
      expiresInSeconds: 900
    };
  }

  public async confirmAvatar(userId: string, input: ConfirmAvatarInput): Promise<CustomerProfile> {
    const updated = await this.customers.updateById(userId, { $set: { avatarKey: input.avatarKey } });
    if (!updated) {
      throw new ResourceNotFoundError("User profile not found.");
    }
    await this.publish("customer.avatar-updated", userId, { avatarKey: input.avatarKey });
    return serializeProfile(updated);
  }

  public async deleteAvatar(userId: string): Promise<CustomerProfile> {
    const updated = await this.customers.updateById(userId, { $unset: { avatarKey: "" } });
    if (!updated) {
      throw new ResourceNotFoundError("User profile not found.");
    }
    await this.publish("customer.avatar-deleted", userId, {});
    return serializeProfile(updated);
  }

  private async requireAccount(userId: string): Promise<CustomerAccountDocument> {
    const account = await this.users.findById(userId);
    if (!account) {
      throw new ResourceNotFoundError("User profile not found.");
    }
    return account;
  }

  private async publish(
    type: string,
    aggregateId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.dependencies.events.publish({ type, aggregateId, payload });
  }
}
