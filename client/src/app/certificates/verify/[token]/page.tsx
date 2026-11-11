import { Suspense } from "react";
import { Translated } from "@/components/i18n/language";
import { CertificateVerification } from "@/components/showcase/certificates";
async function Verification({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CertificateVerification key={token} token={token} />;
}
export default function VerifyPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<Translated text="Checking certificate…" />}>
      <Verification {...props} />
    </Suspense>
  );
}
