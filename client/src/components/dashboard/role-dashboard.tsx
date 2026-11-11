"use client";

import Link from "next/link";
import {
  ArrowRight,
  Atom,
  BookOpen,
  FlaskConical,
  Sparkles,
} from "lucide-react";
import { useT } from "@/components/i18n/language";
import { useSession } from "@/lib/auth-client";
import { roleLabels, type AppRole } from "@/lib/roles";
import { RoleGuard } from "@/components/auth/role-guard";
import { MembershipApplication } from "@/components/membership/membership-application";
import { dashboardLinks } from "./dashboard-links";
import { DashboardProgress } from "./dashboard-progress";

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
  const links = dashboardLinks(role).filter(
    (link) => link.label !== "Dashboard",
  );
  const featured = links.slice(0, 4);
  return (
    <main className="dashboard-overview">
      <div className="dashboard-page-heading">
        <div>
          <p>{t("Narsingdi Government College")}</p>
          <h1>
            {t(roleLabels[role])} {t("Dashboard")}
          </h1>
        </div>
        <span className="dashboard-role-badge">
          <Sparkles size={16} aria-hidden="true" />
          {t("NGC Science Club")}
        </span>
      </div>
      <div className="dashboard-welcome-row">
        <section className="dashboard-welcome">
          <div className="dashboard-welcome-copy">
            <p>{t("NGC Science Club")}</p>
            <h2>
              {t("Welcome,")} {data?.user.name}!
            </h2>
            <p>{t("Your space for science, learning, and club activities.")}</p>
            <div className="dashboard-welcome-pills">
              <span>
                <FlaskConical size={22} aria-hidden="true" />
                {t("Science quizzes")}
              </span>
              <span>
                <BookOpen size={22} aria-hidden="true" />
                {t("Science learning library")}
              </span>
            </div>
          </div>
          <div className="dashboard-science-art" aria-hidden="true">
            <span className="science-orbit orbit-one" />
            <span className="science-orbit orbit-two" />
            <Atom className="science-atom" strokeWidth={1} />
            <FlaskConical className="science-flask" strokeWidth={1.5} />
            <span className="science-dot dot-one" />
            <span className="science-dot dot-two" />
            <span className="science-dot dot-three" />
          </div>
        </section>
        <section className="dashboard-quick-panel">
          <FlaskConical size={30} aria-hidden="true" />
          <h2>
            {t(
              role === "student" ? "Science quizzes" : "Manage science quizzes",
            )}
          </h2>
          <Link
            href={
              role === "student"
                ? "/dashboard/student/quizzes"
                : "/dashboard/teacher/quizzes"
            }
          >
            {t(
              role === "student" ? "Science quizzes" : "Manage science quizzes",
            )}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard/notifications"
            className="dashboard-secondary-action"
          >
            {t("Notifications")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
      <section className="dashboard-featured" aria-label={t("Dashboard")}>
        {featured.map(({ href, label, icon: Icon }, index) => (
          <Link
            href={href}
            key={href}
            className={`dashboard-feature-card feature-${index}`}
          >
            <span className="feature-icon">
              <Icon size={25} aria-hidden="true" />
            </span>
            <h2>{t(label)}</h2>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        ))}
      </section>
      <DashboardProgress student={role === "student"} />
      <div className="dashboard-overview-columns">
        <section className="dashboard-tools">
          <h2>
            {t(
              role === "student"
                ? "Science learning library"
                : "Club administration",
            )}
          </h2>
          <div className="dashboard-tool-grid">
            {links.map(({ href, label, icon: Icon }, index) => (
              <Link className="dashboard-tool" href={href} key={href}>
                <span className={`tool-icon tone-${index % 4}`}>
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{t(label)}</h3>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
        <div className="dashboard-side-stack">
          <section className="dashboard-account-card">
            <span className="dashboard-large-avatar" aria-hidden="true">
              {data?.user.name?.slice(0, 1)}
            </span>
            <h2>{data?.user.name}</h2>
            <span className="dashboard-role-badge">
              {t(roleLabels[role])} {t("account")}
            </span>
            <p>{t("Your access has been verified by the Science Club API.")}</p>
          </section>
          <Link
            className="dashboard-library-card"
            href="/dashboard/student/resources"
          >
            <BookOpen size={30} aria-hidden="true" />
            <h2>{t("Science learning library")}</h2>
            <ArrowRight size={24} aria-hidden="true" />
          </Link>
        </div>
      </div>
      {role === "student" && data?.user.role === "student" && (
        <MembershipApplication />
      )}
    </main>
  );
}
