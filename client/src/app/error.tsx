"use client";
import { useT } from "@/components/i18n/language";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { const t = useT(); return <main className="mx-auto max-w-xl space-y-5 px-4 py-16"><h1 className="text-3xl font-bold">{t("Something went wrong")}</h1><p role="alert">{t("Please try again.")}</p><Button onClick={reset}>{t("Try again")}</Button></main>; }
