"use client";

import { useT } from "@/components/i18n/language";
import { Appearance } from "@/components/layout/appearance";
import { LanguageSettings } from "@/components/i18n/language";
import { NotificationBell } from "@/components/communication/notifications";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, UserRound } from "lucide-react";
import toast from "@/lib/i18n/toast";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  appRoles,
  dashboardPath,
  dashboardRoles,
  parseRole,
  roleLabels,
} from "@/lib/roles";
export function Navbar() {
  const t = useT();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const { data: session, isPending, error } = useSession();
  const role = parseRole(session?.user.role);
  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) {
        toast.error(error.message || "Sign out failed");
        return;
      }
      toast.success("Signed out successfully");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Unable to sign out");
    } finally {
      setIsSigningOut(false);
    }
  }
  return (
    <header className="border-b bg-white">
      <nav
        aria-label={t("Main navigation")}
        className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4"
      >
        <Link href="/" className="text-lg font-bold text-blue-700">
          {t("NGC Science Club")}
        </Link>

        <LanguageSettings />
        <Appearance />
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="text-sm">
            {t("Home")}
          </Link>

          <Link href="/members" className="text-sm">
            {t("Members")}
          </Link>
          <Link href="/events" className="text-sm">
            {t("Events")}
          </Link>
          <Link href="/achievements" className="text-sm">
            {t("Club achievements")}
          </Link>
          <Link href="/gallery" className="text-sm">
            {t("Photo gallery")}
          </Link>
          <Link href="/certificates/verify" className="text-sm">
            {t("Verify certificate")}
          </Link>
          <Link href="/faculty" className="text-sm">
            {t("Faculty mentors")}
          </Link>
          <Link href="/announcements" className="text-sm">
            {t("Announcements")}
          </Link>

          {isPending ? (
            <span role="status">
              <Loader2
                className="size-5 animate-spin"
                aria-label={t("Checking session")}
              />
            </span>
          ) : error ? (
            <span className="text-sm text-slate-600">
              {t("Session unavailable")}
            </span>
          ) : session ? (
            <>
              {role && <NotificationBell key={`${session.user.id}:${role}`} />}
              {role ? (
                appRoles
                  .filter((dashboard) =>
                    dashboardRoles[dashboard].includes(role),
                  )
                  .map((dashboard) => (
                    <Link
                      key={dashboard}
                      href={dashboardPath(dashboard)}
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      {t(roleLabels[dashboard])} {t("Dashboard")}
                    </Link>
                  ))
              ) : (
                <Link href="/dashboard" className="text-sm font-medium">
                  {t("Dashboard")}
                </Link>
              )}

              <span className="hidden text-sm text-slate-600 sm:inline">
                <UserRound className="mr-1 inline size-4" />
                {session.user.name}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogOut className="size-4" />
                )}
                {t("Sign out")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/login" />}
                nativeButton={false}
              >
                {t("Login")}
              </Button>

              <Button
                size="sm"
                render={<Link href="/signup" />}
                nativeButton={false}
              >
                {t("Sign up")}
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
