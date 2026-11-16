"use client";

import { useT } from "@/components/i18n/language";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "@/lib/i18n/toast";
import { useSession } from "@/lib/auth-client";
import { parseRole } from "@/lib/roles";
import {
  membershipFormSchema,
  type MembershipValues,
} from "@/lib/validations/membership";
import {
  MembershipApiError,
  membershipRequest,
  type MembershipSummary,
} from "@/lib/membership-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
export function MembershipApplication({
  showForm = false,
}: {
  showForm?: boolean;
}) {
  const { data } = useSession();
  const canApply = !!data && parseRole(data.user.role) === "student";
  if (!showForm && !canApply) return null;
  return (
    <ApplicationContent
      key={`${data?.user.id ?? "guest"}:${canApply}`}
      showForm={showForm}
      name={data?.user.name ?? ""}
      canApply={canApply}
      signedIn={!!data}
    />
  );
}
type State =
  | {
      kind: "loading";
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "loaded";
      application: MembershipSummary;
    };
const sections = [
  {
    title: "Academic Information",
    columns: 3,
    fields: [
      { name: "fullName", label: "Full Name", max: 100 },
      { name: "studentId", label: "Roll No.", max: 40 },
      { name: "section", label: "Section", max: 60 },
    ],
  },
  {
    title: "Contact Information",
    columns: 3,
    fields: [
      { name: "email", label: "Email", max: 254 },
      { name: "phone", label: "Mobile No.", max: 14 },
      { name: "whatsappPhone", label: "WhatsApp No.", max: 14 },
    ],
  },
  {
    title: "Guide Teacher Information",
    columns: 2,
    fields: [
      { name: "guideTeacher", label: "Guide Teacher Name", max: 100 },
      { name: "guideTeacherSubject", label: "Guide Teacher Subject", max: 100 },
    ],
  },
  {
    title: "Academic Background",
    columns: 3,
    fields: [
      { name: "sscGpa", label: "SSC GPA", max: 4 },
      { name: "optionalSubject", label: "Optional Subject", max: 100 },
      { name: "admissionGoal", label: "Admission Goal", max: 150 },
    ],
  },
  {
    title: "Exam Result",
    columns: 4,
    fields: [
      { name: "halfYearlyResult", label: "Half Yearly", max: 100 },
      { name: "yearFinalResult", label: "Year Final", max: 100 },
      { name: "preTestResult", label: "Pre-Test", max: 100 },
      { name: "testResult", label: "Test", max: 100 },
    ],
  },
  {
    title: "Address",
    columns: 1,
    fields: [{ name: "presentAddress", label: "Present Address", max: 1000 }],
  },
] as const;
function ApplicationContent({
  showForm,
  name,
  canApply,
  signedIn,
}: {
  showForm: boolean;
  name: string;
  canApply: boolean;
  signedIn: boolean;
}) {
  const t = useT();
  const [state, setState] = useState<State>(
    canApply ? { kind: "loading" } : { kind: "loaded", application: null },
  );
  const router = useRouter();
  const form = useForm<MembershipValues>({
    resolver: zodResolver(membershipFormSchema),
    defaultValues: {
      fullName: name,
      studentId: "",
      section: "",
      email: "",
      phone: "",
      whatsappPhone: "",
      guideTeacher: "",
      guideTeacherSubject: "",
      sscGpa: "",
      optionalSubject: "",
      admissionGoal: "",
      halfYearlyResult: "",
      yearFinalResult: "",
      preTestResult: "",
      testResult: "",
      presentAddress: "",
    },
  });
  const load = useCallback(
    (signal?: AbortSignal) =>
      membershipRequest(undefined, signal)
        .then((application) => {
          if (!signal?.aborted) setState({ kind: "loaded", application });
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          if (error instanceof MembershipApiError && error.status === 401)
            router.replace("/login");
          setState({
            kind: "error",
            message:
              error instanceof MembershipApiError
                ? error.message
                : "Unable to load membership status. Please try again.",
          });
        }),
    [router],
  );
  useEffect(() => {
    if (!canApply) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, canApply]);
  async function submit(values: MembershipValues) {
    if (!signedIn) {
      router.push("/login?next=%2Fmembership%2Fapply");
      return;
    }
    if (!canApply) {
      toast.error("Only student accounts can apply.");
      return;
    }
    try {
      const application = await membershipRequest(values);
      setState({ kind: "loaded", application });
      toast.success("Application submitted. Awaiting admin approval.");
    } catch (error) {
      toast.error(
        error instanceof MembershipApiError
          ? error.message
          : "Unable to submit your application. Please try again.",
      );
      if (error instanceof MembershipApiError) {
        if (error.status === 401) router.replace("/login");
        if (error.status === 409) await load();
      }
    }
  }
  return (
    <Card
      className={
        showForm
          ? "gap-0 border-0 bg-transparent py-0 shadow-none ring-0"
          : "rounded-2xl border border-border bg-card shadow-sm ring-0"
      }
    >
      <CardHeader className={showForm ? "sr-only" : ""}>
        <CardTitle>
          <h2>{t("Club membership")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className={showForm ? "p-0" : ""}>
        {state.kind === "loading" ? (
          <p
            role="status"
            className="flex items-center gap-3 rounded-xl bg-muted/50 p-4 text-muted-foreground"
          >
            <LoaderCircle
              aria-hidden="true"
              className="size-4 motion-safe:animate-spin"
            />
            {t("Loading application status\u2026")}
          </p>
        ) : state.kind === "error" ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
            <p role="alert" className="mb-3 text-red-700">
              {state.message}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setState({ kind: "loading" });
                void load();
              }}
            >
              {t("Retry membership status")}
            </Button>
          </div>
        ) : state.application ? (
          <div className="space-y-4 rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
            <p
              role="status"
              className="inline-flex rounded-full border border-teal-600/20 bg-teal-50 px-3 py-1 text-sm font-semibold capitalize text-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
            >
              {t("Application status:")} {t(state.application.status)}
            </p>
            <p className="text-muted-foreground">
              {state.application.status === "pending"
                ? t("Your application is awaiting admin approval.")
                : t("Your application has been reviewed.")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("Submitted:")}{" "}
              {new Date(state.application.submittedAt).toLocaleDateString(
                "en-GB",
              )}
            </p>
            {state.application.rejectionReason && (
              <p className="whitespace-pre-wrap wrap-break-word text-red-700">
                {t("Rejection reason:")} {state.application.rejectionReason}
              </p>
            )}
            {state.application.reviewedAt && (
              <p className="text-sm text-muted-foreground">
                {t("Reviewed:")}{" "}
                {new Date(state.application.reviewedAt).toLocaleDateString(
                  "en-GB",
                )}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setState({ kind: "loading" });
                void load();
              }}
            >
              {t("Refresh membership status")}
            </Button>
            {state.application.status === "approved" && (
              <Link
                href="/dashboard/student/profile"
                className="block font-medium text-blue-700 underline"
              >
                {t("Manage member profile")}
              </Link>
            )}
          </div>
        ) : showForm ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(submit)}
              className="space-y-7"
              noValidate
            >
              {!canApply && (
                <p className="text-sm text-muted-foreground">
                  {signedIn ? (
                    t("Only student accounts can apply.")
                  ) : (
                    <Link
                      href="/login?next=%2Fmembership%2Fapply"
                      className="text-teal-700 underline"
                    >
                      {t("Sign in to apply for membership")}
                    </Link>
                  )}
                </p>
              )}
              <fieldset
                disabled={form.formState.isSubmitting}
                className="min-w-0 space-y-5 disabled:opacity-70"
              >
                <legend className="sr-only">
                  {t("Membership application details")}
                </legend>
                {sections.map((section, index) => (
                  <section
                    key={section.title}
                    aria-labelledby={`membership-section-${index}`}
                    className={
                      section.title === "Exam Result"
                        ? "-mt-5 rounded-b-xl border border-t-0 border-border bg-card px-5 pb-5"
                        : `space-y-4 rounded-xl border border-border bg-card p-5 ${section.title === "Academic Background" ? "rounded-b-none border-b-0" : ""}`
                    }
                  >
                    <h2
                      id={`membership-section-${index}`}
                      className="mb-4 text-lg font-semibold"
                    >
                      {t(section.title)}
                    </h2>
                    <div
                      className={`grid gap-4 ${section.columns === 4 ? "sm:grid-cols-4" : section.columns === 3 ? "sm:grid-cols-3" : section.columns === 2 ? "sm:grid-cols-2" : ""}`}
                    >
                      {section.fields.map((item) => (
                        <FormField
                          key={item.name}
                          control={form.control}
                          name={item.name}
                          render={({ field }) => (
                            <FormItem className="min-w-0 gap-1">
                              <FormLabel>{t(item.label)}</FormLabel>
                              <FormControl>
                                {item.name === "presentAddress" ? (
                                  <textarea
                                    {...field}
                                    placeholder={`[${t(item.label)}]`}
                                    maxLength={item.max}
                                    className="min-h-20 w-full rounded-lg border border-slate-400 bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring"
                                  />
                                ) : (
                                  <Input
                                    {...field}
                                    placeholder={`[${t(item.label)}]`}
                                    maxLength={item.max}
                                    type={
                                      item.name === "email"
                                        ? "email"
                                        : item.name
                                              .toLowerCase()
                                              .includes("phone")
                                          ? "tel"
                                          : "text"
                                    }
                                    inputMode={
                                      item.name === "sscGpa"
                                        ? "decimal"
                                        : undefined
                                    }
                                    autoComplete={
                                      item.name === "fullName"
                                        ? "name"
                                        : item.name === "email"
                                          ? "email"
                                          : "off"
                                    }
                                    className="h-11 rounded-lg border-slate-400 bg-background px-3 text-base shadow-none"
                                  />
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    className="h-11 rounded-lg bg-teal-700 px-5 text-white hover:bg-teal-800"
                  >
                    {form.formState.isSubmitting && (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    )}
                    {form.formState.isSubmitting
                      ? t("Submitting…")
                      : t("Save member")}
                  </Button>
                  <Link
                    href="/dashboard/student"
                    className="inline-flex h-11 items-center rounded-lg border border-teal-700 px-5 font-medium text-teal-700"
                  >
                    {t("Cancel")}
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Submit your student details for admin review. Applying does not automatically approve your membership.",
                  )}
                </p>
              </fieldset>
            </form>
          </Form>
        ) : (
          <div className="space-y-3">
            <p>{t("You have not applied for club membership yet.")}</p>
            <Link
              className="font-medium text-blue-700 underline"
              href="/membership/apply"
            >
              {t("Apply for membership")}
            </Link>
          </div>
        )}
        {showForm && (
          <Link
            href="/dashboard/student"
            className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("Back to student dashboard")}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
