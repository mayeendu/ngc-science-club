"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  myEvents,
  EventApiError,
  type ClubEvent,
  type OwnEvent,
} from "@/lib/event-api";
import { Button } from "@/components/ui/button";
import { EventCard, EventSkeletons } from "./event-shared";
export function MyEvents() {
  const [data, setData] = useState<{
      items: {
        event: ClubEvent;
        registration: NonNullable<OwnEvent["registration"]>;
      }[];
      hasNext: boolean;
    } | null>(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    myEvents(page, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof EventApiError && cause.status === 401)
          router.replace("/login");
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load your events.",
        );
      });
    return () => controller.abort();
  }, [page, revision, router]);
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">My events and participation</h1>
      <Link href="/events" className="text-blue-700 underline">
        Explore events
      </Link>
      <Button
        variant="outline"
        className="ml-4"
        onClick={() => {
          setError("");
          setData(null);
          setRevision((v) => v + 1);
        }}
      >
        Refresh my events
      </Button>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <EventSkeletons />
      ) : data.items.length === 0 ? (
        <p role="status">You have not registered for any events yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <EventCard key={item.event.id} event={item.event}>
              <p>Registration: {item.registration.status}</p>
              <p>
                Attendance:{" "}
                {item.event.status === "cancelled"
                  ? "Event cancelled"
                  : item.registration.attendance}
              </p>
            </EventCard>
          ))}
        </div>
      )}
      {data && !error && (
        <nav className="flex items-center gap-4" aria-label="My event pages">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => {
              setData(null);
              setPage((v) => v - 1);
            }}
          >
            Previous page
          </Button>
          <span>Page {page}</span>
          <Button
            variant="outline"
            disabled={!data.hasNext}
            onClick={() => {
              setData(null);
              setPage((v) => v + 1);
            }}
          >
            Next page
          </Button>
        </nav>
      )}
    </main>
  );
}
