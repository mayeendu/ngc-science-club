"use client";

import { useT } from "@/components/i18n/language";
import { useLanguage } from "@/components/i18n/language";
import { setLanguage } from "@/lib/i18n/language";
import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import { messages, type Locale } from "@/lib/messages";
type ConnectionState = "checking" | "connected" | "failed";
function ConnectionStatus({ locale }: { locale: Locale }) {
  const [status, setStatus] = useState<ConnectionState>("checking");
  const [attempt, setAttempt] = useState(0);
  const text = messages[locale];
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    let active = true;
    checkHealth(controller.signal)
      .then(() => {
        if (active) setStatus("connected");
      })
      .catch(() => {
        if (active) setStatus("failed");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);
  return (
    <section
      aria-labelledby="connection-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
    >
      <h2 id="connection-heading" className="text-lg font-semibold">
        {text.connection}
      </h2>
      <p
        role="status"
        aria-live="polite"
        className={`mt-3 text-sm leading-6 ${status === "connected" ? "text-teal-800" : status === "failed" ? "text-red-800" : "text-slate-600"}`}
      >
        {text[status]}
      </p>
      <button
        type="button"
        disabled={status === "checking"}
        onClick={() => {
          setStatus("checking");
          setAttempt((value) => value + 1);
        }}
        className="mt-5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 disabled:opacity-60"
      >
        {text.retry}
      </button>
    </section>
  );
}
export function Foundation() {
  const t = useT();
  const locale = useLanguage();
  const setLocale = setLanguage;
  const text = messages[locale];
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <div
      lang={locale}
      className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-200 py-6">
        <div>
          <p className="font-bold tracking-tight text-blue-900">{text.title}</p>
          <p className="mt-1 text-sm text-slate-600">{text.college}</p>
        </div>
        <div
          role="group"
          aria-label={t("Language / \u09AD\u09BE\u09B7\u09BE")}
          className="flex gap-2"
        >
          {(["en", "bn"] as const).map((language) => (
            <button
              key={language}
              type="button"
              lang={language}
              aria-pressed={locale === language}
              onClick={() => setLocale(language)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 ${locale === language ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
            >
              {language === "en" ? t("English") : "বাংলা"}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 py-16 sm:py-24">
        <p className="text-sm font-semibold text-teal-800">{text.eyebrow}</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-blue-950 sm:text-6xl">
          {text.heading}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          {text.description}
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-blue-950">
              {text.foundation}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {text.foundationDescription}
            </p>
          </section>
          <ConnectionStatus locale={locale} />
        </div>
      </main>
      <footer className="border-t border-slate-200 py-6 text-sm text-slate-600">
        {text.footer}
      </footer>
    </div>
  );
}
