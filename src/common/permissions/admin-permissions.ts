export const adminRoles = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "USER_MANAGER",
  "MARKETPLACE_MANAGER",
  "SUBSCRIPTION_MANAGER",
  "FINANCE_ADMIN",
  "CAMPAIGN_MANAGER",
  "CONTENT_MANAGER",
  "SUPPORT_ADMIN",
  "ANALYTICS_VIEWER",
  "SYSTEM_OPERATOR"
] as const;

export type AdminRoleCode = (typeof adminRoles)[number];

export const adminPermissions = [
  "dashboard.read",
  "users.read",
  "users.update",
  "users.suspend",
  "users.delete",
  "users.restore",
  "users.export",
  "subscriptions.read",
  "subscriptions.create",
  "subscriptions.update",
  "subscriptions.delete",
  "subscriptions.assign",
  "subscriptions.refund",
  "marketplaces.read",
  "marketplaces.configure",
  "marketplaces.sync",
  "marketplaces.disable",
  "marketplaces.rotate_key",
  "campaigns.read",
  "campaigns.create",
  "campaigns.publish",
  "campaigns.pause",
  "campaigns.delete",
  "analytics.read",
  "analytics.export",
  "system.maintenance.update",
  "admins.read",
  "admins.create",
  "admins.update",
  "admins.delete",
  "reports.read",
  "reports.assign",
  "reports.resolve",
  "reports.dismiss",
  "reports.escalate",
  "email.send",
  "email.schedule",
  "email.templates.manage",
  "settings.read",
  "settings.update",
  "legal.update"
] as const;

export type AdminPermissionCode = (typeof adminPermissions)[number];

export const rolePermissionMatrix: Record<AdminRoleCode, AdminPermissionCode[]> = {
  SUPER_ADMIN: [...adminPermissions],
  OPERATIONS_ADMIN: [
    "dashboard.read",
    "users.read",
    "marketplaces.read",
    "reports.read",
    "reports.assign",
    "reports.resolve"
  ],
  USER_MANAGER: ["dashboard.read", "users.read", "users.update", "users.suspend", "users.export"],
  MARKETPLACE_MANAGER: [
    "dashboard.read",
    "marketplaces.read",
    "marketplaces.configure",
    "marketplaces.sync",
    "marketplaces.disable"
  ],
  SUBSCRIPTION_MANAGER: [
    "dashboard.read",
    "subscriptions.read",
    "subscriptions.create",
    "subscriptions.update",
    "subscriptions.assign"
  ],
  FINANCE_ADMIN: [
    "dashboard.read",
    "subscriptions.read",
    "subscriptions.refund",
    "analytics.read",
    "analytics.export"
  ],
  CAMPAIGN_MANAGER: [
    "dashboard.read",
    "campaigns.read",
    "campaigns.create",
    "campaigns.publish",
    "campaigns.pause",
    "email.send",
    "email.schedule"
  ],
  CONTENT_MANAGER: ["dashboard.read", "settings.read", "legal.update", "settings.update"],
  SUPPORT_ADMIN: [
    "dashboard.read",
    "users.read",
    "reports.read",
    "reports.assign",
    "reports.resolve"
  ],
  ANALYTICS_VIEWER: ["dashboard.read", "analytics.read", "analytics.export"],
  SYSTEM_OPERATOR: ["dashboard.read", "system.maintenance.update", "settings.read"]
};
