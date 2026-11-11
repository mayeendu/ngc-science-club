import { Translated } from "@/components/i18n/language";
import { Suspense } from "react";
import { Announcements } from "@/components/communication/announcements";
async function Detail({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;
  return <Announcements id={id} />;
}
export default function AnnouncementPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  return (
    <Suspense
      fallback={
        <p role="status">
          <Translated text="Loading announcement…" />
        </p>
      }
    >
      <Detail {...props} />
    </Suspense>
  );
}
