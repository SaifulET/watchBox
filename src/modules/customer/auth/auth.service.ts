import { randomInt } from "node:crypto";
import mongoose, { type Types } from "mongoose";
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ResourceNotFoundError
} from "../../../common/errors/app-error.js";
import type { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import { RateLimiterService } from "../../../common/services/rate-limiter.service.js";
import { getAuthConfig } from "../../../config/auth.config.js";
import { getEmailConfig } from "../../../config/email.config.js";
import type { EmailProvider } from "../../../infrastructure/external/email/email-provider.js";
import type { RedisClient } from "../../../infrastructure/redis/client.js";
import { PasswordService } from "./password.service.js";
import { TokenService, type TokenAudience } from "./token.service.js";
import type {
  AdminMfaChallengeInput,
  AdminMfaVerifyInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailConfirmInput,
  VerifyEmailRequestInput
} from "./auth.validation.js";
import type {
  AccountTokenDocument,
  AdminAccountDocument,
  AuthSessionDocument,
  CustomerAccountDocument
} from "./auth.model.js";
import {
  AccountTokenRepository,
  AdminAccountRepository,
  AuthSessionRepository,
  CustomerAccountRepository
} from "./auth.repository.js";
import type { AccountKind, AccountTokenPurpose, TokenPair } from "./auth.types.js";

type RequestFingerprint = {
  ipAddress?: string;
  userAgent?: string;
};

type AuthDependencies = {
  redis?: RedisClient;
  events: DomainEventPublisher;
  passwords?: PasswordService;
  tokens?: TokenService;
  customers?: CustomerAccountRepository;
  admins?: AdminAccountRepository;
  sessions?: AuthSessionRepository;
  accountTokens?: AccountTokenRepository;
  email?: EmailProvider;
};

type LoginResult<TAccount> = {
  account: TAccount;
  sessionId: string;
  tokens: TokenPair;
};

type SessionResponse = {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
};

const accessTtlSeconds = 15 * 60;
const resetTtlMinutes = 15;
const verificationTtlHours = 24;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const ttlToMilliseconds = (ttl: string): number => {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    return 30 * 24 * 60 * 60 * 1000;
  }

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  } as const;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "d") as keyof typeof multipliers;
  return amount * multipliers[unit];
};

const idString = (id: Types.ObjectId | string): string => id.toString();

const serializeCustomer = (account: CustomerAccountDocument) => ({
  id: account._id.toString(),
  email: account.email,
  displayName: account.displayName,
  status: account.status,
  emailVerified: account.emailVerified,
  preferences: account.preferences,
  createdAt: account.createdAt.toISOString(),
  updatedAt: account.updatedAt.toISOString()
});

const serializeAdmin = (account: AdminAccountDocument) => ({
  id: account._id.toString(),
  email: account.email,
  displayName: account.displayName,
  status: account.status,
  permissions: account.permissions,
  roles: account.roles,
  mfaEnabled: account.mfaEnabled,
  createdAt: account.createdAt.toISOString(),
  updatedAt: account.updatedAt.toISOString()
});

type SerializedCustomer = ReturnType<typeof serializeCustomer>;
type SerializedAdmin = ReturnType<typeof serializeAdmin>;
type SerializedAccount = SerializedCustomer | SerializedAdmin;

const serializeSession = (session: AuthSessionDocument): SessionResponse => {
  const response: SessionResponse = {
    id: session._id.toString(),
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString()
  };
  if (session.ipAddress) {
    response.ipAddress = session.ipAddress;
  }
  if (session.userAgent) {
    response.userAgent = session.userAgent;
  }
  return response;
};

export class CustomerAuthService {
  protected readonly passwords: PasswordService;
  protected readonly tokens: TokenService;
  protected readonly customers: CustomerAccountRepository;
  protected readonly admins: AdminAccountRepository;
  protected readonly sessions: AuthSessionRepository;
  protected readonly accountTokens: AccountTokenRepository;
  protected readonly rateLimiter: RateLimiterService;
  protected readonly email: EmailProvider | undefined;

