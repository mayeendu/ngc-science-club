import { RoleGuard } from "@/components/auth/role-guard";
import { AssignedActivities } from "@/components/faculty/assigned-activities";
export default function AssignedActivitiesPage() {
  return (
    <RoleGuard dashboard="teacher">
      <AssignedActivities />
    </RoleGuard>
  );
}
