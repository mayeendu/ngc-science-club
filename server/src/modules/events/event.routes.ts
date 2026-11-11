import { Router } from "express";
import type { z } from "zod";
import type { AuthHandler } from "../../types/auth.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import type { EventRepository } from "./event.repository.js";
import {
  eventIdSchema,
  eventCreateSchema,
  eventUpdateSchema,
  eventVersionSchema,
  eventStatusSchema,
  eventPageSchema,
  publicEventListSchema,
  staffEventListSchema,
  eventEmptySchema,
  attendanceSchema,
  type EventActor,
} from "./event.schema.js";
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, "Invalid event request.");
  return result.data;
}
const origin: AuthHandler = (req, _res, next) => {
  if (req.get("origin") !== env.CLIENT_URL)
    throw new AppError(403, "Untrusted request origin");
  next();
};
function user(locals: Parameters<AuthHandler>[1]["locals"]) {
  if (!locals.user) throw new AppError(401, "Authentication required");
  return locals.user.id;
}
function actor(locals: Parameters<AuthHandler>[1]["locals"]): EventActor {
  if (locals.role !== "teacher" && locals.role !== "admin")
    throw new AppError(403, "Insufficient permissions");
  return { id: user(locals), role: locals.role };
}
export function createPublicEventRouter(repo: EventRepository) {
  const router = Router();
  const list: AuthHandler = async (req, res) => {
    const input = parse(publicEventListSchema, req.query);
    res.json({ success: true, ...(await repo.list(input.page, input)) });
  };
  const detail: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      event: await repo.detail(parse(eventIdSchema, req.params.id)),
    });
  };
  router.get("/", list);
  router.get("/:id", detail);
  return router;
}
export function createStudentEventRouter(
  auth: AuthHandler,
  student: AuthHandler,
  repo: EventRepository,
) {
  const router = Router();
  router.use(auth, student);
  const mine: AuthHandler = async (req, res) =>
    res.json({
      success: true,
      ...(await repo.mine(
        user(res.locals),
        parse(eventPageSchema, req.query).page,
      )),
    });
  const own: AuthHandler = async (req, res) =>
    res.json({
      success: true,
      ...(await repo.own(
        parse(eventIdSchema, req.params.id),
        user(res.locals),
      )),
    });
  const register =
    (cancel: boolean): AuthHandler =>
    async (req, res) => {
      parse(eventEmptySchema, req.body);
      res.json({
        success: true,
        ...(await repo.register(
          parse(eventIdSchema, req.params.id),
          user(res.locals),
          cancel,
        )),
      });
    };
  router.get("/", mine);
  router.get("/:id", own);
  router.post("/:id/register", origin, register(false));
  router.post("/:id/cancel", origin, register(true));
  return router;
}
export function createStaffEventRouter(
  auth: AuthHandler,
  staff: AuthHandler,
  repo: EventRepository,
) {
  const router = Router();
  router.use(auth, staff);
  const list: AuthHandler = async (req, res) => {
    const input = parse(staffEventListSchema, req.query);
    res.json({
      success: true,
      ...(await repo.list(input.page, input, actor(res.locals))),
    });
  };
  const stats: AuthHandler = async (req, res) => {
    parse(eventEmptySchema, req.query);
    res.json({ success: true, ...(await repo.statistics(actor(res.locals))) });
  };
  const participants: AuthHandler = async (req, res) =>
    res.json({
      success: true,
      ...(await repo.participants(
        parse(eventIdSchema, req.params.id),
        actor(res.locals),
        parse(eventPageSchema, req.query).page,
      )),
    });
  const create: AuthHandler = async (req, res) =>
    res.status(201).json({
      success: true,
      event: await repo.create(
        actor(res.locals),
        parse(eventCreateSchema, req.body),
      ),
    });
  const update: AuthHandler = async (req, res) => {
    const { version, ...input } = parse(eventUpdateSchema, req.body);
    res.json({
      success: true,
      event: await repo.update(
        parse(eventIdSchema, req.params.id),
        actor(res.locals),
        version,
        input,
      ),
    });
  };
  const status: AuthHandler = async (req, res) => {
    const input = parse(eventStatusSchema, req.body);
    res.json({
      success: true,
      event: await repo.changeStatus(
        parse(eventIdSchema, req.params.id),
        actor(res.locals),
        input.version,
        input.status,
      ),
    });
  };
  const remove: AuthHandler = async (req, res) => {
    await repo.remove(
      parse(eventIdSchema, req.params.id),
      actor(res.locals),
      parse(eventVersionSchema, req.body).version,
    );
    res.status(204).end();
  };
  const attendance: AuthHandler = async (req, res) =>
    res.json({
      success: true,
      registration: await repo.attendance(
        parse(eventIdSchema, req.params.id),
        actor(res.locals),
        parse(attendanceSchema, req.body),
      ),
    });
  router.get("/", list);
  router.get("/stats", stats);
  router.get("/:id/participants", participants);
  router.post("/", origin, create);
  router.patch("/:id", origin, update);
  router.patch("/:id/status", origin, status);
  router.delete("/:id", origin, remove);
  router.patch("/:id/attendance", origin, attendance);
  return router;
}