  public constructor(protected readonly dependencies: AuthDependencies) {
    this.passwords = dependencies.passwords ?? new PasswordService();
    this.tokens = dependencies.tokens ?? new TokenService();
    this.customers = dependencies.customers ?? new CustomerAccountRepository();
    this.admins = dependencies.admins ?? new AdminAccountRepository();
    this.sessions = dependencies.sessions ?? new AuthSessionRepository();
    this.accountTokens = dependencies.accountTokens ?? new AccountTokenRepository();
    this.rateLimiter = new RateLimiterService(dependencies.redis);
    this.email = dependencies.email;
  }

  public async register(
    input: RegisterInput,
    fingerprint: RequestFingerprint
  ): Promise<LoginResult<SerializedAccount>> {
    try {
      const passwordHash = await this.passwords.hash(input.password);
      const account = await this.customers.create({
        email: input.email,
        passwordHash,
        displayName: input.displayName
      });
      await this.publish("customer.registered", account._id, {
        email: account.email,
        displayName: account.displayName
      });
      const verificationToken = await this.createAccountToken(
        "customer",
        account._id,
        "email-verification",
        verificationTtlHours * 60 * 60 * 1000
      );
      await this.sendEmailVerification(account.email, verificationToken);
      const auth = await this.createSession(account._id, "customer", fingerprint);
      return { account: serializeCustomer(account), ...auth };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError("An account already exists for this email address.");
      }
      throw error;
    }
  }

  public async login(
    input: LoginInput,
    fingerprint: RequestFingerprint
  ): Promise<LoginResult<SerializedAccount>> {
    await this.rateLimiter.consume({
      key: `customer-login:${fingerprint.ipAddress ?? "unknown"}:${input.email}`,
      limit: 5,
      windowSeconds: 15 * 60,
      message: "Too many login attempts. Please try again later."
    });

    const account = await this.customers.findByEmail(input.email);
    if (!account || !(await this.passwords.verify(account.passwordHash, input.password))) {
      throw new AuthenticationError("Invalid email or password.");
    }
    this.assertUsableAccount(account.status);

    account.lastLoginAt = new Date();
    await account.save();
    const auth = await this.createSession(account._id, "customer", fingerprint);
    await this.publish("customer.logged-in", account._id, { sessionId: auth.sessionId });
    return { account: serializeCustomer(account), ...auth };
  }

  public async refresh(input: RefreshInput): Promise<{ sessionId: string; tokens: TokenPair }> {
    const verified = this.tokens.verifyRefreshToken(input.refreshToken, "customer");
    return this.rotateRefreshToken(input.refreshToken, "customer", verified.sessionId);
  }

  public async logout(sessionId: string): Promise<{ revoked: true }> {
    await this.revokeSession(sessionId, "customer");
    return { revoked: true };
  }

  public async logoutAll(actorId: string): Promise<{ revoked: true }> {
    await this.sessions.revokeAll(actorId, "customer");
    await this.publish("customer.sessions-revoked", actorId, {});
    return { revoked: true };
  }

  public async requestEmailVerification(
    input: VerifyEmailRequestInput
  ): Promise<{ delivery: string; expiresInMinutes: number; developmentToken?: string }> {
    const account = await this.customers.findByEmail(input.email);
    if (!account) {
      return { delivery: "email", expiresInMinutes: verificationTtlHours * 60 };
    }
    const rawToken = await this.createAccountToken(
      "customer",
      account._id,
      "email-verification",
      verificationTtlHours * 60 * 60 * 1000
    );
    await this.sendEmailVerification(account.email, rawToken);
    await this.publish("customer.email-verification-requested", account._id, { email: account.email });
    return this.tokenDeliveryResponse(rawToken, verificationTtlHours * 60);
  }

  public async confirmEmail(input: VerifyEmailConfirmInput): Promise<{ verified: true }> {
    const token = await this.consumeToken("customer", "email-verification", input.token);
    await this.customers.updateById(token.accountId, { $set: { emailVerified: true } });
    await this.publish("customer.email-verified", token.accountId, {});
    return { verified: true };
  }

  public async forgotPassword(
    input: ForgotPasswordInput,
    fingerprint: RequestFingerprint
  ): Promise<{ delivery: string; expiresInMinutes: number; developmentToken?: string }> {
    await this.rateLimiter.consume({
      key: `customer-password-reset:${fingerprint.ipAddress ?? "unknown"}:${input.email}`,
      limit: 3,
      windowSeconds: 60 * 60,
      message: "Too many password reset requests. Please try again later."
    });
    const account = await this.customers.findByEmail(input.email);
    if (!account) {
      return { delivery: "email", expiresInMinutes: resetTtlMinutes };
    }
    const rawToken = await this.createAccountToken(
      "customer",
      account._id,
      "password-reset",
      resetTtlMinutes * 60 * 1000
    );
    await this.sendCustomerPasswordReset(account.email, rawToken);
    await this.publish("customer.password-reset-requested", account._id, { email: account.email });
    return this.tokenDeliveryResponse(rawToken, resetTtlMinutes);
  }

  public async resetPassword(input: ResetPasswordInput): Promise<{ reset: true }> {
    const token = await this.consumeToken("customer", "password-reset", input.token);
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.customers.updateById(token.accountId, { $set: { passwordHash } });
    await this.sessions.revokeAll(token.accountId, "customer");
    await this.publish("customer.password-reset", token.accountId, {});
    return { reset: true };
  }

  public async changePassword(
    actorId: string,
    input: ChangePasswordInput
  ): Promise<{ changed: true }> {
    const account = await this.customers.findById(actorId);
    if (!account || !(await this.passwords.verify(account.passwordHash, input.currentPassword))) {
      throw new AuthenticationError("Current password is incorrect.");
    }
    account.passwordHash = await this.passwords.hash(input.newPassword);
    await account.save();
    await this.sessions.revokeAll(account._id, "customer");
    await this.publish("customer.password-changed", account._id, {});
    return { changed: true };
  }

  public async listSessions(actorId: string): Promise<SessionResponse[]> {
    const sessions = await this.sessions.findActiveByAccount(actorId, "customer");
    return sessions.map(serializeSession);
  }

  public async revokeOwnSession(actorId: string, sessionId: string): Promise<{ revoked: true }> {
    const session = await this.sessions.findActiveById(sessionId, "customer");
    if (!session) {
      throw new ResourceNotFoundError("Session not found.");
    }
    if (session.accountId.toString() !== actorId) {
      throw new AuthorizationError("You can revoke only your own sessions.");
    }
    await this.revokeSession(session._id, "customer");
    return { revoked: true };
  }

  protected async createSession(
    accountId: Types.ObjectId,
    accountKind: AccountKind,
    fingerprint: RequestFingerprint
  ): Promise<{ sessionId: string; tokens: TokenPair }> {
    const expiresAt = new Date(Date.now() + ttlToMilliseconds(getAuthConfig().refreshTtl));
    const session = await this.sessions.create({
      accountId,
      accountKind,
      refreshTokenHash: "pending",
      expiresAt,
      ...fingerprint
    });
    const tokens = this.createTokenPair(accountId.toString(), accountKind, session._id.toString());
    session.refreshTokenHash = this.tokens.hashRefreshToken(tokens.refreshToken);
    await session.save();
    await this.saveSessionMetadata(session);
    return { sessionId: session._id.toString(), tokens };
  }

  protected async rotateRefreshToken(
    refreshToken: string,
    accountKind: AccountKind,
    sessionId: string
  ): Promise<{ sessionId: string; tokens: TokenPair }> {
    const session = await this.sessions.findActiveById(sessionId, accountKind);
    if (!session) {
      throw new AuthenticationError("Refresh session is no longer active.");
    }

    const incomingHash = this.tokens.hashRefreshToken(refreshToken);
    if (session.refreshTokenHash !== incomingHash) {
      await this.sessions.markReuse(session._id);
      await this.sessions.revokeAll(session.accountId, accountKind);
      throw new AuthenticationError("Refresh token reuse was detected. All sessions were revoked.");
    }

    const tokens = this.createTokenPair(
      session.accountId.toString(),
      accountKind,
      session._id.toString()
    );
    const expiresAt = new Date(Date.now() + ttlToMilliseconds(getAuthConfig().refreshTtl));
    const updatedSession = await this.sessions.rotateRefreshToken(
      session._id,
      this.tokens.hashRefreshToken(tokens.refreshToken),
      expiresAt
    );
    if (!updatedSession) {
      throw new AuthenticationError("Refresh session is no longer active.");
    }
    await this.saveSessionMetadata(updatedSession);
    return { sessionId: updatedSession._id.toString(), tokens };
  }

  protected createTokenPair(accountId: string, accountKind: AccountKind, sessionId: string): TokenPair {
    const audience: TokenAudience = accountKind;
    return {
      accessToken: this.tokens.signAccessToken({ subject: accountId, audience, sessionId }),
      refreshToken: this.tokens.signRefreshToken({ subject: accountId, audience, sessionId }),
      tokenType: "Bearer",
      expiresIn: accessTtlSeconds
    };
  }

  protected async createAccountToken(
    accountKind: AccountKind,
    accountId: Types.ObjectId,
    purpose: AccountTokenPurpose,
    ttlMs: number
  ): Promise<string> {
    await this.accountTokens.removeActiveForAccount(accountKind, accountId, purpose);
    const rawToken = this.tokens.createOpaqueToken();
    await this.accountTokens.create({
      accountId,
      accountKind,
      purpose,
      tokenHash: this.tokens.hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + ttlMs),
      metadata: {}
    });
    return rawToken;
  }

  protected async consumeToken(
    accountKind: AccountKind,
    purpose: AccountTokenPurpose,
    rawToken: string
  ): Promise<AccountTokenDocument> {
    const token = await this.accountTokens.consumeActive(
      accountKind,
      purpose,
      this.tokens.hashOpaqueToken(rawToken)
    );
    if (!token) {
      throw new AuthenticationError("The supplied token is invalid or expired.");
    }
    return token;
  }

  protected assertUsableAccount(status: string): void {
    if (status === "suspended") {
      throw new AuthorizationError("This account is suspended.");
    }
    if (status === "deleted") {
      throw new AuthenticationError("This account is no longer active.");
    }
  }

  protected async revokeSession(sessionId: string | Types.ObjectId, accountKind: AccountKind): Promise<void> {
    await this.sessions.revokeById(sessionId);
    await this.dependencies.redis?.del(`session:${accountKind}:${idString(sessionId)}`);
  }

  protected async saveSessionMetadata(session: AuthSessionDocument): Promise<void> {
    const key = `session:${session.accountKind}:${session._id.toString()}`;
    const values: Record<string, string> = {
      accountId: session.accountId.toString(),
      accountKind: session.accountKind,
      expiresAt: session.expiresAt.toISOString()
    };
    if (session.ipAddress) {
      values.ipAddress = session.ipAddress;
    }
    if (session.userAgent) {
      values.userAgent = session.userAgent;
    }
    await this.dependencies.redis?.hset(key, values);
    await this.dependencies.redis?.expireat(key, Math.floor(session.expiresAt.getTime() / 1000));
  }

  protected tokenDeliveryResponse(
    token: string,
    expiresInMinutes: number
  ): { delivery: string; expiresInMinutes: number; developmentToken?: string } {
    const response: { delivery: string; expiresInMinutes: number; developmentToken?: string } = {
      delivery: "email",
      expiresInMinutes
    };
    if (process.env.NODE_ENV !== "production") {
      response.developmentToken = token;
    }
    return response;
  }

  protected async sendEmailVerification(email: string, token: string): Promise<void> {
    const link = `${getEmailConfig().webAppUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.email?.send({
      to: email,
      subject: "Verify your WatchBox email",
      text: `Verify your WatchBox email by opening this link: ${link}`,
      html: `<p>Verify your WatchBox email by opening this link:</p><p><a href="${link}">${link}</a></p>`
    });
  }

  protected async sendCustomerPasswordReset(email: string, token: string): Promise<void> {
    const link = `${getEmailConfig().webAppUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.email?.send({
      to: email,
      subject: "Reset your WatchBox password",
      text: `Reset your WatchBox password by opening this link: ${link}`,
      html: `<p>Reset your WatchBox password by opening this link:</p><p><a href="${link}">${link}</a></p>`
    });
  }

  protected async sendAdminPasswordReset(email: string, token: string): Promise<void> {
    const link = `${getEmailConfig().webAppUrl}/admin/reset-password?token=${encodeURIComponent(token)}`;
    await this.email?.send({
      to: email,
      subject: "Reset your WatchBox admin password",
      text: `Reset your WatchBox admin password by opening this link: ${link}`,
      html: `<p>Reset your WatchBox admin password by opening this link:</p><p><a href="${link}">${link}</a></p>`
    });
  }

  protected async sendAdminMfaCode(email: string, code: string): Promise<void> {
    await this.email?.send({
      to: email,
      subject: "Your WatchBox admin verification code",
      text: `Your WatchBox admin verification code is ${code}. It expires in 5 minutes.`,
      html: `<p>Your WatchBox admin verification code is <strong>${code}</strong>.</p><p>It expires in 5 minutes.</p>`
    });
  }

  protected async publish(
    type: string,
    aggregateId: Types.ObjectId | string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.dependencies.events.publish({
      type,
      aggregateId: idString(aggregateId),
      payload
    });
  }
}

