"use client";

import { useT } from "@/components/i18n/language";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { QuizReport } from "@/components/quizzes/quiz-report";
export default function StaffQuizResultsPage() {
  const t = useT();
  return (
    <Suspense fallback={<p role="status">{t("Loading report...")}</p>}>
      <StaffQuizResults />
    </Suspense>
  );
}
function StaffQuizResults() {
  const { id } = useParams<{
    id: string;
  }>();
  return (
    <RoleGuard dashboard="teacher">
      <QuizReport key={id} id={id} />
    </RoleGuard>
  );
}
