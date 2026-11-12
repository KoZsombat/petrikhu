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
import { PERMISSION_CATALOG, type Permission } from "../permissions";
import { createUserSchema, updateUserSchema } from "../types/userTypes";
import { validateJson } from "../validation";

const toUser = (row: typeof user.$inferSelect, permissions: string[] = []) => ({
  id: row.id,
  name: row.name,
  email: row.email,
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

const actorPermissions = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Set<Permission>();
  return permissionsForUser(session.user.id, roleOf(session.user));
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

      const actor = await actorPermissions(c.req.raw);
      if (input.permissions.length > 0 && !actor.has("users.permissions")) {
        return c.json({ error: "Forbidden: missing users.permissions" }, 403);
      }

      const created = await auth.api.signUpEmail({
        body: { name: input.name, email, password: input.password },
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
    requirePermission("users.view"),
    validateJson(updateUserSchema),
    async (c) => {
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const actor = await actorPermissions(c.req.raw);

      const existing = await db.query.user.findFirst({
        where: eq(user.id, id),
      });

      if (!existing) return c.json({ error: "User not found" }, 404);

      const changesProfile =
        input.name !== undefined || input.password !== undefined;

      if (changesProfile && !actor.has("users.manage")) {
        return c.json({ error: "Forbidden: missing users.manage" }, 403);
      }

      if (input.permissions !== undefined && !actor.has("users.permissions")) {
        return c.json({ error: "Forbidden: missing users.permissions" }, 403);
      }

      const context = await auth.$context;

      if (input.name) {
        await context.internalAdapter.updateUser(id, { name: input.name });
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
