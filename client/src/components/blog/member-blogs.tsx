"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { useLanguage } from "@/components/i18n/language";
import { listMemberBlogs, type MemberBlog } from "@/lib/blog-api";

export function MemberBlogs() {
  const bn = useLanguage() === "bn";
  const [items, setItems] = useState<MemberBlog[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    listMemberBlogs(page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result.items);
          setHasNext(result.hasNext);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [page, revision]);
  function refresh() {
    setFailed(false);
    setItems(null);
    setRevision((value) => value + 1);
  }
  return (
    <section aria-labelledby="member-stories-title" className="mb-12 text-left">
      <h2 id="member-stories-title" className="mb-5 text-2xl font-bold">
        {bn ? "সদস্যদের লেখা" : "Member stories"}
      </h2>
      {failed ? (
        <div role="alert" className="rounded-xl border bg-white p-5">
          <p>
            {bn
              ? "সদস্যদের লেখা লোড করা যায়নি।"
              : "Unable to load member stories."}
          </p>
          <button
            type="button"
            onClick={refresh}
            className="mt-2 rounded px-3 py-1 text-blue-700 underline"
          >
            {bn ? "আবার চেষ্টা করুন" : "Retry member stories"}
          </button>
        </div>
      ) : items === null ? (
        <p role="status">
          {bn ? "লেখা লোড হচ্ছে…" : "Loading member stories…"}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-slate-600">
          {bn
            ? "এখনও কোনো সদস্যের লেখা নেই। নিচে বিজ্ঞানের পাঠ পড়ুন, অথবা প্রথম লেখাটি প্রকাশ করুন।"
            : "No member stories yet. Explore the science notes below, or publish the first story."}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col rounded-xl border bg-white p-6 shadow-sm"
            >
              <p className="mb-3 text-xs font-semibold text-blue-700">
                {item.category}
              </p>
              <h3 className="text-xl font-bold wrap-break-word">
                <Link
                  href={`/blog/${item.id}`}
                  className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {item.title}
                </Link>
              </h3>
              <p className="my-4 text-sm leading-7 text-slate-600 wrap-break-word">
                {item.excerpt}
                {item.excerpt.length >= 180 ? "…" : ""}
              </p>
              <div className="mb-4 mt-auto flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <UserRound aria-hidden="true" className="size-3.5" />
                  {item.authorName}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  <time dateTime={item.publishedAt}>
                    {new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", {
                      dateStyle: "medium",
                      timeZone: "Asia/Dhaka",
                    }).format(new Date(item.publishedAt))}
                  </time>
                </span>
              </div>
              <Link
                href={`/blog/${item.id}`}
                aria-label={`${bn ? "পড়ুন" : "Read"}: ${item.title}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
              >
                {bn ? "আরও পড়ুন" : "Read more"}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      )}
      {!failed && items && (page > 1 || hasNext) && (
        <nav
          aria-label={bn ? "ব্লগের পৃষ্ঠা" : "Blog pagination"}
          className="mt-6 flex justify-center gap-4"
        >
          <button
            type="button"
            disabled={page === 1}
            onClick={() => {
              setPage((value) => value - 1);
              setItems(null);
            }}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            {bn ? "আগের" : "Previous"}
          </button>
          <span className="self-center">{page}</span>
          <button
            type="button"
            disabled={!hasNext || page >= 1000}
            onClick={() => {
              setPage((value) => value + 1);
              setItems(null);
            }}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            {bn ? "পরের" : "Next"}
          </button>
        </nav>
      )}
    </section>
  );
}
