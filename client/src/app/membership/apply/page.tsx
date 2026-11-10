"use client";

import { RoleGuard } from "@/components/auth/role-guard";
import { MembershipApplication } from "@/components/membership/membership-application";

export default function MembershipApplicationPage() {
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-6 text-3xl font-bold">Membership application</h1>
        <MembershipApplication showForm />
      </main>
    </RoleGuard>
  );
}
