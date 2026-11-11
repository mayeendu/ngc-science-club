import { z } from "zod";
import { clubJson, clubRequest } from "./club-api";
export const feedbackCategories = [
  "suggestion",
  "event",
  "quiz",
  "technical",
  "general",
] as const;
export const feedbackStatuses = ["open", "in_review", "resolved"] as const;
export const feedbackFormSchema = z.object({
  category: z.enum(feedbackCategories),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(3000),
});
const threadSchema = z.object({
  id: z.string(),
  category: z.enum(feedbackCategories),
  subject: z.string(),
  status: z.enum(feedbackStatuses),
  version: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  messages: z.array(
    z.object({
      author: z.enum(["member", "staff"]),
      message: z.string(),
      sentAt: z.iso.datetime(),
    }),
  ),
  memberName: z.string().optional(),
  assignedTeacherId: z.string().optional(),
});
export type FeedbackThread = z.infer<typeof threadSchema>;
export type FeedbackInput = z.infer<typeof feedbackFormSchema>;
export type FeedbackStatus = (typeof feedbackStatuses)[number];
export function feedbackList(
  staff: boolean,
  page: number,
  status: string,
  category: string,
  signal: AbortSignal,
) {
  return clubRequest(
    `${staff ? "manage/" : ""}feedback?${new URLSearchParams({ page: String(page), ...(status ? { status } : {}), ...(category ? { category } : {}) })}`,
    z.object({
      success: z.literal(true),
      page: z.number(),
      hasNext: z.boolean(),
      items: z.array(threadSchema),
    }),
    { signal },
  );
}
export function submitFeedback(input: FeedbackInput) {
  return clubRequest(
    "feedback",
    z.object({ success: z.literal(true), thread: threadSchema }),
    clubJson("POST", input),
  );
}
export function replyFeedback(
  thread: FeedbackThread,
  message: string,
  staff: boolean,
  status: FeedbackStatus,
) {
  return clubRequest(
    `${staff ? "manage/" : ""}feedback/${thread.id}/replies`,
    z.object({ success: z.literal(true), thread: threadSchema }),
    clubJson("POST", {
      version: thread.version,
      message,
      ...(staff ? { status } : {}),
    }),
  );
}
export function assignFeedback(
  thread: FeedbackThread,
  teacherAccountId: string,
) {
  return clubRequest(
    `manage/feedback/${thread.id}/assignment`,
    z.object({ success: z.literal(true) }),
    clubJson("PUT", { version: thread.version, teacherAccountId }),
  );
}
