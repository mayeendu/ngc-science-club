import type { Db } from "mongodb";
import { getDB } from "../../config/db.js";
import type {
  AnalyticsRange,
  MembershipAnalytics,
} from "./analytics.schema.js";

export type AnalyticsBuckets = {
  summary: {
    totalApplications: number;
    pending: number;
    approved: number;
    rejected: number;
  }[];
  applications: { _id: string; count: number }[];
  approvals: { _id: string; count: number }[];
  departments: { _id: string; count: number }[];
  recent: { status: "pending" | "approved" | "rejected"; submittedAt: Date }[];
  previous: { count: number }[];
};
export function summarizeAnalytics(
  range: AnalyticsRange,
  buckets?: AnalyticsBuckets,
): MembershipAnalytics {
  const totals = buckets?.summary[0];
  const totalApplications = totals?.totalApplications ?? 0;
  const approved = totals?.approved ?? 0;
  const previousApplications = buckets?.previous[0]?.count ?? 0;
  const percentage = (value: number, denominator: number) =>
    Math.round((value / denominator) * 10000) / 100;
  const monthly: MembershipAnalytics["monthly"] = [];
  const applications = new Map(
    buckets?.applications.map((item) => [item._id, item.count]) ?? [],
  );
  const approvals = new Map(
    buckets?.approvals.map((item) => [item._id, item.count]) ?? [],
  );
  const month = new Date(
    Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1),
  );
  while (month < range.end) {
    const key = month.toISOString().slice(0, 7);
    monthly.push({
      month: key,
      applications: applications.get(key) ?? 0,
      approvedMembers: approvals.get(key) ?? 0,
    });
    month.setUTCMonth(month.getUTCMonth() + 1);
  }
  return {
    range: { from: range.from, to: range.to },
    kpis: {
      totalApplications,
      pending: totals?.pending ?? 0,
      approved,
      rejected: totals?.rejected ?? 0,
      approvalRate: totalApplications
        ? percentage(approved, totalApplications)
        : 0,
    },
    monthly,
    departments: (buckets?.departments ?? []).map((item) => ({
      department: item._id,
      members: item.count,
    })),
    recent: (buckets?.recent ?? []).map((item) => ({
      status: item.status,
      submittedAt: item.submittedAt.toISOString(),
    })),
    trend: {
      previousApplications,
      change: totalApplications - previousApplications,
      changePercent: previousApplications
        ? percentage(
            totalApplications - previousApplications,
            previousApplications,
          )
        : totalApplications
          ? null
          : 0,
    },
  };
}
export interface AnalyticsRepository {
  get(range: AnalyticsRange): Promise<MembershipAnalytics>;
}
export function createAnalyticsRepository(
  database: () => Db = getDB,
): AnalyticsRepository {
  return {
    async get(range) {
      const submitted = { submittedAt: { $gte: range.start, $lt: range.end } };
      const approved = {
        status: "approved",
        reviewedAt: { $gte: range.start, $lt: range.end },
      };
      const [buckets] = await database()
        .collection("membershipApplications")
        .aggregate<AnalyticsBuckets>(
          [
            {
              $match: {
                status: { $in: ["pending", "approved", "rejected"] },
                $or: [
                  {
                    submittedAt: { $gte: range.previousStart, $lt: range.end },
                  },
                  approved,
                ],
              },
            },
            // Remove every identifying/private field before branching the aggregation.
            {
              $project: {
                _id: 0,
                status: 1,
                department: 1,
                submittedAt: 1,
                reviewedAt: 1,
              },
            },
            {
              $facet: {
                summary: [
                  { $match: submitted },
                  {
                    $group: {
                      _id: null,
                      totalApplications: { $sum: 1 },
                      ...Object.fromEntries(
                        ["pending", "approved", "rejected"].map((status) => [
                          status,
                          {
                            $sum: {
                              $cond: [{ $eq: ["$status", status] }, 1, 0],
                            },
                          },
                        ]),
                      ),
                    },
                  },
                ],
                applications: [
                  { $match: submitted },
                  {
                    $group: {
                      _id: {
                        $dateToString: {
                          format: "%Y-%m",
                          date: "$submittedAt",
                          timezone: "UTC",
                        },
                      },
                      count: { $sum: 1 },
                    },
                  },
                ],
                approvals: [
                  { $match: approved },
                  {
                    $group: {
                      _id: {
                        $dateToString: {
                          format: "%Y-%m",
                          date: "$reviewedAt",
                          timezone: "UTC",
                        },
                      },
                      count: { $sum: 1 },
                    },
                  },
                ],
                departments: [
                  { $match: approved },
                  { $group: { _id: "$department", count: { $sum: 1 } } },
                  { $sort: { count: -1, _id: 1 } },
                ],
                recent: [
                  { $match: submitted },
                  { $sort: { submittedAt: -1 } },
                  { $limit: 5 },
                  { $project: { _id: 0, status: 1, submittedAt: 1 } },
                ],
                previous: [
                  {
                    $match: {
                      submittedAt: {
                        $gte: range.previousStart,
                        $lt: range.start,
                      },
                    },
                  },
                  { $count: "count" },
                ],
              },
            },
          ],
          { readPreference: "primary", maxTimeMS: 10_000 },
        )
        .toArray();
      return summarizeAnalytics(range, buckets);
    },
  };
}
