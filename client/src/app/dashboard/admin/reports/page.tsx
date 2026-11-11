import { RoleGuard } from "@/components/auth/role-guard";
import { AdminReports } from "@/components/reports/admin-reports";
export default function ReportsPage() {
  return (
    <RoleGuard dashboard="admin">
      <AdminReports />
    </RoleGuard>
  );
}
