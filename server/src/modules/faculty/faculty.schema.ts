import { z } from "zod";
import { eventContentSchema, eventIdSchema } from "../events/event.schema.js";
export const facultyIdSchema = eventIdSchema;
export const facultyContentSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(120),
    designation: z.string().trim().min(2).max(120),
    department: z.string().trim().min(2).max(100),
    specialization: z.string().trim().min(2).max(200),
    photo: eventContentSchema.shape.image,
    bio: z.string().trim().min(10).max(4000),
    published: z.boolean(),
    teacherAccountId: z.union([z.literal(""), eventIdSchema]),
    assignedEventIds: z
      .array(eventIdSchema)
      .max(50)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate activities are not allowed.",
      ),
  })
  .refine(
    (value) => value.assignedEventIds.length === 0 || !!value.teacherAccountId,
    "Link an existing teacher before assigning activities.",
  );
export const facultyVersionSchema = z.strictObject({
  version: z.number().int().positive(),
});
export const facultyUpdateSchema = z
  .strictObject({
    ...facultyContentSchema.shape,
    version: z.number().int().positive(),
  })
  .refine(
    (value) => value.assignedEventIds.length === 0 || !!value.teacherAccountId,
  );
export const facultyListSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  department: z.string().trim().min(2).max(100).optional(),
});
export type FacultyContent = z.infer<typeof facultyContentSchema>;
