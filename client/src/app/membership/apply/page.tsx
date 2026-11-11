"use client";

import { useT } from "@/components/i18n/language";
import { RoleGuard } from "@/components/auth/role-guard";
import { MembershipApplication } from "@/components/membership/membership-application";
export default function MembershipApplicationPage() {
  const t = useT();
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-6 text-3xl font-bold">
          {t("Membership application")}
        </h1>
        <MembershipApplication showForm />
      </main>
    </RoleGuard>
  );
}
