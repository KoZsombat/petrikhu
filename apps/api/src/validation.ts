import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import type { ZodType } from "zod";

const invalid = (error: { issues: { message?: string }[] }, c: Context) =>
  c.json({ error: error.issues[0]?.message ?? "Invalid request" }, 400);

export const validateJson = <T extends ZodType>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) return invalid(result.error, c);
  });

export const validateQuery = <T extends ZodType>(schema: T) =>
  zValidator("query", schema, (result, c) => {
    if (!result.success) return invalid(result.error, c);
  });
