import type { Db, Document } from "mongodb";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type {
  PerformanceActor,
  PerformanceQuery,
} from "./performance.schema.js";

// One joined cohort feeds every facet. No facet can widen the authorization scope.
export function performancePipeline(
  actor: PerformanceActor,
  query: PerformanceQuery,
): Document[] {
  return [
    {
      $match: {
        status: "submitted",
        submittedAt: { $gte: query.start, $lt: query.end },
        ...(actor.role === "student" ? { userId: actor.id } : {}),
        ...(query.subject ? { subject: query.subject } : {}),
      },
    },
    {
      $lookup: {
        from: "quizzes",
        let: { quizId: "$quizId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  "$_id",
                  {
                    $convert: {
                      input: "$$quizId",
                      to: "objectId",
                      onError: null,
                      onNull: null,
                    },
                  },
                ],
              },
              status: "published",
              deletedAt: { $exists: false },
              resultsReleasedAt: { $type: "date" },
              closedAt: { $type: "date" },
              ...(actor.role === "teacher" ? { createdBy: actor.id } : {}),
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "authorizedQuiz",
      },
    },
    { $match: { "authorizedQuiz.0": { $exists: true } } },
    {
      $project: {
        _id: 0,
        quizId: 1,
        userId: 1,
        studentName: 1,
        title: 1,
        subject: 1,
        submittedAt: 1,
        score: 1,
        totalMarks: 1,
        percentage: 1,
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              completed: { $sum: 1 },
              average: { $avg: "$percentage" },
              best: { $max: "$percentage" },
            },
          },
        ],
        quizzes: [
          {
            $group: {
              _id: "$quizId",
              title: { $first: "$title" },
              subject: { $first: "$subject" },
              completed: { $sum: 1 },
              average: { $avg: "$percentage" },
            },
          },
          { $sort: { title: 1, _id: 1 } },
          { $skip: (query.page - 1) * 20 },
          { $limit: 21 },
        ],
        timeline: [
          {
            $group: {
              _id: {
                $dateToString: {
                  date: "$submittedAt",
                  format: "%Y-%m",
                  timezone: "UTC",
                },
              },
              completed: { $sum: 1 },
              average: { $avg: "$percentage" },
            },
          },
          { $sort: { _id: 1 } },
        ],
        history:
          actor.role === "student"
            ? [
                { $sort: { submittedAt: -1, quizId: 1 } },
                { $skip: (query.page - 1) * 20 },
                { $limit: 21 },
                {
                  $project: {
                    _id: 0,
                    quizId: 1,
                    title: 1,
                    subject: 1,
                    submittedAt: 1,
                    score: 1,
                    totalMarks: 1,
                    percentage: 1,
                  },
                },
              ]
            : [{ $limit: 1 }, { $match: { $expr: false } }],
        rankings:
          actor.role === "student"
            ? [{ $limit: 1 }, { $match: { $expr: false } }]
            : [
                { $sort: { submittedAt: -1, quizId: 1 } },
                {
                  $group: {
                    _id: "$userId",
                    name: { $first: "$studentName" },
                    completed: { $sum: 1 },
                    average: { $avg: "$percentage" },
                  },
                },
                { $set: { average: { $round: ["$average", 2] } } },
                {
                  $setWindowFields: {
                    sortBy: { average: -1 },
                    output: { rank: { $rank: {} } },
                  },
                },
                { $sort: { rank: 1, _id: 1 } },
                { $skip: (query.page - 1) * 20 },
                { $limit: 21 },
                {
                  $project: {
                    _id: 0,
                    name: 1,
                    completed: 1,
                    average: 1,
                    rank: 1,
                  },
                },
              ],
      },
    },
  ];
}
type Aggregate = {
  summary: { completed: number; average: number; best: number }[];
  quizzes: {
    _id: string;
    title: string;
    subject: string;
    completed: number;
    average: number;
  }[];
  timeline: { _id: string; completed: number; average: number }[];
  history: {
    quizId: string;
    title: string;
    subject: string;
    submittedAt: Date;
    score: number;
    totalMarks: number;
    percentage: number;
  }[];
  rankings: {
    name: string;
    completed: number;
    average: number;
    rank: number;
  }[];
};
const rounded = (value: number) => Math.round(value * 100) / 100;
export function createPerformanceRepository(database: () => Db = getDB) {
  return {
    async get(actor: PerformanceActor, query: PerformanceQuery) {
      const db = database();
      if (actor.role === "student") {
        const member = await db
          .collection<{ _id: string; status: string }>("membershipApplications")
          .findOne(
            { _id: actor.id, status: "approved" },
            { projection: { _id: 1 }, readPreference: "primary" },
          );
        if (!member) throw new AppError(403, "Approved membership required.");
      }
      const [data] = await db
        .collection("quizAttempts")
        .aggregate<Aggregate>(performancePipeline(actor, query), {
          readPreference: "primary",
          maxTimeMS: 10_000,
        })
        .toArray();
      return {
        range: { from: query.from, to: query.to },
        completed: data?.summary[0]?.completed ?? 0,
        averagePercentage: rounded(data?.summary[0]?.average ?? 0),
        bestPercentage: data?.summary[0]?.best ?? 0,
        page: query.page,
        quizzesHasNext: (data?.quizzes.length ?? 0) > 20,
        historyHasNext: (data?.history.length ?? 0) > 20,
        rankingsHasNext: (data?.rankings.length ?? 0) > 20,
        quizzes: (data?.quizzes ?? [])
          .slice(0, 20)
          .map((row) => ({
            quizId: row._id,
            title: row.title,
            subject: row.subject,
            completed: row.completed,
            averagePercentage: rounded(row.average),
          })),
        timeline: (data?.timeline ?? []).map((row) => ({
          month: row._id,
          completed: row.completed,
          averagePercentage: rounded(row.average),
        })),
        history: (data?.history ?? [])
          .slice(0, 20)
          .map((row) => ({
            quizId: row.quizId,
            title: row.title,
            subject: row.subject,
            submittedAt: row.submittedAt.toISOString(),
            score: row.score,
            totalMarks: row.totalMarks,
            percentage: row.percentage,
          })),
        rankings: (data?.rankings ?? [])
          .slice(0, 20)
          .map((row) => ({
            name: row.name,
            completed: row.completed,
            averagePercentage: row.average,
            rank: row.rank,
          })),
      };
    },
  };
}
export type PerformanceRepository = ReturnType<
  typeof createPerformanceRepository
>;
