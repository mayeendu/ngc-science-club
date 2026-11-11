import { Translated } from "@/components/i18n/language";
export function PageSkeleton() {
  return (
    <div role="status" className="mx-auto max-w-6xl space-y-6 p-6">
      <span className="sr-only">
        <Translated text="Loading page…" />
      </span>
      <div aria-hidden="true" className="motion-safe:animate-pulse space-y-6">
        <div className="h-10 w-2/3 rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-40 rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    </div>
  );
}
