import dictionary from "./bn.json";
export type Language = "bn" | "en";
export const LANGUAGE_KEY = "ngc-language";
let temporary: Language | undefined;
let storageUnavailable = false;
export function getLanguage(): Language {
  if (typeof window === "undefined") return "bn";
  if (storageUnavailable) return temporary ?? "bn";
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    return saved === "en" ? "en" : "bn";
  } catch {
    storageUnavailable = true;
    return temporary ?? "bn";
  }
}
export function setLanguage(language: Language) {
  temporary = language;
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event("ngc-language-change"));
}
export function subscribeLanguage(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_KEY || event.key === null) callback();
  };
  window.addEventListener("ngc-language-change", callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("ngc-language-change", callback);
    window.removeEventListener("storage", storage);
  };
}
export function translate(
  language: Language,
  value: unknown,
  parameters: unknown[] = [],
  problem = false,
): string {
  if (value == null) return "";
  const source = String(value);
  const translated = Object.hasOwn(dictionary, source)
    ? (dictionary as Record<string, string>)[source]
    : undefined;
  let text =
    language === "bn" && typeof translated === "string" ? translated : source;
  if (language === "bn" && text === source) {
    if (problem && /[A-Za-z]/.test(source))
      text = "অনুরোধটি সম্পন্ন করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।";
    if (
      /^Too small:|^Too big:|^Invalid input:|^Invalid string:|^Invalid option:|^Invalid email|^Invalid URL|^Invalid ISO/.test(
        source,
      )
    )
      text = "ঘরটির তথ্য সঠিকভাবে পূরণ করুন।";
  }
  // User content is substituted after translation and is never used as a dictionary key.
  return text.replace(/\{(\d+)\}/g, (match, index: string) =>
    Number(index) < parameters.length
      ? String(parameters[Number(index)] ?? "")
      : match,
  );
}
