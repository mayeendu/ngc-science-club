import { RoleGuard } from "@/components/auth/role-guard";
import { ShowcaseBoard } from "@/components/showcase/showcase-board";
export default function ShowcasePage() {
  return (
    <RoleGuard dashboard="teacher">
      <ShowcaseBoard staff />
    </RoleGuard>
  );
}
