import { z } from "zod";
import { membershipSchema } from "./validations/membership";

export const reviewDecisionSchema = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("approved") }),
  z.strictObject({
    decision: z.literal("rejected"),
    rejectionReason: z
      .string()
      .trim()
      .min(5, "Write a rejection reason of at least 5 characters.")
      .max(1000),
  }),
]);
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type MembershipStatus = "pending" | "approved" | "rejected";
const summarySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  submittedAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().optional(),
  rejectionReason: z.string().optional(),
});
const listSchema = z.object({
  success: z.literal(true),
  applications: z.array(
    membershipSchema.extend({
      id: z.string(),
      ...summarySchema.shape,
    }),
  ),
  page: z.number().int().positive(),
  hasNext: z.boolean(),
});
export type AdminMembershipList = z.infer<typeof listSchema>;
export type AdminMembership = AdminMembershipList["applications"][number];
export class AdminMembershipError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function request(path: string, options: RequestInit) {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Membership service is not configured.");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/admin/memberships${path}`,
    {
      ...options,
      credentials: "include",
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok)
    throw new AdminMembershipError(
      response.status,
      response.status === 401
        ? "Your session expired. Please sign in again."
        : response.status === 403
          ? "Administrator access is required."
          : response.status === 409
            ? "This application has already been reviewed or is unavailable. The list will refresh."
            : "Unable to load or review applications. Please try again.",
    );
  const body: unknown = await response.json();
  return body;
}
export async function listMemberships(
  status: MembershipStatus,
  page: number,
  signal: AbortSignal,
) {
  return listSchema.parse(
    await request(`?status=${status}&page=${page}`, { signal }),
  );
}
export async function reviewMembership(id: string, input: ReviewDecision) {
  const body = await request(`/${encodeURIComponent(id)}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reviewDecisionSchema.parse(input)),
  });
  return z
    .object({ success: z.literal(true), application: summarySchema })
    .parse(body);
}
