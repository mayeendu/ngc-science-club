import { Router } from "express";
import type { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import type { AuthHandler } from "../../types/auth.js";
import type { FacultyRepository } from "./faculty.repository.js";
import {
  facultyContentSchema,
  facultyIdSchema,
  facultyListSchema,
  facultyUpdateSchema,
  facultyVersionSchema,
} from "./faculty.schema.js";
const parse = <T>(schema: z.ZodType<T>, input: unknown) => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError(400, "Invalid faculty request.");
  return parsed.data;
};
const trusted: AuthHandler = (req, _res, next) => {
  if (req.get("origin") !== env.CLIENT_URL)
    throw new AppError(403, "Untrusted request origin");
  next();
};
export function createPublicFacultyRouter(repository: FacultyRepository) {
  const router = Router();
  router.get("/", async (req, res) => {
    const query = parse(facultyListSchema, req.query);
    res.json({
      success: true,
      ...(await repository.list(false, query.page, query.department)),
    });
  });
  router.get("/:id", async (req, res) => {
    parse(facultyVersionSchema.pick({}), req.query);
    res.json({
      success: true,
      profile: await repository.detail(parse(facultyIdSchema, req.params.id)),
    });
  });
  return router;
}
export function createAdminFacultyRouter(
  authenticate: AuthHandler,
  admin: AuthHandler,
  repository: FacultyRepository,
) {
  const router = Router();
  router.use(authenticate, admin);
  router.get("/", async (req, res) => {
    const query = parse(facultyListSchema, req.query);
    res.json({
      success: true,
      ...(await repository.list(true, query.page, query.department)),
    });
  });
  router.post("/", trusted, async (req, res) => {
    res
      .status(201)
      .json({
        success: true,
        profile: await repository.create(parse(facultyContentSchema, req.body)),
      });
  });
  router.put("/:id", trusted, async (req, res) => {
    const { version, ...input } = parse(facultyUpdateSchema, req.body);
    res.json({
      success: true,
      profile: await repository.update(
        parse(facultyIdSchema, req.params.id),
        input,
        version,
      ),
    });
  });
  router.delete("/:id", trusted, async (req, res) => {
    await repository.remove(
      parse(facultyIdSchema, req.params.id),
      parse(facultyVersionSchema, req.body).version,
    );
    res.json({ success: true });
  });
  return router;
}
export function createTeacherActivityRouter(
  authenticate: AuthHandler,
  teacher: AuthHandler,
  repository: FacultyRepository,
) {
  const router = Router();
  const assigned: AuthHandler = async (req, res) => {
    if (!res.locals.user) throw new AppError(401, "Authentication required");
    const { page } = parse(facultyListSchema.pick({ page: true }), req.query);
    res.json({
      success: true,
      ...(await repository.assigned(res.locals.user.id, page)),
    });
  };
  router.get("/", authenticate, teacher, assigned);
  return router;
}
