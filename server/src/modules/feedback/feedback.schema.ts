import { z } from "zod";
export const feedbackId = z.string().regex(/^[a-f0-9]{24}$/);
export const feedbackCreate = z.strictObject({
  category: z.enum(["suggestion", "event", "quiz", "technical", "general"]),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(3000),
});
export const feedbackReply = z.strictObject({
  version: z.number().int().positive(),
  message: z.string().trim().min(1).max(3000),
});
export const feedbackStatus = z.enum(["open", "in_review", "resolved"]);
export const feedbackStaffReply = feedbackReply.extend({
  status: feedbackStatus,
});
export const feedbackAssign = z.strictObject({
  version: z.number().int().positive(),
  teacherAccountId: z.union([z.literal(""), feedbackId]),
});
export const feedbackQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  status: feedbackStatus.optional(),
  category: feedbackCreate.shape.category.optional(),
});
export type FeedbackActor = {
  id: string;
  role: "student" | "teacher" | "admin";
  name: string;
};
