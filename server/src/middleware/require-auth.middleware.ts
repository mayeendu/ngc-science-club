import { fromNodeHeaders } from "better-auth/node";
import type {
  AuthHandler,
  AuthSessionProvider,
  VerifiedAuthentication,
} from "../types/auth.js";

// Request identity is server-owned; a body/header or manually filled locals cannot verify it.
const authentications = new WeakMap<object, VerifiedAuthentication>();

export function getVerifiedAuthentication(request: object) {
  return authentications.get(request);
}

export function requireAuth(auth: AuthSessionProvider): AuthHandler {
  return async (req, res, next) => {
    try {
      const authentication =
        authentications.get(req) ??
        (await auth.api.getSession({
          headers: fromNodeHeaders(req.headers),
          query: { disableCookieCache: true },
        }));
      if (
        !authentication ||
        !(authentication.session.expiresAt instanceof Date) ||
        !Number.isFinite(authentication.session.expiresAt.getTime()) ||
        authentication.session.expiresAt.getTime() <= Date.now() ||
        typeof authentication.user.id !== "string" ||
        !authentication.user.id ||
        authentication.session.userId !== authentication.user.id
      ) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }
      authentications.set(req, authentication);
      res.locals.user = authentication.user;
      res.locals.session = authentication.session;
      next();
    } catch {
      // Do not forward raw driver errors that can contain private connection data.
      next(new Error("Session verification failed."));
    }
  };
}
