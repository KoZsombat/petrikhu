import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/auth-schema";
import { userPermissions } from "../db/schema";
import { env } from "../env";
import {
  permissionsForUser,
  requireAuth,
  requirePermission,
  roleOf,
} from "../middleware/auth";
import {
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  type Permission,
  type Role,
} from "../permissions";
import { createUserSchema, updateUserSchema } from "../types/userTypes";
import { validateJson } from "../validation";

const toUser = (row: typeof user.$inferSelect, permissions: string[] = []) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: roleOf(row),
  permissions,
  isSeededAdmin: row.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase(),
  createdAt: row.createdAt.toISOString(),
});

const extraPermissionsByUser = async () => {
  const rows = await db
    .select({
      userId: userPermissions.userId,
      permission: userPermissions.permission,
    })
    .from(userPermissions);

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row.permission);
    map.set(row.userId, list);
  }
  return map;
};

const actorContext = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const role = roleOf(session.user);
  return {
    userId: session.user.id,
    role,
    permissions: await permissionsForUser(session.user.id, role),
  };
};

/**
 * A permission grant must stay inside the actor's own effective permissions: nobody can hand out a
 * capability they do not hold, which also stops a delegated user manager from escalating to admin.
 */
const exceedsActor = (
  actor: Set<Permission>,
  permissions: Iterable<string>,
): string | null => {
  for (const permission of permissions) {
    if (!actor.has(permission as Permission)) return permission;
  }
  return null;
};

