import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { getDatabaseConfig } from "../../src/config/database.config.js";
import {
  AccountTokenModel,
  AdminAccountModel,
  AuthSessionModel,
  CustomerAccountModel
} from "../../src/modules/customer/auth/auth.model.js";
import { PasswordService } from "../../src/modules/customer/auth/password.service.js";

process.env.STORAGE_PROVIDER = "local";
process.env.EMAIL_PROVIDER = "local";

const app = createApp();

type AuthResponse = {
  success: true;
  data: {
    account: {
      id: string;
      email: string;
      permissions?: string[];
      roles?: string[];
      notificationPreferences?: {
        emailAlerts: boolean;
      };
    };
    sessionId: string;
    tokens: {
      accessToken: string;
      refreshToken: string;
      tokenType: "Bearer";
    };
  };
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type DataResponse<TData> = {
  success: true;
  data: TData;
};

type TokenDeliveryResponse = {
  delivery: "email";
  expiresInMinutes: number;
  developmentToken?: string;
  developmentCode?: string;
};

type PermissionsResponse = {
  permissions: string[];
  roles: string[];
};

const connectForTests = async (): Promise<void> => {
  mongoose.set("strictQuery", true);
  mongoose.set("sanitizeFilter", true);
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    return;
  }
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: `${config.databaseName}-test`,
    autoIndex: true
  });
};

