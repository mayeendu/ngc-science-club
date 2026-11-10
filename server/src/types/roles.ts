export const APP_ROLES = ["student", "teacher", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

// This app uses one exact role, even though Better Auth supports comma-separated roles.
export function parseAppRole(value: unknown): AppRole | null {
  return value === "student" || value === "teacher" || value === "admin"
    ? value
    : null;
}
