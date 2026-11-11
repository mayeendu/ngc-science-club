import { z } from "zod";
export const eventCategories = [
  "activity",
  "workshop",
  "seminar",
  "competition",
  "achievement",
] as const;
export const eventContentSchema = z.object({
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
export const eventSchema = eventContentSchema.extend({
  id: z.string(),
  status: z.enum(["draft", "published", "cancelled"]),
  version: z.number(),
  registeredCount: z.number(),
  createdAt: z.iso.datetime(),
});
export type ClubEvent = z.infer<typeof eventSchema>;
export type EventContent = z.infer<typeof eventContentSchema>;
const registrationSchema = z.object({
  id: z.string(),
  status: z.enum(["registered", "cancelled"]),
  attendance: z.enum(["unmarked", "present", "absent"]),
  version: z.number(),
  registeredAt: z.iso.datetime(),
});
const ownSchema = z.object({
  success: z.literal(true),
  event: eventSchema,
  registration: registrationSchema.nullable(),
});
export type OwnEvent = z.infer<typeof ownSchema>;
const listSchema = z.object({
  success: z.literal(true),
  events: z.array(eventSchema),
  page: z.number(),
  hasNext: z.boolean(),
});
const statsSchema = z.object({
  success: z.literal(true),
  total: z.number(),
  published: z.number(),
  draft: z.number(),
  cancelled: z.number(),
  registrations: z.number(),
  present: z.number(),
  absent: z.number(),
  categories: z.array(z.object({ category: z.string(), count: z.number() })),
});
export type EventStats = z.infer<typeof statsSchema>;
const participantsSchema = z.object({
  success: z.literal(true),
  event: eventSchema,
  items: z.array(registrationSchema.extend({ name: z.string() })),
  counts: z.object({
    registered: z.number(),
    present: z.number(),
    absent: z.number(),
  }),
  page: z.number(),
  hasNext: z.boolean(),
});
export type Participants = z.infer<typeof participantsSchema>;
export class EventApiError extends Error {
  constructor(
    public status: number,
    message?: string,
  ) {
    super(
      message ??
        (status === 401
          ? "Your session expired. Sign in again."
          : status === 403
            ? "Approved membership or the required role is missing."
            : status === 404
              ? "Event not found."
              : status === 409
                ? "Event or registration changed. Refresh and try again."
                : "Unable to load events. Please retry."),
    );
  }
}
async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Event API is not configured.");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const parsed = z.object({ message: z.string().max(250) }).safeParse(data);
    throw new EventApiError(
      response.status,
      parsed.success && (response.status === 400 || response.status === 409)
        ? parsed.data.message
        : undefined,
    );
  }
  return schema.parse(response.status === 204 ? null : await response.json());
}
export const listEvents = (
  page: number,
  period: string,
  category: string,
  signal: AbortSignal,
) =>
  request(
    `events?page=${page}&period=${period}${category ? `&category=${encodeURIComponent(category)}` : ""}`,
    listSchema,
    "GET",
    undefined,
    signal,
  );
export const eventDetail = (id: string, signal?: AbortSignal) =>
  request(
    `events/${encodeURIComponent(id)}`,
    z.object({ success: z.literal(true), event: eventSchema }),
    "GET",
    undefined,
    signal,
  );
export const ownEvent = (id: string, signal?: AbortSignal) =>
  request(
    `student/events/${encodeURIComponent(id)}`,
    ownSchema,
    "GET",
    undefined,
    signal,
  );
export const registerEvent = (id: string, cancel = false) =>
  request(
    `student/events/${encodeURIComponent(id)}/${cancel ? "cancel" : "register"}`,
    ownSchema,
    "POST",
    {},
  );
export const myEvents = (page: number, signal: AbortSignal) =>
  request(
    `student/events?page=${page}`,
    z.object({
      success: z.literal(true),
      items: z.array(
        z.object({ event: eventSchema, registration: registrationSchema }),
      ),
      page: z.number(),
      hasNext: z.boolean(),
    }),
    "GET",
    undefined,
    signal,
  );
export const manageEvents = (
  page: number,
  status: string,
  signal: AbortSignal,
) =>
  request(
    `manage/events?page=${page}${status ? `&status=${status}` : ""}`,
    listSchema,
    "GET",
    undefined,
    signal,
  );
export const eventStats = (signal: AbortSignal) =>
  request("manage/events/stats", statsSchema, "GET", undefined, signal);
export const saveEvent = (input: EventContent, event?: ClubEvent) =>
  request(
    event ? `manage/events/${event.id}` : "manage/events",
    z.object({ success: z.literal(true), event: eventSchema }),
    event ? "PATCH" : "POST",
    event ? { ...input, version: event.version } : input,
  );
export const changeEventStatus = (
  event: ClubEvent,
  status: ClubEvent["status"],
) =>
  request(
    `manage/events/${event.id}/status`,
    z.object({ success: z.literal(true), event: eventSchema }),
    "PATCH",
    { version: event.version, status },
  );
export const deleteEvent = (event: ClubEvent) =>
  request(`manage/events/${event.id}`, z.null(), "DELETE", {
    version: event.version,
  });
export const eventParticipants = (
  id: string,
  page: number,
  signal: AbortSignal,
) =>
  request(
    `manage/events/${encodeURIComponent(id)}/participants?page=${page}`,
    participantsSchema,
    "GET",
    undefined,
    signal,
  );
export const markAttendance = (
  id: string,
  item: Participants["items"][number],
  attendance: "present" | "absent",
) =>
  request(
    `manage/events/${encodeURIComponent(id)}/attendance`,
    z.object({
      success: z.literal(true),
      registration: registrationSchema.extend({ name: z.string() }),
    }),
    "PATCH",
    { registrationId: item.id, version: item.version, attendance },
  );
export const eventDate = (date: string) =>
  new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
