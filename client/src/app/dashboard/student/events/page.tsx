import { RoleGuard } from "@/components/auth/role-guard";
import { MyEvents } from "@/components/events/my-events";
export default function MyEventsPage() {
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <MyEvents />
    </RoleGuard>
  );
}
