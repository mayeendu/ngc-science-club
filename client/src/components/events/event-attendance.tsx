"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "@/lib/i18n/toast";
import {
  eventParticipants,
  markAttendance,
  EventApiError,
  eventDate,
  type Participants,
} from "@/lib/event-api";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/auth/access-state";
import { EventSkeletons, EventConfirmation } from "./event-shared";
export function EventAttendance({ id }: { id: string }) {
  const t = useT();
  const [data, setData] = useState<Participants | null>(null),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState<{
      item: Participants["items"][number];
      attendance: "present" | "absent";
    } | null>(null);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    eventParticipants(id, page, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof EventApiError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof EventApiError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load participants.",
        );
      });
    return () => controller.abort();
  }, [id, page, revision, router]);
  const refresh = () => {
    setData(null);
    setError("");
    setRevision((v) => v + 1);
  };
  async function confirm() {
    if (!action || busy) return;
    setBusy(true);
    try {
      await markAttendance(id, action.item, action.attendance);
      toast.success("Attendance saved.");
      setAction(null);
      refresh();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to save attendance.",
      );
      if (cause instanceof EventApiError && cause.status === 401)
        router.replace("/login");
      setAction(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <Link
        href="/dashboard/teacher/events"
        className="text-blue-700 underline"
      >
        {t("Back to event management")}
      </Link>
      <h1 className="text-3xl font-bold">
        {t("Event participants and attendance")}
      </h1>
      <Button variant="outline" onClick={refresh} disabled={busy}>
        {t("Refresh participants")}
      </Button>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <EventSkeletons />
      ) : (
        <>
          <h2 className="break-words text-2xl font-semibold">
            {data.event.title}
          </h2>
          <p>
            {eventDate(data.event.startsAt)}
            {t("(Dhaka) \u00B7")} {t(data.event.status)}
          </p>
          <p>
            {t("Registered:")} {data.counts.registered} {t("\u00B7 Present:")}{" "}
            {data.counts.present} {t("\u00B7 Absent:")} {data.counts.absent}{" "}
            {t("\u00B7 Unmarked:")}{" "}
            {data.counts.registered - data.counts.present - data.counts.absent}
          </p>
          <p className="text-sm text-slate-600">
            {t(
              "Attendance is available only after a published event starts. Cancelled registrations are excluded.",
            )}
          </p>
          {data.items.length === 0 ? (
            <p role="status">{t("No registered participants.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">
                  {t("Private event participant list")}
                </caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3">{t("Member")}</th>
                    <th className="p-3">{t("Registered (Dhaka)")}</th>
                    <th className="p-3">{t("Attendance")}</th>
                    <th className="p-3">{t("Mark attendance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="break-words p-3">{item.name}</td>
                      <td className="p-3">{eventDate(item.registeredAt)}</td>
                      <td className="p-3">{t(item.attendance)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {(["present", "absent"] as const).map(
                            (attendance) => (
                              <Button
                                key={attendance}
                                variant="outline"
                                size="sm"
                                disabled={
                                  busy ||
                                  data.event.status !== "published" ||
                                  item.attendance === attendance
                                }
                                onClick={() => setAction({ item, attendance })}
                              >
                                {attendance === "present"
                                  ? t("Present")
                                  : t("Absent")}
                              </Button>
                            ),
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label={t("Participant pages")}
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
              {t("Previous page")}
            </Button>
            <span>
              {t("Page")} {page}
            </span>
            <Button
              variant="outline"
              disabled={!data.hasNext}
              onClick={() => {
                setData(null);
                setPage((v) => v + 1);
              }}
            >
              {t("Next page")}
            </Button>
          </nav>
        </>
      )}
      {action && (
        <EventConfirmation
          title={t("Confirm attendance record?")}
          busy={busy}
          onCancel={() => setAction(null)}
          onConfirm={() => void confirm()}
        >
          {t("Mark")} {action.item.name} {t("as")} {t(action.attendance)}?
        </EventConfirmation>
      )}
    </main>
  );
}
