import { RoleGuard } from "@/components/auth/role-guard";
import { PerformanceDashboard } from "@/components/performance/performance-dashboard";
export default function PerformancePage() {
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <PerformanceDashboard student />
    </RoleGuard>
  );
}
