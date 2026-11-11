"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { EventAttendance } from "@/components/events/event-attendance";
function Attendance() {
  const { id } = useParams<{ id: string }>();
  return (
    <RoleGuard dashboard="teacher">
      <EventAttendance key={id} id={id} />
    </RoleGuard>
  );
}
export default function AttendancePage() {
  return (
    <Suspense fallback={<p role="status">Loading participants...</p>}>
      <Attendance />
    </Suspense>
  );
}
