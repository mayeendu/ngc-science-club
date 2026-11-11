import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  FlaskConical,
  Image,
  LayoutDashboard,
  Library,
  MessageSquare,
  UserRound,
  Users,
} from "lucide-react";
import type { AppRole } from "@/lib/roles";

export function dashboardLinks(role: AppRole) {
  const staff = role !== "student";
  return [
    { href: `/dashboard/${role}`, label: "Dashboard", icon: LayoutDashboard },
    ...(role === "admin"
      ? [
          {
            href: "/dashboard/admin/memberships",
            label: "Manage membership applications",
            icon: Users,
          },
          {
            href: "/dashboard/admin/analytics",
            label: "Membership analytics",
            icon: BarChart3,
          },
          {
            href: "/dashboard/admin/faculty",
            label: "Manage faculty mentors",
            icon: UserRound,
          },
          {
            href: "/dashboard/admin/reports",
            label: "Club reports",
            icon: BarChart3,
          },
        ]
      : []),
    {
      href: staff ? "/dashboard/teacher/quizzes" : "/dashboard/student/quizzes",
      label: staff ? "Manage science quizzes" : "Science quizzes",
      icon: FlaskConical,
    },
    {
      href: staff ? `/dashboard/${role}/events` : "/dashboard/student/events",
      label: staff ? "Manage events and activities" : "My events",
      icon: CalendarDays,
    },
    {
      href: staff
        ? "/dashboard/teacher/analytics"
        : "/dashboard/student/performance",
      label: staff
        ? "Student performance analytics"
        : "My performance analytics",
      icon: BarChart3,
    },
    ...(!staff
      ? [
          {
            href: "/dashboard/student/results",
            label: "My results and performance",
            icon: BookOpen,
          },
          {
            href: "/dashboard/student/profile",
            label: "My profile",
            icon: UserRound,
          },
        ]
      : [
          {
            href: "/dashboard/teacher/activities",
            label: "My assigned activities",
            icon: CalendarDays,
          },
          {
            href: "/dashboard/teacher/feedback",
            label: "Manage feedback",
            icon: MessageSquare,
          },
          {
            href: "/dashboard/teacher/announcements",
            label: "Manage announcements",
            icon: Bell,
          },
          {
            href: "/dashboard/teacher/showcase",
            label: "Achievements and gallery management",
            icon: Image,
          },
          {
            href: "/dashboard/teacher/certificates",
            label: "Certificate management",
            icon: Award,
          },
          {
            href: "/dashboard/teacher/resources",
            label: "Resource management",
            icon: Library,
          },
        ]),
    {
      href: "/dashboard/student/resources",
      label: "Science learning library",
      icon: Library,
    },
    {
      href: "/dashboard/student/certificates",
      label: "My certificates",
      icon: Award,
    },
    {
      href: "/dashboard/student/feedback",
      label: "My feedback and suggestions",
      icon: MessageSquare,
    },
    { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  ];
}
