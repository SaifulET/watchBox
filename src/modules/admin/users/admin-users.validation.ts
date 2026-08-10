import { Types } from "mongoose";
import { z } from "zod";

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().max(120).optional(),
  tier: z.string().trim().max(40).optional(),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
  sortBy: z.enum(["name", "email", "status", "lastActive", "joinedDate"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional()
});

export const adminUserParamsSchema = z.object({
  userId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid user id.")
});

export const adminUserStatusSchema = z.object({
  status: z.enum(["active", "suspended"])
});

export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;
