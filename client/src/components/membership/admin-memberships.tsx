"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "@/lib/i18n/toast";
import {
  AdminMembershipError,
  listMemberships,
  reviewMembership,
  reviewDecisionSchema,
  type AdminMembership,
  type AdminMembershipList,
  type MembershipStatus,
} from "@/lib/admin-membership-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccessDenied } from "@/components/auth/access-state";
type Selection = {
  application: AdminMembership;
  decision: "approved" | "rejected";
};
export function AdminMemberships() {
  const t = useT();
  const [status, setStatus] = useState<MembershipStatus>("pending");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<AdminMembershipList | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [reason, setReason] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const reasonId = useId();
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    listMemberships(status, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof AdminMembershipError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof AdminMembershipError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof AdminMembershipError
            ? cause.message
            : "Unable to load applications. Please try again.",
        );
      });
    return () => controller.abort();
  }, [status, page, revision, router]);
  useEffect(() => {
    const element = dialog.current;
    if (selection && element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, [selection]);
  function refresh() {
    setResult(null);
    setError("");
    setRevision((value) => value + 1);
  }
  function open(
    application: AdminMembership,
    decision: "approved" | "rejected",
  ) {
    setReason("");
    setReviewError("");
    setSelection({ application, decision });
  }
  async function confirm() {
    if (!selection || busy) return;
    const input = reviewDecisionSchema.safeParse(
      selection.decision === "rejected"
        ? { decision: "rejected", rejectionReason: reason }
        : { decision: "approved" },
    );
    if (!input.success) {
      setReviewError("Provide a rejection reason of 5–1000 characters.");
      return;
    }
    setBusy(true);
    setReviewError("");
    try {
      await reviewMembership(selection.application.id, input.data);
      toast.success(`Application ${selection.decision}.`);
      setSelection(null);
      refresh();
    } catch (cause) {
      const message =
        cause instanceof AdminMembershipError
          ? cause.message
          : "Unable to save the review. Please try again.";
      toast.error(message);
      setReviewError(message);
      if (cause instanceof AdminMembershipError) {
        if (cause.status === 401) {
          setSelection(null);
          router.replace("/login");
        }
        if (cause.status === 403) {
          setSelection(null);
          setDenied(true);
        }
        if (cause.status === 409) {
          setSelection(null);
          refresh();
        }
      }
    } finally {
      setBusy(false);
    }
  }
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("Membership applications")}</h1>
      <p className="text-slate-600">
        {t(
          "Review student applications. Each pending application can be reviewed once.",
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="membership-filter" className="font-medium">
          {t("Status")}
        </label>
        <select
          id="membership-filter"
          value={status}
          onChange={(event) => {
            const value = event.target.value;
            if (
              value === "pending" ||
              value === "approved" ||
              value === "rejected"
            ) {
              setStatus(value);
              setPage(1);
              setResult(null);
              setError("");
            }
          }}
          className="rounded-md border bg-white px-3 py-2"
        >
          <option value="pending">{t("Pending")}</option>
          <option value="approved">{t("Approved")}</option>
          <option value="rejected">{t("Rejected")}</option>
        </select>
        <Button variant="outline" onClick={refresh}>
          {t("Refresh applications")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-red-700">
          {t(error, undefined, true)}
        </p>
      ) : !result ? (
        <p role="status">{t("Loading applications\u2026")}</p>
      ) : (
        <>
          {result.applications.length === 0 && (
            <p role="status">
              {t("No")} {status} {t("applications on this page.")}
            </p>
          )}
          <div className="space-y-5">
            {result.applications.map((application) => (
              <Card key={application.id}>
                <CardHeader>
                  <CardTitle>
                    <h2 className="text-xl">{application.fullName}</h2>
                  </CardTitle>
                  <span className="w-fit rounded-full bg-teal-50 px-3 py-1 text-sm font-medium capitalize text-teal-800">
                    {t(application.status)}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ["Class Roll", application.studentId],
                      ["Department", application.department],
                      ["Session", application.academicYear],
                      ["Mobile No.", application.phone],
                      ["SSC GPA", application.sscGpa ?? "Unavailable"],
                      [
                        "SSC Reg No.",
                        application.sscRegistration ?? "Unavailable",
                      ],
                      ["Section", application.section ?? "Unavailable"],
                      [
                        "Father's / Mother's Mobile No.",
                        application.guardianPhone ?? "Unavailable",
                      ],
                      [
                        "WhatsApp No.",
                        application.whatsappPhone ?? "Unavailable",
                      ],
                      [
                        "Guide Teacher's Name",
                        application.guideTeacher ?? "Unavailable",
                      ],
                      [
                        "Optional Subject",
                        application.optionalSubject ?? "Unavailable",
                      ],
                      [
                        "Student's Residence",
                        application.residence ?? "Unavailable",
                      ],
                      [
                        "Admission Goal",
                        application.admissionGoal ?? "Unavailable",
                      ],
                      ["Signature", application.signature ?? "Unavailable"],
                      [
                        "Submitted",
                        new Date(application.submittedAt).toLocaleString(
                          "en-GB",
                        ),
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="font-medium text-slate-600">
                          {t(label)}
                        </dt>
                        <dd className="break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div>
                    <h3 className="font-medium">{t("Reason for joining")}</h3>
                    <p className="whitespace-pre-wrap break-words text-slate-600">
                      {application.reason}
                    </p>
                  </div>
                  {application.reviewedAt && (
                    <p className="text-sm">
                      {t("Reviewed:")}{" "}
                      {new Date(application.reviewedAt).toLocaleString("en-GB")}
                    </p>
                  )}
                  {application.rejectionReason && (
                    <p className="whitespace-pre-wrap break-words text-red-700">
                      {t("Rejection reason:")} {application.rejectionReason}
                    </p>
                  )}
                  {application.status === "pending" && (
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => open(application, "approved")}>
                        {t("Approve")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => open(application, "rejected")}
                      >
                        {t("Reject")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => {
                setPage((value) => value - 1);
                setResult(null);
              }}
            >
              {t("Previous")}
            </Button>
            <span>
              {t("Page")} {page}
            </span>
            <Button
              variant="outline"
              disabled={!result.hasNext || page >= 1000}
              onClick={() => {
                setPage((value) => value + 1);
                setResult(null);
              }}
            >
              {t("Next")}
            </Button>
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={heading}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setSelection(null);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
      >
        {selection && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
            noValidate
            className="space-y-4"
          >
            <h2 id={heading} className="text-xl font-bold">
              {selection.decision === "approved"
                ? t("Approve application?")
                : t("Reject application?")}
            </h2>
            <p>
              {t("Confirm your decision for")} {selection.application.fullName}{" "}
              {t(". Only pending applications can be reviewed.")}
            </p>
            {selection.decision === "rejected" && (
              <div>
                <label htmlFor={reasonId} className="font-medium">
                  {t("Rejection reason")}
                </label>
                <textarea
                  id={reasonId}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  disabled={busy}
                  aria-invalid={!!reviewError}
                  className="mt-2 w-full rounded-md border p-3"
                />
                <p className="text-sm text-slate-600">
                  {t(
                    "5\u20131000 characters. This reason is visible to the student.",
                  )}
                </p>
              </div>
            )}
            {reviewError && (
              <p role="alert" className="text-red-700">
                {reviewError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setSelection(null)}
              >
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? t("Saving review\u2026")
                  : selection.decision === "approved"
                    ? t("Confirm approval")
                    : t("Confirm rejection")}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}
