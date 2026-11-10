"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";
import {
  listMembers,
  memberStats,
  membershipDate,
  type MemberList,
  type MemberStats,
} from "@/lib/member-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function MemberSkeletons() {
  return (
    <div role="status" aria-label="Loading members">
      <span className="sr-only">Loading members…</span>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-52 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
export function MemberDirectory() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<MemberList | null>(null);
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listMembers(
        { search, department, academicYear, page },
        controller.signal,
      ),
      memberStats(controller.signal),
    ])
      .then(([data, counts]) => {
        if (!controller.signal.aborted) {
          setList(data);
          setStats(counts);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    const focus = () => {
      setList(null);
      setError(false);
      setRevision((value) => value + 1);
    };
    window.addEventListener("focus", focus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", focus);
    };
  }, [search, department, academicYear, page, revision]);
  function reload() {
    setList(null);
    setError(false);
    setRevision((value) => value + 1);
  }
  function resetPage() {
    setPage(1);
    setList(null);
    setError(false);
  }
  return (
    <main className="min-h-[80vh] bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-teal-700">
            NGC Science Club community
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Meet our members
          </h1>
          <p className="max-w-2xl text-slate-600">
            Meet the students exploring science together at Narsingdi Government
            College.
          </p>
        </header>
        {stats && !error && (
          <section aria-label="Member statistics" className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-blue-800">
              <Users className="size-5" aria-hidden="true" />
              {stats.totalMembers} approved members
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.departments.map((item) => (
                <span
                  key={item.department}
                  className="rounded-full border bg-white px-3 py-1 text-sm text-slate-600"
                >
                  {item.department}: {item.count}
                </span>
              ))}
            </div>
          </section>
        )}
        <form
          className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            resetPage();
            setRevision((value) => value + 1);
          }}
        >
          <div>
            <label
              htmlFor="member-search"
              className="mb-2 block text-sm font-medium"
            >
              Search by name
            </label>
            <Input
              id="member-search"
              value={draft}
              maxLength={80}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Member name"
            />
          </div>
          <div>
            <label
              htmlFor="member-department"
              className="mb-2 block text-sm font-medium"
            >
              Department
            </label>
            <select
              id="member-department"
              value={department}
              disabled={!stats}
              onChange={(event) => {
                setDepartment(event.target.value);
                resetPage();
              }}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">All departments</option>
              {stats?.departments.map((item) => (
                <option key={item.department} value={item.department}>
                  {item.department}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="member-year"
              className="mb-2 block text-sm font-medium"
            >
              Academic year
            </label>
            <select
              id="member-year"
              value={academicYear}
              disabled={!stats}
              onChange={(event) => {
                setAcademicYear(event.target.value);
                resetPage();
              }}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">All academic years</option>
              {stats?.academicYears.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </div>
          <Button className="self-end" type="submit">
            Search members
          </Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {list
              ? `${list.pagination.total} matching members`
              : "Approved student profiles"}
          </p>
          <Button variant="outline" onClick={reload}>
            Refresh directory
          </Button>
        </div>
        {error ? (
          <div role="alert" className="rounded-xl border bg-white p-6">
            <p>Unable to load members. Please try again.</p>
            <Button variant="outline" className="mt-3" onClick={reload}>
              Retry members
            </Button>
          </div>
        ) : !list ? (
          <MemberSkeletons />
        ) : list.members.length === 0 ? (
          <div
            role="status"
            className="rounded-xl border bg-white p-10 text-center"
          >
            <h2 className="text-xl font-semibold">No members found</h2>
            <p className="mt-2 text-slate-600">
              Try another name or filter, or return after new memberships are
              approved.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.members.map((member) => (
              <Card key={member.id} className="min-w-0 bg-white">
                <CardHeader>
                  <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <GraduationCap className="size-6" aria-hidden="true" />
                  </div>
                  <CardTitle>
                    <h2 className="break-words text-xl">{member.name}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="break-words text-slate-600">
                    {member.department}
                  </p>
                  <p className="text-sm text-slate-600">
                    Academic year: {member.academicYear}
                  </p>
                  <p className="text-sm text-slate-500">
                    Member since: {membershipDate(member.membershipDate)}
                  </p>
                  <Link
                    href={`/members/${member.id}`}
                    className="mt-3 inline-block font-medium text-blue-700 underline"
                    aria-label={`View profile of ${member.name}`}
                  >
                    View profile
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {list && list.pagination.totalPages > 0 && (
          <nav
            aria-label="Member pagination"
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => {
                setPage((value) => value - 1);
                setList(null);
              }}
            >
              Previous members
            </Button>
            <span className="text-sm">
              Page {page} of {list.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page >= list.pagination.totalPages || page >= 1000}
              onClick={() => {
                setPage((value) => value + 1);
                setList(null);
              }}
            >
              Next members
            </Button>
          </nav>
        )}
      </div>
    </main>
  );
}
