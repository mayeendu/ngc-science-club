import { Router } from "express";
import type { z } from "zod";
import { AppError } from "../../utils/app-error.js";
import { env } from "../../config/env.js";
import type { AuthHandler } from "../../types/auth.js";
import type { QuizActor } from "../quizzes/quiz.schema.js";
import type { AssessmentRepository } from "./assessment.repository.js";
import {
  assessmentIdSchema,
  assessmentPageSchema,
  answerSchema,
  submitSchema,
  emptySchema,
} from "./assessment.schema.js";
function parse<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError(400, "Invalid assessment request.");
  return parsed.data;
}
const trusted: AuthHandler = (req, _res, next) => {
  if (req.get("origin") !== env.CLIENT_URL)
    throw new AppError(403, "Untrusted request origin");
  next();
};
function user(locals: Parameters<AuthHandler>[1]["locals"]) {
  if (!locals.user) throw new AppError(401, "Authentication required");
  return locals.user.id;
}
function actor(locals: Parameters<AuthHandler>[1]["locals"]): QuizActor {
  if (locals.role !== "teacher" && locals.role !== "admin")
    throw new AppError(403, "Insufficient permissions");
  return { id: user(locals), role: locals.role };
}
export function createStudentAssessmentRouter(
  authenticate: AuthHandler,
  student: AuthHandler,
  repository: AssessmentRepository,
) {
  const router = Router();
  router.use(authenticate, student);
  const list: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.catalog(
        user(res.locals),
        parse(assessmentPageSchema, req.query).page,
      )),
    });
  };
  const detail: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.read(
        parse(assessmentIdSchema, req.params.id),
        user(res.locals),
      )),
    });
  };
  const start: AuthHandler = async (req, res) => {
    parse(emptySchema, req.body);
    res.json({
      success: true,
      ...(await repository.start(
        parse(assessmentIdSchema, req.params.id),
        user(res.locals),
      )),
    });
  };
  const save: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.save(
        parse(assessmentIdSchema, req.params.id),
        user(res.locals),
        parse(answerSchema, req.body),
      )),
    });
  };
  const submit: AuthHandler = async (req, res) => {
    const input = parse(submitSchema, req.body);
    res.json({
      success: true,
      ...(await repository.submit(
        parse(assessmentIdSchema, req.params.id),
        user(res.locals),
        "answers" in input
          ? { answers: input.answers, revision: input.revision }
          : undefined,
      )),
    });
  };
  const history: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.history(
        user(res.locals),
        parse(assessmentPageSchema, req.query).page,
      )),
    });
  };
  const performance: AuthHandler = async (req, res) => {
    parse(emptySchema, req.query);
    res.json({
      success: true,
      ...(await repository.performance(user(res.locals))),
    });
  };
  router.get("/quizzes", list);
  router.get("/quizzes/:id", detail);
  router.post("/quizzes/:id/start", trusted, start);
  router.put("/quizzes/:id/answers", trusted, save);
  router.post("/quizzes/:id/submit", trusted, submit);
  router.get("/results", history);
  router.get("/performance", performance);
  return router;
}
export function createStaffAssessmentRouter(
  authenticate: AuthHandler,
  staff: AuthHandler,
  repository: AssessmentRepository,
) {
  const router = Router();
  router.use(authenticate, staff);
  const report: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.staff(
        parse(assessmentIdSchema, req.params.id),
        actor(res.locals),
        parse(assessmentPageSchema, req.query).page,
      )),
    });
  };
  const control =
    (action: "close" | "release"): AuthHandler =>
    async (req, res) => {
      parse(emptySchema, req.body);
      res.json({
        success: true,
        quiz: await repository.control(
          parse(assessmentIdSchema, req.params.id),
          actor(res.locals),
          action,
        ),
      });
    };
  router.get("/:id", report);
  router.post("/:id/close", trusted, control("close"));
  router.post("/:id/release", trusted, control("release"));
  return router;
}