export class AdminAuthService extends CustomerAuthService {
  public override async login(
    input: LoginInput,
    fingerprint: RequestFingerprint
  ): Promise<LoginResult<SerializedAccount>> {
    await this.rateLimiter.consume({
      key: `admin-login:${fingerprint.ipAddress ?? "unknown"}:${input.email}`,
      limit: 5,
      windowSeconds: 15 * 60,
      message: "Too many admin login attempts. Please try again later."
    });

    const account = await this.admins.findByEmail(input.email);
    if (!account || !(await this.passwords.verify(account.passwordHash, input.password))) {
      throw new AuthenticationError("Invalid email or password.");
    }
    this.assertUsableAccount(account.status);

    account.lastLoginAt = new Date();
    await account.save();
    const auth = await this.createSession(account._id, "admin", fingerprint);
    await this.publish("admin.logged-in", account._id, { sessionId: auth.sessionId });
    return { account: serializeAdmin(account), ...auth };
  }

  public override async refresh(input: RefreshInput): Promise<{ sessionId: string; tokens: TokenPair }> {
    const verified = this.tokens.verifyRefreshToken(input.refreshToken, "admin");
    return this.rotateRefreshToken(input.refreshToken, "admin", verified.sessionId);
  }

  public override async logout(sessionId: string): Promise<{ revoked: true }> {
    await this.revokeSession(sessionId, "admin");
    return { revoked: true };
  }

