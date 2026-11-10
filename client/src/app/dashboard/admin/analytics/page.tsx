import { RoleGuard } from "@/components/auth/role-guard";
import { MembershipAnalyticsDashboard } from "@/components/membership/membership-analytics";
export default function MembershipAnalyticsPage() {
  return (
    <RoleGuard dashboard="admin">
      <MembershipAnalyticsDashboard />
    </RoleGuard>
  );
}
