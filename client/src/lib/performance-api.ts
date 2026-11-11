import { z } from "zod";
import { AssessmentError } from "./assessment-api";
const comparison = z.object({
  title: z.string(),
  subject: z.string(),
  quizId: z.string(),
  completed: z.number(),
  averagePercentage: z.number(),
});
const schema = z.object({
  success: z.literal(true),
  range: z.object({ from: z.string(), to: z.string() }),
  completed: z.number(),
  averagePercentage: z.number(),
  bestPercentage: z.number(),
  page: z.number(),
  quizzesHasNext: z.boolean(),
  historyHasNext: z.boolean(),
  rankingsHasNext: z.boolean(),
  quizzes: z.array(comparison),
  timeline: z.array(
    z.object({
      month: z.string(),
      completed: z.number(),
      averagePercentage: z.number(),
    }),
  ),
  history: z.array(
    z.object({
      quizId: z.string(),
      title: z.string(),
      subject: z.string(),
      submittedAt: z.iso.datetime(),
      score: z.number(),
      totalMarks: z.number(),
      percentage: z.number(),
    }),
  ),
  rankings: z.array(
    z.object({
      name: z.string(),
      completed: z.number(),
      averagePercentage: z.number(),
      rank: z.number(),
    }),
  ),
});
export type Performance = z.infer<typeof schema>;
export async function getPerformance(
  student: boolean,
  query: URLSearchParams,
  signal: AbortSignal,
) {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Performance API is not configured.");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/${student ? "student" : "manage"}/performance?${query}`,
    {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    },
  );
  if (!response.ok) throw new AssessmentError(response.status);
  return schema.parse(await response.json());
}
