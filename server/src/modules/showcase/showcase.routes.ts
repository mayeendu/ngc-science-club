import { Router } from "express";
import { z } from "zod";
import type { AuthHandler } from "../../types/auth.js";
import { AppError } from "../../utils/app-error.js";
import { env } from "../../config/env.js";
import type { ResourceActor } from "../resources/resource.schema.js";
import type { ShowcaseRepository } from "./showcase.repository.js";
import type { CertificateRepository } from "../certificates/certificate.repository.js";
import {
  showcaseId,
  showcaseContent,
  showcaseVersion,
  showcaseUpdate,
  showcaseQuery,
} from "./showcase.schema.js";
const parse = <T>(schema: z.ZodType<T>, input: unknown) => {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, "Invalid showcase or certificate request.");
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
export function createPublicShowcaseRouter(repository: ShowcaseRepository) {
  const router = Router();
  router.get("/", async (req, res) => {
    res.json({
      success: true,
      ...(await repository.list(parse(showcaseQuery, req.query))),
    });
  });
  return router;
}
export function createManageShowcaseRouter(
  authenticate: AuthHandler,
  staff: AuthHandler,
  repository: ShowcaseRepository,
) {
  const router = Router();
  router.use(authenticate, staff);
  const list: AuthHandler = async (req, res) => {
    res.json({
      success: true,
      ...(await repository.list(
        parse(showcaseQuery, req.query),
        actor(res.locals),
      )),
    });
  };
  router.get("/", list);
  const create: AuthHandler = async (req, res) => {
    res
      .status(201)
      .json({
        success: true,
        item: await repository.save(
          actor(res.locals),
          parse(showcaseContent, req.body),
        ),
      });
  };
  router.post("/", trusted, create);
  const update: AuthHandler = async (req, res) => {
    const { version, ...input } = parse(showcaseUpdate, req.body);
    res.json({
      success: true,
      item: await repository.save(
        actor(res.locals),
        input,
        parse(showcaseId, req.params.id),
        version,
      ),
    });
  };
  router.put("/:id", trusted, update);
  const remove: AuthHandler = async (req, res) => {
    await repository.remove(
      actor(res.locals),
      parse(showcaseId, req.params.id),
      parse(showcaseVersion, req.body).version,
    );
    res.json({ success: true });
  };
  router.delete("/:id", trusted, remove);
  return router;
}
const token = z.string().regex(/^[a-f0-9]{64}$/),
  page = showcaseQuery.pick({ page: true });
export function createPublicCertificateRouter(
  repository: CertificateRepository,
) {
  const router = Router();
  router.get("/verify/:token", async (req, res) => {
    parse(z.strictObject({}), req.query);
    res.json({
      success: true,
      certificate: await repository.verify(parse(token, req.params.token)),
    });
  });
  return router;
}
export function createCertificateRouter(
  authenticate: AuthHandler,
  authorize: AuthHandler,
  repository: CertificateRepository,
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
        parse(page, req.query).page,
      )),
    });
  };
  router.get("/", list);
  if (staff) {
    const issue: AuthHandler = async (req, res) => {
      const input = parse(
        z.strictObject({
          eventId: showcaseId,
          registrationId: z.string().regex(/^[a-f0-9]{24}:[a-f0-9]{24}$/),
        }),
        req.body,
      );
      res.json({
        success: true,
        certificate: await repository.issue(
          actor(res.locals),
          input.eventId,
          input.registrationId,
        ),
      });
    };
    router.post("/", trusted, issue);
    const revoke: AuthHandler = async (req, res) => {
      await repository.revoke(
        actor(res.locals),
        parse(token, req.params.token),
        parse(showcaseVersion, req.body).version,
      );
      res.json({ success: true });
    };
    router.patch("/:token/revoke", trusted, revoke);
  }
  return router;
}
