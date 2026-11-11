"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "@/lib/i18n/toast";
import { useSession } from "@/lib/auth-client";
import {
  memberProfileSchema,
  ownMemberProfile,
  MemberProfileError,
  type OwnMemberProfile,
  type MemberProfileValues,
} from "@/lib/member-profile-api";
import { membershipDate } from "@/lib/member-api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
export function MemberProfileEditor() {
  const { data } = useSession();
  return data ? (
    <ProfileLoader key={data.user.id} userId={data.user.id} />
  ) : null;
}
function ProfileLoader({ userId }: { userId: string }) {
  const t = useT();
  const [profile, setProfile] = useState<OwnMemberProfile | null>(null);
  const [error, setError] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    ownMemberProfile(undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setProfile(data);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof MemberProfileError && cause.status === 401)
          router.replace("/login");
        setError(cause instanceof MemberProfileError ? cause.status : 500);
      });
    return () => controller.abort();
  }, [revision, router]);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("My member profile")}</h1>
      <Link
        href="/dashboard/student"
        className="inline-block text-blue-700 underline"
      >
        {t("Back to student dashboard")}
      </Link>
      {profile && !error && (
        <Link
          href={`/members/${userId}`}
          className="ml-4 inline-block text-blue-700 underline"
        >
          {t("View public profile")}
        </Link>
      )}
      {error ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <p role="alert">
              {error === 403
                ? t(
                    "An approved student membership is required to manage a profile.",
                  )
                : t("Unable to load your member profile. Please try again.")}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setProfile(null);
                setRevision((value) => value + 1);
              }}
            >
              {t("Retry profile")}
            </Button>
          </CardContent>
        </Card>
      ) : !profile ? (
        <p role="status">{t("Loading member profile\u2026")}</p>
      ) : (
        <ProfileForm
          profile={profile}
          onSave={setProfile}
          onDenied={(status) => {
            setProfile(null);
            setError(status);
          }}
        />
      )}
    </main>
  );
}
const fields = [
  { name: "fullName", label: "Full name", max: 100 },
  { name: "phone", label: "Phone", max: 14 },
  { name: "department", label: "Department", max: 100 },
  { name: "academicYear", label: "Academic year", max: 40 },
] as const;
function ProfileForm({
  profile,
  onSave,
  onDenied,
}: {
  profile: OwnMemberProfile;
  onSave: (profile: OwnMemberProfile) => void;
  onDenied: (status: number) => void;
}) {
  const t = useT();
  const router = useRouter();
  const form = useForm<MemberProfileValues>({
    resolver: zodResolver(memberProfileSchema),
    defaultValues: {
      fullName: profile.fullName,
      phone: profile.phone,
      department: profile.department,
      academicYear: profile.academicYear,
    },
  });
  async function submit(values: MemberProfileValues) {
    try {
      const updated = await ownMemberProfile(values);
      onSave(updated);
      form.reset({
        fullName: updated.fullName,
        phone: updated.phone,
        department: updated.department,
        academicYear: updated.academicYear,
      });
      toast.success("Member profile updated.");
    } catch (cause) {
      toast.error(
        cause instanceof MemberProfileError
          ? cause.message
          : "Unable to save your profile. Please try again.",
      );
      if (
        cause instanceof MemberProfileError &&
        (cause.status === 401 || cause.status === 403)
      ) {
        onDenied(cause.status);
        if (cause.status === 401) router.replace("/login");
      }
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl">{t("Member details")}</h2>
        </CardTitle>
        <p className="text-sm text-slate-600">
          {t(
            "Your name, department and academic year appear in the public directory. Your phone stays private.",
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-slate-600">{t("Membership status")}</dt>
            <dd className="font-medium capitalize">{t(profile.status)}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">{t("Joining date")}</dt>
            <dd>{membershipDate(profile.membershipDate)}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">
              {t("Student ID (read only)")}
            </dt>
            <dd className="break-words">
              {profile.studentId || "Not recorded"}
            </dd>
          </div>
        </dl>
        <div>
          <label
            htmlFor="profile-completion"
            className="mb-2 block text-sm font-medium"
          >
            {t("Profile completion:")} {profile.completion}%
          </label>
          <progress
            id="profile-completion"
            value={profile.completion}
            max={100}
            className="h-3 w-full accent-teal-600"
          />
          <p className="mt-1 text-xs text-slate-500">
            {t("Based on the four editable fields in your saved profile.")}
          </p>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(submit)}
            noValidate
            className="space-y-5"
          >
            <fieldset
              disabled={form.formState.isSubmitting}
              className="grid gap-5 sm:grid-cols-2"
            >
              <legend className="sr-only">{t("Edit member profile")}</legend>
              {fields.map((item) => (
                <FormField
                  key={item.name}
                  control={form.control}
                  name={item.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{item.label}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </fieldset>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? t("Saving profile\u2026")
                : t("Save profile")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
