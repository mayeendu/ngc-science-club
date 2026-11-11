import { RoleGuard } from "@/components/auth/role-guard";
import { Certificates } from "@/components/showcase/certificates";
export default function CertificatesPage() {
  return (
    <RoleGuard dashboard="student">
      <Certificates />
    </RoleGuard>
  );
}
