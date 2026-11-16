"use client";

import { useT } from "@/components/i18n/language";
import { Appearance } from "@/components/layout/appearance";
import { ClubLogo } from "@/components/layout/club-logo";
import { LanguageSettings } from "@/components/i18n/language";
import { NotificationBell } from "@/components/communication/notifications";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import toast from "@/lib/i18n/toast";
import { signOut, useSession } from "@/lib/auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { dashboardPath, parseRole } from "@/lib/roles";
export function Navbar() {
  const t = useT();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, error } = useSession();
  const role = parseRole(session?.user.role);
  const signedIn = !!session && !isPending && !error;
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
  if (pathname.startsWith("/dashboard")) return null;
  return (
    <header className="science-navbar border-b bg-white">
      <nav
        aria-label={t("Main navigation")}
        className="mx-auto flex min-h-16 max-w-screen-2xl items-center gap-4 overflow-x-auto px-4 py-3 [&_a]:whitespace-nowrap"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 text-lg font-bold text-blue-700"
        >
          <ClubLogo
            decorative
            className="w-12 rounded-lg border border-blue-100 p-1"
          />
          <span>{t("NGC Science Club")}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-3">
          <Link href="/" className="text-sm">
            {t("Home")}
          </Link>

          <Link href="/members" className="text-sm">
            {t("Members")}
          </Link>
          <Link href="/faculty" className="text-sm">
            {t("Teachers")}
          </Link>
          {signedIn && role === "student" && (
            <Link
              href="/membership/apply"
              className={buttonVariants({ size: "sm" })}
            >
              {t("Apply Membership")}
            </Link>
          )}
          {signedIn && (role === "teacher" || role === "admin") && (
            <Link
              href="/faculty/add"
              className={buttonVariants({ size: "sm" })}
            >
              {t("Add teacher")}
            </Link>
          )}
          {signedIn && (
            <Link
              href={role ? dashboardPath(role) : "/dashboard"}
              className="text-sm font-medium"
            >
              {t("Dashboard")}
            </Link>
          )}
          <Link href="/events" className="text-sm">
            {t("Events")}
          </Link>
          <NotificationBell
            key={signedIn ? session.user.id : "guest"}
            signedIn={signedIn}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageSettings />
          <Appearance />
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
              <span className="whitespace-nowrap text-sm">
                {t("Welcome {0}", [session.user.name])}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
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
              <Link
                href="/login"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "h-6 text-xs",
                })}
              >
                {t("Sign in")}
              </Link>

              <Link
                href="/signup"
                className={buttonVariants({
                  size: "sm",
                  className: "h-6 text-xs",
                })}
              >
                {t("Sign up")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
