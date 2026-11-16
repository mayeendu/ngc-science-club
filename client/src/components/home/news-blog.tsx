"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Newspaper,
  Tag,
  X,
} from "lucide-react";
import { useLanguage } from "@/components/i18n/language";
import { listAnnouncements, type Announcement } from "@/lib/communication-api";

type Language = "en" | "bn";
type Text = Readonly<Record<Language, string>>;
type ScienceNote = Readonly<{
  id: string;
  title: Text;
  category: Text;
  image: string;
  alt: Text;
  paragraphs: readonly Text[];
}>;
const notes: readonly ScienceNote[] = [
  {
    id: "first-experiment",
    title: {
      en: "Turn a curious question into your first experiment",
      bn: "কৌতূহলী প্রশ্ন থেকেই শুরু হোক প্রথম পরীক্ষা",
    },
    category: { en: "Science notes", bn: "বিজ্ঞানের পাঠ" },
    image: "/images/activities/innovation.jpg",
    alt: {
      en: "Students assembling a robotics project together",
      bn: "একসাথে রোবোটিক্স প্রকল্প তৈরি করছে শিক্ষার্থীরা",
    },
    paragraphs: [
      {
        en: "Start with a question you can investigate safely. For example: does a paper helicopter fall differently when its blades are longer? Write down what you expect to happen and why.",
        bn: "নিরাপদে অনুসন্ধান করা যায় এমন প্রশ্ন দিয়ে শুরু করো। যেমন: কাগজের হেলিকপ্টারের পাখা বড় হলে কি পতনের ধরন বদলায়? কী ঘটবে বলে মনে হয় এবং কেন, তা লিখে রাখো।",
      },
      {
        en: "Change one factor at a time. Keep the paper, release height, and release method the same while comparing blade lengths. Repeat each trial, record the results, and look for a pattern instead of choosing only the result you expected.",
        bn: "একবারে একটি বিষয় বদলাও। পাখার দৈর্ঘ্য তুলনার সময় কাগজ, ছাড়ার উচ্চতা ও পদ্ধতি একই রাখো। প্রতিটি পরীক্ষা কয়েকবার করো, ফল লিখে রাখো এবং শুধু প্রত্যাশিত ফল বেছে না নিয়ে ছন্দ খুঁজে দেখো।",
      },
      {
        en: "Share both your results and the limits of your method. A result that surprises you is a reason to ask a better question. Use simple, safe materials and ask a teacher before trying unfamiliar equipment or substances.",
        bn: "ফলাফলের পাশাপাশি পদ্ধতির সীমাবদ্ধতাও জানাও। অপ্রত্যাশিত ফল আরও ভালো প্রশ্ন করার সুযোগ। সহজ ও নিরাপদ উপকরণ ব্যবহার করো; অপরিচিত যন্ত্র বা পদার্থ ব্যবহারের আগে শিক্ষকের পরামর্শ নাও।",
      },
    ],
  },
  {
    id: "everyday-physics",
    title: {
      en: "Find the extraordinary physics in everyday life",
      bn: "দৈনন্দিন জীবনেই খুঁজে নাও অসাধারণ পদার্থবিজ্ঞান",
    },
    category: { en: "Physics", bn: "পদার্থবিজ্ঞান" },
    image: "/images/activities/workshop.jpg",
    alt: {
      en: "Students exploring physics with laboratory equipment",
      bn: "গবেষণাগারের যন্ত্র দিয়ে পদার্থবিজ্ঞান অন্বেষণ করছে শিক্ষার্থীরা",
    },
    paragraphs: [
      {
        en: "Physics begins with noticing. A bicycle slowing down, a shadow moving, and a spoon looking bent in water are everyday invitations to investigate motion, light, and energy.",
        bn: "পদার্থবিজ্ঞানের শুরু পর্যবেক্ষণ থেকে। সাইকেলের গতি কমা, ছায়ার অবস্থান বদলানো বা পানিতে চামচ বাঁকা দেখানো—এসব গতি, আলো ও শক্তিকে জানার সুযোগ।",
      },
      {
        en: "Try observing a pencil through the side of a clear glass of water. The pencil can appear displaced at the water surface because light changes direction when it travels between water and air. This bending is called refraction.",
        bn: "পানিভরা স্বচ্ছ গ্লাসের পাশ থেকে একটি পেনসিল দেখো। পানি ও বাতাসের মধ্যে চলার সময় আলো দিক বদলায় বলে পানির তলে পেনসিলের অংশটি সরে গেছে বলে মনে হতে পারে। এই দিক বদলকে প্রতিসরণ বলে।",
      },
      {
        en: "Sketch what you see before searching for an explanation. Compare your observations from different angles and discuss them with a classmate or teacher. Clear observations make scientific explanations easier to test.",
        bn: "ব্যাখ্যা খোঁজার আগে যা দেখছ তার ছবি আঁকো। বিভিন্ন কোণ থেকে পর্যবেক্ষণ করো এবং সহপাঠী বা শিক্ষকের সঙ্গে আলোচনা করো। স্পষ্ট পর্যবেক্ষণ বৈজ্ঞানিক ব্যাখ্যা যাচাই করতে সাহায্য করে।",
      },
    ],
  },
  {
    id: "campus-biodiversity",
    title: {
      en: "A closer look at the biodiversity around us",
      bn: "চারপাশের জীববৈচিত্র্যকে দেখো আরও কাছ থেকে",
    },
    category: { en: "Environment", bn: "পরিবেশ" },
    image: "/images/activities/conservation.jpg",
    alt: {
      en: "Volunteers working together to plant a tree outdoors",
      bn: "খোলা মাঠে একসাথে গাছ লাগাচ্ছেন স্বেচ্ছাসেবকেরা",
    },
    paragraphs: [
      {
        en: "A small patch of green can hold many different forms of life. Plants, insects, birds, and fungi interact with one another and with their surroundings. Observing these connections is a useful first step in learning about biodiversity.",
        bn: "ছোট্ট সবুজ জায়গাতেও নানা ধরনের জীব থাকতে পারে। গাছপালা, পোকামাকড়, পাখি ও ছত্রাক একে অন্যের সঙ্গে এবং পরিবেশের সঙ্গে যুক্ত। এই সম্পর্ক পর্যবেক্ষণ জীববৈচিত্র্য শেখার প্রথম ধাপ।",
      },
      {
        en: "Choose a safe observation spot and make a nature journal. Record the date, weather, and what you notice. Sketch or photograph organisms without disturbing nests, picking plants, or handling unfamiliar animals.",
        bn: "পর্যবেক্ষণের জন্য নিরাপদ জায়গা বেছে নিয়ে প্রকৃতির দিনলিপি তৈরি করো। তারিখ, আবহাওয়া ও দেখা বিষয়গুলো লিখে রাখো। বাসা নষ্ট না করে, গাছ না ছিঁড়ে এবং অপরিচিত প্রাণী না ধরে ছবি আঁকো বা তোলো।",
      },
      {
        en: "Return to the same spot at different times and compare your notes. Keep the area free of litter and talk with a teacher about responsible conservation activities. Careful observation and small, consistent actions can support a healthier shared environment.",
        bn: "বিভিন্ন সময়ে একই জায়গায় ফিরে দিনলিপি তুলনা করো। জায়গাটি আবর্জনামুক্ত রাখো এবং দায়িত্বশীল সংরক্ষণ কার্যক্রম নিয়ে শিক্ষকের সঙ্গে কথা বলো। যত্নশীল পর্যবেক্ষণ ও নিয়মিত ছোট উদ্যোগ পরিবেশের সুস্থতায় ভূমিকা রাখতে পারে।",
      },
    ],
  },
];

