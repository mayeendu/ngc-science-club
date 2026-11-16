"use client";

import { RoleGuard } from "@/components/auth/role-guard";
import { AddTeacherForm } from "@/components/faculty/add-teacher-form";

export default function AddTeacherPage() {
  return (
    <RoleGuard dashboard="teacher" allowedRoles={["teacher", "admin"]}>
      <AddTeacherForm />
    </RoleGuard>
  );
}
