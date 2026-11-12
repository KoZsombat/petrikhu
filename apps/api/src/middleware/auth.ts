import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { auth } from "../auth";
import { db } from "../db";
import { userPermissions } from "../db/schema";
import {
  effectivePermissions,
  type Permission,
} from "../permissions";

export const ROLES = ["admin", "editor", "reviewer", "author", "inactive"] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

export const roleOf = (user: unknown): Role => {
  if (user && typeof user === "object" && "role" in user) {
    const role = user.role;
    if (isRole(role)) return role;
  }
  return "inactive";
};

/** Role defaults plus every permission granted directly to the user. */
export const permissionsForUser = async (
  userId: string,
  role: Role,
): Promise<Set<Permission>> => {
  if (role === "admin") return effectivePermissions(role);

  const rows = await db
    .select({ permission: userPermissions.permission })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));

  return effectivePermissions(
    role,
    rows.map((row) => row.permission),
  );
};

export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

/**
 * Requires every listed permission. A user's effective permissions are their role defaults plus
 * any direct grants, so an admin can give an author a single extra capability without changing role.
 */
export const requirePermission = (...required: Permission[]) =>
  createMiddleware(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const permissions = await permissionsForUser(
      session.user.id,
      roleOf(session.user),
    );

    if (!required.every((permission) => permissions.has(permission))) {
      return c.json(
        { error: `Forbidden: missing ${required.join(", ")}` },
        403,
      );
    }

    await next();
  });
