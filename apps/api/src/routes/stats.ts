import { count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { siteSettings, teachers } from "../db/schema";
import { getFilcRoomCounts } from "../lib/filc";
import { DEFAULT_STUDENT_COUNT } from "../types/settingsTypes";

export const registerStatsRoutes = (app: Hono) => {
  /** Public counters for the homepage and the school profile pages. */
  app.get("/api/stats", async (c) => {
    const [teacherRow, studentsRow, rooms] = await Promise.all([
      db
        .select({ value: count() })
        .from(teachers)
        .where(eq(teachers.published, true)),
      db.query.siteSettings.findFirst({
        where: eq(siteSettings.key, "students"),
      }),
      getFilcRoomCounts(),
    ]);

    return c.json({
      teachers: Number(teacherRow[0]?.value ?? 0),
      students: studentsRow?.value ?? DEFAULT_STUDENT_COUNT,
      classrooms: rooms?.classrooms ?? null,
      labs: rooms?.labs ?? null,
    });
  });
};
