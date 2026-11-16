import { Translated } from "@/components/i18n/language";
import Link from "next/link";
import { ScienceHero } from "@/components/home/science-hero";
import { ScienceActivities } from "@/components/home/science-activities";
export default function HomePage() {
  return (
    <main className="home-page mx-auto flex min-h-[80vh] max-w-screen-2xl flex-col items-center gap-10 px-4 pb-12 text-center sm:px-6 lg:px-10">
      <ScienceHero />
      <div className="grid w-full gap-5 text-left sm:grid-cols-3">
        <Link
          href="/faculty"
          className="rounded-2xl border border-t-4 border-t-blue-700 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
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
          className="rounded-2xl border border-t-4 border-t-teal-600 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
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
          className="rounded-2xl border border-t-4 border-t-green-500 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h2 className="text-xl font-semibold">
            <Translated text="Science in action" />
          </h2>
          <p className="mt-3">
            <Translated text="See moments from our club activities." />
          </p>
        </Link>
      </div>
      <ScienceActivities />
    </main>
  );
}
