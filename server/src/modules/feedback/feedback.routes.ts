import { Router } from "express";
import type { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import type { AuthHandler } from "../../types/auth.js";
import {
  feedbackId,
  feedbackCreate,
  feedbackReply,
  feedbackStaffReply,
  feedbackAssign,
  feedbackQuery,
  type FeedbackActor,
} from "./feedback.schema.js";
import type { FeedbackRepository } from "./feedback.repository.js";
const parse = <T>(schema: z.ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, "Invalid feedback request.");
  return result.data;
};
const trusted: AuthHandler = (req, _res, next) => {
  if (req.get("origin") !== env.CLIENT_URL)
    throw new AppError(403, "Untrusted request origin");
  next();
};
const actor = (locals: Parameters<AuthHandler>[1]["locals"]): FeedbackActor => {
  if (!locals.user) throw new AppError(401, "Authentication required");
  const role = locals.role;
  if (role !== "student" && role !== "teacher" && role !== "admin")
    throw new AppError(403, "Insufficient permissions");
  return { id: locals.user.id, role, name: locals.user.name ?? "Club member" };
};
export function createFeedbackRouter(
  authenticate: AuthHandler,
  authorize: AuthHandler,
  repository: FeedbackRepository,
  staff = false,
  admin?: AuthHandler,
) {
  const router = Router();
  router.use(authenticate, authorize);
  const list: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.list(
        actor(res.locals),
        staff,
        parse(feedbackQuery, req.query),
      )),
    });
  };
  router.get("/", list);
  if (!staff) {
    const create: AuthHandler = async (req, res) => {
      res
        .status(201)
        .json({
          success: true,
          thread: await repository.create(
            actor(res.locals),
            parse(feedbackCreate, req.body),
          ),
        });
    };
    router.post("/", trusted, create);
  }
  const reply: AuthHandler = async (req, res) => {
    const input = staff
      ? parse(feedbackStaffReply, req.body)
      : { ...parse(feedbackReply, req.body), status: undefined };
    res.json({
      success: true,
      thread: await repository.reply(
        actor(res.locals),
        staff,
        parse(feedbackId, req.params.id),
        input.version,
        input.message,
        input.status,
      ),
    });
  };
  router.post("/:id/replies", trusted, reply);
  if (staff && admin) {
    router.put("/:id/assignment", admin, trusted, async (req, res) => {
      const input = parse(feedbackAssign, req.body);
      await repository.assign(
        parse(feedbackId, req.params.id),
        input.version,
        input.teacherAccountId,
      );
      res.json({ success: true });
    });
  }
  return router;
}