describe("auth APIs", () => {
  beforeAll(async () => {
    await connectForTests();
    await Promise.all([CustomerAccountModel.syncIndexes(), AdminAccountModel.syncIndexes()]);
  });

  beforeEach(async () => {
    await Promise.all([
      CustomerAccountModel.deleteMany({}),
      AdminAccountModel.deleteMany({}),
      AuthSessionModel.deleteMany({}),
      AccountTokenModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("registers, authenticates, rotates refresh tokens, and revokes customer sessions", async () => {
    const register = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "buyer@example.com",
        password: "correct-password",
        displayName: "Buyer One"
      })
      .expect(201);
    const registered = register.body as AuthResponse;

    expect(registered.success).toBe(true);
    expect(registered.data.account.email).toBe("buyer@example.com");
    expect(registered.data.account.notificationPreferences?.emailAlerts).toBe(true);
    expect(registered.data.tokens.tokenType).toBe("Bearer");

    const sessions = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${registered.data.tokens.accessToken}`)
      .expect(200);
    const sessionsBody = sessions.body as DataResponse<unknown[]>;
    expect(sessionsBody.data).toHaveLength(1);

    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: registered.data.tokens.refreshToken })
      .expect(200);
    const refreshed = refresh.body as Pick<AuthResponse, "success"> & {
      data: {
        sessionId: string;
        tokens: AuthResponse["data"]["tokens"];
      };
    };
    expect(refreshed.data.tokens.refreshToken).not.toBe(registered.data.tokens.refreshToken);

    await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: registered.data.tokens.refreshToken })
      .expect(401);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "buyer@example.com", password: "correct-password" })
      .expect(200);
    const loggedIn = login.body as AuthResponse;

    await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${loggedIn.data.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${loggedIn.data.tokens.accessToken}`)
      .expect(401);

    const secondLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "buyer@example.com", password: "correct-password" })
      .expect(200);
    const loggedInAgain = secondLogin.body as AuthResponse;

    await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${loggedInAgain.data.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${loggedInAgain.data.tokens.accessToken}`)
      .expect(401);
  });

  it("supports customer email verification and password reset token flows", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "reset@example.com",
        password: "old-password",
        displayName: "Reset User"
      })
      .expect(201);

    const verification = await request(app)
      .post("/api/v1/auth/verify-email/request")
      .send({ email: "reset@example.com" })
      .expect(200);
    const verificationBody = verification.body as DataResponse<TokenDeliveryResponse>;
    expect(verificationBody.data.expiresInMinutes).toBe(1);
    const verificationToken = verificationBody.data.developmentToken;
    if (!verificationToken) {
      throw new Error("Expected a development verification token.");
    }

    await request(app)
      .post("/api/v1/auth/verify-email/confirm")
      .send({ token: verificationToken })
      .expect(200);

    const reset = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "reset@example.com" })
      .expect(200);
    const resetBody = reset.body as DataResponse<TokenDeliveryResponse>;
    const resetToken = resetBody.data.developmentToken;
    if (!resetToken) {
      throw new Error("Expected a development reset token.");
    }

    await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: resetToken,
        newPassword: "new-password",
        confirmPassword: "different-password"
      })
      .expect(400);

    await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: resetToken,
        newPassword: "new-password",
        confirmPassword: "new-password"
      })
      .expect(200);

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "reset@example.com", password: "new-password" })
      .expect(200);
  });

  it("reads and updates the current customer profile, preferences, activity, stats, and avatar", async () => {
    const register = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "profile@example.com",
        password: "profile-password",
        displayName: "Profile User"
      })
      .expect(201);
    const registered = register.body as AuthResponse;
    const authorization = `Bearer ${registered.data.tokens.accessToken}`;

    const me = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", authorization)
      .expect(200);
    const meBody = me.body as DataResponse<{ email: string; displayName: string }>;
    expect(meBody.data.email).toBe("profile@example.com");

    const updated = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", authorization)
      .send({ displayName: "Updated Profile", country: "United States" })
      .expect(200);
    const updatedBody = updated.body as DataResponse<{ displayName: string; country: string }>;
    expect(updatedBody.data.displayName).toBe("Updated Profile");

    const preferences = await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", authorization)
      .send({ currency: "eur" })
      .expect(200);
    const preferencesBody = preferences.body as DataResponse<{ currency: string; newsletter?: boolean }>;
    expect(preferencesBody.data.currency).toBe("EUR");
    expect(preferencesBody.data.newsletter).toBeUndefined();

    const darkMode = await request(app)
      .get("/api/v1/users/me/dark-mode")
      .set("Authorization", authorization)
      .expect(200);
    const darkModeBody = darkMode.body as DataResponse<{ darkMode: boolean }>;
    expect(darkModeBody.data.darkMode).toBe(false);

    const updatedDarkMode = await request(app)
      .patch("/api/v1/users/me/dark-mode")
      .set("Authorization", authorization)
      .send({ darkMode: true })
      .expect(200);
    const updatedDarkModeBody = updatedDarkMode.body as DataResponse<{ darkMode: boolean }>;
    expect(updatedDarkModeBody.data.darkMode).toBe(true);

    const notificationPreferences = await request(app)
      .get("/api/v1/notification-preferences")
      .set("Authorization", authorization)
      .expect(200);
    const notificationPreferencesBody =
      notificationPreferences.body as DataResponse<{ emailAlerts: boolean }>;
    expect(notificationPreferencesBody.data.emailAlerts).toBe(true);

    const updatedNotificationPreferences = await request(app)
      .patch("/api/v1/notification-preferences")
      .set("Authorization", authorization)
      .send({ emailAlerts: false })
      .expect(200);
    const updatedNotificationPreferencesBody =
      updatedNotificationPreferences.body as DataResponse<{ emailAlerts: boolean }>;
    expect(updatedNotificationPreferencesBody.data.emailAlerts).toBe(false);

    await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", authorization)
      .send({ newsletter: false })
      .expect(400);

    await request(app)
      .get("/api/v1/users/me/activity")
      .set("Authorization", authorization)
      .expect(200);
    await request(app)
      .get("/api/v1/users/me/stats")
      .set("Authorization", authorization)
      .expect(200);

    const emptyAvatar = await request(app)
      .get("/api/v1/users/me/avatar")
      .set("Authorization", authorization)
      .expect(200);
    const emptyAvatarBody = emptyAvatar.body as DataResponse<{
      avatarKey: string | null;
      avatarUrl: string | null;
    }>;
    expect(emptyAvatarBody.data.avatarKey).toBeNull();
    expect(emptyAvatarBody.data.avatarUrl).toBeNull();

    const uploadUrl = await request(app)
      .post("/api/v1/users/me/avatar/upload-url")
      .set("Authorization", authorization)
      .expect(200);
    const uploadUrlBody = uploadUrl.body as DataResponse<{
      avatarKey: string;
      avatarUrl: string;
      uploadUrl: string;
    }>;
    expect(uploadUrlBody.data.avatarKey).toContain(registered.data.account.id);
    expect(uploadUrlBody.data.avatarUrl).toContain(uploadUrlBody.data.avatarKey);

    const confirmedAvatar = await request(app)
      .post("/api/v1/users/me/avatar/confirm")
      .set("Authorization", authorization)
      .send({ avatarKey: uploadUrlBody.data.avatarKey })
      .expect(200);
    const confirmedAvatarBody = confirmedAvatar.body as DataResponse<{ avatarUrl: string }>;
    expect(confirmedAvatarBody.data.avatarUrl).toBe(uploadUrlBody.data.avatarUrl);

    const savedAvatar = await request(app)
      .get("/api/v1/users/me/avatar")
      .set("Authorization", authorization)
      .expect(200);
    const savedAvatarBody = savedAvatar.body as DataResponse<{
      avatarKey: string | null;
      avatarUrl: string | null;
    }>;
    expect(savedAvatarBody.data.avatarKey).toBe(uploadUrlBody.data.avatarKey);
    expect(savedAvatarBody.data.avatarUrl).toBe(uploadUrlBody.data.avatarUrl);

    await request(app)
      .delete("/api/v1/users/me/avatar")
      .set("Authorization", authorization)
      .expect(200);

    await request(app)
      .delete("/api/v1/users/me")
      .set("Authorization", authorization)
      .expect(200);

    await expect(CustomerAccountModel.exists({ _id: registered.data.account.id })).resolves.toBeNull();
    await expect(AuthSessionModel.countDocuments({ accountId: registered.data.account.id })).resolves.toBe(
      0
    );
    await expect(AccountTokenModel.countDocuments({ accountId: registered.data.account.id })).resolves.toBe(
      0
    );

    await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", authorization)
      .expect(401);

    await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "profile@example.com",
        password: "new-profile-password",
        displayName: "New Profile User"
      })
      .expect(201);
  });

  it("authenticates admins and exposes admin auth workflows", async () => {
    const passwords = new PasswordService();
    await AdminAccountModel.create({
      email: "admin@example.com",
      displayName: "Admin One",
      passwordHash: await passwords.hash("admin-password"),
      permissions: ["admin:users"],
      roles: ["super-admin"]
    });

    const login = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "admin@example.com", password: "admin-password" })
      .expect(200);
    const loggedIn = login.body as AuthResponse;

    const permissions = await request(app)
      .get("/api/v1/admin/auth/me/permissions")
      .set("Authorization", `Bearer ${loggedIn.data.tokens.accessToken}`)
      .expect(200);
    const permissionsBody = permissions.body as DataResponse<PermissionsResponse>;
    expect(permissionsBody.data.permissions).toContain("admin:users");

    const mfaSetup = await request(app)
      .post("/api/v1/admin/auth/mfa/setup")
      .set("Authorization", `Bearer ${loggedIn.data.tokens.accessToken}`)
      .expect(200);
    const mfaSetupBody = mfaSetup.body as DataResponse<TokenDeliveryResponse>;
    const mfaCode = mfaSetupBody.data.developmentCode;
    if (!mfaCode) {
      throw new Error("Expected a development MFA code.");
    }

    await request(app)
      .post("/api/v1/admin/auth/mfa/verify")
      .set("Authorization", `Bearer ${loggedIn.data.tokens.accessToken}`)
      .send({ code: mfaCode })
      .expect(200);

    await request(app)
      .post("/api/v1/admin/auth/logout")
      .set("Authorization", `Bearer ${loggedIn.data.tokens.accessToken}`)
      .expect(200);
  });

  it("registers the first admin and protects later admin registration", async () => {
    const firstRegister = await request(app)
      .post("/api/v1/admin/auth/register")
      .send({
        email: "owner@example.com",
        password: "owner-password",
        displayName: "Owner Admin"
      })
      .expect(201);
    const firstAdmin = firstRegister.body as AuthResponse;

    expect(firstAdmin.success).toBe(true);
    expect(firstAdmin.data.account.email).toBe("owner@example.com");
    expect(firstAdmin.data.account.permissions).toEqual(
      expect.arrayContaining(["admin:dashboard", "admin:settings", "admin:users"])
    );
    expect(firstAdmin.data.account.roles).toContain("super-admin");

    const openRegister = await request(app)
      .post("/api/v1/admin/auth/register")
      .send({
        email: "open@example.com",
        password: "open-password",
        displayName: "Open Admin"
      })
      .expect(401);
    const openRegisterBody = openRegister.body as ErrorResponse;
    expect(openRegisterBody.error.code).toBe("AUTHENTICATION_REQUIRED");

    const secondRegister = await request(app)
      .post("/api/v1/admin/auth/register")
      .set("Authorization", `Bearer ${firstAdmin.data.tokens.accessToken}`)
      .send({
        email: "second@example.com",
        password: "second-password",
        displayName: "Second Admin",
        permissions: ["admin:settings"],
        roles: ["content-admin"]
      })
      .expect(201);
    const secondAdmin = secondRegister.body as AuthResponse;
    expect(secondAdmin.data.account.permissions).toEqual(["admin:settings"]);
    expect(secondAdmin.data.account.roles).toEqual(["content-admin"]);

    await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "second@example.com", password: "second-password" })
      .expect(200);
  });
});
