"use client";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { QuizAttempt } from "@/components/quizzes/quiz-attempt";
export default function StudentQuizPage() {
  return (
    <Suspense fallback={<p role="status">Loading quiz...</p>}>
      <StudentQuiz />
    </Suspense>
  );
}
function StudentQuiz() {
  const { id } = useParams<{ id: string }>();
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <QuizAttempt key={id} id={id} />
    </RoleGuard>
  );
}
