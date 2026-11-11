"use client";
import { BookOpen, FlaskConical, Users } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { parseRole, roleLabels, type AppRole } from "@/lib/roles";
import { RoleGuard } from "@/components/auth/role-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MembershipApplication } from "@/components/membership/membership-application";

const features: Record<AppRole, readonly string[]> = {
  student: [],
  teacher: ["Teaching activities"],
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
  const { data } = useSession();
  const accountRole = parseRole(data?.user.role);
  if (!accountRole) return null;
  return (
    <main className="min-h-[80vh] bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="mb-2 text-sm font-medium text-teal-700">
            Narsingdi Government College
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {roleLabels[role]} Dashboard
          </h1>
          <p className="mt-3 text-slate-600">
            Your space for science, learning, and club activities.
          </p>
        </div>
        <Card className="border-t-4 border-blue-600 bg-white">
          <CardHeader>
            <span className="mb-2 w-fit rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              {roleLabels[accountRole]} account
            </span>
            <CardTitle>
              <h2 className="text-xl font-semibold">
                Welcome, {data?.user.name}!
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              Your access has been verified by the Science Club API.
            </p>
          </CardContent>
        </Card>
        {role === "student" && accountRole === "student" && (
          <MembershipApplication />
        )}
        {role === "admin" && (
          <Link
            href="/dashboard/admin/memberships"
            className="inline-block font-medium text-blue-700 underline"
          >
            Manage membership applications
          </Link>
        )}
        {role === "admin" && (
          <Link
            href="/dashboard/admin/analytics"
            className="ml-4 inline-block font-medium text-blue-700 underline"
          >
            Membership analytics
          </Link>
        )}
        {(role === "teacher" || role === "admin") && (
          <Link
            href="/dashboard/teacher/analytics"
            className="inline-block font-medium text-blue-700 underline"
          >
            Student performance analytics
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
            Manage events and activities
          </Link>
        )}
        {(role === "teacher" || role === "admin") && (
          <Link
            href="/dashboard/teacher/quizzes"
            className="inline-block font-medium text-blue-700 underline"
          >
            Manage science quizzes
          </Link>
        )}
        {role === "student" && accountRole === "student" && (
          <div className="flex flex-wrap gap-5">
            <Link
              href="/dashboard/student/performance"
              className="text-blue-700 underline"
            >
              My performance analytics
            </Link>
            <Link
              href="/dashboard/student/events"
              className="text-blue-700 underline"
            >
              My events
            </Link>
            <Link
              href="/dashboard/student/quizzes"
              className="text-blue-700 underline"
            >
              Science quizzes
            </Link>
            <Link
              href="/dashboard/student/results"
              className="text-blue-700 underline"
            >
              My results and performance
            </Link>
          </div>
        )}
        <section
          aria-label="Upcoming features"
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
                    <h2>{title}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">
                    Planned for a future milestone.
                  </p>
                  <span className="mt-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    Coming later
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