  public override async logoutAll(actorId: string): Promise<{ revoked: true }> {
    await this.sessions.revokeAll(actorId, "admin");
    await this.publish("admin.sessions-revoked", actorId, {});
    return { revoked: true };
  }

  public override async forgotPassword(
    input: ForgotPasswordInput,
    fingerprint: RequestFingerprint
  ): Promise<{ delivery: string; expiresInMinutes: number; developmentToken?: string }> {
    await this.rateLimiter.consume({
      key: `admin-password-reset:${fingerprint.ipAddress ?? "unknown"}:${input.email}`,
      limit: 3,
      windowSeconds: 60 * 60,
      message: "Too many password reset requests. Please try again later."
    });
    const account = await this.admins.findByEmail(input.email);
    if (!account) {
      return { delivery: "email", expiresInMinutes: resetTtlMinutes };
    }
    const rawToken = await this.createAccountToken(
      "admin",
      account._id,
      "admin-password-reset",
      resetTtlMinutes * 60 * 1000
    );
    await this.sendAdminPasswordReset(account.email, rawToken);
    await this.publish("admin.password-reset-requested", account._id, { email: account.email });
    return this.tokenDeliveryResponse(rawToken, resetTtlMinutes);
  }

  public async verifyResetCode(input: { token: string }): Promise<{ valid: true }> {
    const hash = this.tokens.hashOpaqueToken(input.token);
    const token = await this.accountTokens.findOne({
      accountKind: "admin",
      purpose: "admin-password-reset",
      tokenHash: hash,
      consumedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() })
    });
    if (!token) {
      throw new AuthenticationError("The supplied reset token is invalid or expired.");
    }
    return { valid: true };
  }

  public override async resetPassword(input: ResetPasswordInput): Promise<{ reset: true }> {
    const token = await this.consumeToken("admin", "admin-password-reset", input.token);
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.admins.updateById(token.accountId, { $set: { passwordHash } });
    await this.sessions.revokeAll(token.accountId, "admin");
    await this.publish("admin.password-reset", token.accountId, {});
    return { reset: true };
  }

  public override async changePassword(
    actorId: string,
    input: ChangePasswordInput
  ): Promise<{ changed: true }> {
    const account = await this.admins.findById(actorId);
    if (!account || !(await this.passwords.verify(account.passwordHash, input.currentPassword))) {
      throw new AuthenticationError("Current password is incorrect.");
    }
    account.passwordHash = await this.passwords.hash(input.newPassword);
    await account.save();
    await this.sessions.revokeAll(account._id, "admin");
    await this.publish("admin.password-changed", account._id, {});
    return { changed: true };
  }

  public override async listSessions(actorId: string): Promise<SessionResponse[]> {
    const sessions = await this.sessions.findActiveByAccount(actorId, "admin");
    return sessions.map(serializeSession);
  }

  public override async revokeOwnSession(
    actorId: string,
    sessionId: string
  ): Promise<{ revoked: true }> {
    const session = await this.sessions.findActiveById(sessionId, "admin");
    if (!session) {
      throw new ResourceNotFoundError("Session not found.");
    }
    if (session.accountId.toString() !== actorId) {
      throw new AuthorizationError("You can revoke only your own sessions.");
    }
    await this.revokeSession(session._id, "admin");
    return { revoked: true };
  }

  public async setupMfa(actorId: string): Promise<{ enabled: false; delivery: string; developmentCode?: string }> {
    const account = await this.admins.findById(actorId);
    if (!account) {
      throw new ResourceNotFoundError("Admin account not found.");
    }
    const code = this.createMfaCode();
    await this.createMfaToken(account._id, code);
    await this.sendAdminMfaCode(account.email, code);
    const response: { enabled: false; delivery: string; developmentCode?: string } = {
      enabled: false,
      delivery: "email"
    };
    if (process.env.NODE_ENV !== "production") {
      response.developmentCode = code;
    }
    await this.publish("admin.mfa-setup-requested", account._id, { email: account.email });
    return response;
  }

  public async verifyMfa(actorId: string, input: AdminMfaVerifyInput): Promise<{ enabled: true }> {
    const account = await this.admins.findById(actorId);
    if (!account) {
      throw new ResourceNotFoundError("Admin account not found.");
    }
    await this.consumeToken("admin", "admin-mfa", input.code);
    account.mfaEnabled = true;
    await account.save();
    await this.publish("admin.mfa-enabled", account._id, {});
    return { enabled: true };
  }

  public async challengeMfa(
    input: AdminMfaChallengeInput
  ): Promise<{ delivery: string; expiresInMinutes: number; developmentCode?: string }> {
    const account = await this.admins.findByEmail(input.email);
    if (!account) {
      return { delivery: "email", expiresInMinutes: 5 };
    }
    const code = this.createMfaCode();
    await this.createMfaToken(account._id, code);
    await this.sendAdminMfaCode(account.email, code);
    await this.publish("admin.mfa-challenge-requested", account._id, { email: account.email });
    const response: { delivery: string; expiresInMinutes: number; developmentCode?: string } = {
      delivery: "email",
      expiresInMinutes: 5
    };
    if (process.env.NODE_ENV !== "production") {
      response.developmentCode = code;
    }
    return response;
  }

  public async disableMfa(actorId: string): Promise<{ enabled: false }> {
    const account = await this.admins.findById(actorId);
    if (!account) {
      throw new ResourceNotFoundError("Admin account not found.");
    }
    account.mfaEnabled = false;
    await account.save();
    await this.accountTokens.removeActiveForAccount("admin", account._id, "admin-mfa");
    await this.publish("admin.mfa-disabled", account._id, {});
    return { enabled: false };
  }

  public async getPermissions(actorId: string): Promise<{ permissions: string[]; roles: string[] }> {
    const account = await this.admins.findById(actorId);
    if (!account) {
      throw new ResourceNotFoundError("Admin account not found.");
    }
    return { permissions: account.permissions, roles: account.roles };
  }

  private createMfaCode(): string {
    return randomInt(100000, 999999).toString();
  }

  private async createMfaToken(accountId: Types.ObjectId, code: string): Promise<void> {
    await this.accountTokens.removeActiveForAccount("admin", accountId, "admin-mfa");
    await this.accountTokens.create({
      accountId,
      accountKind: "admin",
      purpose: "admin-mfa",
      tokenHash: this.tokens.hashOpaqueToken(code),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      metadata: {}
    });
  }
}
