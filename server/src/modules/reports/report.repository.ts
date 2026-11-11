import type { Db, Document } from "mongodb";
import { getDB } from "../../config/db.js";
import type { AnalyticsRange } from "../membership-analytics/analytics.schema.js";

// Dates are cohort dates, while statuses describe the current state of that cohort.
export const reportSources = [
  {
    key: "members",
    collection: "membershipApplications",
    date: "submittedAt",
    states: ["pending", "approved", "rejected"],
  },
  {
    key: "quizzes",
    collection: "quizzes",
    date: "createdAt",
    states: ["draft", "published"],
  },
  {
    key: "events",
    collection: "events",
    date: "startsAt",
    states: ["draft", "published", "cancelled"],
  },
  {
    key: "attendance",
    collection: "eventRegistrations",
    date: "registeredAt",
    states: ["unmarked", "present", "absent"],
  },
  {
    key: "feedback",
    collection: "feedbackThreads",
    date: "createdAt",
    states: ["open", "in_review", "resolved"],
  },
] as const;
type Bucket = { _id: string; count: number };
type Buckets = {
  totals: { count: number }[];
  states: Bucket[];
  monthly: Bucket[];
};
export function reportPipeline(
  source: (typeof reportSources)[number],
  range: AnalyticsRange,
): Document[] {
  return [
    {
      $match: {
        [source.date]: { $gte: range.start, $lt: range.end },
        ...(source.key === "events" || source.key === "quizzes"
          ? { deletedAt: { $exists: false } }
          : {}),
        ...(source.key === "attendance" ? { status: "registered" } : {}),
      },
    },
    {
      $facet: {
        totals: [{ $count: "count" }],
        states: [
          {
            $group: {
              _id: source.key === "attendance" ? "$attendance" : "$status",
              count: { $sum: 1 },
            },
          },
        ],
        monthly: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m",
                  date: `$${source.date}`,
                  timezone: "UTC",
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ];
}
export function createReportRepository(database: () => Db = getDB) {
  return {
    async get(range: AnalyticsRange) {
      const sections = await Promise.all(
        reportSources.map(async (source) => {
          const [buckets] = await database()
            .collection(source.collection)
            .aggregate<Buckets>(reportPipeline(source, range), {
              maxTimeMS: 10000,
            })
            .toArray();
          // Allowlist labels as well as fields: malformed stored values cannot become export cells.
          return {
            key: source.key,
            total: buckets?.totals[0]?.count ?? 0,
            states: source.states.map((state) => ({
              state,
              count:
                buckets?.states.find((entry) => entry._id === state)?.count ??
                0,
            })),
            monthly: (buckets?.monthly ?? [])
              .filter((entry) => /^\d{4}-\d{2}$/.test(entry._id))
              .map((entry) => ({ month: entry._id, count: entry.count })),
          };
        }),
      );
      return {
        range: { from: range.from, to: range.to },
        generatedAt: new Date().toISOString(),
        sections,
      };
    },
  };
}
export type ReportRepository = ReturnType<typeof createReportRepository>;
export function reportCsv(
  report: Awaited<ReturnType<ReportRepository["get"]>>,
) {
  const rows: (string | number)[][] = [
    ["from", "to", "section", "metric", "count"],
  ];
  for (const section of report.sections) {
    rows.push([
      report.range.from,
      report.range.to,
      section.key,
      "total",
      section.total,
    ]);
    for (const state of section.states)
      rows.push([
        report.range.from,
        report.range.to,
        section.key,
        state.state,
        state.count,
      ]);
    for (const month of section.monthly)
      rows.push([
        report.range.from,
        report.range.to,
        section.key,
        month.month,
        month.count,
      ]);
  }
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n") +
    "\r\n"
  );
}
