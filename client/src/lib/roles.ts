export const appRoles = ["student", "teacher", "admin"] as const;
export type AppRole = (typeof appRoles)[number];
export function parseRole(value: unknown): AppRole | null {
  return value === "student" || value === "teacher" || value === "admin"
    ? value
    : null;
}
export const roleLabels: Record<AppRole, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "Admin",
};
export const dashboardRoles: Record<AppRole, readonly AppRole[]> = {
  student: ["student", "teacher", "admin"],
  teacher: ["teacher", "admin"],
  admin: ["admin"],
};
export function dashboardPath(role: AppRole) {
  return `/dashboard/${role}`;
}
