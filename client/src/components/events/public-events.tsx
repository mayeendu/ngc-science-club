"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { eventCategories, listEvents, type ClubEvent } from "@/lib/event-api";
import { EventCard, EventSkeletons } from "./event-shared";
export function PublicEvents() {
  const t = useT();
  const [period, setPeriod] = useState("upcoming"),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<{
      events: ClubEvent[];
      hasNext: boolean;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    listEvents(page, period, category, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Unable to load events. Please retry.");
      });
    return () => controller.abort();
  }, [page, period, category, revision]);
  const reset = () => {
    setData(null);
    setError("");
    setPage(1);
  };
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("Events and activities")}</h1>
      <p className="text-slate-600">
        {t(
          "Discover science workshops, seminars, competitions and club achievements.",
        )}
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1">
          {t("When")}
          <select
            aria-label={t("Event period")}
            className="block rounded-md border p-2"
            value={period}
            onChange={(e) => {
              reset();
              setPeriod(e.target.value);
            }}
          >
            <option value="upcoming">{t("Upcoming")}</option>
            <option value="past">{t("Past")}</option>
            <option value="all">{t("All dates")}</option>
          </select>
        </label>
        <label className="space-y-1">
          {t("Category")}
          <select
            aria-label={t("Event category")}
            className="block rounded-md border p-2"
            value={category}
            onChange={(e) => {
              reset();
              setCategory(e.target.value);
            }}
          >
            <option value="">{t("All categories")}</option>
            {eventCategories.map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() => {
            setData(null);
            setError("");
            setRevision((v) => v + 1);
          }}
        >
          {t("Refresh events")}
        </Button>
      </div>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <EventSkeletons />
      ) : data.events.length === 0 ? (
        <p role="status">{t("No events match these filters.")}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
      {data && !error && (
        <nav aria-label={t("Event pages")} className="flex items-center gap-4">
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
      )}
    </main>
  );
}
