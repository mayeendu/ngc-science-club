import { RoleGuard } from "@/components/auth/role-guard";
import { MemberProfileEditor } from "@/components/membership/member-profile-editor";
export default function StudentMemberProfilePage() {
  return (
    <RoleGuard dashboard="student" allowedRoles={["student"]}>
      <MemberProfileEditor />
    </RoleGuard>
  );
}
