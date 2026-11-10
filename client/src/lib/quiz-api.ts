import { z } from "zod";
const option = z.string().trim().min(1, "Option is required").max(300);
export const mcqSchema = z.strictObject({
  text: z.string().trim().min(5).max(1000),
  options: z
    .tuple([option, option, option, option])
    .refine(
      (options) =>
        new Set(options.map((value) => value.toLowerCase())).size === 4,
      { message: "Provide four distinct options.", path: [0] },
    ),
  correctOption: z.number().int().min(0).max(3),
  marks: z.number().int().min(1).max(100),
  explanation: z.string().trim().max(2000).optional(),
});
export const quizFormSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(2000),
  subject: z.string().trim().min(2).max(100),
  durationMinutes: z.number().int().min(1).max(180),
  questions: z.array(mcqSchema).max(50),
});
export type QuizValues = z.infer<typeof quizFormSchema>;
const summarySchema = z.object({
  hasAttempts: z.boolean().optional(),
  closed: z.boolean().optional(),
  resultsReleased: z.boolean().optional(),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  subject: z.string(),
  durationMinutes: z.number().int(),
  totalMarks: z.number().int(),
  questionCount: z.number().int(),
  status: z.enum(["draft", "published"]),
  version: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const detailSchema = summarySchema.extend({ questions: z.array(mcqSchema) });
export type QuizSummary = z.infer<typeof summarySchema>;
export type QuizDetail = z.infer<typeof detailSchema>;
export type QuizList = {
  quizzes: QuizSummary[];
  page: number;
  hasNext: boolean;
};
export class QuizApiError extends Error {
  constructor(public status: number) {
    super(
      status === 401
        ? "Your session expired. Please sign in again."
        : status === 403
          ? "Teacher or administrator access is required."
          : status === 404
            ? "Quiz not found or not accessible."
            : status === 409
              ? "Quiz changed or is published. Refresh; unpublish before editing or deleting."
              : status === 400
                ? "Invalid quiz. Check all fields and include a complete MCQ before publishing."
                : "Unable to manage quizzes. Please try again.",
    );
  }
}
async function request(path: string, options: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Quiz API is not configured.");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/manage/quizzes${path}`,
    {
      ...options,
      credentials: "include",
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(12_000)])
        : AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new QuizApiError(response.status);
  if (response.status === 204) return null;
  const body: unknown = await response.json();
  return body;
}
function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
export async function listQuizzes(
  page: number,
  status: string,
  signal: AbortSignal,
): Promise<QuizList> {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set("status", status);
  return z
    .object({
      success: z.literal(true),
      quizzes: z.array(summarySchema),
      page: z.number().int(),
      hasNext: z.boolean(),
    })
    .parse(await request(`?${params}`, { signal }));
}
export async function quizDetail(id: string) {
  return z
    .object({ success: z.literal(true), quiz: detailSchema })
    .parse(await request(`/${encodeURIComponent(id)}`)).quiz;
}
export async function saveQuiz(values: QuizValues, quiz?: QuizDetail | null) {
  const content = quizFormSchema.parse(values);
  return z
    .object({ success: z.literal(true), quiz: detailSchema })
    .parse(
      await request(
        quiz ? `/${encodeURIComponent(quiz.id)}` : "",
        json(
          quiz ? "PATCH" : "POST",
          quiz ? { ...content, version: quiz.version } : content,
        ),
      ),
    ).quiz;
}
export async function quizAction(
  quiz: QuizSummary,
  action: "publish" | "unpublish" | "delete",
) {
  const id = encodeURIComponent(quiz.id);
  await request(
    action === "delete" ? `/${id}` : `/${id}/status`,
    json(action === "delete" ? "DELETE" : "PATCH", {
      version: quiz.version,
      ...(action === "delete"
        ? {}
        : { status: action === "publish" ? "published" : "draft" }),
    }),
  );
}
export function blankQuestion(): QuizValues["questions"][number] {
  return { text: "", options: ["", "", "", ""], correctOption: 0, marks: 1 };
}
