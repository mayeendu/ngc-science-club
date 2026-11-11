import { RoleGuard } from "@/components/auth/role-guard";
import { EventManagement } from "@/components/events/event-management";
export default function AdminEventsPage() {
  return (
    <RoleGuard dashboard="admin" allowedRoles={["admin"]}>
      <EventManagement />
    </RoleGuard>
  );
}
