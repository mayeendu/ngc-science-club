import { RoleGuard } from "@/components/auth/role-guard";
import { QuizManagement } from "@/components/quizzes/quiz-management";
export default function TeacherQuizzesPage() {
  return (
    <RoleGuard dashboard="teacher">
      <QuizManagement />
    </RoleGuard>
  );
}
