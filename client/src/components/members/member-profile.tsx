"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MemberApiError,
  memberProfile,
  membershipDate,
  type PublicMember,
} from "@/lib/member-api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MemberSkeletons } from "./member-directory";
export function MemberProfile({ id }: { id: string }) {
  const t = useT();
  const [member, setMember] = useState<PublicMember | null>(null);
  const [error, setError] = useState<"missing" | "unavailable" | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    memberProfile(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setMember(data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof MemberApiError && cause.status === 404
              ? "missing"
              : "unavailable",
          );
      });
    const focus = () => {
      setMember(null);
      setError(null);
      setRevision((value) => value + 1);
    };
    window.addEventListener("focus", focus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", focus);
    };
  }, [id, revision]);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <Link href="/members" className="text-blue-700 underline">
        {t("Back to members")}
      </Link>
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl">
                {error === "missing"
                  ? t("Member not found")
                  : t("Unable to load profile")}
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p role="alert">
              {error === "missing"
                ? t(
                    "This profile is not available in the approved member directory.",
                  )
                : t("Please try again.")}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setError(null);
                setMember(null);
                setRevision((value) => value + 1);
              }}
            >
              {t("Refresh profile")}
            </Button>
          </CardContent>
        </Card>
      ) : !member ? (
        <MemberSkeletons />
      ) : (
        <Card className="border-t-4 border-blue-600">
          <CardHeader>
            <p className="text-sm font-semibold text-teal-700">
              {t("NGC Science Club member")}
            </p>
            <CardTitle>
              <h1 className="break-words text-3xl font-bold">{member.name}</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-6 sm:grid-cols-2">
              {[
                ["Department", member.department],
                ["Academic year", member.academicYear],
                ["Member since", membershipDate(member.membershipDate)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-medium text-slate-500">{t(label)}</dt>
                  <dd className="mt-1 break-words text-lg">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
