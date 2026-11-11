"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  manageEvents,
  eventStats,
  changeEventStatus,
  deleteEvent,
  eventDate,
  EventApiError,
  type ClubEvent,
  type EventStats,
} from "@/lib/event-api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AccessDenied } from "@/components/auth/access-state";
import { EventForm } from "./event-form";
import { EventSkeletons, EventConfirmation } from "./event-shared";
export function EventManagement() {
  const [data, setData] = useState<{
      events: ClubEvent[];
      hasNext: boolean;
    } | null>(null),
    [stats, setStats] = useState<EventStats | null>(null),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<ClubEvent | "new" | null>(null),
    [action, setAction] = useState<{
      event: ClubEvent;
      type: "draft" | "published" | "cancelled" | "delete";
    } | null>(null),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      manageEvents(page, status, controller.signal),
      eventStats(controller.signal),
    ])
      .then(([list, summary]) => {
        if (!controller.signal.aborted) {
          setData(list);
          setStats(summary);
        }
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof EventApiError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof EventApiError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof Error ? cause.message : "Unable to load events.",
        );
      });
    return () => controller.abort();
  }, [page, status, revision, router]);
  function refresh() {
    setData(null);
    setStats(null);
    setError("");
    setRevision((v) => v + 1);
  }
  async function confirm() {
    if (!action || busy) return;
    setBusy(true);
    try {
      if (action.type === "delete") await deleteEvent(action.event);
      else await changeEventStatus(action.event, action.type);
      toast.success("Event updated.");
      setAction(null);
      refresh();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to update event.",
      );
      if (cause instanceof EventApiError && cause.status === 401)
        router.replace("/login");
      if (cause instanceof EventApiError && cause.status === 403)
        setDenied(true);
      setAction(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">Event management and statistics</h1>
      <p className="text-slate-600">
        Teachers manage their own events. Administrators manage all events.
        Participant details remain private.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button onClick={() => setEditing("new")} disabled={busy}>
          Create event
        </Button>
        <Button variant="outline" onClick={refresh} disabled={busy}>
          Refresh management
        </Button>
        <label>
          Status
          <select
            aria-label="Management event status"
            value={status}
            className="ml-2 rounded-md border p-2"
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              setData(null);
            }}
          >
            <option value="">All statuses</option>
            {["draft", "published", "cancelled"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {editing && (
        <EventForm
          key={editing === "new" ? "new" : editing.id}
          event={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : !data || !stats ? (
        <EventSkeletons />
      ) : (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Event statistics"
          >
            {[
              ["Total events", stats.total],
              ["Published", stats.published],
              ["Drafts", stats.draft],
              ["Cancelled", stats.cancelled],
              ["Registrations", stats.registrations],
              ["Present", stats.present],
              ["Absent", stats.absent],
              [
                "Attendance rate",
                stats.present + stats.absent
                  ? `${Math.round((stats.present / (stats.present + stats.absent)) * 100)}%`
                  : "0%",
              ],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle>
                    <h2>{label}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-800">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          <p className="text-sm text-slate-600">
            Registrations include retained records for cancelled events.
            Attendance rate is present ÷ marked (present + absent).
          </p>
          <div
            className="flex flex-wrap gap-3"
            aria-label="Activity distribution"
          >
            {stats.categories.map((row) => (
              <span
                key={row.category}
                className="rounded-full bg-teal-50 px-3 py-1 text-sm"
              >
                {row.category}: {row.count}
              </span>
            ))}
          </div>
          {data.events.length === 0 ? (
            <p role="status">No events match this status.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[780px] text-left text-sm">
                <caption className="sr-only">
                  Managed events and activities
                </caption>
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Event",
                      "Start (Dhaka)",
                      "Status",
                      "Registrations",
                      "Actions",
                    ].map((label) => (
                      <th key={label} className="p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={event.id} className="border-t">
                      <td className="max-w-64 break-words p-3">
                        <p className="font-semibold">{event.title}</p>
                        <p>{event.category}</p>
                      </td>
                      <td className="p-3">{eventDate(event.startsAt)}</td>
                      <td className="p-3">{event.status}</td>
                      <td className="p-3">
                        {event.registeredCount} / {event.capacity}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || event.status !== "draft"}
                            onClick={() => setEditing(event)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              busy ||
                              event.status === "cancelled" ||
                              event.registeredCount > 0
                            }
                            onClick={() =>
                              setAction({
                                event,
                                type:
                                  event.status === "draft"
                                    ? "published"
                                    : "draft",
                              })
                            }
                          >
                            {event.status === "draft" ? "Publish" : "Unpublish"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || event.status !== "published"}
                            onClick={() =>
                              setAction({ event, type: "cancelled" })
                            }
                          >
                            Cancel event
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || event.status !== "draft"}
                            onClick={() => setAction({ event, type: "delete" })}
                          >
                            Delete
                          </Button>
                          <Link
                            href={`/dashboard/teacher/events/${event.id}`}
                            className="self-center text-blue-700 underline"
                          >
                            Participants and attendance
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="Managed event pages"
            className="flex items-center gap-4"
          >
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
        </>
      )}
      {action && (
        <EventConfirmation
          title={`${action.type === "delete" ? "Archive" : action.type === "cancelled" ? "Cancel" : "Change status of"} this event?`}
          busy={busy}
          onCancel={() => setAction(null)}
          onConfirm={() => void confirm()}
        >
          <p>{action.event.title}</p>
          <p className="mt-2">
            {action.type === "cancelled"
              ? "Cancellation is permanent. Members will see this event as cancelled and attendance will be disabled."
              : action.type === "delete"
                ? "The empty draft will be archived and removed from event lists."
                : `The event status will become ${action.type}.`}
          </p>
        </EventConfirmation>
      )}
    </main>
  );
}
