"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
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
function systemSnapshot() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function subscribeSystem(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function Appearance() {
  const t = useT(),
    theme = useSyncExternalStore(subscribe, snapshot, () => "system");
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    systemSnapshot,
    () => false,
  );
  const dark = theme === "dark" || (theme !== "light" && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);
  return (
    <button
      type="button"
      role="switch"
      aria-label={t("Appearance")}
      aria-checked={dark}
      title={dark ? t("Dark") : t("Light")}
      className={`relative inline-flex h-7 min-h-0! w-16 shrink-0 items-center rounded-full border p-0.5 shadow-[0_1px_4px_rgb(0_0_0/30%)] motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${dark ? "border-zinc-200 bg-white" : "border-[#303434] bg-[#303434]"}`}
      onClick={() => {
        memory = dark ? "light" : "dark";
        try {
          localStorage.setItem("ngc-theme", memory);
        } catch {
          /* Keep the current choice for this session. */
        }
        window.dispatchEvent(new Event("ngc-theme"));
      }}
    >
      <span
        aria-hidden="true"
        className={`flex size-5.5 shrink-0 items-center justify-center rounded-full motion-safe:transition-transform ${dark ? "translate-x-9 bg-black text-white" : "translate-x-0 bg-white text-[#20221e]"}`}
      >
        {dark ? (
          <Moon className="size-3.5 fill-current" strokeWidth={1.5} />
        ) : (
          <Sun className="size-3.5" strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}
