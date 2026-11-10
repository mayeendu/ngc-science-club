import type { AuthHandler } from "../../types/auth.js";
import { AppError } from "../../utils/app-error.js";
import type { createApplicationService } from "./application.service.js";

export function createApplicationController(
  service: ReturnType<typeof createApplicationService>,
) {
  const submit: AuthHandler = async (req, res) => {
    if (!res.locals.user) throw new AppError(401, "Authentication required");
    const application = await service.submit(res.locals.user.id, req.body);
    res.status(201).json({ success: true, application });
  };
  const status: AuthHandler = async (_req, res) => {
    if (!res.locals.user) throw new AppError(401, "Authentication required");
    const application = await service.status(res.locals.user.id);
    res.json({ success: true, application });
  };
  const list: AuthHandler = async (req, res) => {
    res.json({ success: true, ...(await service.list(req.query)) });
  };
  const review: AuthHandler = async (req, res) => {
    if (!res.locals.user) throw new AppError(401, "Authentication required");
    const application = await service.review(
      req.params.id,
      res.locals.user.id,
      req.body,
    );
    res.json({ success: true, application });
  };
  const ownProfile: AuthHandler = async (_req, res) => {
    if (!res.locals.user) throw new AppError(401, "Authentication required");
    res.json({
      success: true,
      profile: await service.ownProfile(res.locals.user.id),
    });
  };
  const updateOwnProfile: AuthHandler = async (req, res) => {
    if (!res.locals.user) throw new AppError(401, "Authentication required");
    res.json({
      success: true,
      profile: await service.updateOwnProfile(res.locals.user.id, req.body),
    });
  };
  return { submit, status, list, review, ownProfile, updateOwnProfile };
}
