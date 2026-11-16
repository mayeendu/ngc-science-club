import type { Metadata } from "next";
import { NewsBlog } from "@/components/home/news-blog";

export const metadata: Metadata = {
  title: "Blog | NGC Science Club",
  description:
    "Explore science articles and the latest news from NGC Science Club.",
};

export default function BlogPage() {
  return (
    <main className="mx-auto min-h-[80vh] max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-10">
      <NewsBlog standalone />
    </main>
  );
}
