"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Compass,
  FlaskConical,
  Leaf,
  Lightbulb,
  MapPin,
  Microscope,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/components/i18n/language";

type LocalizedText = Readonly<{ en: string; bn: string }>;
type Activity = Readonly<{
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  badge: LocalizedText;
  image: string;
  alt: LocalizedText;
  badgeClass: string;
  metadata: readonly [
    Readonly<{ text: LocalizedText; icon: LucideIcon }>,
    Readonly<{ text: LocalizedText; icon: LucideIcon }>,
  ];
  href?: string;
}>;

const activities: readonly Activity[] = [
  {
    id: "quiz",
    title: { en: "Regular Science Quiz", bn: "নিয়মিত বিজ্ঞান কুইজ" },
    description: {
      en: "Challenge your scientific knowledge through exciting quizzes in Biology, Physics, Chemistry, and General Science.",
      bn: "জীববিজ্ঞান, পদার্থবিজ্ঞান, রসায়ন ও সাধারণ বিজ্ঞানের আকর্ষণীয় কুইজে তোমার জ্ঞান যাচাই করো।",
    },
    badge: { en: "Weekly", bn: "সাপ্তাহিক" },
    badgeClass: "bg-blue-50 text-blue-800",
    image: "/images/activities/quiz-bd.jpg",
    alt: {
      en: "Students attending the Dhaka regional Mathematics Olympiad in Bangladesh",
      bn: "বাংলাদেশের ঢাকা আঞ্চলিক গণিত অলিম্পিয়াডে অংশ নিচ্ছে শিক্ষার্থীরা",
    },
    metadata: [
      { text: { en: "Weekly", bn: "সাপ্তাহিক" }, icon: CalendarDays },
      { text: { en: "Knowledge", bn: "জ্ঞানচর্চা" }, icon: BookOpen },
    ],
  },
  {
    id: "olympiad",
    title: { en: "Science Olympiad", bn: "বিজ্ঞান অলিম্পিয়াড" },
    description: {
      en: "Compete in challenging science Olympiads, sharpen your problem-solving skills, and showcase your talent.",
      bn: "বিজ্ঞান অলিম্পিয়াডে অংশ নাও, সমস্যা সমাধানের দক্ষতা বাড়াও এবং তোমার প্রতিভা তুলে ধরো।",
    },
    badge: { en: "Competition", bn: "প্রতিযোগিতা" },
    badgeClass: "bg-amber-50 text-amber-800",
    image: "/images/activities/olympiad-bd.jpg",
    alt: {
      en: "Students gathered at the National Mathematics Olympiad in Dhaka, Bangladesh",
      bn: "বাংলাদেশের ঢাকায় জাতীয় গণিত অলিম্পিয়াডে সমবেত শিক্ষার্থীরা",
    },
    metadata: [
      { text: { en: "Competition", bn: "প্রতিযোগিতা" }, icon: Trophy },
      { text: { en: "Team & Individual", bn: "দলীয় ও একক" }, icon: Users },
    ],
    href: "/events",
  },
  {
    id: "study-tour",
    title: { en: "Educational Study Tour", bn: "শিক্ষামূলক ভ্রমণ" },
    description: {
      en: "Explore nature, research institutions, museums, and ecosystems through educational field visits.",
      bn: "শিক্ষামূলক ভ্রমণে প্রকৃতি, গবেষণা প্রতিষ্ঠান, জাদুঘর ও বাস্তুতন্ত্রকে কাছ থেকে জানো।",
    },
    badge: { en: "Outdoor Learning", bn: "প্রকৃতিতে শিক্ষা" },
    badgeClass: "bg-teal-50 text-teal-800",
    image: "/images/activities/study-tour-bd.jpg",
    alt: {
      en: "A group of students outdoors at 30 Godown in Barishal, Bangladesh",
      bn: "বাংলাদেশের বরিশালের ত্রিশ গোডাউনে খোলা পরিবেশে একদল শিক্ষার্থী",
    },
    metadata: [
      { text: { en: "Field Visits", bn: "মাঠপর্যায়ে ভ্রমণ" }, icon: MapPin },
      { text: { en: "Exploration", bn: "অনুসন্ধান" }, icon: Compass },
    ],
    href: "/events",
  },
  {
    id: "innovation",
    title: {
      en: "Science Project & Innovation",
      bn: "বিজ্ঞান প্রকল্প ও উদ্ভাবন",
    },
    description: {
      en: "Turn creative ideas into practical scientific models, experiments, and innovative research projects.",
      bn: "সৃজনশীল ধারণাকে বৈজ্ঞানিক মডেল, পরীক্ষা ও উদ্ভাবনী গবেষণা প্রকল্পে রূপ দাও।",
    },
    badge: { en: "Innovation", bn: "উদ্ভাবন" },
    badgeClass: "bg-violet-50 text-violet-800",
    image: "/images/activities/innovation-bd.jpg",
    alt: {
      en: "Students presenting robotics projects at a STEM fair in Dhaka, Bangladesh",
      bn: "বাংলাদেশের ঢাকায় স্টেম মেলায় রোবোটিক্স প্রকল্প উপস্থাপন করছে শিক্ষার্থীরা",
    },
    metadata: [
      { text: { en: "Projects", bn: "প্রকল্প" }, icon: Lightbulb },
      { text: { en: "Experiments", bn: "পরীক্ষা" }, icon: FlaskConical },
    ],
  },
  {
    id: "workshop",
    title: {
      en: "Science Workshop & Seminar",
      bn: "বিজ্ঞান কর্মশালা ও সেমিনার",
    },
    description: {
      en: "Learn practical scientific skills through expert-led workshops, interactive seminars, and hands-on training.",
      bn: "বিশেষজ্ঞদের কর্মশালা, অংশগ্রহণমূলক সেমিনার ও হাতে-কলমে প্রশিক্ষণে বিজ্ঞানের ব্যবহারিক দক্ষতা অর্জন করো।",
    },
    badge: { en: "Skill Development", bn: "দক্ষতা উন্নয়ন" },
    badgeClass: "bg-orange-50 text-orange-800",
    image: "/images/activities/workshop-bd.jpg",
    alt: {
      en: "Students working together at a creative workshop at Dhaka University, Bangladesh",
      bn: "বাংলাদেশের ঢাকা বিশ্ববিদ্যালয়ে সৃজনশীল কর্মশালায় একসাথে কাজ করছে শিক্ষার্থীরা",
    },
    metadata: [
      { text: { en: "Workshop", bn: "কর্মশালা" }, icon: Microscope },
      { text: { en: "Learning", bn: "শেখা" }, icon: BookOpen },
    ],
    href: "/events",
  },
  {
    id: "conservation",
    title: { en: "Environment & Conservation", bn: "পরিবেশ ও সংরক্ষণ" },
    description: {
      en: "Protect biodiversity and promote sustainability through tree planting, awareness campaigns, and conservation activities.",
      bn: "বৃক্ষরোপণ, সচেতনতা প্রচার ও সংরক্ষণ কার্যক্রমে জীববৈচিত্র্য রক্ষা করো এবং টেকসই ভবিষ্যৎ গড়ো।",
    },
    badge: { en: "Community", bn: "সমাজ" },
    badgeClass: "bg-green-50 text-green-800",
    image: "/images/activities/conservation-bd.jpg",
    alt: {
      en: "Students at a college tree-planting awareness rally in Mymensingh, Bangladesh",
      bn: "বাংলাদেশের ময়মনসিংহে কলেজের বৃক্ষরোপণ সচেতনতা র‍্যালিতে শিক্ষার্থীরা",
    },
    metadata: [
      { text: { en: "Conservation", bn: "সংরক্ষণ" }, icon: Leaf },
      { text: { en: "Community", bn: "সমাজ" }, icon: Users },
    ],
    href: "/events",
  },
];

