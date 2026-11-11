"use client";

import { useT } from "@/components/i18n/language";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { EventDetail } from "@/components/events/event-detail";
function Detail() {
  const { id } = useParams<{
    id: string;
  }>();
  return <EventDetail key={id} id={id} />;
}
export default function EventPage() {
  const t = useT();
  return (
    <Suspense fallback={<p role="status">{t("Loading event...")}</p>}>
      <Detail />
    </Suspense>
  );
}
