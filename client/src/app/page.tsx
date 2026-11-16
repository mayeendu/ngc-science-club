import { ScienceHero } from "@/components/home/science-hero";
import { ScienceActivities } from "@/components/home/science-activities";
import { NewsBlog } from "@/components/home/news-blog";
export default function HomePage() {
  return (
    <main className="home-page mx-auto flex min-h-[80vh] max-w-screen-2xl flex-col items-center gap-10 px-4 pb-12 text-center sm:px-6 lg:px-10">
      <ScienceHero />
      <ScienceActivities />
      <NewsBlog />
    </main>
  );
}
