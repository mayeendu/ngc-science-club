"use client";

import { useT } from "@/components/i18n/language";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { EventAttendance } from "@/components/events/event-attendance";
function Attendance() {
  const { id } = useParams<{
    id: string;
  }>();
  return (
    <RoleGuard dashboard="teacher">
      <EventAttendance key={id} id={id} />
    </RoleGuard>
  );
}
export default function AttendancePage() {
  const t = useT();
  return (
    <Suspense fallback={<p role="status">{t("Loading participants...")}</p>}>
      <Attendance />
    </Suspense>
  );
}
