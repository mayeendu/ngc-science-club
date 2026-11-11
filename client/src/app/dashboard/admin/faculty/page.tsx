import { RoleGuard } from "@/components/auth/role-guard";
import { FacultyManagement } from "@/components/faculty/faculty-management";
export default function FacultyManagementPage() {
  return (
    <RoleGuard dashboard="admin">
      <FacultyManagement />
    </RoleGuard>
  );
}