export function NewsBlog({ standalone = false }: { standalone?: boolean }) {
  const language = useLanguage();
  const bn = language === "bn";
  const [news, setNews] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<ScienceNote | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogTitle = useId();
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
  useEffect(() => {
    const element = dialog.current;
    if (selected && element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, [selected]);
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
          {news.map((item, index) => (
            <article key={item.id} className={cardClasses}>
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <Image
                  src={notes[index].image}
                  alt={notes[index].alt[language]}
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
                  href={`/announcements/${encodeURIComponent(item.id)}`}
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
                <button
                  type="button"
                  aria-label={`${readMore}: ${note.title[language]}`}
                  onClick={() => setSelected(note)}
                  className="mt-auto inline-flex w-fit items-center gap-2 rounded text-sm font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {readMore}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
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
      <dialog
        ref={dialog}
        aria-labelledby={dialogTitle}
        onClose={() => setSelected(null)}
        className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border bg-white p-6 text-left text-slate-900 shadow-2xl backdrop:bg-black/50 sm:p-8"
      >
        {selected && (
          <>
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2
                id={dialogTitle}
                className="text-2xl font-bold leading-relaxed"
              >
                {selected.title[language]}
              </h2>
              <button
                type="button"
                aria-label={bn ? "লেখা বন্ধ করো" : "Close article"}
                onClick={() => dialog.current?.close()}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm leading-8 text-slate-600">
              {selected.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph[language]}</p>
              ))}
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
