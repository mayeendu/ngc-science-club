
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ApiUser = {
    id: string;
    name: string;
    email: string;
};

export function ProtectedApiTest() {
    const [result, setResult] = useState("");
    const [loading, setLoading] = useState(false);

    async function checkProtectedApi() {
        setLoading(true);

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_AUTH_URL}/api/me`,
                {
                    credentials: "include",
                    cache: "no-store",
                }
            );

            if (!response.ok) {
                setResult(`Request failed: HTTP ${response.status}`);
                return;
            }

            const data: {
                success: boolean;
                user: ApiUser;
            } = await response.json();

            setResult(`Authenticated as ${data.user.name}`);
        } catch {
            setResult("Unable to connect to the API");
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="mt-6 rounded-xl border p-5">
            <h2 className="mb-3 text-lg font-semibold">
                Protected API Test
            </h2>

            <Button
                onClick={checkProtectedApi}
                disabled={loading}
            >
                {loading ? "Checking..." : "Check protected API"}
            </Button>

            {result && (
                <p role="status" className="mt-3 text-sm">
                    {result}
                </p>
            )}
        </section>
    );
}
