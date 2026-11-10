import { z } from "zod";
import type { MembershipValues } from "./validations/membership";

const resultSchema = z.object({
  success: z.literal(true),
  application: z
    .object({
      status: z.enum(["pending", "approved", "rejected"]),
      submittedAt: z.iso.datetime(),
      reviewedAt: z.iso.datetime().optional(),
      rejectionReason: z.string().optional(),
    })
    .nullable(),
});
export type MembershipSummary = z.infer<typeof resultSchema>["application"];
export class MembershipApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function membershipRequest(
  values?: MembershipValues,
  signal?: AbortSignal,
): Promise<MembershipSummary> {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Membership service is not configured.");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/membership-applications${values ? "" : "/me"}`,
    {
      method: values ? "POST" : "GET",
      credentials: "include",
      cache: "no-store",
      headers: values ? { "Content-Type": "application/json" } : undefined,
      body: values ? JSON.stringify(values) : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    const message =
      response.status === 401
        ? "Your session expired. Please sign in again."
        : response.status === 403
          ? "Only student accounts can apply."
          : response.status === 409
            ? "You already have a membership application."
            : "Unable to save or load your application. Please try again.";
    throw new MembershipApiError(response.status, message);
  }
  return resultSchema.parse(await response.json()).application;
}
