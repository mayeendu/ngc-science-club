import express, { Router } from "express";
import { pipeline } from "node:stream/promises";
import type { z } from "zod";
import type { AuthHandler } from "../../types/auth.js";
import { AppError } from "../../utils/app-error.js";
import { env } from "../../config/env.js";
import {
  resourceContent,
  resourceId,
  resourceQuery,
  resourceUpdate,
  resourceVersion,
  resourceStatus,
  type ResourceActor,
} from "./resource.schema.js";
import type { ResourceRepository } from "./resource.repository.js";
const parse = <T>(schema: z.ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, "Invalid resource request.");
  return result.data;
};
const trusted: AuthHandler = (req, _res, next) => {
  if (req.get("origin") !== env.CLIENT_URL)
    throw new AppError(403, "Untrusted request origin");
  next();
};
function actor(locals: Parameters<AuthHandler>[1]["locals"]): ResourceActor {
  const role = locals.role;
  if (
    !locals.user ||
    (role !== "student" && role !== "teacher" && role !== "admin")
  )
    throw new AppError(403, "Insufficient permissions");
  return { id: locals.user.id, role };
}
export function createResourceRouter(
  authenticate: AuthHandler,
  authorize: AuthHandler,
  repository: ResourceRepository,
  staff = false,
) {
  const router = Router();
  router.use(authenticate, authorize);
  const list: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.list(
        actor(res.locals),
        staff,
        parse(resourceQuery, req.query),
      )),
    });
  };
  router.get("/", list);
  const download: AuthHandler = async (req, res) => {
    parse(resourceVersion.pick({}), req.query);
    const { file, stream } = await repository.download(
      actor(res.locals),
      staff,
      parse(resourceId, req.params.id),
    );
    res.setHeader("Content-Type", file.mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="resource-download"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    res.setHeader("Content-Length", String(file.size));
    try {
      await pipeline(stream, res);
    } catch {
      if (!res.headersSent)
        throw new AppError(500, "Unable to download resource.");
      res.destroy();
    }
  };
  router.get("/:id/download", download);
  if (staff) {
    const create: AuthHandler = async (req, res) => {
      res.status(201).json({
        success: true,
        resource: await repository.create(
          actor(res.locals),
          parse(resourceContent, req.body),
        ),
      });
    };
    router.post("/", trusted, create);
    const update: AuthHandler = async (req, res) => {
      const { version, ...input } = parse(resourceUpdate, req.body);
      res.json({
        success: true,
        resource: await repository.update(
          actor(res.locals),
          parse(resourceId, req.params.id),
          input,
          version,
        ),
      });
    };
    router.put("/:id", trusted, update);
    const status: AuthHandler = async (req, res) => {
      const input = parse(resourceStatus, req.body);
      res.json({
        success: true,
        resource: await repository.publish(
          actor(res.locals),
          parse(resourceId, req.params.id),
          input.version,
          input.published,
        ),
      });
    };
    router.patch("/:id/status", trusted, status);
    const remove: AuthHandler = async (req, res) => {
      await repository.remove(
        actor(res.locals),
        parse(resourceId, req.params.id),
        parse(resourceVersion, req.body).version,
      );
      res.json({ success: true });
    };
    router.delete("/:id", trusted, remove);
    const upload: AuthHandler = async (req, res) => {
      parse(resourceVersion.pick({}), req.query);
      if (!Buffer.isBuffer(req.body))
        throw new AppError(400, "Send a binary file.");
      let name: string;
      try {
        name = decodeURIComponent(req.get("X-File-Name") ?? "");
      } catch {
        throw new AppError(400, "Invalid file name.");
      }
      const version = parse(resourceVersion, {
        version: Number(req.get("X-Resource-Version")),
      }).version;
      res.json({
        success: true,
        resource: await repository.upload(
          actor(res.locals),
          parse(resourceId, req.params.id),
          version,
          name,
          req.body,
        ),
      });
    };
    router.post(
      "/:id/file",
      trusted,
      express.raw({ type: "application/octet-stream", limit: "5mb" }),
      upload,
    );
  }
  return router;
}
