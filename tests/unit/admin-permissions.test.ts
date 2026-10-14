import { describe, expect, it } from "vitest";
import {
  adminPermissions,
  resolveAdminPermissions
} from "../../src/common/permissions/admin-permissions.js";

describe("resolveAdminPermissions", () => {
  it("expands the legacy bootstrap super-admin role", () => {
    const permissions = resolveAdminPermissions(["admin:dashboard"], ["super-admin"]);

    expect(permissions).toContain("reports.read");
    expect(permissions).toContain("reports.resolve");
    expect(permissions).toEqual(expect.arrayContaining([...adminPermissions]));
  });

  it("expands SUPPORT_ADMIN permissions", () => {
    const permissions = resolveAdminPermissions([], ["SUPPORT_ADMIN"]);

    expect(permissions).toEqual(
      expect.arrayContaining(["reports.read", "reports.resolve"])
    );
  });
});
