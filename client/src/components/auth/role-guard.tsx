"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { dashboardRoles, parseRole, type AppRole } from "@/lib/roles";
import { AccessDenied, AccessError, AccessLoading } from "./access-state";

// A UX guard only: Express independently authorizes every protected request.
export function RoleGuard({
  dashboard,
  children,
  allowedRoles,
}: {
  dashboard: AppRole;
  children: ReactNode;
  allowedRoles?: readonly AppRole[];
}) {
  const { data, error, isPending, refetch } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!isPending && !error && !data) router.replace("/login");
  }, [data, error, isPending, router]);
  if (isPending) return <AccessLoading />;
  if (error) return <AccessError retry={() => void refetch()} />;
  if (!data) return <AccessLoading />;
  const role = parseRole(data.user.role);
  if (!role || !(allowedRoles ?? dashboardRoles[dashboard]).includes(role))
    return <AccessDenied />;
  return (
    <VerifiedOverview
      key={`${data.user.id}:${role}:${dashboard}:${data.session.expiresAt}`}
      dashboard={dashboard}
      expiresAt={new Date(data.session.expiresAt).getTime()}
    >
      {children}
    </VerifiedOverview>
  );
}

function VerifiedOverview({
  dashboard,
  expiresAt,
  children,
}: {
  dashboard: AppRole;
  expiresAt: number;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<
    "loading" | "allowed" | "denied" | "error" | "expired"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    const expire = () => {
      sequence++;
      setStatus("expired");
      router.replace("/login");
    };
    // Schedule instead of trusting client dates as authorization evidence.
    const remaining = Number.isFinite(expiresAt) ? expiresAt - Date.now() : 0;
    const timer = window.setTimeout(
      expire,
      Math.max(0, Math.min(remaining, 2_147_483_647)),
    );
    async function verify() {
      if (expiresAt <= Date.now()) {
        expire();
        return;
      }
      const request = ++sequence;
      try {
        const base = process.env.NEXT_PUBLIC_AUTH_URL;
        if (!base) throw new Error("Missing API configuration");
        const response = await fetch(
          `${base.replace(/\/$/, "")}/api/${dashboard}/overview`,
          {
            credentials: "include",
            cache: "no-store",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(10_000),
            ]),
          },
        );
        if (controller.signal.aborted || request !== sequence) return;
        if (response.status === 401) {
          expire();
          return;
        }
        if (response.status === 403) {
          setStatus("denied");
          return;
        }
        if (!response.ok) throw new Error("API unavailable");
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("success" in body) ||
          body.success !== true
        )
          throw new Error("Unexpected response");
        if (!controller.signal.aborted && request === sequence)
          setStatus("allowed");
      } catch {
        if (!controller.signal.aborted && request === sequence)
          setStatus("error");
      }
    }
    if (remaining > 0) void verify();
    const onFocus = () => {
      setStatus("loading");
      void verify();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [dashboard, expiresAt, router, attempt]);
  if (status === "denied") return <AccessDenied />;
  if (status === "error")
    return (
      <AccessError
        retry={() => {
          setStatus("loading");
          setAttempt((value) => value + 1);
        }}
      />
    );
  if (status !== "allowed") return <AccessLoading />;
  return <>{children}</>;
}
