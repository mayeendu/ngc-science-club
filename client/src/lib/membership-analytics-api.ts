import { z } from "zod";

const count = z.number().int().nonnegative();
const analyticsSchema = z.object({
  success: z.literal(true),
  analytics: z.strictObject({
    range: z.object({ from: z.iso.date(), to: z.iso.date() }),
    kpis: z.object({
      totalApplications: count,
      pending: count,
      approved: count,
      rejected: count,
      approvalRate: z.number().min(0).max(100),
    }),
    monthly: z.array(
      z.object({
        month: z.string(),
        applications: count,
        approvedMembers: count,
      }),
    ),
    departments: z.array(z.object({ department: z.string(), members: count })),
    recent: z.array(
      z.strictObject({
        status: z.enum(["pending", "approved", "rejected"]),
        submittedAt: z.iso.datetime(),
      }),
    ),
    trend: z.object({
      previousApplications: count,
      change: z.number().int(),
      changePercent: z.number().nullable(),
    }),
  }),
});
export type MembershipAnalytics = z.infer<typeof analyticsSchema>["analytics"];
export class AnalyticsError extends Error {
  constructor(public status: number) {
    super(
      status === 400
        ? "Select valid dates in order, at most 731 days apart."
        : status === 401
          ? "Your session expired. Please sign in again."
          : status === 403
            ? "Administrator access is required."
            : "Unable to load membership analytics. Please try again.",
    );
  }
}
export function defaultAnalyticsDates() {
  const now = new Date();
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
      .toISOString()
      .slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}
export async function getMembershipAnalytics(
  dates: { from: string; to: string },
  signal: AbortSignal,
) {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Analytics API is not configured.");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/admin/membership-analytics?${new URLSearchParams(dates)}`,
    {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
    },
  );
  if (!response.ok) throw new AnalyticsError(response.status);
  return analyticsSchema.parse(await response.json()).analytics;
}
