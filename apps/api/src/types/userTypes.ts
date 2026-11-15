import { z } from "zod";
import { isPermission, ROLES } from "../permissions";

const permissionKeySchema = z
  .string()
  .refine(isPermission, { message: "Unknown permission" });

const roleSchema = z.enum(ROLES);

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.email(),
  password: z.string().min(8).max(200),
  role: roleSchema.default("inactive"),
  permissions: z.array(permissionKeySchema).max(100).default([]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  password: z.string().min(8).max(200).optional(),
  role: roleSchema.optional(),
  permissions: z.array(permissionKeySchema).max(100).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
