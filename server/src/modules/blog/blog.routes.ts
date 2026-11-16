import { Router } from "express";
import type { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import type { AuthHandler } from "../../types/auth.js";
import {
  blogContent,
  blogId,
  blogPage,
  type BlogActor,
} from "./blog.schema.js";
import type { BlogRepository } from "./blog.repository.js";
const parse = <T>(schema: z.ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, "Invalid blog request.");
  return result.data;
};
function actor(locals: Parameters<AuthHandler>[1]["locals"]): BlogActor {
  if (!locals.user) throw new AppError(401, "Authentication required");
  const role = locals.role;
  if (role !== "student" && role !== "teacher" && role !== "admin")
    throw new AppError(403, "Insufficient permissions");
  return { id: locals.user.id, name: locals.user.name, role };
}
export function createBlogRouter(
  authenticate: AuthHandler,
  authorize: AuthHandler,
  repository: BlogRepository,
) {
  const router = Router();
  router.get("/", async (req, res) => {
    res.json({
      success: true,
      ...(await repository.list(parse(blogPage, req.query).page)),
    });
  });
  const permission: AuthHandler = async (_req, res) => {
    await repository.permission(actor(res.locals));
    res.json({ success: true, canWrite: true });
  };
  router.get("/permission", authenticate, authorize, permission);
  router.get("/:id", async (req, res) => {
    parse(blogPage.pick({}), req.query);
    res.json({
      success: true,
      post: await repository.detail(parse(blogId, req.params.id)),
    });
  });
  const create: AuthHandler = async (req, res) => {
    if (req.get("origin") !== env.CLIENT_URL)
      throw new AppError(403, "Untrusted request origin");
    parse(blogPage.pick({}), req.query);
    const input = parse(blogContent, req.body);
    res
      .status(201)
      .json({
        success: true,
        post: await repository.create(actor(res.locals), input),
      });
  };
  router.post("/", authenticate, authorize, create);
  return router;
}
