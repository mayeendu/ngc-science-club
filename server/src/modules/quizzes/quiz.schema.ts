import { z } from "zod";
export const questionSchema = z.strictObject({
  text: z.string().trim().min(5).max(1000),
  options: z
    .tuple([
      z.string().trim().min(1).max(300),
      z.string().trim().min(1).max(300),
      z.string().trim().min(1).max(300),
      z.string().trim().min(1).max(300),
    ])
    .refine(
      (options) =>
        new Set(options.map((option) => option.toLowerCase())).size === 4,
      "Options must be distinct.",
    ),
  correctOption: z.number().int().min(0).max(3),
  marks: z.number().int().min(1).max(100),
  explanation: z.string().trim().max(2000).optional(),
});
export const quizContentSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(2000),
  subject: z.string().trim().min(2).max(100),
  durationMinutes: z.number().int().min(1).max(180),
  questions: z.array(questionSchema).max(50),
});
export const quizCreateSchema = quizContentSchema.extend({
  status: z.literal("draft").default("draft"),
});
export const quizUpdateSchema = quizContentSchema.extend({
  version: z.number().int().positive(),
});
export const quizStatusSchema = z.strictObject({
  status: z.enum(["draft", "published"]),
  version: z.number().int().positive(),
});
export const quizDeleteSchema = z.strictObject({
  version: z.number().int().positive(),
});
export const quizListSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  status: z.enum(["draft", "published"]).optional(),
});
export const quizIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
export type QuizContent = z.infer<typeof quizContentSchema>;
export type QuizActor = { id: string; role: "teacher" | "admin" };
export type QuizSummary = {
  hasAttempts?: boolean;
  closed?: boolean;
  resultsReleased?: boolean;
  id: string;
  title: string;
  description: string;
  subject: string;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  status: "draft" | "published";
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type QuizDetail = QuizSummary & { questions: QuizContent["questions"] };
export type QuizList = {
  quizzes: QuizSummary[];
  page: number;
  hasNext: boolean;
};
