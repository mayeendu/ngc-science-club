"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { listNotifications, markNotification } from "@/lib/communication-api";
import { ClubApiError } from "@/lib/club-api";
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
export function NotificationBell() {
  const t = useT();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      const request = ++sequence;
      listNotifications(1, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted && request === sequence)
            setCount(data.unreadCount);
        })
        .catch(() => {
          if (!controller.signal.aborted && request === sequence)
            setCount(null);
        });
    };
    load();
    const interval = window.setInterval(load, 60000);
    window.addEventListener("club-notifications-updated", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("club-notifications-updated", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  return (
    <Link
      href="/dashboard/notifications"
      aria-label={
        count === null
          ? t("Notifications")
          : t("Notifications ({0} unread)", [count])
      }
      className="inline-flex items-center gap-1 text-sm text-blue-700"
    >
      <Bell className="size-4" aria-hidden="true" />
      {t("Notifications")}{" "}
      {count !== null && (
        <span className="rounded-full bg-blue-100 px-2 text-blue-900">
          {count}
        </span>
      )}
    </Link>
  );
}
export function Notifications() {
  const t = useT();
  const router = useRouter();
  const [data, setData] = useState<Awaited<
      ReturnType<typeof listNotifications>
    > | null>(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
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
    listNotifications(page, controller.signal)
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
            : "Unable to load notifications.",
        );
      });
    return () => controller.abort();
  }, [page, revision, router]);
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("My notifications")}</h1>
      <p>
        {t(
          "Membership decisions, available quizzes and released results, your registered event updates, and published announcements.",
        )}
      </p>
      <Button variant="outline" onClick={refresh}>
        {t("Refresh notifications")}
      </Button>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <p role="status">{t("Loading notifications\u2026")}</p>
      ) : (
        <>
          <p aria-live="polite">
            {data.unreadCount} {t("unread notifications")}
          </p>
          {!data.items.length ? (
            <p role="status">{t("No notifications yet.")}</p>
          ) : (
            <ul className="space-y-4">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className={`space-y-3 rounded-xl border p-5 ${item.read ? "" : "border-blue-500"}`}
                >
                  <p className="text-sm">
                    {t(item.kind)} · {t(item.read ? "Read" : "Unread")} ·{" "}
                    {new Date(item.date).toLocaleString("en-GB", {
                      timeZone: "Asia/Dhaka",
                    })}{" "}
                    {t("(Dhaka)")}
                  </p>
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p>{t(item.body)}</p>
                  <div className="flex flex-wrap gap-4">
                    <Link href={item.href} className="text-blue-700 underline">
                      {t("View")} {item.title}
                    </Link>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await markNotification(item.id, !item.read);
                          window.dispatchEvent(
                            new Event("club-notifications-updated"),
                          );
                          refresh();
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Unable to update notification.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t(item.read ? "Mark unread" : "Mark read")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <nav aria-label={t("Notification pages")} className="flex gap-4">
        <Button
          variant="outline"
          disabled={page === 1 || busy}
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
          disabled={!data?.hasNext || page >= 1000 || busy}
          onClick={() => {
            setPage((value) => value + 1);
            refresh();
          }}
        >
          {t("Next")}
        </Button>
      </nav>
    </main>
  );
}
