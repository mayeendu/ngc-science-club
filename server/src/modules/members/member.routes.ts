import { Router } from "express";
import { createMemberController } from "./member.controller.js";
import {
  createMemberRepository,
  type MemberRepository,
} from "./member.repository.js";
import { createMemberService } from "./member.service.js";

export function createMemberRouter(
  repository: MemberRepository = createMemberRepository(),
) {
  const router = Router();
  const controller = createMemberController(createMemberService(repository));
  router.get("/count", controller.count);
  router.get("/stats", controller.stats);
  router.get("/", controller.list);
  router.get("/:id", controller.profile);
  return router;
}

export const memberRouter = createMemberRouter();
