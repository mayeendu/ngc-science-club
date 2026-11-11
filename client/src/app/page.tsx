import { Translated } from "@/components/i18n/language";
import Link from "next/link";
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
      <Translated text="Unable to connect to the backend. Please refresh to try again." />
    </p>
  );
}
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-6xl flex-col items-center gap-8 px-4 py-12 text-center sm:py-20">
      <h1 className="text-4xl font-bold text-blue-700">
        <Translated text="NGC Science Club" />
      </h1>

      <p className="text-lg text-slate-600">
        <Translated text="Narsingdi Government College" />
      </p>
      <p className="max-w-2xl text-lg">
        <Translated text="Explore science together. Learn, experiment, and share your discoveries with the college community." />
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/signup"
          className="rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white"
        >
          <Translated text="Join the science community" />
        </Link>
        <Link
          href="/events"
          className="rounded-lg border px-6 py-3 font-semibold"
        >
          <Translated text="Explore club events" />
        </Link>
      </div>
      <div className="grid w-full gap-5 text-left sm:grid-cols-3">
        <Link
          href="/faculty"
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold">
            <Translated text="Learn with mentors" />
          </h2>
          <p className="mt-3">
            <Translated text="Meet the faculty guiding our science activities." />
          </p>
        </Link>
        <Link
          href="/achievements"
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold">
            <Translated text="Celebrate discovery" />
          </h2>
          <p className="mt-3">
            <Translated text="Explore club achievements and student participation." />
          </p>
        </Link>
        <Link
          href="/gallery"
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold">
            <Translated text="Science in action" />
          </h2>
          <p className="mt-3">
            <Translated text="See moments from our club activities." />
          </p>
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">
          <Translated text="Backend Connection" />
        </h2>

        <Suspense
          fallback={
            <p role="status" className="text-slate-600">
              <Translated text="Checking backend connection…" />
            </p>
          }
        >
          <BackendConnection />
        </Suspense>
      </div>
    </main>
  );
}
