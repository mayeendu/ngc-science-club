import type { Request, Response, NextFunction } from "express";
import { getMemberCount } from "./member.service.js";

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
