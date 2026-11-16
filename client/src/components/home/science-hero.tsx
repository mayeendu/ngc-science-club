"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Atom,
  Dna,
  FlaskConical,
  MoveUpRight,
  Pause,
  Play,
  Sigma,
} from "lucide-react";
import { useLanguage, useT } from "@/components/i18n/language";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

const subjects = [
  {
    name: "Physics",
    bn: "পদার্থবিজ্ঞান",
    title: "Small questions.",
    accent: "Infinite possibilities.",
    titleBn: "ছোট্ট প্রশ্নে",
    accentBn: "অসীম সম্ভাবনা।",
    description:
      "From the motion of a pendulum to the mysteries of the universe. Turn your curiosity into your next discovery.",
    descriptionBn:
      "দোলকের গতি থেকে মহাবিশ্বের রহস্য। তোমার কৌতূহল থেকেই শুরু হোক নতুন আবিষ্কার।",
    formula: "E = mc²",
    Icon: Atom,
    color: "#f5ce35",
  },
  {
    name: "Chemistry",
    bn: "রসায়ন",
    title: "Mix curiosity.",
    accent: "Create a reaction.",
    titleBn: "কৌতূহল মেশাও।",
    accentBn: "নতুন কিছু গড়ো।",
    description:
      "Explore the elements that shape our world. Discover the extraordinary chemistry behind ordinary things.",
    descriptionBn:
      "আমাদের পৃথিবী গড়ার উপাদানগুলোকে জানো। সাধারণ জিনিসের অসাধারণ রসায়ন খুঁজে দেখো।",
    formula: "H₂O",
    Icon: FlaskConical,
    color: "#adcbb3",
  },
  {
    name: "Mathematics",
    bn: "গণিত",
    title: "Find the pattern.",
    accent: "Think beyond limits.",
    titleBn: "খুঁজে নাও ছন্দ।",
    accentBn: "ভাবো সীমা ছাড়িয়ে।",
    description:
      "Every great idea starts with a new way of thinking. Explore elegant patterns, solve problems, and connect the dots.",
    descriptionBn:
      "নতুনভাবে ভাবা থেকেই বড় ধারণার শুরু। ছন্দ খোঁজো, সমস্যা সমাধান করো, আর মিলিয়ে নাও সূত্রগুলো।",
    formula: "π ≈ 3.14159",
    Icon: Sigma,
    color: "#bab3dc",
  },
  {
    name: "Biology",
    bn: "জীববিজ্ঞান",
    title: "Explore life.",
    accent: "Discover your world.",
    titleBn: "জীবনকে জানো।",
    accentBn: "পৃথিবীকে আবিষ্কার করো।",
    description:
      "From a single cell to a thriving ecosystem. Get closer to the living world and the science that connects us all.",
    descriptionBn:
      "একটি কোষ থেকে সমৃদ্ধ বাস্তুতন্ত্র। জীবজগৎ আর আমাদের সংযোগের বিজ্ঞানকে আরও কাছে থেকে জানো।",
    formula: "A · T · G · C",
    Icon: Dna,
    color: "#bed171",
  },
] as const;

function ScienceArtwork({ index }: { index: number }) {
  const { Icon, formula } = subjects[index];
  return (
    <div className="science-art" aria-hidden="true">
      <div className="science-art-outline" />
      <div className="science-art-blob" />
      <div className="science-art-dots" />
      <span className="science-art-spark">✳</span>
      <div className="science-art-sheet">
        <div className="science-sheet-top">
          <span>NGC / SCIENCE LAB</span>
          <span>0{index + 1}</span>
        </div>
        <Icon className="science-main-icon" strokeWidth={0.85} />
        <div className="science-sheet-bottom">
          <span>{formula}</span>
          <MoveUpRight size={26} />
        </div>
      </div>
      <div className="science-formula">
        {index === 0
          ? "F = ma"
          : index === 1
            ? "C₆H₁₂O₆"
            : index === 2
              ? "x² + y² = r²"
              : "DNA → RNA"}
      </div>
      <div className="science-art-label">
        <span className="science-status-dot" />
        {formula}
      </div>
    </div>
  );
}

