import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { teachers } from "../db/schema";
import { requirePermission } from "../middleware/auth";
import { teacherInputSchema, teacherUpdateSchema } from "../types/teacherTypes";
import { validateJson } from "../validation";

const toPublicTeacher = (teacher: typeof teachers.$inferSelect) => ({
  id: teacher.id,
  name: teacher.name,
  role: teacher.role,
  email: teacher.email,
  room: teacher.room,
  photo: teacher.photo,
});

const toTeacher = (teacher: typeof teachers.$inferSelect) => ({
  ...toPublicTeacher(teacher),
  sortOrder: teacher.sortOrder,
  published: teacher.published,
});

export const registerTeacherRoutes = (app: Hono) => {
  app.get("/api/teachers", async (c) => {
    const rows = await db
      .select()
      .from(teachers)
      .where(eq(teachers.published, true))
      .orderBy(asc(teachers.sortOrder), asc(teachers.name));

    return c.json(rows.map(toPublicTeacher));
  });

  app.get(
    "/api/admin/teachers",
    requirePermission("teachers.view"),
    async (c) => {
      const rows = await db
        .select()
        .from(teachers)
        .orderBy(asc(teachers.sortOrder), asc(teachers.name));

      return c.json(rows.map(toTeacher));
    },
  );

  app.post(
    "/api/admin/teachers",
    requirePermission("teachers.manage"),
    validateJson(teacherInputSchema),
    async (c) => {
      const input = c.req.valid("json");

      const conflict = await db.query.teachers.findFirst({
        where: eq(teachers.name, input.name),
      });

      if (conflict) {
        return c.json({ error: "Teacher name already exists" }, 409);
      }

      const [created] = await db.insert(teachers).values(input).returning();
      return c.json(toTeacher(created), 201);
    },
  );

  app.put(
    "/api/admin/teachers/:id",
    requirePermission("teachers.manage"),
    validateJson(teacherUpdateSchema),
    async (c) => {
      const id = c.req.param("id");
      const input = c.req.valid("json");

      const existing = await db.query.teachers.findFirst({
        where: eq(teachers.id, id),
      });

      if (!existing) return c.json({ error: "Teacher not found" }, 404);

      if (input.name && input.name !== existing.name) {
        const conflict = await db.query.teachers.findFirst({
          where: eq(teachers.name, input.name),
        });

        if (conflict) {
          return c.json({ error: "Teacher name already exists" }, 409);
        }
      }

      const [updated] = await db
        .update(teachers)
        .set(input)
        .where(eq(teachers.id, id))
        .returning();

      return c.json(toTeacher(updated));
    },
  );

  app.delete(
    "/api/admin/teachers/:id",
    requirePermission("teachers.manage"),
    async (c) => {
      const id = c.req.param("id");

      const deleted = await db
        .delete(teachers)
        .where(eq(teachers.id, id))
        .returning({ id: teachers.id });

      if (deleted.length === 0) {
        return c.json({ error: "Teacher not found" }, 404);
      }

      return c.body(null, 204);
    },
  );
};
