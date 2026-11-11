import { Translated } from "@/components/i18n/language";
import { FacultyDirectory } from "@/components/faculty/faculty-directory";
import { Suspense } from "react";
export default function FacultyProfilePage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  return (
    <Suspense
      fallback={
        <p role="status">
          <Translated text="Loading faculty profile…" />
        </p>
      }
    >
      <FacultyProfileContent {...props} />
    </Suspense>
  );
}
async function FacultyProfileContent({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;
  return <FacultyDirectory id={id} />;
}
