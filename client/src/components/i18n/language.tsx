"use client";
import { useEffect, useSyncExternalStore } from "react";
import {
  getLanguage,
  setLanguage,
  subscribeLanguage,
  translate,
  type Language,
} from "@/lib/i18n/language";
export function useLanguage() {
  return useSyncExternalStore(
    subscribeLanguage,
    getLanguage,
    () => "bn" as Language,
  );
}
export function useT() {
  const language = useLanguage();
  return (value: unknown, parameters?: unknown[], problem = false) =>
    translate(language, value, parameters, problem);
}
export function Translated({ text }: { text: string }) {
  const t = useT();
  return <>{t(text)}</>;
}
export function LanguageSettings() {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <div
      role="group"
      aria-label="ভাষা / Language"
      className={`relative inline-flex h-7 w-16 shrink-0 items-center justify-between rounded-full border p-0.5 shadow-[0_1px_4px_rgb(0_0_0/30%)] motion-safe:transition-colors ${language === "en" ? "border-zinc-200 bg-white" : "border-[#303434] bg-[#303434]"}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-0.5 top-0.5 size-5.5 rounded-full motion-safe:transition-transform ${language === "en" ? "translate-x-9 bg-black" : "translate-x-0 bg-white"}`}
      />
      {(["bn", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-label={option === "bn" ? "বাংলা" : "English"}
          aria-pressed={language === option}
          onClick={() => setLanguage(option)}
          className={`relative z-10 inline-flex size-5.5 min-h-0! shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${language === "en" ? (option === "en" ? "text-white" : "text-zinc-700") : option === "bn" ? "text-[#20221e]" : "text-white"}`}
        >
          {option === "bn" ? "BN" : "EN"}
        </button>
      ))}
    </div>
  );
}
