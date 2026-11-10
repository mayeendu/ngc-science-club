import { z } from "zod";
import { AppError } from "../../utils/app-error.js";

const querySchema = z.strictObject({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AnalyticsRange = {
  from: string;
  to: string;
  start: Date;
  end: Date;
  previousStart: Date;
};
export function parseAnalyticsRange(
  query: unknown,
  now = new Date(),
): AnalyticsRange {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success || !!parsed.data.from !== !!parsed.data.to)
    throw new AppError(
      400,
      "Provide valid from/to dates together (YYYY-MM-DD).",
    );
  const from =
    parsed.data.from ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
      .toISOString()
      .slice(0, 10);
  const to = parsed.data.to ?? now.toISOString().slice(0, 10);
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000);
  const duration = end.getTime() - start.getTime();
  if (
    from < "2000-01-01" ||
    to > "2100-12-31" ||
    duration <= 0 ||
    duration > 731 * 86_400_000
  )
    throw new AppError(
      400,
      "Select an ordered date range of at most 731 days between 2000 and 2100.",
    );
  return {
    from,
    to,
    start,
    end,
    previousStart: new Date(start.getTime() - duration),
  };
}
export type MembershipAnalytics = {
  range: { from: string; to: string };
  kpis: {
    totalApplications: number;
    pending: number;
    approved: number;
    rejected: number;
    approvalRate: number;
  };
  monthly: { month: string; applications: number; approvedMembers: number }[];
  departments: { department: string; members: number }[];
  recent: {
    status: "pending" | "approved" | "rejected";
    submittedAt: string;
  }[];
  trend: {
    previousApplications: number;
    change: number;
    changePercent: number | null;
  };
};
