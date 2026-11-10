import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import type { AppRole } from "../types/roles.js";

export const authAccessControl = createAccessControl(defaultStatements);
export const authRoles = {
  // Ordinary auth and application routes do not require plugin management rights.
  student: authAccessControl.newRole({ user: [], session: [] }),
  teacher: authAccessControl.newRole({ user: [], session: [] }),
  admin: authAccessControl.newRole(adminAc.statements),
} satisfies Record<AppRole, unknown>;
