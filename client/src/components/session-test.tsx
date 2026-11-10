
"use client";

import { useSession } from "@/lib/auth-client";

export function SessionTest() {
    const { data: session, isPending, error } = useSession();

    if (isPending) return <p>Checking session...</p>;
    if (error) return <p>Session check failed.</p>;
    if (!session) return <p>Not signed in.</p>;

    return (
        <div>
            <p>Signed in as: {session.user.name}</p>
            <p>Email: {session.user.email}</p>
        </div>
    );
}
