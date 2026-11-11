"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, UserRound } from "lucide-react";
import toast from "react-hot-toast";

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
        aria-label="Main navigation"
        className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4"
      >
        <Link href="/" className="text-lg font-bold text-blue-700">
          NGC Science Club
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="text-sm">
            Home
          </Link>

          <Link href="/members" className="text-sm">
            Members
          </Link>
          <Link href="/events" className="text-sm">
            Events
          </Link>

          {isPending ? (
            <span role="status">
              <Loader2
                className="size-5 animate-spin"
                aria-label="Checking session"
              />
            </span>
          ) : error ? (
            <span className="text-sm text-slate-600">Session unavailable</span>
          ) : session ? (
            <>
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
                      {roleLabels[dashboard]} Dashboard
                    </Link>
                  ))
              ) : (
                <Link href="/dashboard" className="text-sm font-medium">
                  Dashboard
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
                Sign out
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
                Login
              </Button>

              <Button
                size="sm"
                render={<Link href="/signup" />}
                nativeButton={false}
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
