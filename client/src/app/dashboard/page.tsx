
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Loader2, LayoutDashboard } from "lucide-react";
import { ProtectedApiTest } from "@/components/auth/protected-api-test";

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, isPending, error } = useSession();

    useEffect(() => {
        if (!isPending && !error && !session) {
            router.replace("/login");
        }
    }, [isPending, error, session, router]);

    if (isPending) {
        return (
            <main className="flex min-h-[70vh] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-blue-600" />
            </main>
        );
    }

    if (error) {
        return (
            <main className="mx-auto max-w-3xl p-8">
                <p role="alert">
                    Unable to verify your session. Please try again.
                </p>
            </main>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <main className="mx-auto max-w-5xl px-4 py-10">
            <div className="mb-8 flex items-center gap-3">
                <LayoutDashboard className="size-8 text-blue-700" />
                <h1 className="text-3xl font-bold">
                    My Dashboard
                </h1>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">
                    Welcome, {session.user.name}!
                </h2>

                <p className="mt-2 text-slate-600">
                    You are signed in to NGC Science Club.
                </p>

                <p className="mt-3 text-sm text-slate-500">
                    Email: {session.user.email}
                </p>
            </div>
            <ProtectedApiTest />
        </main>
    );
}
