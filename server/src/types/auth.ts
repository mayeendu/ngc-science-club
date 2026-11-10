import type { RequestHandler } from "express";
import type { ParamsDictionary, Query } from "express-serve-static-core";
import type { Auth } from "../lib/auth.js";
import type { AppRole } from "./roles.js";

export type VerifiedAuthentication = Auth["$Infer"]["Session"];
export type AuthSessionProvider = { api: Pick<Auth["api"], "getSession"> };

// Optional until requireAuth/requireRole succeeds. Handlers guard before access.
export interface AuthLocals {
  user?: VerifiedAuthentication["user"];
  session?: VerifiedAuthentication["session"];
  role?: AppRole;
}

export type AuthHandler = RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  Query,
  AuthLocals
>;
