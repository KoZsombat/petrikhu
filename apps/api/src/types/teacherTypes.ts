import { z } from "zod";

export const teacherInputSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(300).default(""),
  email: z.string().max(200).nullable().default(null),
  room: z.string().max(200).nullable().default(null),
  photo: z.string().max(1000).nullable().default(null),
  sortOrder: z.number().int().min(0).default(0),
  published: z.boolean().default(true),
});

export const teacherUpdateSchema = teacherInputSchema.partial();

export type TeacherInput = z.infer<typeof teacherInputSchema>;
export type TeacherUpdate = z.infer<typeof teacherUpdateSchema>;
