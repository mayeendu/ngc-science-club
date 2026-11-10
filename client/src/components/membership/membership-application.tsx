"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { useSession } from "@/lib/auth-client";
import { parseRole } from "@/lib/roles";
import {
  membershipSchema,
  type MembershipValues,
} from "@/lib/validations/membership";
import {
  MembershipApiError,
  membershipRequest,
  type MembershipSummary,
} from "@/lib/membership-api";
import { AccessDenied } from "@/components/auth/access-state";
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
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; application: MembershipSummary };
const fields = [
  {
    name: "fullName",
    label: "Full name",
    placeholder: "Your full name",
    max: 100,
  },
  {
    name: "studentId",
    label: "Student ID",
    placeholder: "Your college student ID",
    max: 40,
  },
  {
    name: "department",
    label: "Department",
    placeholder: "Your department",
    max: 100,
  },
  {
    name: "academicYear",
    label: "Academic year",
    placeholder: "e.g. 2026–2027",
    max: 40,
  },
  { name: "phone", label: "Phone", placeholder: "01712345678", max: 14 },
  {
    name: "reason",
    label: "Reason for joining",
    placeholder: "Tell us why you would like to join (20–1000 characters)",
    max: 1000,
  },
] as const;

function ApplicationContent({
  showForm,
  name,
}: {
  showForm: boolean;
  name: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const router = useRouter();
  const form = useForm<MembershipValues>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      fullName: name,
      studentId: "",
      department: "",
      academicYear: "",
      phone: "",
      reason: "",
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
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>
          <h2>Club membership</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {state.kind === "loading" ? (
          <p role="status">Loading application status…</p>
        ) : state.kind === "error" ? (
          <div>
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
              Retry membership status
            </Button>
          </div>
        ) : state.application ? (
          <div className="space-y-3">
            <p role="status" className="font-medium capitalize">
              Application status: {state.application.status}
            </p>
            <p className="text-slate-600">
              {state.application.status === "pending"
                ? "Your application is awaiting admin approval."
                : "Your application has been reviewed."}
            </p>
            <p className="text-sm text-slate-500">
              Submitted:{" "}
              {new Date(state.application.submittedAt).toLocaleDateString(
                "en-GB",
              )}
            </p>
            {state.application.rejectionReason && (
              <p className="whitespace-pre-wrap break-words text-red-700">
                Rejection reason: {state.application.rejectionReason}
              </p>
            )}
            {state.application.reviewedAt && (
              <p className="text-sm text-slate-500">
                Reviewed:{" "}
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
              Refresh membership status
            </Button>
            {state.application.status === "approved" && (
              <Link
                href="/dashboard/student/profile"
                className="block font-medium text-blue-700 underline"
              >
                Manage member profile
              </Link>
            )}
          </div>
        ) : showForm ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(submit)}
              className="space-y-5"
              noValidate
            >
              <p className="text-slate-600">
                Submit your student details for admin review. Applying does not
                automatically approve your membership.
              </p>
              <fieldset
                disabled={form.formState.isSubmitting}
                className="space-y-5"
              >
                <legend className="sr-only">
                  Membership application details
                </legend>
                {fields.map((item) => (
                  <FormField
                    key={item.name}
                    control={form.control}
                    name={item.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{item.label}</FormLabel>
                        <FormControl>
                          {item.name === "reason" ? (
                            <textarea
                              {...field}
                              rows={5}
                              maxLength={item.max}
                              placeholder={item.placeholder}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600"
                            />
                          ) : (
                            <Input
                              {...field}
                              placeholder={item.placeholder}
                              maxLength={item.max}
                              type={item.name === "phone" ? "tel" : "text"}
                              autoComplete={
                                item.name === "fullName"
                                  ? "name"
                                  : item.name === "phone"
                                    ? "tel"
                                    : "off"
                              }
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting
                    ? "Submitting…"
                    : "Submit application"}
                </Button>
              </fieldset>
            </form>
          </Form>
        ) : (
          <div className="space-y-3">
            <p>You have not applied for club membership yet.</p>
            <Link
              className="font-medium text-blue-700 underline"
              href="/membership/apply"
            >
              Apply for membership
            </Link>
          </div>
        )}
        {showForm && (
          <Link
            href="/dashboard/student"
            className="mt-6 inline-block text-sm text-blue-700 underline"
          >
            Back to student dashboard
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
