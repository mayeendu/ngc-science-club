import type { Request, Response, NextFunction } from "express";
import { getMemberCount } from "./member.service.js";
import type { createMemberService } from "./member.service.js";
import type { RequestHandler } from "express";

export function createMemberController(
  service: ReturnType<typeof createMemberService>,
) {
  const list: RequestHandler = async (req, res) => {
    res.json({ success: true, ...(await service.list(req.query)) });
  };
  const profile: RequestHandler = async (req, res) => {
    res.json({ success: true, member: await service.profile(req.params.id) });
  };
  const count: RequestHandler = async (_req, res) => {
    res.json({ success: true, totalMembers: await service.count() });
  };
  const stats: RequestHandler = async (_req, res) => {
    res.json({ success: true, ...(await service.stats()) });
  };
  return { list, profile, count, stats };
}

export async function getMemberCountController(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const totalMembers = await getMemberCount();

    res.status(200).json({
      success: true,
      totalMembers,
    });
  } catch (error) {
    next(error);
  }
}
