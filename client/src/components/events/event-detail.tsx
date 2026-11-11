"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "@/lib/i18n/toast";
import { useSession } from "@/lib/auth-client";
import {
  EventApiError,
  eventDetail,
  ownEvent,
  registerEvent,
  eventDate,
  type ClubEvent,
  type OwnEvent,
} from "@/lib/event-api";
import { Button } from "@/components/ui/button";
import { EventImage, EventSkeletons, EventConfirmation } from "./event-shared";
export function EventDetail({ id }: { id: string }) {
  const { data } = useSession();
  return (
    <EventDetailContent key={`${id}:${data?.user.id ?? "guest"}`} id={id} />
  );
}
function EventDetailContent({ id }: { id: string }) {
  const t = useT();
  const { data: session, isPending } = useSession(),
    router = useRouter();
  const [event, setEvent] = useState<ClubEvent | null>(null),
    [own, setOwn] = useState<OwnEvent["registration"]>(null),
    [membershipError, setMembershipError] = useState(""),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [verified, setVerified] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    eventDetail(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setEvent(data.event);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Unable to load event.",
          );
      });
    return () => controller.abort();
  }, [id, revision]);
  useEffect(() => {
    if (!session || session.user.role !== "student") return;
    const controller = new AbortController();
    ownEvent(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setOwn(data.registration);
          setEvent(data.event);
          setVerified(true);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setMembershipError(
            cause instanceof Error
              ? cause.message
              : "Unable to verify membership.",
          );
      });
    return () => controller.abort();
  }, [id, session, revision]);
  const refresh = () => {
    setError("");
    setMembershipError("");
    setEvent(null);
    setVerified(false);
    setRevision((v) => v + 1);
  };
  async function act(cancel = false) {
    setBusy(true);
    try {
      const data = await registerEvent(id, cancel);
      setEvent(data.event);
      setOwn(data.registration);
      toast.success(
        cancel
          ? "Registration cancelled."
          : "You are registered for this event.",
      );
      setConfirm(false);
    } catch (cause) {
      if (cause instanceof EventApiError && cause.status === 401)
        router.replace("/login");
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Unable to change registration.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link href="/events" className="text-blue-700 underline">
        {t("Back to events")}
      </Link>
      <Button
        variant="outline"
        className="ml-4"
        onClick={refresh}
        disabled={busy}
      >
        {t("Refresh event")}
      </Button>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !event ? (
        <EventSkeletons />
      ) : (
        <>
          <EventImage event={event} />
          <p className="capitalize text-teal-800">
            {t(event.category)} · {t(event.status)}
          </p>
          <h1 className="break-words text-3xl font-bold">{event.title}</h1>
          <p>
            {eventDate(event.startsAt)}
            {t("(Dhaka)")}
          </p>
          <p className="break-words">
            {t("Venue:")} {event.venue}
          </p>
          <p className="whitespace-pre-wrap break-words">{event.description}</p>
          <p>
            {event.category === "achievement"
              ? t("Achievements do not accept registrations.")
              : t("{0} / {1} registrations", [
                  event.registeredCount,
                  event.capacity,
                ])}
          </p>
          {event.status === "cancelled" && (
            <p
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 p-3"
            >
              {t("This event has been cancelled. Attendance is unavailable.")}
            </p>
          )}
          {isPending ? (
            <p role="status">{t("Checking account...")}</p>
          ) : !session ? (
            <Link href="/login" className="text-blue-700 underline">
              {t("Sign in to register")}
            </Link>
          ) : session.user.role !== "student" ? (
            <p>{t("Use your staff dashboard to manage events.")}</p>
          ) : membershipError ? (
            <p role="alert">{membershipError}</p>
          ) : !verified ? (
            <p role="status">{t("Checking membership and registration...")}</p>
          ) : (
            <section className="space-y-4 rounded-xl border p-5">
              <h2 className="text-xl font-semibold">
                {t("Your participation")}
              </h2>
              <p>
                {t("Registration:")} {own?.status ?? "Not registered"}
              </p>
              {own?.status === "registered" && (
                <p>
                  {t("Attendance:")} {t(own.attendance)}
                </p>
              )}
              {own?.status === "registered" ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirm(true)}
                >
                  {t("Cancel registration")}
                </Button>
              ) : (
                <Button
                  disabled={
                    busy ||
                    event.status !== "published" ||
                    event.category === "achievement" ||
                    event.registeredCount >= event.capacity
                  }
                  onClick={() => void act()}
                >
                  {t("Register for event")}
                </Button>
              )}
              <p className="text-sm text-slate-600">
                {t(
                  "Registration and cancellation close at the event start time. The server validates availability.",
                )}
              </p>
              <Link
                href="/dashboard/student/events"
                className="inline-block text-blue-700 underline"
              >
                {t("My events")}
              </Link>
            </section>
          )}
          {confirm && (
            <EventConfirmation
              title={t("Cancel your registration?")}
              busy={busy}
              onCancel={() => setConfirm(false)}
              onConfirm={() => void act(true)}
            >
              {t(
                "Your reserved place will become available to another member.",
              )}
            </EventConfirmation>
          )}
        </>
      )}
    </main>
  );
}
