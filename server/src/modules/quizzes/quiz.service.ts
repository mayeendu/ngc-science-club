import { AppError } from "../../utils/app-error.js";
import {
  quizIdSchema,
  quizCreateSchema,
  quizUpdateSchema,
  quizDeleteSchema,
  quizStatusSchema,
  quizListSchema,
  quizContentSchema,
  type QuizActor,
} from "./quiz.schema.js";
import type { QuizRepository } from "./quiz.repository.js";
import type { z } from "zod";
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(
      400,
      "Invalid quiz data. Check fields, four distinct options, answer index and marks.",
    );
  return result.data;
}
export function createQuizService(repository: QuizRepository) {
  return {
    list(actor: QuizActor, query: unknown) {
      const input = validate(quizListSchema, query);
      return repository.list(actor, input.page, input.status);
    },
    detail(actor: QuizActor, id: unknown) {
      return repository.detail(validate(quizIdSchema, id), actor);
    },
    create(actor: QuizActor, body: unknown) {
      const { title, description, subject, durationMinutes, questions } =
        validate(quizCreateSchema, body);
      return repository.create(actor, {
        title,
        description,
        subject,
        durationMinutes,
        questions,
      });
    },
    update(actor: QuizActor, id: unknown, body: unknown) {
      const { version, ...content } = validate(quizUpdateSchema, body);
      return repository.update(
        validate(quizIdSchema, id),
        actor,
        version,
        content,
      );
    },
    async setStatus(actor: QuizActor, id: unknown, body: unknown) {
      const key = validate(quizIdSchema, id),
        input = validate(quizStatusSchema, body);
      const current = await repository.detail(key, actor);
      if (current.version !== input.version || current.status === input.status)
        throw new AppError(
          409,
          "Quiz changed or status is already set. Refresh and try again.",
        );
      if (input.status === "published") {
        validate(quizContentSchema, {
          title: current.title,
          description: current.description,
          subject: current.subject,
          durationMinutes: current.durationMinutes,
          questions: current.questions,
        });
        if (current.questions.length === 0)
          throw new AppError(
            400,
            "Add at least one complete MCQ before publishing.",
          );
      }
      return repository.setStatus(key, actor, input.version, input.status);
    },
    remove(actor: QuizActor, id: unknown, body: unknown) {
      const input = validate(quizDeleteSchema, body);
      return repository.remove(
        validate(quizIdSchema, id),
        actor,
        input.version,
      );
    },
  };
}
