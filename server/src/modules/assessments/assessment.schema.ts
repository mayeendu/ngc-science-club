import { z } from "zod";

export const assessmentIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
export const assessmentPageSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const answerSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  answers: z.array(z.number().int().min(0).max(3).nullable()).max(50),
});
export const submitSchema = z.union([z.strictObject({}), answerSchema]);
export const emptySchema = z.strictObject({});
export type AnswerInput = z.infer<typeof answerSchema>;
export type AttemptDocument = {
  _id: string;
  quizId: string;
  userId: string;
  studentName: string;
  title: string;
  subject: string;
  status: "in_progress" | "submitted";
  answers: (number | null)[];
  revision: number;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt?: Date;
  score?: number;
  percentage?: number;
  totalMarks: number;
  reason?: "manual" | "expired" | "closed";
};
export type SafeQuiz = {
  id: string;
  title: string;
  description: string;
  subject: string;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  closed: boolean;
  resultsReleased: boolean;
};
export type AttemptView = {
  status: AttemptDocument["status"];
  answers: (number | null)[];
  revision: number;
  startedAt: string;
  deadlineAt: string;
  serverNow: string;
  submittedAt: string | null;
  questions: { text: string; options: string[]; marks: number }[];
  result: null | {
    score: number;
    percentage: number;
    submittedAt: string;
    review: {
      text: string;
      options: string[];
      marks: number;
      selectedOption: number | null;
      correctOption: number;
      earnedMarks: number;
      explanation: string;
    }[];
  };
};
export type HistoryItem = {
  quizId: string;
  title: string;
  subject: string;
  status: AttemptDocument["status"];
  startedAt: string;
  submittedAt: string | null;
  released: boolean;
  score: number | null;
  percentage: number | null;
  totalMarks: number;
};
