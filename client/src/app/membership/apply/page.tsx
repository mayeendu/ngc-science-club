"use client";

import { useT } from "@/components/i18n/language";
import { MembershipApplication } from "@/components/membership/membership-application";
export default function MembershipApplicationPage() {
  const t = useT();
  return (
    <main className="mx-auto max-w-228 px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{t("Add new member")}</h1>
      <MembershipApplication showForm />
    </main>
  );
}
