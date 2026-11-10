import { Suspense } from "react";
import { connection } from "next/server";
import { getHealth } from "@/lib/api";

async function BackendConnection() {
  await connection();
  const health = await getHealth(AbortSignal.timeout(5000)).catch(() => null);
  return health ? (
    <p role="status" className="text-green-700">
      {health.message}
    </p>
  ) : (
    <p role="status" className="text-red-600">
      Unable to connect to the backend. Please refresh to try again.
    </p>
  );
}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
      <h1 className="text-4xl font-bold text-blue-700">NGC Science Club</h1>

      <p className="text-lg text-slate-600">Narsingdi Government College</p>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Backend Connection</h2>

        <Suspense
          fallback={
            <p role="status" className="text-slate-600">
              Checking backend connection…
            </p>
          }
        >
          <BackendConnection />
        </Suspense>
      </div>
    </main>
  );
}
