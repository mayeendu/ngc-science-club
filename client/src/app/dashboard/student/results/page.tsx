import { RoleGuard } from "@/components/auth/role-guard";
import { StudentResults } from "@/components/quizzes/student-results";
export default function StudentResultsPage() {
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <StudentResults />
    </RoleGuard>
  );
}
