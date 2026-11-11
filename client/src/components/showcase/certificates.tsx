"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/components/i18n/language";
import {
  listCertificates,
  issueCertificate,
  revokeCertificate,
  verifyCertificate,
  type Certificate,
} from "@/lib/showcase-api";
import {
  manageEvents,
  eventParticipants,
  type Participants,
} from "@/lib/event-api";
import { ClubApiError } from "@/lib/club-api";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/auth/access-state";
import { EventConfirmation } from "@/components/events/event-shared";
function IssueCertificates({ done }: { done: () => void }) {
  const t = useT();
  const [events, setEvents] = useState<Awaited<
      ReturnType<typeof manageEvents>
    > | null>(null),
    [eventPage, setEventPage] = useState(1),
    [id, setId] = useState(""),
    [participants, setParticipants] = useState<Participants | null>(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    manageEvents(eventPage, "published", controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setEvents(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Unable to load events.",
          );
      });
    return () => controller.abort();
  }, [eventPage]);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    eventParticipants(id, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setParticipants(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load participants.",
          );
      });
    return () => controller.abort();
  }, [id, page]);
  return (
    <section className="space-y-4 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">
        {t("Issue attendance certificates")}
      </h2>
      <p>
        {t(
          "Select a started published event. Only registered participants marked present can receive a certificate.",
        )}
      </p>
      <label className="grid gap-1">
        {t("Event")}
        <select
          value={id}
          className="rounded border p-2"
          onChange={(event) => {
            setId(event.target.value);
            setParticipants(null);
            setPage(1);
            setError("");
          }}
        >
          <option value="">{t("Choose an event")}</option>
          {events?.events.map((event) => (
            <option value={event.id} key={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>
      <nav className="flex gap-3" aria-label={t("Event pages")}>
        <Button
          variant="outline"
          disabled={eventPage === 1}
          onClick={() => {
            setEventPage((value) => value - 1);
            setId("");
            setParticipants(null);
          }}
        >
          {t("Previous")}
        </Button>
        <span>
          {t("Page")} {eventPage}
        </span>
        <Button
          variant="outline"
          disabled={!events?.hasNext || eventPage >= 1000}
          onClick={() => {
            setEventPage((value) => value + 1);
            setId("");
            setParticipants(null);
          }}
        >
          {t("Next")}
        </Button>
      </nav>
      {error && <p role="alert">{t(error, undefined, true)}</p>}
      {id && !participants ? (
        <p role="status">{t("Loading participants...")}</p>
      ) : (
        participants && (
          <>
            <ul className="space-y-3">
              {participants.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3">
                  <span>
                    {item.name} · {t(item.attendance)}
                  </span>
                  <Button
                    disabled={
                      busy ||
                      item.attendance !== "present" ||
                      participants.event.status !== "published"
                    }
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await issueCertificate(id, item.id);
                        done();
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Unable to issue certificate.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("Issue certificate for {0}", [item.name])}
                  </Button>
                </li>
              ))}
            </ul>
            <nav className="flex gap-3" aria-label={t("Participant pages")}>
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => {
                  setPage((value) => value - 1);
                  setParticipants(null);
                }}
              >
                {t("Previous")}
              </Button>
              <span>
                {t("Page")} {page}
              </span>
              <Button
                variant="outline"
                disabled={!participants.hasNext || page >= 1000}
                onClick={() => {
                  setPage((value) => value + 1);
                  setParticipants(null);
                }}
              >
                {t("Next")}
              </Button>
            </nav>
          </>
        )
      )}
    </section>
  );
}
function CertificatePrint({
  certificate,
  close,
}: {
  certificate: Certificate;
  close: () => void;
}) {
  const t = useT(),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      onCancel={close}
      aria-label={t("Certificate preview")}
      className="certificate-print-root m-auto w-[calc(100%-2rem)] max-w-5xl rounded-xl border bg-white p-6 backdrop:bg-black/40"
    >
      <div className="no-print mb-5 flex gap-3">
        <Button onClick={() => window.print()}>{t("Print or save PDF")}</Button>
        <Button variant="outline" onClick={close}>
          {t("Close preview")}
        </Button>
      </div>
      <article className="space-y-6 border-4 border-blue-900 p-8 text-center">
        <p className="text-xl font-semibold">
          {t("Narsingdi Government College")}
        </p>
        <p>{t("NGC Science Club")}</p>
        <h1 className="text-4xl font-bold">
          {t("Certificate of participation")}
        </h1>
        <p>{t("This certificate is awarded to")}</p>
        <h2 className="text-3xl font-bold">{certificate.recipientName}</h2>
        <p>{t("For confirmed participation in")}</p>
        <p className="text-2xl font-semibold">{certificate.eventTitle}</p>
        <p>{certificate.eventDate.slice(0, 10)}</p>
        <p>
          {t("Issued on")}: {certificate.issuedAt.slice(0, 10)}
        </p>
        <p className="break-all text-xs">
          {window.location.origin}/certificates/verify/
          {certificate.verificationId}
        </p>
        <p className="text-sm">
          {t(
            "Verify the certificate ID online to confirm its current validity.",
          )}
        </p>
      </article>
    </dialog>,
    document.body,
  );
}
export function Certificates({ staff = false }: { staff?: boolean }) {
  const t = useT(),
    router = useRouter();
  const [data, setData] = useState<Awaited<
      ReturnType<typeof listCertificates>
    > | null>(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [printing, setPrinting] = useState<Certificate | null>(null),
    [revoke, setRevoke] = useState<Certificate | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const refresh = () => {
    setData(null);
    setError("");
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    listCertificates(staff, page, controller.signal)
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
          cause instanceof Error
            ? cause.message
            : "Unable to load certificates.",
        );
      });
    return () => controller.abort();
  }, [staff, page, revision, router]);
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">
        {t(staff ? "Certificate management" : "My certificates")}
      </h1>
      {staff && <IssueCertificates done={refresh} />}
      <Button variant="outline" onClick={refresh}>
        {t("Refresh")}
      </Button>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <p role="status">{t("Loading certificates…")}</p>
      ) : !data.items.length ? (
        <p role="status">{t("No certificates have been issued.")}</p>
      ) : (
        <ul className="space-y-4">
          {data.items.map((item) => (
            <li
              key={item.verificationId}
              className="space-y-3 rounded-xl border p-5"
            >
              <h2 className="text-xl font-semibold">{item.eventTitle}</h2>
              <p>
                {item.recipientName} · {t(item.valid ? "Valid" : "Not valid")}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={`/certificates/verify/${item.verificationId}`}
                  className="text-blue-700 underline"
                >
                  {t("Verify certificate")}
                </Link>
                <Button
                  variant="outline"
                  disabled={!item.valid}
                  onClick={() => setPrinting(item)}
                >
                  {t("Preview certificate")}
                </Button>
                {staff && (
                  <Button
                    variant="outline"
                      disabled={item.revoked}
                    onClick={() => setRevoke(item)}
                  >
                    {t("Revoke certificate")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex gap-4" aria-label={t("Certificate pages")}>
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => {
            setPage((value) => value - 1);
            refresh();
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
            refresh();
          }}
        >
          {t("Next")}
        </Button>
      </nav>
      {printing && (
        <CertificatePrint
          certificate={printing}
          close={() => setPrinting(null)}
        />
      )}
      {revoke && (
        <EventConfirmation
          title={t("Revoke this certificate?")}
          busy={busy}
          onCancel={() => setRevoke(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await revokeCertificate(revoke);
              setRevoke(null);
              refresh();
            } catch (cause) {
              setRevoke(null);
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Unable to revoke certificate.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {t(
              "Revocation is permanent. Online verification will show that this certificate is not valid.",
            )}
          </p>
        </EventConfirmation>
      )}
    </main>
  );
}
export function CertificateVerification({ token }: { token?: string }) {
  const t = useT(),
    router = useRouter();
  const [input, setInput] = useState(""),
    [data, setData] = useState<Awaited<
      ReturnType<typeof verifyCertificate>
    > | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    verifyCertificate(token, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to verify certificate.",
          );
      });
    return () => controller.abort();
  }, [token, revision]);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("Verify certificate")}</h1>
      <p>
        {t(
          "Public verification shows recipient initials only. Full recipient details remain private.",
        )}
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`/certificates/verify/${input.trim().toLowerCase()}`);
        }}
      >
        <label className="grid gap-1">
          {t("Verification ID")}
          <input
            required
            pattern="[a-fA-F0-9]{64}"
            maxLength={64}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="w-full rounded border p-2"
          />
        </label>
        <Button type="submit">{t("Verify certificate")}</Button>
      </form>
      {token && (
        <>
          <Button
            variant="outline"
            onClick={() => {
              setData(null);
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            {t("Refresh")}
          </Button>
          {error ? (
            <p role="alert">{t(error, undefined, true)}</p>
          ) : !data ? (
            <p role="status">{t("Checking certificate…")}</p>
          ) : (
            <section className="space-y-3 rounded-xl border p-5">
              <h2 className="text-2xl font-bold">
                {t(data.certificate.valid ? "Valid" : "Not valid")}
              </h2>
              <p>{data.certificate.eventTitle}</p>
              <p>
                {t("Recipient initials")}: {data.certificate.recipientInitials}
              </p>
              <p>
                {t("Issued on")}: {data.certificate.issuedAt.slice(0, 10)}
              </p>
              <p className="break-all text-sm">
                {data.certificate.verificationId}
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