export function ScienceHero() {
  const bn = useLanguage() === "bn";
  const t = useT();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!api) return;
    const selected = () => setCurrent(api.selectedScrollSnap());
    api.on("select", selected);
    return () => {
      api.off("select", selected);
    };
  }, [api]);
  useEffect(() => {
    if (!api || paused || hovering || focused) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!document.hidden && !reduced.matches) api.scrollNext();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [api, paused, hovering, focused, current]);
  return (
    <section
      className="science-hero"
      aria-label={bn ? "বিজ্ঞান অন্বেষণ" : "Explore science"}
    >
      <Carousel
        opts={{ loop: true }}
        setApi={setApi}
        aria-label={bn ? "বিজ্ঞানের চারটি বিষয়" : "Four fields of science"}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
      >
        <CarouselContent>
          {subjects.map((subject, index) => (
            <CarouselItem
              key={subject.name}
              aria-label={`${index + 1} / 4: ${bn ? subject.bn : subject.name}`}
              aria-hidden={current !== index}
              inert={current !== index}
            >
              <div
                className="science-banner"
                style={{ "--science-accent": subject.color } as CSSProperties}
              >
                <div className="science-copy">
                  <div className="science-eyebrow">
                    <span />
                    {t("Narsingdi Government College")}
                  </div>
                  <p className="science-subject">
                    0{index + 1} <span>/</span> {bn ? subject.bn : subject.name}
                  </p>
                  <h1>
                    {bn ? subject.titleBn : subject.title}
                    <br />
                    <span>{bn ? subject.accentBn : subject.accent}</span>
                  </h1>
                  <p className="science-description">
                    {bn ? subject.descriptionBn : subject.description}
                  </p>
                  <div className="science-actions">
                    <Link href="/signup" className="science-join">
                      {t("Join the science community")}
                      <ArrowRight size={19} />
                    </Link>
                    <Link href="/events" className="science-explore">
                      {t("Explore club events")}
                      <MoveUpRight size={16} />
                    </Link>
                  </div>
                  <div className="science-motto">
                    <ArrowDownRight size={23} />
                    <span>
                      {bn
                        ? "প্রশ্ন করো। শেখো। আবিষ্কার করো।"
                        : "STAY CURIOUS. KEEP DISCOVERING."}
                    </span>
                  </div>
                </div>
                <div className="science-visual">
                  <ScienceArtwork index={index} />
                  <p className="science-visual-caption">
                    {bn ? subject.bn : subject.name}
                    <span>NGC SCIENCE CLUB</span>
                  </p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="science-carousel-footer">
          <div className="science-subject-tabs">
            {subjects.map((subject, index) => (
              <button
                key={subject.name}
                type="button"
                aria-label={bn ? `${subject.bn} দেখুন` : `Show ${subject.name}`}
                aria-current={current === index ? "true" : undefined}
                onClick={() => api?.scrollTo(index)}
              >
                <span>0{index + 1}</span>
                {bn ? subject.bn : subject.name}
              </button>
            ))}
          </div>
          <div className="science-carousel-controls">
            <span className="science-slide-count">
              0{current + 1} <span>/ 04</span>
            </span>
            <button
              type="button"
              aria-label={bn ? "আগের ব্যানার" : "Previous banner"}
              onClick={() => api?.scrollPrev()}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              aria-label={bn ? "পরের ব্যানার" : "Next banner"}
              onClick={() => api?.scrollNext()}
            >
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              aria-label={
                bn
                  ? paused
                    ? "ব্যানার চালু করুন"
                    : "ব্যানার থামান"
                  : paused
                    ? "Play banners"
                    : "Pause banners"
              }
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
        </div>
      </Carousel>
    </section>
  );
}
