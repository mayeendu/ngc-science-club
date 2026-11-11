import { RoleGuard } from "@/components/auth/role-guard";
import { ResourceLibrary } from "@/components/resources/resource-library";
export default function ResourceManagementPage() {
  return (
    <RoleGuard dashboard="teacher">
      <ResourceLibrary staff />
    </RoleGuard>
  );
}
