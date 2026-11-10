import { RoleGuard } from "@/components/auth/role-guard";
import { StudentQuizzes } from "@/components/quizzes/student-quizzes";
export default function StudentQuizListPage() {
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <StudentQuizzes />
    </RoleGuard>
  );
}
