"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useT } from "@/components/i18n/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  createTeacherEntry,
  teacherEntrySchema,
  type TeacherEntry,
} from "@/lib/faculty-api";
import { ClubApiError } from "@/lib/club-api";
import toast from "@/lib/i18n/toast";

const fields = [
  { name: "name", label: "Full Name", max: 120 },
  { name: "designation", label: "Designation", max: 120 },
  { name: "department", label: "Department / Subject Name", max: 100 },
  { name: "bcsBatch", label: "BCS Batch", max: 40 },
  { name: "email", label: "Email", max: 254 },
  { name: "phone", label: "Mobile No.", max: 14 },
] as const;

export function AddTeacherForm() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm<TeacherEntry>({
    resolver: zodResolver(teacherEntrySchema),
    defaultValues: {
      name: "",
      designation: "",
      department: "",
      bcsBatch: "",
      email: "",
      phone: "",
    },
  });
  async function submit(values: TeacherEntry) {
    setError("");
    try {
      await createTeacherEntry(values);
      toast.success("Teacher saved.");
      router.push("/faculty");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save profile.",
      );
      if (cause instanceof ClubApiError && cause.status === 401)
        router.replace("/login");
    }
  }
  return (
    <main className="mx-auto max-w-[526px] px-4 py-8">
      <h1 className="mb-3 text-[28px] font-bold tracking-tight">
        {t("Add new teacher")}
      </h1>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(submit)}
          noValidate
          className="rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <fieldset
            disabled={form.formState.isSubmitting}
            className="min-w-0 space-y-3 disabled:opacity-70"
          >
            <legend className="sr-only">{t("Teacher details")}</legend>
            {fields.map((item) => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <FormLabel className="text-base font-semibold">
                      {t(item.label)}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={item.max}
                        type={
                          item.name === "email"
                            ? "email"
                            : item.name === "phone"
                              ? "tel"
                              : "text"
                        }
                        autoComplete={
                          item.name === "name"
                            ? "name"
                            : item.name === "email"
                              ? "email"
                              : item.name === "phone"
                                ? "tel"
                                : "off"
                        }
                        placeholder={`[${t(item.label)}]`}
                        className="h-12 rounded-lg border-neutral-400 bg-background px-3 text-base shadow-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {t(error, undefined, true)}
              </p>
            )}
            <div className="flex gap-3 pt-3">
              <Button
                type="submit"
                className="h-12 rounded-lg bg-teal-700 px-5 text-base font-semibold text-white hover:bg-teal-800"
              >
                {form.formState.isSubmitting && (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {t(form.formState.isSubmitting ? "Saving…" : "Save teacher")}
              </Button>
              <Link
                href="/faculty"
                className="inline-flex h-12 items-center rounded-lg border border-teal-700 px-5 text-base font-semibold text-teal-700"
              >
                {t("Cancel")}
              </Link>
            </div>
          </fieldset>
        </form>
      </Form>
    </main>
  );
}
