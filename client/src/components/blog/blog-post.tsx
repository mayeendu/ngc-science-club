"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/components/i18n/language";
import { BlogApiError, getMemberBlog } from "@/lib/blog-api";
import { getAnnouncement } from "@/lib/communication-api";
import { ClubApiError } from "@/lib/club-api";
import { scienceNotes } from "@/lib/science-notes";
import {
  announcementCover,
  blogCover,
  type BlogCover,
} from "@/lib/blog-covers";

type ArticleContent = {
  title: string;
  category: string;
  body: string;
  cover: BlogCover;
  authorName?: string;
  date?: string;
  updated?: boolean;
};
export function BlogPost({ id }: { id: string }) {
  const language = useLanguage();
  const bn = language === "bn";
  const note = scienceNotes.find((item) => item.id === id);
  const [remote, setRemote] = useState<ArticleContent | null>(null);
  const [error, setError] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (note) return;
    const controller = new AbortController();
    const load = id.startsWith("news-")
      ? getAnnouncement(id.slice(5), controller.signal).then(
          ({ announcement }): ArticleContent => ({
            title: announcement.title,
            category: "Club news",
            body: announcement.body,
            cover: announcementCover(announcement.id),
            date: announcement.updatedAt,
            updated: true,
          }),
        )
      : getMemberBlog(id, controller.signal).then((post): ArticleContent => ({
          title: post.title,
          category: post.category,
          body: post.body,
          cover: blogCover(post.category),
          authorName: post.authorName,
          date: post.publishedAt,
        }));
    load
      .then((article) => {
        if (!controller.signal.aborted) setRemote(article);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof BlogApiError || cause instanceof ClubApiError
              ? cause.status
              : 500,
          );
      });
    return () => controller.abort();
  }, [id, note, revision]);
  const article: ArticleContent | null = note
    ? {
        title: note.title[language],
        category: note.category[language],
        body: note.paragraphs
          .map((paragraph) => paragraph[language])
          .join("\n\n"),
        cover: { image: note.image, alt: note.alt },
      }
    : remote;
  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-5 py-10 sm:py-14">
      <Link
        href="/blog"
        className="mb-7 inline-flex items-center gap-2 rounded text-sm font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {bn ? "সব ব্লগে ফিরে যান" : "Back to all blogs"}
      </Link>
      {error ? (
        <div role="alert">
          <h1 className="text-2xl font-bold">
            {error === 404
              ? bn
                ? "লেখাটি পাওয়া যায়নি"
                : "Blog post not found"
              : bn
                ? "লেখাটি লোড করা যায়নি"
                : "Unable to load blog post"}
          </h1>
          {error !== 404 && (
            <button
              type="button"
              className="mt-4 rounded border px-4 py-2"
              onClick={() => {
                setError(0);
                setRevision((value) => value + 1);
              }}
            >
              {bn ? "আবার চেষ্টা করুন" : "Retry post"}
            </button>
          )}
        </div>
      ) : !article ? (
        <p role="status">{bn ? "লেখা লোড হচ্ছে…" : "Loading blog post…"}</p>
      ) : (
        <article>
          <header>
            <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
              <Image
                src={article.cover.image}
                alt={article.cover.alt[language]}
                fill
                sizes="(max-width: 896px) 100vw, 856px"
                preload
                className="object-cover"
              />
            </div>
            <p className="text-sm font-semibold text-blue-700">
              {article.updated && bn ? "ক্লাবের সংবাদ" : article.category}
            </p>
            <h1 className="my-4 text-3xl font-bold leading-tight wrap-break-word sm:text-4xl lg:text-5xl">
              {article.title}
            </h1>
            {(article.authorName || article.date) && (
              <p className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {article.authorName && <span>{article.authorName}</span>}
                {article.authorName && article.date && (
                  <span aria-hidden="true">·</span>
                )}
                {article.date && (
                  <>
                    {article.updated && (
                      <span>{bn ? "হালনাগাদ:" : "Updated:"}</span>
                    )}
                    <time dateTime={article.date}>
                      {new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", {
                        dateStyle: "long",
                        timeZone: "Asia/Dhaka",
                      }).format(new Date(article.date))}
                    </time>
                  </>
                )}
              </p>
            )}
          </header>
          <div className="mt-7 space-y-5 text-base leading-8">
            {article.body.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-wrap wrap-break-word">
                {paragraph}
              </p>
            ))}
          </div>
          <p className="mt-10 border-t pt-5 text-xs text-slate-500">
            <a
              href="/images/activities/bangladesh-credits.txt"
              className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {bn ? "ছবির উৎস ও লাইসেন্স" : "Photo sources & licenses"}
            </a>
          </p>
        </article>
      )}
    </main>
  );
}
