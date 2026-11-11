import { Announcements } from "@/components/communication/announcements";
import { RoleGuard } from "@/components/auth/role-guard";
export default function AnnouncementManagementPage() {
  return (
    <RoleGuard dashboard="teacher">
      <Announcements manage />
    </RoleGuard>
  );
}
