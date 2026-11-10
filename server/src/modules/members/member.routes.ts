import { Router } from "express";
import { getMemberCountController } from "./member.controller.js";

export const memberRouter = Router();

memberRouter.get("/count", getMemberCountController);
