import { z } from "zod";
import { clubJson, clubRequest } from "./club-api";
const publicProfile = z.object({
  id: z.string(),
  name: z.string(),
  designation: z.string(),
  department: z.string(),
  specialization: z.string(),
  photo: z.string(),
  bio: z.string(),
});
const adminProfile = publicProfile.extend({
  published: z.boolean(),
  teacherAccountId: z.string(),
  assignedEventIds: z.array(z.string()),
  version: z.number(),
});
export type FacultyProfile = z.infer<typeof publicProfile>;
export type ManagedFaculty = z.infer<typeof adminProfile>;
const id = z.string().regex(/^[a-f0-9]{24}$/);
export const facultyFormSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    designation: z.string().trim().min(2).max(120),
    department: z.string().trim().min(2).max(100),
    specialization: z.string().trim().min(2).max(200),
    photo: z.union([
      z.literal(""),
      z
        .url()
        .max(2048)
        .refine((value) => {
          if (!URL.canParse(value)) return false;
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        }, "Use an HTTPS photo URL without credentials."),
    ]),
    bio: z.string().trim().min(10).max(4000),
    published: z.boolean(),
    teacherAccountId: z.union([z.literal(""), id]),
    assignedEventIds: z
      .array(id)
      .max(50)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Remove duplicate event IDs.",
      ),
  })
  .refine(
    (value) => value.assignedEventIds.length === 0 || !!value.teacherAccountId,
    {
      path: ["teacherAccountId"],
      message: "Link a teacher before assigning activities.",
    },
  );
export type FacultyInput = z.infer<typeof facultyFormSchema>;
const pagination = {
  success: z.literal(true),
  page: z.number(),
  hasNext: z.boolean(),
};
export function listFaculty(
  page: number,
  department: string,
  signal: AbortSignal,
) {
  return clubRequest(
    `faculty?${new URLSearchParams({ page: String(page), ...(department ? { department } : {}) })}`,
    z.object({ ...pagination, items: z.array(publicProfile) }),
    { signal },
  );
}
export function facultyDetail(id: string, signal: AbortSignal) {
  return clubRequest(
    `faculty/${encodeURIComponent(id)}`,
    z.object({ success: z.literal(true), profile: publicProfile }),
    { signal },
  );
}
export function manageFaculty(page: number, signal: AbortSignal) {
  return clubRequest(
    `admin/faculty?page=${page}`,
    z.object({ ...pagination, items: z.array(adminProfile) }),
    { signal },
  );
}
export function saveFaculty(input: FacultyInput, profile?: ManagedFaculty) {
  return clubRequest(
    `admin/faculty${profile ? `/${profile.id}` : ""}`,
    z.object({ success: z.literal(true), profile: adminProfile }),
    clubJson(profile ? "PUT" : "POST", {
      ...input,
      ...(profile ? { version: profile.version } : {}),
    }),
  );
}
export function archiveFaculty(profile: ManagedFaculty) {
  return clubRequest(
    `admin/faculty/${profile.id}`,
    z.object({ success: z.literal(true) }),
    clubJson("DELETE", { version: profile.version }),
  );
}
export function assignedActivities(page: number, signal: AbortSignal) {
  return clubRequest(
    `teacher/activities?page=${page}`,
    z.object({
      ...pagination,
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          startsAt: z.iso.datetime(),
          venue: z.string(),
          status: z.enum(["draft", "published", "cancelled"]),
        }),
      ),
    }),
    { signal },
  );
}
