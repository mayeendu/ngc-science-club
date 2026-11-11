import { z } from "zod";
import { clubJson, clubRequest } from "./club-api";
const announcement = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  updatedAt: z.iso.datetime(),
});
const managed = announcement.extend({
  published: z.boolean(),
  version: z.number(),
});
export type Announcement = z.infer<typeof announcement>;
export type ManagedAnnouncement = z.infer<typeof managed>;
export const announcementFormSchema = z.object({
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(5000),
  published: z.boolean(),
});
export type AnnouncementInput = z.infer<typeof announcementFormSchema>;
export function getAnnouncement(id: string, signal: AbortSignal) {
  return clubRequest(
    `announcements/${encodeURIComponent(id)}`,
    z.object({ success: z.literal(true), announcement }),
    { signal },
  );
}
export function listAnnouncements(page: number, signal: AbortSignal) {
  return clubRequest(
    `announcements?page=${page}`,
    z.object({
      success: z.literal(true),
      items: z.array(announcement),
      page: z.number(),
      hasNext: z.boolean(),
    }),
    { signal },
  );
}
export function manageAnnouncements(page: number, signal: AbortSignal) {
  return clubRequest(
    `manage/announcements?page=${page}`,
    z.object({
      success: z.literal(true),
      items: z.array(managed),
      page: z.number(),
      hasNext: z.boolean(),
    }),
    { signal },
  );
}
export function saveAnnouncement(
  input: AnnouncementInput,
  current?: ManagedAnnouncement,
) {
  return clubRequest(
    `manage/announcements${current ? `/${current.id}` : ""}`,
    z.object({ success: z.literal(true), announcement: managed }),
    clubJson(current ? "PUT" : "POST", {
      ...input,
      ...(current ? { version: current.version } : {}),
    }),
  );
}
export function archiveAnnouncement(current: ManagedAnnouncement) {
  return clubRequest(
    `manage/announcements/${current.id}`,
    z.object({ success: z.literal(true) }),
    clubJson("DELETE", { version: current.version }),
  );
}
export const notificationListSchema = z.object({
  success: z.literal(true),
  items: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["membership", "quiz", "event", "announcement"]),
      title: z.string(),
      body: z.string(),
      href: z
        .string()
        .refine((value) => value.startsWith("/") && !value.startsWith("//")),
      date: z.iso.datetime(),
      read: z.boolean(),
    }),
  ),
  unreadCount: z.number().int().nonnegative(),
  page: z.number(),
  hasNext: z.boolean(),
});
export function listNotifications(page: number, signal: AbortSignal) {
  return clubRequest(`notifications?page=${page}`, notificationListSchema, {
    signal,
  });
}
export function markNotification(id: string, read: boolean) {
  return clubRequest(
    `notifications/${encodeURIComponent(id)}`,
    z.object({ success: z.literal(true) }),
    clubJson("PATCH", { read }),
  );
}
