import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { siteSettings } from "../db/schema";
import { requirePermission } from "../middleware/auth";
import {
  DEFAULT_STUDENT_COUNT,
  settingsInputSchema,
} from "../types/settingsTypes";
import { validateJson } from "../validation";

export const registerSettingsRoutes = (app: Hono) => {
  app.get(
    "/api/admin/settings",
    requirePermission("settings.manage"),
    async (c) => {
      const studentsRow = await db.query.siteSettings.findFirst({
        where: eq(siteSettings.key, "students"),
      });

      return c.json({
        students: studentsRow?.value ?? DEFAULT_STUDENT_COUNT,
      });
    },
  );

  app.put(
    "/api/admin/settings",
    requirePermission("settings.manage"),
    validateJson(settingsInputSchema),
    async (c) => {
      const { students } = c.req.valid("json");

      await db
        .insert(siteSettings)
        .values({ key: "students", value: students })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: students },
        });

      return c.json({ students });
    },
  );
};
