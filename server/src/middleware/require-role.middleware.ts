import {
  findAuthorizationUser,
  type AuthorizationUserLookup,
} from "../lib/authorization-user.js";
import type { AuthHandler } from "../types/auth.js";
import { parseAppRole, type AppRole } from "../types/roles.js";
import { getVerifiedAuthentication } from "./require-auth.middleware.js";

export function createRequireRole(
  lookup: AuthorizationUserLookup = findAuthorizationUser,
) {
  return (...allowedRoles: AppRole[]): AuthHandler => {
    if (
      !allowedRoles.length ||
      allowedRoles.some((value) => parseAppRole(value) === null)
    ) {
      throw new Error(
        "requireRole requires at least one valid application role.",
      );
    }
    return async (req, res, next) => {
      const authentication = getVerifiedAuthentication(req);
      if (
        !authentication ||
        authentication.session.expiresAt.getTime() <= Date.now()
      ) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }
      try {
        // Use only the verified user ID. Ignore body, query, headers and cached user.role.
        const currentUser = await lookup(authentication.user.id);
        if (!currentUser) {
          res
            .status(401)
            .json({ success: false, message: "Authentication required" });
          return;
        }
        const role = parseAppRole(currentUser.role);
        if (
          !role ||
          currentUser.banned === true ||
          !allowedRoles.includes(role)
        ) {
          res
            .status(403)
            .json({ success: false, message: "Insufficient permissions" });
          return;
        }
        res.locals.role = role;
        res.locals.user = { ...authentication.user, role };
        next();
      } catch {
        next(new Error("Authorization lookup failed."));
      }
    };
  };
}

// Use after requireAuth(auth). Missing verified request context always returns 401.
export const requireRole = createRequireRole();
