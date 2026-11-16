"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useLanguage } from "@/components/i18n/language";
import {
  BlogApiError,
  blogCategories,
  blogFormSchema,
  blogPermission,
  publishMemberBlog,
  type BlogInput,
} from "@/lib/blog-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WriteBlog() {
  const bn = useLanguage() === "bn";
  const { data, isPending, error: sessionError, refetch } = useSession();
  const router = useRouter();
  const [access, setAccess] = useState<{ id: string; status: number }>({
    id: "",
    status: 0,
  });
  const [revision, setRevision] = useState(0);
  const [failure, setFailure] = useState(0);
  const busy = useRef(false);
  const form = useForm<BlogInput>({
    resolver: zodResolver(blogFormSchema),
    defaultValues: { title: "", category: "General Science", body: "" },
  });
  const accountId = data?.user.id;
  useEffect(() => {
    if (!accountId || isPending || sessionError) return;
    const controller = new AbortController();
    blogPermission(controller.signal)
      .then(() => {
        if (!controller.signal.aborted)
          setAccess({ id: accountId, status: 200 });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setAccess({
            id: accountId,
            status: cause instanceof BlogApiError ? cause.status : 500,
          });
      });
    return () => controller.abort();
  }, [accountId, isPending, sessionError, revision]);
  const heading = bn ? "ব্লগ লিখুন" : "Write Blog";
  const signin = (
    <Link
      href="/login?next=/blog/write"
      className="inline-block rounded bg-blue-700 px-5 py-2.5 font-semibold text-white"
    >
      {bn ? "ব্লগ লিখতে সাইন ইন করুন" : "Sign in to write a blog"}
    </Link>
  );
  const status = access.id === accountId ? access.status : 0;
  return (
    <main className="mx-auto min-h-[70vh] max-w-3xl px-5 py-12">
      <Link
        href="/blog"
        className="mb-6 inline-block text-sm text-blue-700 underline"
      >
        {bn ? "ব্লগে ফিরে যান" : "Back to blog"}
      </Link>
      <h1 className="text-3xl font-bold">{heading}</h1>
      <p className="mb-8 mt-3 text-sm leading-7 text-slate-600">
        {bn
          ? "আপনার বিজ্ঞানের ভাবনা, পরীক্ষা ও অভিজ্ঞতা সবার সাথে ভাগ করুন। প্রকাশের পর লেখাটি সবাই পড়তে পারবে।"
          : "Share your scientific ideas, experiments, and experiences. Published posts can be read by everyone."}
      </p>
      {isPending ? (
        <p role="status">
          {bn ? "অ্যাকাউন্ট যাচাই হচ্ছে…" : "Checking your account…"}
        </p>
      ) : sessionError ? (
        <div role="alert">
          <p>
            {bn
              ? "অ্যাকাউন্ট যাচাই করা যায়নি।"
              : "Unable to verify your account."}
          </p>
          <Button onClick={() => void refetch()}>
            {bn ? "আবার চেষ্টা করুন" : "Retry account"}
          </Button>
        </div>
      ) : !data || status === 401 ? (
        signin
      ) : status === 0 ? (
        <p role="status">
          {bn ? "সদস্যপদ যাচাই হচ্ছে…" : "Checking membership…"}
        </p>
      ) : status === 403 ? (
        <div role="alert" className="rounded-xl border bg-white p-6">
          <h2 className="text-xl font-semibold">
            {bn ? "অনুমোদিত সদস্যপদ প্রয়োজন" : "Approved membership required"}
          </h2>
          <p className="my-3 text-slate-600">
            {bn
              ? "সদস্যপদ অনুমোদনের পর আপনি ব্লগ প্রকাশ করতে পারবেন।"
              : "You can publish a blog after your membership is approved."}
          </p>
          <Link href="/membership/apply" className="text-blue-700 underline">
            {bn ? "সদস্যপদের আবেদন দেখুন" : "View membership application"}
          </Link>
        </div>
      ) : status !== 200 ? (
        <div role="alert">
          <p>
            {bn
              ? "লেখার অনুমতি যাচাই করা যায়নি।"
              : "Unable to check writing permission."}
          </p>
          <Button
            onClick={() => {
              setAccess({ id: accountId ?? "", status: 0 });
              setRevision((value) => value + 1);
            }}
          >
            {bn ? "আবার চেষ্টা করুন" : "Retry permission"}
          </Button>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-8"
          onSubmit={(event) => {
            void form.handleSubmit(async (input) => {
              if (busy.current) return;
              busy.current = true;
              setFailure(0);
              try {
                const post = await publishMemberBlog(input);
                router.push(`/blog/${post.id}`);
              } catch (cause) {
                setFailure(cause instanceof BlogApiError ? cause.status : 500);
              } finally {
                busy.current = false;
              }
            })(event);
          }}
        >
          <div>
            <label
              htmlFor="blog-title"
              className="mb-2 block text-sm font-semibold"
            >
              {bn ? "শিরোনাম" : "Title"}
            </label>
            <Input
              id="blog-title"
              maxLength={150}
              aria-invalid={!!form.formState.errors.title}
              aria-describedby={
                form.formState.errors.title ? "blog-title-error" : undefined
              }
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p
                id="blog-title-error"
                role="alert"
                className="mt-1 text-sm text-red-700"
              >
                {bn
                  ? "শিরোনাম ৩–১৫০ অক্ষরের হতে হবে।"
                  : "Title must contain 3–150 characters."}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="blog-category"
              className="mb-2 block text-sm font-semibold"
            >
              {bn ? "বিষয়" : "Category"}
            </label>
            <select
              id="blog-category"
              {...form.register("category")}
              className="w-full rounded-lg border bg-white px-3 py-2"
            >
              {blogCategories.map((category, index) => (
                <option key={category} value={category}>
                  {bn
                    ? [
                        "পদার্থবিজ্ঞান",
                        "রসায়ন",
                        "গণিত",
                        "জীববিজ্ঞান",
                        "পরিবেশ",
                        "সাধারণ বিজ্ঞান",
                      ][index]
                    : category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="blog-body"
              className="mb-2 block text-sm font-semibold"
            >
              {bn ? "আপনার লেখা" : "Your article"}
            </label>
            <textarea
              id="blog-body"
              rows={14}
              maxLength={10000}
              aria-invalid={!!form.formState.errors.body}
              aria-describedby={
                form.formState.errors.body
                  ? "blog-body-help blog-body-error"
                  : "blog-body-help"
              }
              {...form.register("body")}
              className="w-full rounded-lg border bg-white p-3 text-sm leading-7"
            />
            <p id="blog-body-help" className="mt-1 text-xs text-slate-500">
              {bn
                ? "৫০–১০,০০০ অক্ষর। অনুচ্ছেদ আলাদা করতে ফাঁকা লাইন দিন।"
                : "50–10,000 characters. Use blank lines to separate paragraphs."}
            </p>
            {form.formState.errors.body && (
              <p
                id="blog-body-error"
                role="alert"
                className="mt-1 text-sm text-red-700"
              >
                {bn
                  ? "লেখা ৫০–১০,০০০ অক্ষরের হতে হবে।"
                  : "Article must contain 50–10,000 characters."}
              </p>
            )}
          </div>
          {failure > 0 && (
            <div role="alert" className="text-sm text-red-700">
              <p>
                {failure === 403
                  ? bn
                    ? "আপনার সদস্যপদ বা অনুমতি বদলেছে। প্রকাশের অনুমতি নেই।"
                    : "Your membership or permissions changed. You cannot publish this post."
                  : failure === 401
                    ? bn
                      ? "সেশন শেষ হয়েছে। আবার সাইন ইন করুন।"
                      : "Your session expired. Please sign in again."
                    : failure === 429
                      ? bn
                        ? "অনেক অনুরোধ হয়েছে। একটু পরে আবার চেষ্টা করুন।"
                        : "Too many requests. Please wait before trying again."
                      : bn
                        ? "ব্লগ প্রকাশ করা যায়নি। আপনার লেখা রাখা আছে, আবার চেষ্টা করুন।"
                        : "Unable to publish your blog. Your text is still here; please try again."}
              </p>
              {failure === 401 && signin}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? bn
                  ? "প্রকাশ হচ্ছে…"
                  : "Publishing…"
                : bn
                  ? "ব্লগ প্রকাশ করুন"
                  : "Publish blog"}
            </Button>
            <Link href="/blog" className="rounded-lg border px-4 py-2 text-sm">
              {bn ? "বাতিল" : "Cancel"}
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
