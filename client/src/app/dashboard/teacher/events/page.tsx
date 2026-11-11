import { RoleGuard } from "@/components/auth/role-guard";
import { EventManagement } from "@/components/events/event-management";
export default function ManageEventsPage() {
  return (
    <RoleGuard dashboard="teacher">
      <EventManagement />
    </RoleGuard>
  );
}
