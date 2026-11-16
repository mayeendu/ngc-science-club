"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Newspaper, Tag } from "lucide-react";
import { useLanguage } from "@/components/i18n/language";
import { listAnnouncements, type Announcement } from "@/lib/communication-api";
import { MemberBlogs } from "@/components/blog/member-blogs";
import { scienceNotes as notes } from "@/lib/science-notes";
import { announcementCover } from "@/lib/blog-covers";

export function NewsBlog({ standalone = false }: { standalone?: boolean }) {
  const language = useLanguage();
  const bn = language === "bn";
  const [news, setNews] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    listAnnouncements(1, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setNews(result.items.slice(0, 3));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [revision]);
  const readMore = bn ? "আরও পড়ো" : "Read more";
  const Heading = standalone ? "h1" : "h2";
  const visibleNotes = standalone ? notes : notes.slice(0, 3 - news.length);
  const imageClasses =
    "object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105";
  const cardClasses =
    "group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm motion-safe:transition-shadow hover:shadow-lg";

  return (
    <section
      aria-labelledby="news-blog-heading"
      className="w-full rounded-2xl bg-slate-50 px-4 py-12 sm:px-7 sm:py-16 lg:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        <header className="mx-auto mb-10 max-w-4xl text-center sm:mb-14">
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <Newspaper aria-hidden="true" className="size-4 text-blue-600" />
            {bn ? "সংবাদ ও ব্লগ" : "News & Blog"}
          </p>
          <Heading
            id="news-blog-heading"
            className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
          >
            {standalone
              ? bn
                ? "বিজ্ঞান ক্লাবের ব্লগ"
                : "Science Club Blog"
              : bn
                ? "ক্লাবের সংবাদ ও বিজ্ঞানের নতুন ভাবনায় সাথে থাকো।"
                : "Stay updated with our news and blog."}
          </Heading>
          <svg
            aria-hidden="true"
            viewBox="0 0 140 12"
            className="mx-auto mt-4 h-3 w-32 text-blue-600"
          >
            <path
              d="M3 9Q70 0 137 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </header>
        {standalone && (
          <>
            <div className="mb-8 flex justify-center">
              <Link
                href="/blog/write"
                className="inline-flex items-center gap-3 rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                {bn ? "ব্লগ লিখুন" : "Write Blog"}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <MemberBlogs />
          </>
        )}
        {loading && (
          <p role="status" className="mb-5 text-center text-sm text-slate-600">
            {bn ? "ক্লাবের সংবাদ লোড হচ্ছে…" : "Loading club news…"}
          </p>
        )}
        {failed && (
          <div
            role="status"
            className="mb-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600"
          >
            <p>
              {bn
                ? "ক্লাবের সংবাদ এখন পাওয়া যাচ্ছে না। নিচে বিজ্ঞানের পাঠ পড়ো।"
                : "Club news is unavailable. Explore our science notes below."}
            </p>
            <button
              type="button"
              className="rounded px-2 py-1 font-medium text-blue-700 underline focus-visible:outline-2 focus-visible:outline-offset-4"
              onClick={() => {
                setFailed(false);
                setLoading(true);
                setRevision((value) => value + 1);
              }}
            >
              {bn ? "আবার চেষ্টা করো" : "Retry news"}
            </button>
          </div>
        )}
        <div className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => (
            <article key={item.id} className={cardClasses}>
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <Image
                  src={announcementCover(item.id).image}
                  alt={announcementCover(item.id).alt[language]}
                  fill
                  sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 400px"
                  className={imageClasses}
                />
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays aria-hidden="true" className="size-4" />
                    <time dateTime={item.updatedAt}>
                      {new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "Asia/Dhaka",
                      }).format(new Date(item.updatedAt))}
                    </time>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Tag aria-hidden="true" className="size-4 text-blue-600" />
                    {bn ? "ক্লাবের সংবাদ" : "Club news"}
                  </span>
                </div>
                <h3 className="mb-7 break-words text-xl font-bold leading-relaxed text-slate-900">
                  {item.title}
                </h3>
                <Link
                  href={`/blog/news-${encodeURIComponent(item.id)}`}
                  aria-label={`${readMore}: ${item.title}`}
                  className="mt-auto inline-flex w-fit items-center gap-2 rounded text-sm font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {readMore}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </article>
          ))}
          {visibleNotes.map((note) => (
            <article key={note.id} className={cardClasses}>
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <Image
                  src={note.image}
                  alt={note.alt[language]}
                  fill
                  sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 400px"
                  className={imageClasses}
                />
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 aria-hidden="true" className="size-4" />
                    {bn ? "বিজ্ঞানের পাঠ" : "Science notes"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Tag aria-hidden="true" className="size-4 text-blue-600" />
                    {note.category[language]}
                  </span>
                </div>
                <h3 className="mb-7 text-xl font-bold leading-relaxed text-slate-900">
                  {note.title[language]}
                </h3>
                <Link
                  href={"/blog/" + note.id}
                  aria-label={`${readMore}: ${note.title[language]}`}
                  className="mt-auto inline-flex w-fit items-center gap-2 rounded text-sm font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {readMore}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-10 text-center sm:mt-12">
          <Link
            href="/announcements"
            className="inline-flex items-center gap-4 rounded-md bg-blue-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            {bn ? "ক্লাবের সব সংবাদ দেখো" : "Explore all club news"}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-slate-500">
        <a
          href="/images/activities/bangladesh-credits.txt"
          className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {bn ? "ছবির উৎস ও লাইসেন্স" : "Photo sources & licenses"}
        </a>
      </p>
    </section>
  );
}
