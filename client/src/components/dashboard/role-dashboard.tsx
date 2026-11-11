"use client";

import { useT } from "@/components/i18n/language";
import { BookOpen, FlaskConical, Users } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { parseRole, roleLabels, type AppRole } from "@/lib/roles";
import { RoleGuard } from "@/components/auth/role-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MembershipApplication } from "@/components/membership/membership-application";
const features: Record<AppRole, readonly string[]> = {
  student: [],
  teacher: [],
  admin: ["Club administration", "Member applications", "Club reports"],
};
const icons = [Users, FlaskConical, BookOpen];
export function RoleDashboard({ role }: { role: AppRole }) {
  return (
    <RoleGuard dashboard={role}>
      <DashboardContent role={role} />
    </RoleGuard>
  );
}
function DashboardContent({ role }: { role: AppRole }) {
  const t = useT();
  const { data } = useSession();
  const accountRole = parseRole(data?.user.role);
  if (!accountRole) return null;
  return (
    <main className="min-h-[80vh] bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="mb-2 text-sm font-medium text-teal-700">
            {t("Narsingdi Government College")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t(roleLabels[role])} {t("Dashboard")}
          </h1>
          <p className="mt-3 text-slate-600">
            {t("Your space for science, learning, and club activities.")}
          </p>
        </div>
        <Card className="border-t-4 border-blue-600 bg-white">
          <CardHeader>
            <span className="mb-2 w-fit rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              {t(roleLabels[accountRole])} {t("account")}
            </span>
            <CardTitle>
              <h2 className="text-xl font-semibold">
                {t("Welcome,")} {data?.user.name}!
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              {t("Your access has been verified by the Science Club API.")}
            </p>
          </CardContent>
        </Card>
        <Link
          href="/dashboard/student/certificates"
          className="text-blue-700 underline"
        >
          {t("My certificates")}
        </Link>
        {role === "admin" && (
          <Link
            href="/dashboard/admin/reports"
            className="text-blue-700 underline"
          >
            {t("Club reports")}
          </Link>
        )}
        {(role === "teacher" || role === "admin") && (
          <>
            <Link
              href="/dashboard/teacher/showcase"
              className="text-blue-700 underline"
            >
              {t("Achievements and gallery management")}
            </Link>
            <Link
              href="/dashboard/teacher/certificates"
              className="text-blue-700 underline"
            >
              {t("Certificate management")}
            </Link>
          </>
        )}
        <Link
          href="/dashboard/student/resources"
          className="text-blue-700 underline"
        >
          {t("Science learning library")}
        </Link>
        {(role === "teacher" || role === "admin") && (
          <Link
            href="/dashboard/teacher/resources"
            className="text-blue-700 underline"
          >
            {t("Resource management")}
          </Link>
        )}
        {role === "student" && accountRole === "student" && (
          <MembershipApplication />
        )}
        <Link
          href="/dashboard/student/feedback"
          className="text-blue-700 underline"
        >
          {t("My feedback and suggestions")}
        </Link>
        {role === "admin" && (
          <Link
            href="/dashboard/admin/faculty"
            className="text-blue-700 underline"
          >
            {t("Manage faculty mentors")}
          </Link>
        )}
        {(role === "teacher" || role === "admin") && (
          <>
            <Link
              href="/dashboard/teacher/activities"
              className="text-blue-700 underline"
            >
              {t("My assigned activities")}
            </Link>
            <Link
              href="/dashboard/teacher/feedback"
              className="text-blue-700 underline"
            >
              {t("Manage feedback")}
            </Link>
            <Link
              href="/dashboard/teacher/announcements"
              className="text-blue-700 underline"
            >
              {t("Manage announcements")}
            </Link>
          </>
        )}
        {role === "admin" && (
          <Link
            href="/dashboard/admin/memberships"
            className="inline-block font-medium text-blue-700 underline"
          >
            {t("Manage membership applications")}
          </Link>
        )}
        {role === "admin" && (
          <Link
            href="/dashboard/admin/analytics"
            className="ml-4 inline-block font-medium text-blue-700 underline"
          >
            {t("Membership analytics")}
          </Link>
        )}
        {(role === "teacher" || role === "admin") && (
          <Link
            href="/dashboard/teacher/analytics"
            className="inline-block font-medium text-blue-700 underline"
          >
            {t("Student performance analytics")}
          </Link>
        )}
        {(role === "teacher" || role === "admin") && (
          <Link
            href={
              role === "admin"
                ? "/dashboard/admin/events"
                : "/dashboard/teacher/events"
            }
            className="inline-block font-medium text-blue-700 underline"
          >
            {t("Manage events and activities")}
          </Link>
        )}
        {(role === "teacher" || role === "admin") && (
          <Link
            href="/dashboard/teacher/quizzes"
            className="inline-block font-medium text-blue-700 underline"
          >
            {t("Manage science quizzes")}
          </Link>
        )}
        {role === "student" && accountRole === "student" && (
          <div className="flex flex-wrap gap-5">
            <Link
              href="/dashboard/student/performance"
              className="text-blue-700 underline"
            >
              {t("My performance analytics")}
            </Link>
            <Link
              href="/dashboard/student/events"
              className="text-blue-700 underline"
            >
              {t("My events")}
            </Link>
            <Link
              href="/dashboard/student/quizzes"
              className="text-blue-700 underline"
            >
              {t("Science quizzes")}
            </Link>
            <Link
              href="/dashboard/student/results"
              className="text-blue-700 underline"
            >
              {t("My results and performance")}
            </Link>
          </div>
        )}
        <section
          aria-label={t("Upcoming features")}
          className={`grid gap-5 ${role === "admin" ? "md:grid-cols-3" : "md:grid-cols-2"}`}
        >
          {features[role].map((title, index) => {
            const Icon = icons[index];
            return (
              <Card key={title} className="bg-white">
                <CardHeader>
                  <Icon
                    className="mb-3 size-6 text-blue-700"
                    aria-hidden="true"
                  />
                  <CardTitle>
                    <h2>{t(title)}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">
                    {t("Planned for a future milestone.")}
                  </p>
                  <span className="mt-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {t("Coming later")}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}
