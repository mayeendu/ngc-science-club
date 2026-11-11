"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignedActivities } from "@/lib/faculty-api";
import { ClubApiError } from "@/lib/club-api";
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
export function AssignedActivities() {
  const t = useT();
  const router = useRouter();
  const [data, setData] = useState<Awaited<
      ReturnType<typeof assignedActivities>
    > | null>(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const reload = () => {
    setData(null);
    setError("");
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    assignedActivities(page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ClubApiError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof ClubApiError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof Error ? cause.message : "Unable to load activities.",
        );
      });
    return () => controller.abort();
  }, [page, revision, router]);
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("My assigned activities")}</h1>
      <p>
        {t(
          "Activity details assigned by the club administrator. Event management and participant access continue to follow event ownership.",
        )}
      </p>
      <Button variant="outline" onClick={reload}>
        {t("Refresh activities")}
      </Button>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <p role="status">{t("Loading activities\u2026")}</p>
      ) : !data.items.length ? (
        <p role="status">{t("No activities assigned.")}</p>
      ) : (
        <ul className="space-y-4">
          {data.items.map((event) => (
            <li key={event.id} className="space-y-2 rounded-xl border p-4">
              <h2 className="text-xl font-semibold">{event.title}</h2>
              <p>
                {new Date(event.startsAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Dhaka",
                })}{" "}
                {t("(Dhaka) \u00B7")} {event.venue} · {t(event.status)}
              </p>
              {event.status !== "draft" && (
                <Link
                  href={`/events/${event.id}`}
                  className="text-blue-700 underline"
                >
                  {t("View public event")}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <nav className="flex gap-4" aria-label={t("Assigned activity pages")}>
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => {
            setPage((value) => value - 1);
            reload();
          }}
        >
          {t("Previous")}
        </Button>
        <span>
          {t("Page")} {page}
        </span>
        <Button
          variant="outline"
          disabled={!data?.hasNext || page >= 1000}
          onClick={() => {
            setPage((value) => value + 1);
            reload();
          }}
        >
          {t("Next")}
        </Button>
      </nav>
    </main>
  );
}
