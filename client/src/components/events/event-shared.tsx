"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventDate, type ClubEvent } from "@/lib/event-api";
export function EventSkeletons() {
  return (
    <div role="status" aria-label="Loading events">
      <span className="sr-only">Loading events...</span>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-64 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
export function EventImage({ event }: { event: ClubEvent }) {
  return event.image ? (
    <Image
      unoptimized
      src={event.image}
      alt=""
      width={800}
      height={400}
      referrerPolicy="no-referrer"
      className="h-48 w-full rounded-lg object-cover"
    />
  ) : null;
}
export function EventCard({
  event,
  children,
}: {
  event: ClubEvent;
  children?: ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <EventImage event={event} />
        <p className="text-sm capitalize text-teal-800">
          {event.category} · {event.status}
        </p>
        <CardTitle>
          <h2 className="break-words text-xl">{event.title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p>{eventDate(event.startsAt)} (Dhaka)</p>
        <p className="break-words">{event.venue}</p>
        <p>
          {event.category === "achievement"
            ? "Club achievement"
            : `${Math.max(0, event.capacity - event.registeredCount)} / ${event.capacity} places available`}
        </p>
        <Link
          href={`/events/${event.id}`}
          className="inline-block text-blue-700 underline"
        >
          View event
        </Link>
        {children}
      </CardContent>
    </Card>
  );
}
export function EventConfirmation({
  title,
  children,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={heading}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onConfirm();
        }}
      >
        <h2 id={heading} className="text-xl font-bold">
          {title}
        </h2>
        <div>{children}</div>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Keep unchanged
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Confirm"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
