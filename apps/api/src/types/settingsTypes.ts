import { z } from "zod";

/** Shown on the public site until an admin saves a different value. */
export const DEFAULT_STUDENT_COUNT = "1178";

export const settingsInputSchema = z.object({
  /** Free text: admins may write "1178", "~1200" or a label-like value. */
  students: z.string().trim().min(1, "Student count is required").max(32),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;
