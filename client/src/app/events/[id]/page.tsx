"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { EventDetail } from "@/components/events/event-detail";
function Detail() {
  const { id } = useParams<{ id: string }>();
  return <EventDetail key={id} id={id} />;
}
export default function EventPage() {
  return (
    <Suspense fallback={<p role="status">Loading event...</p>}>
      <Detail />
    </Suspense>
  );
}
