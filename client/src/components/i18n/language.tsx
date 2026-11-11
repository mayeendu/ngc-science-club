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
    <label className="inline-flex items-center gap-2 text-sm">
      <span>ভাষা / Language</span>
      <select
        aria-label="ভাষা / Language"
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="rounded border bg-white px-2 py-1"
      >
        <option value="bn" lang="bn">
          বাংলা
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
    </label>
  );
}
