import { z } from "zod";
export const eventCategories = [
  "activity",
  "workshop",
  "seminar",
  "competition",
  "achievement",
] as const;
export const eventIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
export const eventContentSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(eventCategories),
  startsAt: z.iso.datetime(),
  venue: z.string().trim().min(3).max(200),
  capacity: z.number().int().min(1).max(1000),
  image: z.union([
    z.literal(""),
    z
      .url()
      .max(2048)
      .refine((value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      }, "Use an HTTPS image URL without credentials."),
  ]),
});
export const eventCreateSchema = eventContentSchema;
export const eventUpdateSchema = eventContentSchema.extend({
  version: z.number().int().positive(),
});
export const eventVersionSchema = z.strictObject({
  version: z.number().int().positive(),
});
export const eventStatusSchema = eventVersionSchema.extend({
  status: z.enum(["draft", "published", "cancelled"]),
});
export const eventPageSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const publicEventListSchema = eventPageSchema.extend({
  period: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  category: z.enum(eventCategories).optional(),
});
export const staffEventListSchema = eventPageSchema.extend({
  status: z.enum(["draft", "published", "cancelled"]).optional(),
});
export const eventEmptySchema = z.strictObject({});
export const attendanceSchema = z.strictObject({
  registrationId: z.string().min(1).max(200),
  attendance: z.enum(["present", "absent"]),
  version: z.number().int().positive(),
});
export type EventContent = z.infer<typeof eventContentSchema>;
export type EventActor = { id: string; role: "teacher" | "admin" };
export type EventStatus = "draft" | "published" | "cancelled";
export type EventView = EventContent & {
  id: string;
  status: EventStatus;
  registeredCount: number;
  version: number;
  createdAt: string;
};
