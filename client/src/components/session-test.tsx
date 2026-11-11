"use client";

import { useT } from "@/components/i18n/language";
import { useSession } from "@/lib/auth-client";
export function SessionTest() {
  const t = useT();
  const { data: session, isPending, error } = useSession();
  if (isPending) return <p>{t("Checking session...")}</p>;
  if (error) return <p>{t("Session check failed.")}</p>;
  if (!session) return <p>{t("Not signed in.")}</p>;
  return (
    <div>
      <p>
        {t("Signed in as:")} {session.user.name}
      </p>
      <p>
        {t("Email:")} {session.user.email}
      </p>
    </div>
  );
}
