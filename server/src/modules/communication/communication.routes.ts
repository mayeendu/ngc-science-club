import { Router } from "express";
import type { z } from "zod";
import type { AuthHandler } from "../../types/auth.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import type { AnnouncementRepository } from "./announcement.repository.js";
import type { NotificationRepository } from "./notification.repository.js";
import {
  announcementId,
  announcementContent,
  announcementUpdate,
  communicationPage,
  communicationVersion,
  notificationId,
  notificationRead,
  type CommunicationActor,
} from "./communication.schema.js";
const parse = <T>(schema: z.ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(400, "Invalid communication request.");
  return result.data;
};
const trusted: AuthHandler = (req, _res, next) => {
  if (req.get("origin") !== env.CLIENT_URL)
    throw new AppError(403, "Untrusted request origin");
  next();
};
function actor(
  locals: Parameters<AuthHandler>[1]["locals"],
): CommunicationActor {
  if (!locals.user) throw new AppError(401, "Authentication required");
  const role = locals.role;
  if (role !== "student" && role !== "teacher" && role !== "admin")
    throw new AppError(403, "Insufficient permissions");
  return { id: locals.user.id, role };
}
export function createPublicAnnouncementRouter(
  repository: AnnouncementRepository,
) {
  const router = Router();
  router.get("/", async (req, res) => {
    res.json({
      success: true,
      ...(await repository.list(parse(communicationPage, req.query).page)),
    });
  });
  router.get("/:id", async (req, res) => {
    parse(communicationVersion.pick({}), req.query);
    res.json({
      success: true,
      announcement: await repository.detail(
        parse(announcementId, req.params.id),
      ),
    });
  });
  return router;
}
export function createManageAnnouncementRouter(
  authenticate: AuthHandler,
  staff: AuthHandler,
  repository: AnnouncementRepository,
) {
  const router = Router();
  router.use(authenticate, staff);
  const list: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.list(
        parse(communicationPage, req.query).page,
        actor(res.locals),
      )),
    });
  };
  router.get("/", list);
  const create: AuthHandler = async (req, res) => {
    res.status(201).json({
      success: true,
      announcement: await repository.create(
        actor(res.locals),
        parse(announcementContent, req.body),
      ),
    });
  };
  router.post("/", trusted, create);
  const update: AuthHandler = async (req, res) => {
    const { version, ...input } = parse(announcementUpdate, req.body);
    res.json({
      success: true,
      announcement: await repository.update(
        actor(res.locals),
        parse(announcementId, req.params.id),
        input,
        version,
      ),
    });
  };
  router.put("/:id", trusted, update);
  const remove: AuthHandler = async (req, res) => {
    await repository.remove(
      actor(res.locals),
      parse(announcementId, req.params.id),
      parse(communicationVersion, req.body).version,
    );
    res.json({ success: true });
  };
  router.delete("/:id", trusted, remove);
  return router;
}
export function createNotificationRouter(
  authenticate: AuthHandler,
  authorize: AuthHandler,
  repository: NotificationRepository,
) {
  const router = Router();
  router.use(authenticate, authorize);
  const list: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.list(
        actor(res.locals),
        parse(communicationPage, req.query).page,
      )),
    });
  };
  router.get("/", list);
  const mark: AuthHandler = async (req, res) => {
    await repository.mark(
      actor(res.locals),
      parse(notificationId, req.params.id),
      parse(notificationRead, req.body).read,
    );
    res.json({ success: true });
  };
  router.patch("/:id", trusted, mark);
  return router;
}
