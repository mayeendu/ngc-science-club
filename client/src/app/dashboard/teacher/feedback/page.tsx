import { FeedbackBoard } from "@/components/feedback/feedback-board";
import { RoleGuard } from "@/components/auth/role-guard";
export default function FeedbackManagementPage() {
  return (
    <RoleGuard dashboard="teacher">
      <FeedbackBoard staff />
    </RoleGuard>
  );
}
