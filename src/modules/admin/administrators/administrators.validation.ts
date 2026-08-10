import { z } from "zod";
import {
  adminPermissions,
  adminRoles
} from "../../../common/permissions/admin-permissions.js";

const email = z.string().trim().email().transform((value) => value.toLowerCase());

const jsonArray = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

export const createAdministratorSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email,
    password: z.string().min(8).max(128),
    roles: z.preprocess(jsonArray, z.array(z.enum(adminRoles)).max(50)).default([]),
    permissions: z.preprocess(jsonArray, z.array(z.enum(adminPermissions)).max(100)).default([])
  })
  .strict();

export type CreateAdministratorInput = z.infer<typeof createAdministratorSchema>;
