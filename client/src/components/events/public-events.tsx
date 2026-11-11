"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { eventCategories, listEvents, type ClubEvent } from "@/lib/event-api";
import { EventCard, EventSkeletons } from "./event-shared";
export function PublicEvents() {
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
      <h1 className="text-3xl font-bold">Events and activities</h1>
      <p className="text-slate-600">
        Discover science workshops, seminars, competitions and club
        achievements.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1">
          When
          <select
            aria-label="Event period"
            className="block rounded-md border p-2"
            value={period}
            onChange={(e) => {
              reset();
              setPeriod(e.target.value);
            }}
          >
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All dates</option>
          </select>
        </label>
        <label className="space-y-1">
          Category
          <select
            aria-label="Event category"
            className="block rounded-md border p-2"
            value={category}
            onChange={(e) => {
              reset();
              setCategory(e.target.value);
            }}
          >
            <option value="">All categories</option>
            {eventCategories.map((value) => (
              <option key={value} value={value}>
                {value}
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
          Refresh events
        </Button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <EventSkeletons />
      ) : data.events.length === 0 ? (
        <p role="status">No events match these filters.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
      {data && !error && (
        <nav aria-label="Event pages" className="flex items-center gap-4">
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
