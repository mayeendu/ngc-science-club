import express, { Router } from "express";
import { env } from "../../config/env.js";
import type { AuthHandler } from "../../types/auth.js";
import { AppError } from "../../utils/app-error.js";
import type { QuizActor } from "./quiz.schema.js";
import type { QuizRepository } from "./quiz.repository.js";
import { createQuizService } from "./quiz.service.js";

export function createQuizRouter(
  authenticate: AuthHandler,
  staffOnly: AuthHandler,
  repository: QuizRepository,
) {
  const router = Router(),
    service = createQuizService(repository);
  router.use(authenticate, staffOnly, express.json({ limit: "1mb" }));
  const actor = (locals: Parameters<AuthHandler>[1]["locals"]): QuizActor => {
    if (!locals.user || (locals.role !== "teacher" && locals.role !== "admin"))
      throw new AppError(401, "Authentication required");
    return { id: locals.user.id, role: locals.role };
  };
  const origin: AuthHandler = (req, _res, next) => {
    if (req.get("origin") !== env.CLIENT_URL)
      throw new AppError(403, "Untrusted request origin");
    next();
  };
  const list: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await service.list(actor(res.locals), req.query)),
    });
  };
  const get: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      quiz: await service.detail(actor(res.locals), req.params.id),
    });
  };
  const create: AuthHandler = async (req, res) => {
    res.status(201).json({
      success: true,
      quiz: await service.create(actor(res.locals), req.body),
    });
  };
  const update: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      quiz: await service.update(actor(res.locals), req.params.id, req.body),
    });
  };
  const status: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      quiz: await service.setStatus(actor(res.locals), req.params.id, req.body),
    });
  };
  const remove: AuthHandler = async (req, res) => {
    await service.remove(actor(res.locals), req.params.id, req.body);
    res.status(204).end();
  };
  router.get("/", list);
  router.get("/:id", get);
  router.post("/", origin, create);
  router.patch("/:id", origin, update);
  router.patch("/:id/status", origin, status);
  router.delete("/:id", origin, remove);
  return router;
}
