"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useT } from "@/components/i18n/language";
let memory: string | null = null;
function snapshot() {
  try {
    return localStorage.getItem("ngc-theme") ?? memory ?? "system";
  } catch {
    return memory ?? "system";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("ngc-theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ngc-theme", callback);
  };
}
export function Appearance() {
  const t = useT(),
    theme = useSyncExternalStore(subscribe, snapshot, () => "system");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme !== "light" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return (
    <label className="text-sm">
      {t("Appearance")}
      <select
        aria-label={t("Appearance")}
        className="ml-2 rounded border p-2"
        value={theme}
        onChange={(event) => {
          memory = event.target.value;
          try {
            localStorage.setItem("ngc-theme", memory);
          } catch {
            /* Keep the current choice for this session. */
          }
          window.dispatchEvent(new Event("ngc-theme"));
        }}
      >
        <option value="system">{t("System")}</option>
        <option value="light">{t("Light")}</option>
        <option value="dark">{t("Dark")}</option>
      </select>
    </label>
  );
}
