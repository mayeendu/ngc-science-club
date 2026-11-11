import { FeedbackBoard } from "@/components/feedback/feedback-board";
import { RoleGuard } from "@/components/auth/role-guard";
export default function FeedbackPage() {
  return (
    <RoleGuard dashboard="student">
      <FeedbackBoard />
    </RoleGuard>
  );
}
