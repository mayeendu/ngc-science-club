"use client";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { QuizReport } from "@/components/quizzes/quiz-report";
export default function StaffQuizResultsPage() {
  return (
    <Suspense fallback={<p role="status">Loading report...</p>}>
      <StaffQuizResults />
    </Suspense>
  );
}
function StaffQuizResults() {
  const { id } = useParams<{ id: string }>();
  return (
    <RoleGuard dashboard="teacher">
      <QuizReport key={id} id={id} />
    </RoleGuard>
  );
}
