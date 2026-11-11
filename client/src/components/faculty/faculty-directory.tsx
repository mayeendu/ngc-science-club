"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  listFaculty,
  facultyDetail,
  type FacultyProfile,
} from "@/lib/faculty-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function FacultyCard({
  profile,
  detail = false,
}: {
  profile: FacultyProfile;
  detail?: boolean;
}) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        {profile.photo && (
          <Image
            unoptimized
            src={profile.photo}
            alt={profile.name}
            width={160}
            height={160}
            referrerPolicy="no-referrer"
            className="size-32 rounded-full object-cover"
          />
        )}
        <CardTitle>
          <h2>{profile.name}</h2>
        </CardTitle>
        <p>
          {profile.designation} · {profile.department}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p>{profile.specialization}</p>
        {detail ? (
          <p className="whitespace-pre-wrap break-words">{profile.bio}</p>
        ) : (
          <Link
            className="text-blue-700 underline"
            href={`/faculty/${profile.id}`}
          >
            {t("View mentor profile")}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
export function FacultyDirectory({ id }: { id?: string }) {
  const t = useT();
  const [items, setItems] = useState<FacultyProfile[] | null>(null),
    [page, setPage] = useState(1),
    [department, setDepartment] = useState(""),
    [filter, setFilter] = useState(""),
    [hasNext, setHasNext] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        if (id) {
          const result = await facultyDetail(id, controller.signal);
          if (!controller.signal.aborted) setItems([result.profile]);
        } else {
          const result = await listFaculty(page, filter, controller.signal);
          if (!controller.signal.aborted) {
            setItems(result.items);
            setHasNext(result.hasNext);
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Unable to load faculty.",
          );
      }
    };
    void load();
    return () => controller.abort();
  }, [id, page, filter, revision]);
  const reload = () => {
    setError("");
    setItems(null);
    setRevision((value) => value + 1);
  };
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">
        {t(id ? "Faculty mentor profile" : "Faculty mentors")}
      </h1>
      {!id && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setFilter(department.trim());
            reload();
          }}
        >
          <label className="grid gap-1">
            {t("Department")}
            <input
              maxLength={100}
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="rounded border p-2"
            />
          </label>
          <Button type="submit">{t("Filter faculty")}</Button>
        </form>
      )}
      <Button variant="outline" onClick={reload}>
        {t("Refresh faculty")}
      </Button>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !items ? (
        <p role="status">{t("Loading faculty\u2026")}</p>
      ) : items.length === 0 ? (
        <p role="status">{t("No faculty profiles found.")}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {items.map((profile) => (
            <FacultyCard key={profile.id} profile={profile} detail={!!id} />
          ))}
        </div>
      )}
      {!id && items && (
        <nav
          aria-label={t("Faculty pages")}
          className="flex items-center gap-4"
        >
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
            disabled={!hasNext || page >= 1000}
            onClick={() => {
              setPage((value) => value + 1);
              reload();
            }}
          >
            {t("Next")}
          </Button>
        </nav>
      )}
    </main>
  );
}
