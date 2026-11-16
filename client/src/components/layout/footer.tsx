"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Images,
  MapPin,
  Newspaper,
  Trophy,
} from "lucide-react";
import { useLanguage, useT } from "@/components/i18n/language";
import { ClubLogo } from "@/components/layout/club-logo";

type FooterLink = Readonly<{ href: string; en: string; bn: string }>;
const clubLinks: readonly FooterLink[] = [
  { href: "/", en: "Home", bn: "হোম" },
  { href: "/members", en: "Members", bn: "সদস্যবৃন্দ" },
  { href: "/faculty", en: "Teachers", bn: "শিক্ষকবৃন্দ" },
];
const discoverLinks: readonly FooterLink[] = [
  { href: "/events", en: "Events & activities", bn: "অনুষ্ঠান ও কার্যক্রম" },
  { href: "/achievements", en: "Club achievements", bn: "ক্লাবের অর্জন" },
  { href: "/gallery", en: "Photo gallery", bn: "ফটো গ্যালারি" },
  { href: "/certificates/verify", en: "Verify certificate", bn: "সনদ যাচাই" },
];
const quickLinks = [
  { href: "/announcements", en: "Announcements", bn: "ঘোষণা", Icon: Newspaper },
  { href: "/events", en: "Events", bn: "অনুষ্ঠান", Icon: CalendarDays },
  { href: "/gallery", en: "Photo gallery", bn: "ফটো গ্যালারি", Icon: Images },
  { href: "/achievements", en: "Achievements", bn: "অর্জন", Icon: Trophy },
] as const;

function FooterMenu({
  title,
  links,
  language,
}: {
  title: string;
  links: readonly FooterLink[];
  language: "en" | "bn";
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="club-footer-link inline-block py-1 text-sm"
            >
              {link[language]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const pathname = usePathname();
  const language = useLanguage();
  const t = useT();
  const bn = language === "bn";
  if (pathname.startsWith("/dashboard")) return null;

  return (
    <footer className="club-footer w-full bg-[#080b10] text-[#a8b0bb]">
      <div className="mx-auto max-w-[1440px] px-6 pb-7 pt-14 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_.8fr_1fr_1.25fr] lg:gap-x-12">
          <div>
            <Link
              href="/"
              className="club-footer-brand inline-flex items-center gap-3 rounded-lg"
              aria-label={t("NGC Science Club")}
            >
              <ClubLogo
                decorative
                sizes="64px"
                className="w-16 rounded-xl p-1"
              />
              <span className="text-xl font-bold tracking-tight text-white">
                {t("NGC Science Club")}
              </span>
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-7">
              {bn
                ? "কৌতূহলী মন, নতুন ভাবনা আর একসাথে বিজ্ঞান আবিষ্কারের একটি ঠিকানা।"
                : "A home for curious minds, shared ideas, and the joy of discovering science together."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="club-footer-join inline-flex items-center gap-2 rounded-lg border border-[#35c888] bg-[#35c888] px-4 py-2.5 text-sm font-semibold text-[#080b10]"
              >
                {t("Sign up")}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/login"
                className="club-footer-link rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium"
              >
                {t("Sign in")}
              </Link>
            </div>
          </div>
          <FooterMenu
            title={bn ? "আমাদের ক্লাব" : "Our club"}
            links={clubLinks}
            language={language}
          />
          <FooterMenu
            title={bn ? "অন্বেষণ করো" : "Discover"}
            links={discoverLinks}
            language={language}
          />
          <div>
            <h2 className="text-base font-semibold text-white">
              {bn ? "ক্লাবের সাথে থাকো" : "Stay connected"}
            </h2>
            <div className="mt-5 flex items-start gap-2.5 text-sm leading-7">
              <MapPin
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-[#35c888]"
              />
              <p>
                {t("Narsingdi Government College")}
                <br />
                {bn ? "নরসিংদী, বাংলাদেশ" : "Narsingdi, Bangladesh"}
              </p>
            </div>
            <p className="mt-4 text-sm leading-7">
              {bn
                ? "ক্লাবের নতুন খবর ও কার্যক্রমের ঘোষণা দেখো।"
                : "Keep up with club news and upcoming activities."}
            </p>
            <Link
              href="/announcements"
              className="club-footer-accent mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#35c888]"
            >
              {bn ? "সর্বশেষ ঘোষণা" : "Latest announcements"}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
            <nav
              aria-label={bn ? "ক্লাবের দ্রুত লিংক" : "Club quick links"}
              className="mt-6 flex flex-wrap gap-3"
            >
              {quickLinks.map(({ href, en, bn: labelBn, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-label={bn ? labelBn : en}
                  title={bn ? labelBn : en}
                  className="club-footer-quick inline-flex size-10 items-center justify-center rounded-lg border border-white/5 bg-[#121b29] text-[#e5eaf0]"
                >
                  <Icon aria-hidden="true" className="size-[18px]" />
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs leading-6 sm:mt-14">
          <p>
            © {t("NGC Science Club")}.{" "}
            {bn ? "সর্বস্বত্ব সংরক্ষিত।" : "All rights reserved."}
          </p>
          <p className="mt-1 text-[#8e99a7]">
            {bn
              ? "শেখা, সহযোগিতা এবং আবিষ্কারের জন্য।"
              : "Built for learning, collaboration, and discovery."}
          </p>
        </div>
      </div>
    </footer>
  );
}
