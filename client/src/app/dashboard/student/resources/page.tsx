import { RoleGuard } from "@/components/auth/role-guard";
import { ResourceLibrary } from "@/components/resources/resource-library";
export default function ResourcePage() {
  return (
    <RoleGuard dashboard="student">
      <ResourceLibrary />
    </RoleGuard>
  );
}
