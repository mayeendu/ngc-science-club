import { Notifications } from "@/components/communication/notifications";
import { RoleGuard } from "@/components/auth/role-guard";
export default function NotificationsPage() {
  return (
    <RoleGuard dashboard="student">
      <Notifications />
    </RoleGuard>
  );
}
