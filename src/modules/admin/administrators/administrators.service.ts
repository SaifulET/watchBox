import { randomUUID } from "node:crypto";
import {
  adminPermissions,
  adminRoles,
  rolePermissionMatrix,
  type AdminRoleCode
} from "../../../common/permissions/admin-permissions.js";
import { ConflictError } from "../../../common/errors/app-error.js";
import type { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import { uploadObject } from "../../../infrastructure/storage/s3-storage.js";
import {
  AdminAccountModel,
  type AdminAccountDocument
} from "../../customer/auth/auth.model.js";
import { PasswordService } from "../../customer/auth/password.service.js";
import type { CreateAdministratorInput } from "./administrators.validation.js";

type AdministratorsServiceDependencies = {
  events: DomainEventPublisher;
  passwords?: PasswordService;
};

const roleLabels: Record<AdminRoleCode, string> = {
  SUPER_ADMIN: "Super Admin",
  OPERATIONS_ADMIN: "Operations Admin",
  USER_MANAGER: "User Manager",
  MARKETPLACE_MANAGER: "Marketplace Manager",
  SUBSCRIPTION_MANAGER: "Subscription Manager",
  FINANCE_ADMIN: "Finance Admin",
  CAMPAIGN_MANAGER: "Campaign Manager",
  CONTENT_MANAGER: "Content Manager",
  SUPPORT_ADMIN: "Support Admin",
  ANALYTICS_VIEWER: "Analytics Viewer",
  SYSTEM_OPERATOR: "System Operator"
};

const permissionLabel = (code: string): string =>
  code
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const permissionGroup = (code: string): string => code.split(".")[0] ?? "general";

const imageExtensionFromMimeType = (mimeType: string): string => {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  if (mimeType === "image/gif") {
    return "gif";
  }
  throw new ConflictError("Only image/jpeg, image/png, image/webp, and image/gif uploads are supported.");
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const serializeAdministrator = (account: AdminAccountDocument) => ({
  id: account._id.toString(),
  email: account.email,
  displayName: account.displayName,
  status: account.status,
  permissions: account.permissions,
  roles: account.roles,
  mfaEnabled: account.mfaEnabled,
  avatarUrl: account.avatarUrl ?? null,
  createdAt: account.createdAt.toISOString(),
  updatedAt: account.updatedAt.toISOString()
});

export class AdministratorsService {
  private readonly passwords: PasswordService;

  public constructor(private readonly dependencies: AdministratorsServiceDependencies) {
    this.passwords = dependencies.passwords ?? new PasswordService();
  }

  public listRoles() {
    return adminRoles.map((code) => ({
      code,
      label: roleLabels[code],
      permissions: rolePermissionMatrix[code]
    }));
  }

  public listPermissions() {
    return adminPermissions.map((code) => ({
      code,
      label: permissionLabel(code),
      group: permissionGroup(code)
    }));
  }

  public async createAdministrator(
    actorId: string,
    input: CreateAdministratorInput,
    image?: Express.Multer.File
  ) {
    const roles = input.roles.length ? input.roles : ["OPERATIONS_ADMIN"];
    const rolePermissions = roles.flatMap((role) =>
      role in rolePermissionMatrix ? rolePermissionMatrix[role as AdminRoleCode] : []
    );
    const permissions = Array.from(new Set<string>([
      ...rolePermissions,
      ...input.permissions
    ]));
    const avatar = image ? await this.uploadAvatar(image) : {};

    try {
      const account = await AdminAccountModel.create({
        email: input.email,
        displayName: input.displayName,
        passwordHash: await this.passwords.hash(input.password),
        roles,
        permissions,
        ...avatar
      });
      await this.dependencies.events.publish({
        type: "admin.administrators.created",
        aggregateId: account._id.toString(),
        payload: { actorId, email: account.email, roles, permissions }
      });
      return serializeAdministrator(account);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError("An admin account already exists for this email address.");
      }
      throw error;
    }
  }

  private async uploadAvatar(file: Express.Multer.File): Promise<{
    avatarKey: string;
    avatarUrl: string;
  }> {
    const avatarKey = `admin-avatars/${randomUUID()}.${imageExtensionFromMimeType(file.mimetype)}`;
    const avatarUrl = await uploadObject({
      key: avatarKey,
      body: file.buffer,
      contentType: file.mimetype
    });
    return { avatarKey, avatarUrl };
  }
}
