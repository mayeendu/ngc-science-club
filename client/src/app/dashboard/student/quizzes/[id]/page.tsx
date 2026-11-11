"use client";

import { useT } from "@/components/i18n/language";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { QuizAttempt } from "@/components/quizzes/quiz-attempt";
export default function StudentQuizPage() {
  const t = useT();
  return (
    <Suspense fallback={<p role="status">{t("Loading quiz...")}</p>}>
      <StudentQuiz />
    </Suspense>
  );
}
function StudentQuiz() {
  const { id } = useParams<{
    id: string;
  }>();
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <QuizAttempt key={id} id={id} />
    </RoleGuard>
  );
}
