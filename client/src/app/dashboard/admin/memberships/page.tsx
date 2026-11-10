import { RoleGuard } from "@/components/auth/role-guard";
import { AdminMemberships } from "@/components/membership/admin-memberships";

export default function AdminMembershipsPage() {
  return (
    <RoleGuard dashboard="admin">
      <AdminMemberships />
    </RoleGuard>
  );
}
