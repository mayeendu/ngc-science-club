"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AssessmentError,
  studentQuizzes,
  type SafeQuiz,
} from "@/lib/assessment-api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export function StudentQuizzes() {
  const t = useT();
  const [data, setData] = useState<{
      quizzes: SafeQuiz[];
      hasNext: boolean;
    } | null>(null),
    [error, setError] = useState("");
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    studentQuizzes(page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof AssessmentError && cause.status === 401)
          router.replace("/login");
        setError(
          cause instanceof AssessmentError
            ? cause.message
            : "Unable to load quizzes.",
        );
      });
    return () => controller.abort();
  }, [page, revision, router]);
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("Science quizzes")}</h1>
      <p className="text-slate-600">
        {t(
          "Published quizzes for approved club members. One attempt per quiz.",
        )}
      </p>
      <Link
        href="/dashboard/student/results"
        className="text-blue-700 underline"
      >
        {t("My results and performance")}
      </Link>
      <Button
        variant="outline"
        className="ml-4"
        onClick={() => {
          setData(null);
          setError("");
          setRevision((value) => value + 1);
        }}
      >
        {t("Refresh quizzes")}
      </Button>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <p role="status">{t("Loading available quizzes\u2026")}</p>
      ) : data.quizzes.length === 0 ? (
        <p role="status">{t("No open published quizzes are available.")}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.quizzes.map((quiz) => (
            <Card key={quiz.id}>
              <CardHeader>
                <CardTitle>
                  <h2 className="break-words text-xl">{quiz.title}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-600">{quiz.subject}</p>
                <p>
                  {quiz.questionCount} {t("questions \u00B7")}{" "}
                  {quiz.durationMinutes} {t("minutes \u00B7")} {quiz.totalMarks}{" "}
                  {t("marks")}
                </p>
                <Link
                  href={`/dashboard/student/quizzes/${quiz.id}`}
                  className="text-blue-700 underline"
                >
                  {t("View quiz")}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {data && (
        <nav className="flex items-center gap-4" aria-label={t("Quiz pages")}>
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => {
              setData(null);
              setPage((value) => value - 1);
            }}
          >
            {t("Previous")}
          </Button>
          <span>
            {t("Page")} {page}
          </span>
          <Button
            variant="outline"
            disabled={!data.hasNext}
            onClick={() => {
              setData(null);
              setPage((value) => value + 1);
            }}
          >
            {t("Next")}
          </Button>
        </nav>
      )}
    </main>
  );
}
