"use client";

import { useT } from "@/components/i18n/language";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  LoaderCircle,
} from "lucide-react";
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
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
import { ClubLogo } from "@/components/layout/club-logo";
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
  if (!data) return null;
  if (parseRole(data.user.role) !== "student")
    return showForm ? <AccessDenied /> : null;
  return (
    <ApplicationContent
      key={data.user.id}
      showForm={showForm}
      name={data.user.name}
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
const fields = [
  { name: "fullName", label: "Full Name In English", max: 100 },
  { name: "studentId", label: "Class Roll", max: 40 },
  { name: "academicYear", label: "Session", max: 40 },
  { name: "sscGpa", label: "SSC GPA", max: 4 },
  { name: "sscRegistration", label: "SSC Reg No.", max: 20 },
  {
    name: "section",
    label: "Section",
    options: ["Science 1", "Science 2", "Science 3"],
  },
  { name: "phone", label: "Mobile No.", max: 14 },
  { name: "guardianPhone", label: "Father's / Mother's Mobile No.", max: 14 },
  { name: "whatsappPhone", label: "WhatsApp No.", max: 14 },
  { name: "guideTeacher", label: "Guide Teacher's Name", max: 100 },
  {
    name: "optionalSubject",
    label: "Optional Subject",
    options: ["Math", "Biology"],
  },
  {
    name: "residence",
    label: "Student's Residence",
    options: ["College Hostel", "Others"],
  },
  {
    name: "admissionGoal",
    label: "Admission Goal",
    options: ["Medical", "Engineering", "University"],
  },
  { name: "signature", label: "Signature", max: 100 },
] as const;
const sections = [
  { title: "Student details", start: 0, end: 6 },
  { title: "Contact details", start: 6, end: 10 },
  { title: "Preferences and signature", start: 10, end: 14 },
] as const;
function ApplicationContent({
  showForm,
  name,
}: {
  showForm: boolean;
  name: string;
}) {
  const t = useT();
  const [state, setState] = useState<State>({ kind: "loading" });
  const router = useRouter();
  const form = useForm<MembershipValues>({
    resolver: zodResolver(membershipFormSchema),
    defaultValues: {
      fullName: name,
      studentId: "",
      department: "Science",
      academicYear: "",
      phone: "",
      reason: "Science club membership application.",
      sscGpa: "",
      sscRegistration: "",
      guardianPhone: "",
      whatsappPhone: "",
      guideTeacher: "",
      signature: "",
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
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function submit(values: MembershipValues) {
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
          ? "gap-0 overflow-hidden rounded-3xl border border-border bg-card py-0 shadow-xl shadow-slate-900/5 ring-0"
          : "rounded-2xl border border-border bg-card shadow-sm ring-0"
      }
    >
      {showForm && (
        <div className="brand-hero flex items-center gap-4 border-b px-5 py-7 sm:gap-5 sm:px-9 sm:py-9">
          <div className="brand-logo-plate w-16 shrink-0 rounded-2xl border border-white/80 p-2 shadow-sm sm:w-20">
            <ClubLogo decorative sizes="80px" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {t("Club membership")}
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {t("To apply for membership complete the form below")}
            </p>
          </div>
        </div>
      )}
      <CardHeader className={showForm ? "sr-only" : ""}>
        <CardTitle>
          <h2>{t("Club membership")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className={showForm ? "p-5 sm:p-9" : ""}>
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
              <p className="whitespace-pre-wrap break-words text-red-700">
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
              <p className="flex gap-3 rounded-2xl border border-teal-600/15 bg-teal-50/60 p-4 text-sm leading-relaxed text-muted-foreground dark:bg-teal-950/20">
                <ClipboardCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-teal-700 dark:text-teal-300"
                />
                {t(
                  "Submit your student details for admin review. Applying does not automatically approve your membership.",
                )}
              </p>
              <fieldset
                disabled={form.formState.isSubmitting}
                className="min-w-0 space-y-8 disabled:opacity-70"
              >
                <legend className="sr-only">
                  {t("Membership application details")}
                </legend>
                {sections.map((section, index) => (
                  <section
                    key={section.title}
                    className="space-y-5"
                    aria-labelledby={`membership-section-${section.start}`}
                  >
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3
                        id={`membership-section-${section.start}`}
                        className="text-base font-semibold tracking-tight text-foreground"
                      >
                        {t(section.title)}
                      </h3>
                    </div>
                    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                      {fields.slice(section.start, section.end).map((item) => (
                        <FormField
                          key={item.name}
                          control={form.control}
                          name={item.name}
                          render={({ field }) => (
                            <FormItem
                              className={
                                item.name === "fullName" ||
                                item.name === "section" ||
                                item.name === "admissionGoal" ||
                                item.name === "signature"
                                  ? "min-w-0 sm:col-span-2"
                                  : "min-w-0"
                              }
                            >
                              <FormLabel className="text-sm font-medium text-foreground">
                                {t(item.label)}
                              </FormLabel>
                              {"options" in item ? (
                                <FormControl>
                                  <div
                                    role="radiogroup"
                                    aria-label={t(item.label)}
                                    className="grid gap-2.5 aria-invalid:rounded-xl aria-invalid:outline aria-invalid:outline-destructive sm:grid-flow-col sm:auto-cols-fr"
                                  >
                                    {item.options.map((option) => (
                                      <label
                                        key={option}
                                        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 has-checked:border-primary has-checked:bg-primary/5 has-checked:text-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-disabled:cursor-not-allowed"
                                      >
                                        <input
                                          type="radio"
                                          name={field.name}
                                          value={option}
                                          checked={field.value === option}
                                          onChange={() =>
                                            field.onChange(option)
                                          }
                                          onBlur={field.onBlur}
                                          ref={field.ref}
                                          className="size-4 shrink-0 accent-primary"
                                        />
                                        {t(option)}
                                      </label>
                                    ))}
                                  </div>
                                </FormControl>
                              ) : (
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    maxLength={item.max}
                                    type={
                                      item.name.toLowerCase().includes("phone")
                                        ? "tel"
                                        : "text"
                                    }
                                    className="h-12 rounded-xl border-border bg-background px-4 text-base shadow-xs transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/15 md:text-sm"
                                    autoComplete={
                                      item.name === "fullName" ? "name" : "off"
                                    }
                                    inputMode={
                                      item.name === "sscGpa"
                                        ? "decimal"
                                        : item.name === "sscRegistration"
                                          ? "numeric"
                                          : undefined
                                    }
                                  />
                                </FormControl>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                    {t(
                      "Date is recorded automatically when you submit. Type your full name as your signature.",
                    )}
                  </p>
                  <Button
                    type="submit"
                    className="h-12 w-full shrink-0 gap-2 rounded-xl px-6 font-semibold shadow-sm sm:w-auto"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting && (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 motion-safe:animate-spin"
                      />
                    )}
                    {form.formState.isSubmitting
                      ? t("Submitting\u2026")
                      : t("Submit application")}
                    {!form.formState.isSubmitting && (
                      <ArrowRight aria-hidden="true" className="size-4" />
                    )}
                  </Button>
                </div>
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
