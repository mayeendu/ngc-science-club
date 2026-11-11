import { z } from "zod";
export const announcementId = z.string().regex(/^[a-f0-9]{24}$/);
export const announcementContent = z.strictObject({
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(5000),
  published: z.boolean(),
});
export const announcementUpdate = announcementContent.extend({
  version: z.number().int().positive(),
});
export const communicationPage = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const communicationVersion = z.strictObject({
  version: z.number().int().positive(),
});
export const notificationId = z
  .string()
  .regex(/^(announcement|quiz|event|membership):[a-f0-9]{24}$/);
export const notificationRead = z.strictObject({ read: z.boolean() });
export type CommunicationActor = {
  id: string;
  role: "student" | "teacher" | "admin";
};
