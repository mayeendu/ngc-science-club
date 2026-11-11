"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  FlaskConical,
  Home,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useT, LanguageSettings } from "@/components/i18n/language";
import { Appearance } from "@/components/layout/appearance";
import { ClubLogo } from "@/components/layout/club-logo";
import { NotificationBell } from "@/components/communication/notifications";
import { signOut, useSession } from "@/lib/auth-client";
import { appRoles, dashboardRoles, parseRole, roleLabels } from "@/lib/roles";
import toast from "@/lib/i18n/toast";
import { dashboardLinks } from "./dashboard-links";

export function DashboardShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const role = parseRole(data?.user.role);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  if (!role) return <>{children}</>;
  const links = dashboardLinks(role);
  async function logout() {
    setBusy(true);
    try {
      const result = await signOut();
      if (result.error) {
        toast.error("Sign out failed");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Unable to sign out");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard-shell">
      {open && (
        <button
          className="dashboard-scrim"
          aria-label={t("Close")}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="dashboard-sidebar"
        className={`dashboard-sidebar ${open ? "is-open" : ""}`}
      >
        <button
          className="dashboard-drawer-close"
          aria-label={t("Close")}
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <Link href="/" className="dashboard-brand">
          <ClubLogo decorative className="w-12" />
          <span>{t("NGC Science Club")}</span>
        </Link>
        <nav aria-label={t("Dashboard")} className="dashboard-navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{t(label)}</span>
            </Link>
          ))}
        </nav>
        <Link href="/events" className="dashboard-sidebar-promo">
          <FlaskConical size={42} aria-hidden="true" />
          <strong>{t("NGC Science Club")}</strong>
          <span>
            {t("Your space for science, learning, and club activities.")}
          </span>
          <ArrowUpRight size={20} aria-hidden="true" />
        </Link>
      </aside>
      <div className="dashboard-workspace">
        <header className="dashboard-toolbar">
          <button
            className="dashboard-menu"
            aria-label={t("Main navigation")}
            aria-expanded={open}
            aria-controls="dashboard-sidebar"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <Link href="/" className="dashboard-home">
            <Home size={18} />
            {t("Home")}
          </Link>
          <nav
            aria-label={t("Main navigation")}
            className="dashboard-view-switch"
          >
            {appRoles
              .filter((view) => dashboardRoles[view].includes(role))
              .map((view) => (
                <Link
                  key={view}
                  href={`/dashboard/${view}`}
                  aria-current={
                    pathname === `/dashboard/${view}` ? "page" : undefined
                  }
                >
                  {t(roleLabels[view])} {t("Dashboard")}
                </Link>
              ))}
          </nav>
          <div className="dashboard-toolbar-settings">
            <Appearance />
            <LanguageSettings />
            <NotificationBell key={data?.user.id} />
          </div>
          <div className="dashboard-account">
            <span className="dashboard-avatar" aria-hidden="true">
              {data?.user.name?.slice(0, 1)}
            </span>
            <span>
              <strong>{data?.user.name}</strong>
              <small>{t(roleLabels[role])}</small>
            </span>
          </div>
          <button
            onClick={logout}
            disabled={busy}
            aria-label={t("Sign out")}
            title={t("Sign out")}
            className="dashboard-logout"
          >
            <LogOut size={19} />
          </button>
        </header>
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  );
}