function ActivityCard({
  activity,
  language,
}: {
  activity: Activity;
  language: "bn" | "en";
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 hover:shadow-lg focus-within:shadow-lg motion-safe:hover:-translate-y-1">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <Image
          src={activity.image}
          alt={activity.alt[language]}
          fill
          sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 400px"
          className="object-cover object-[50%_30%] motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
        />
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${activity.badgeClass}`}
        >
          {activity.badge[language]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-lg font-bold leading-snug tracking-tight">
          {activity.href ? (
            <Link
              href={activity.href}
              className="inline-flex items-start gap-2 rounded-sm text-slate-900 hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              {activity.title[language]}
              <ArrowUpRight
                aria-hidden="true"
                className="mt-1 size-4 shrink-0"
              />
            </Link>
          ) : (
            activity.title[language]
          )}
        </h3>
        <p className="mb-6 mt-3 text-sm leading-7 text-slate-600">
          {activity.description[language]}
        </p>
        <ul
          aria-label={
            language === "bn" ? "কার্যক্রমের তথ্য" : "Activity details"
          }
          className="mt-auto flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600"
        >
          {activity.metadata.map(({ text, icon: Icon }) => (
            <li key={text.en} className="inline-flex items-center gap-1.5">
              <Icon aria-hidden="true" className="size-3.5 text-slate-500" />
              {text[language]}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function ScienceActivities() {
  const language = useLanguage();
  return (
    <section
      aria-labelledby="science-activities-heading"
      className="w-full bg-white px-1 py-12 text-left sm:py-16"
    >
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-9 text-center sm:mb-12">
          <h2
            id="science-activities-heading"
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            {language === "bn"
              ? "বিজ্ঞান ক্লাবের কার্যক্রম"
              : "Science Club Activity"}
          </h2>
          <p className="mt-3 text-base text-slate-600">
            {language === "bn"
              ? "অন্বেষণ, পরীক্ষা, উদ্ভাবন ও আবিষ্কার।"
              : "Explore, Experiment, Innovate & Discover."}
          </p>
        </header>
        <div className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              language={language}
            />
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">
          <a
            href="/images/activities/bangladesh-credits.txt"
            className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {language === "bn"
              ? "ছবির উৎস ও লাইসেন্স"
              : "Photo sources & licenses"}
          </a>
        </p>
      </div>
    </section>
  );
}