export const registerUserRoutes = (app: Hono) => {
  app.get("/api/me/permissions", requireAuth, async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const permissions = await permissionsForUser(
      session.user.id,
      roleOf(session.user),
    );

    return c.json({ permissions: [...permissions] });
  });

  app.get(
    "/api/admin/permissions",
    requirePermission("users.view"),
    async (c) =>
      c.json({
        permissions: PERMISSION_CATALOG.map((entry) => ({ ...entry })),
      }),
  );

  app.get("/api/admin/users", requirePermission("users.view"), async (c) => {
    const [rows, extras] = await Promise.all([
      db.select().from(user).orderBy(asc(user.createdAt)),
      extraPermissionsByUser(),
    ]);

    return c.json(rows.map((row) => toUser(row, extras.get(row.id) ?? [])));
  });

  app.post(
    "/api/admin/users",
    requirePermission("users.manage"),
    validateJson(createUserSchema),
    async (c) => {
      const input = c.req.valid("json");
      const email = input.email.toLowerCase();

      const existing = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (existing) return c.json({ error: "Email already exists" }, 409);

      const actor = await actorContext(c.req.raw);
      if (!actor) return c.json({ error: "Unauthorized" }, 401);

      if (input.role === "admin" && actor.role !== "admin") {
        return c.json({ error: "Only an admin can create an admin" }, 403);
      }

      const granted = [...ROLE_PERMISSIONS[input.role], ...input.permissions];

      if (granted.length > 0) {
        if (!actor.permissions.has("users.permissions")) {
          return c.json({ error: "Forbidden: missing users.permissions" }, 403);
        }

        const exceeded = exceedsActor(actor.permissions, granted);
        if (exceeded) {
          return c.json(
            { error: `Forbidden: cannot grant ${exceeded}` },
            403,
          );
        }
      }

      const created = await auth.api.signUpEmail({
        body: { name: input.name, email, password: input.password },
      });

      const context = await auth.$context;
      await context.internalAdapter.updateUser(created.user.id, {
        role: input.role,
      });

      if (input.permissions.length > 0) {
        await db.insert(userPermissions).values(
          input.permissions.map((permission) => ({
            userId: created.user.id,
            permission,
          })),
        );
      }

      const row = await db.query.user.findFirst({
        where: eq(user.id, created.user.id),
      });

      if (!row) return c.json({ error: "User not found" }, 404);

      return c.json(toUser(row, input.permissions), 201);
    },
  );

  app.put(
    "/api/admin/users/:id",
    requireAuth,
    validateJson(updateUserSchema),
    async (c) => {
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const actor = await actorContext(c.req.raw);

      if (!actor) return c.json({ error: "Unauthorized" }, 401);

      const existing = await db.query.user.findFirst({
        where: eq(user.id, id),
      });

      if (!existing) return c.json({ error: "User not found" }, 404);

      const isSelf = actor.userId === id;
      const isSeededAdmin =
        existing.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
      const targetRole = roleOf(existing);

      if (isSeededAdmin && !isSelf) {
        return c.json(
          { error: "The seeded admin can only be edited by itself" },
          403,
        );
      }

      const changesProfile =
        input.name !== undefined || input.password !== undefined;
      const changesRole = input.role !== undefined && input.role !== targetRole;
      const changesPermissions = input.permissions !== undefined;

      if (changesProfile && !actor.permissions.has("users.manage")) {
        return c.json({ error: "Forbidden: missing users.manage" }, 403);
      }

      if (changesRole && !actor.permissions.has("users.manage")) {
        return c.json({ error: "Forbidden: missing users.manage" }, 403);
      }

      if (changesPermissions && !actor.permissions.has("users.permissions")) {
        return c.json(
          { error: "Forbidden: missing users.permissions" },
          403,
        );
      }

      if (isSelf && (changesRole || changesPermissions)) {
        return c.json(
          { error: "You cannot change your own role or permissions" },
          400,
        );
      }

      if (changesRole) {
        if (!actor.permissions.has("users.permissions")) {
          return c.json(
            { error: "Forbidden: missing users.permissions" },
            403,
          );
        }

        if (
          (targetRole === "admin" || input.role === "admin") &&
          actor.role !== "admin"
        ) {
          return c.json(
            { error: "Only an admin can change admin roles" },
            403,
          );
        }

        const exceeded = exceedsActor(
          actor.permissions,
          ROLE_PERMISSIONS[input.role as Role],
        );

        if (exceeded) {
          return c.json({ error: `Forbidden: cannot grant ${exceeded}` }, 403);
        }
      }

      if (changesPermissions) {
        const requested = new Set(input.permissions);
        const current = new Set(
          (await extraPermissionsByUser()).get(id) ?? [],
        );

        const exceeded = exceedsActor(actor.permissions, requested);
        if (exceeded) {
          return c.json({ error: `Forbidden: cannot grant ${exceeded}` }, 403);
        }

        // Removing a permission the actor does not hold would let it strip capabilities it does
        // not understand, so those rows are off limits too.
        for (const permission of current) {
          if (
            !requested.has(permission as Permission) &&
            !actor.permissions.has(permission as Permission)
          ) {
            return c.json(
              { error: `Forbidden: cannot revoke ${permission}` },
              403,
            );
          }
        }
      }

      const context = await auth.$context;

      if (input.name) {
        await context.internalAdapter.updateUser(id, { name: input.name });
      }

      if (changesRole) {
        await context.internalAdapter.updateUser(id, { role: input.role });
      }

      if (input.password) {
        await context.internalAdapter.updatePassword(id, input.password);
      }

      if (input.permissions !== undefined) {
        const unique = [...new Set(input.permissions)];
        await db.transaction(async (tx) => {
          await tx
            .delete(userPermissions)
            .where(eq(userPermissions.userId, id));
          if (unique.length > 0) {
            await tx.insert(userPermissions).values(
              unique.map((permission) => ({ userId: id, permission })),
            );
          }
        });
      }

      const row = await db.query.user.findFirst({
        where: eq(user.id, id),
      });

      const extras =
        input.permissions ?? (await extraPermissionsByUser()).get(id) ?? [];

      return c.json(toUser(row ?? existing, extras));
    },
  );

  app.delete(
    "/api/admin/users/:id",
    requirePermission("users.manage"),
    async (c) => {
      const id = c.req.param("id");

      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
      if (session?.user.id === id) {
        return c.json({ error: "You cannot delete your own account" }, 400);
      }

      const existing = await db.query.user.findFirst({
        where: eq(user.id, id),
      });

      if (!existing) return c.json({ error: "User not found" }, 404);

      if (existing.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) {
        return c.json({ error: "The seeded admin cannot be deleted" }, 403);
      }

      const context = await auth.$context;
      await context.internalAdapter.deleteUser(id);

      return c.body(null, 204);
    },
  );
};
