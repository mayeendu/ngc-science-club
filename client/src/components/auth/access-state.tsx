"use client";
import Link from "next/link";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessLoading() {
  return (
    <main
      className="flex min-h-[60vh] items-center justify-center gap-3"
      role="status"
    >
      <Loader2
        className="size-5 animate-spin text-blue-700"
        aria-hidden="true"
      />
      Checking access…
    </main>
  );
}
export function AccessError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Unable to verify access</h1>
      <p role="alert" className="my-4 text-slate-600">
        The service may be unavailable. Please try again.
      </p>
      <Button onClick={retry}>Try again</Button>
    </main>
  );
}
export function AccessDenied() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <ShieldX
        className="mx-auto mb-4 size-10 text-teal-700"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-teal-700">403</p>
      <h1 className="mt-2 text-3xl font-bold">Access Denied</h1>
      <p className="my-4 text-slate-600">
        Your account does not have permission to view this dashboard.
      </p>
      <Link className="font-medium text-blue-700 underline" href="/dashboard">
        Go to my dashboard
      </Link>
    </main>
  );
}
