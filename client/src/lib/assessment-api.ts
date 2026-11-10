import { z } from "zod";
const choice = z.number().int().min(0).max(3).nullable();
const question = z.strictObject({
  text: z.string(),
  options: z.array(z.string()).length(4),
  marks: z.number(),
});
export const safeQuizSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  subject: z.string(),
  durationMinutes: z.number(),
  totalMarks: z.number(),
  questionCount: z.number(),
  closed: z.boolean(),
  resultsReleased: z.boolean(),
});
export const attemptStateSchema = z.object({
  success: z.literal(true),
  quiz: safeQuizSchema,
  serverNow: z.iso.datetime(),
  attempt: z
    .object({
      status: z.enum(["in_progress", "submitted"]),
      answers: z.array(choice),
      revision: z.number().int(),
      startedAt: z.iso.datetime(),
      deadlineAt: z.iso.datetime(),
      serverNow: z.iso.datetime(),
      submittedAt: z.iso.datetime().nullable(),
      questions: z.array(question),
      result: z
        .object({
          score: z.number(),
          percentage: z.number(),
          submittedAt: z.iso.datetime(),
          review: z.array(
            question.extend({
              selectedOption: choice,
              correctOption: z.number().int().min(0).max(3),
              earnedMarks: z.number(),
              explanation: z.string(),
            }),
          ),
        })
        .nullable(),
    })
    .nullable(),
});
export type AttemptState = z.infer<typeof attemptStateSchema>;
export type SafeQuiz = z.infer<typeof safeQuizSchema>;
export class AssessmentError extends Error {
  constructor(public status: number) {
    super(
      status === 401
        ? "Your session expired. Sign in again."
        : status === 403
          ? "Approved membership or the required role is missing."
          : status === 404
            ? "Quiz or attempt not found."
            : status === 409
              ? "The assessment changed. Reload the server state before continuing."
              : status === 400
                ? "Invalid assessment request."
                : "Unable to connect to the assessment service. Please retry.",
    );
  }
}
async function request(path: string, options: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Assessment API is not configured.");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/${path}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new AssessmentError(response.status);
  const body: unknown = await response.json();
  return body;
}
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export async function studentQuizzes(page: number, signal: AbortSignal) {
  return z
    .object({
      success: z.literal(true),
      quizzes: z.array(safeQuizSchema),
      page: z.number(),
      hasNext: z.boolean(),
    })
    .parse(
      await request(`student/assessments/quizzes?page=${page}`, { signal }),
    );
}
export async function readAttempt(id: string, signal?: AbortSignal) {
  return attemptStateSchema.parse(
    await request(`student/assessments/quizzes/${encodeURIComponent(id)}`, {
      signal,
    }),
  );
}
export async function startAttempt(id: string) {
  return attemptStateSchema.parse(
    await request(
      `student/assessments/quizzes/${encodeURIComponent(id)}/start`,
      json("POST", {}),
    ),
  );
}
export async function saveAnswers(
  id: string,
  revision: number,
  answers: (number | null)[],
) {
  return attemptStateSchema.parse(
    await request(
      `student/assessments/quizzes/${encodeURIComponent(id)}/answers`,
      json("PUT", { revision, answers }),
    ),
  );
}
export async function submitAttempt(
  id: string,
  input:
    { revision: number; answers: (number | null)[] } | Record<string, never>,
) {
  return attemptStateSchema.parse(
    await request(
      `student/assessments/quizzes/${encodeURIComponent(id)}/submit`,
      json("POST", input),
    ),
  );
}
export const historySchema = z.object({
  success: z.literal(true),
  items: z.array(
    z.object({
      quizId: z.string(),
      title: z.string(),
      subject: z.string(),
      status: z.enum(["in_progress", "submitted"]),
      startedAt: z.iso.datetime(),
      submittedAt: z.iso.datetime().nullable(),
      released: z.boolean(),
      score: z.number().nullable(),
      percentage: z.number().nullable(),
      totalMarks: z.number(),
    }),
  ),
  page: z.number(),
  hasNext: z.boolean(),
});
export const performanceSchema = z.object({
  success: z.literal(true),
  completed: z.number(),
  averagePercentage: z.number(),
  bestPercentage: z.number(),
  subjects: z.array(
    z.object({
      subject: z.string(),
      completed: z.number(),
      averagePercentage: z.number(),
    }),
  ),
  timeline: z.array(
    z.object({
      title: z.string(),
      percentage: z.number(),
      submittedAt: z.iso.datetime(),
    }),
  ),
});
export async function myResults(page: number, signal: AbortSignal) {
  return historySchema.parse(
    await request(`student/assessments/results?page=${page}`, { signal }),
  );
}
export async function myPerformance(signal: AbortSignal) {
  return performanceSchema.parse(
    await request("student/assessments/performance", { signal }),
  );
}
export const reportSchema = z.object({
  success: z.literal(true),
  quiz: safeQuizSchema,
  participants: z.number(),
  submitted: z.number(),
  averageScore: z.number(),
  page: z.number(),
  hasNext: z.boolean(),
  rankings: z.array(
    z.object({
      name: z.string(),
      score: z.number(),
      percentage: z.number(),
      rank: z.number(),
      submittedAt: z.iso.datetime(),
    }),
  ),
  questions: z.array(
    z.object({
      question: z.number(),
      text: z.string(),
      correct: z.number(),
      incorrect: z.number(),
      unanswered: z.number(),
      accuracy: z.number(),
    }),
  ),
});
export async function quizReport(
  id: string,
  page: number,
  signal: AbortSignal,
) {
  return reportSchema.parse(
    await request(
      `manage/quiz-assessments/${encodeURIComponent(id)}?page=${page}`,
      { signal },
    ),
  );
}
export async function controlAssessment(
  id: string,
  action: "close" | "release",
) {
  return z
    .object({ success: z.literal(true), quiz: safeQuizSchema })
    .parse(
      await request(
        `manage/quiz-assessments/${encodeURIComponent(id)}/${action}`,
        json("POST", {}),
      ),
    );
}
