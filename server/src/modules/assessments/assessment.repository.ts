import { ObjectId, type ClientSession, type Db, type Document } from "mongodb";
import { getDB, getMongoClient } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import { quizContentSchema, type QuizActor } from "../quizzes/quiz.schema.js";
import type { QuizDocument } from "../quizzes/quiz.repository.js";
import {
  type AttemptDocument,
  type AttemptView,
  type SafeQuiz,
  type AnswerInput,
  type HistoryItem,
} from "./assessment.schema.js";

export type AssessmentTransaction = <T>(
  work: (database: Db, session?: ClientSession) => Promise<T>,
) => Promise<T>;
const transaction: AssessmentTransaction = (work) =>
  getMongoClient().withSession((session) =>
    session.withTransaction(() => work(getDB(), session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    }),
  );
const key = (id: string, userId: string) => `${id}:${userId}`;
function safeQuiz(quiz: QuizDocument): SafeQuiz {
  return {
    id: quiz._id.toHexString(),
    title: quiz.title,
    description: quiz.description,
    subject: quiz.subject,
    durationMinutes: quiz.durationMinutes,
    totalMarks: quiz.totalMarks,
    questionCount: quiz.questions.length,
    closed: !!quiz.closedAt,
    resultsReleased: !!quiz.resultsReleasedAt,
  };
}
function view(quiz: QuizDocument, attempt: AttemptDocument): AttemptView {
  const released = !!quiz.resultsReleasedAt && attempt.status === "submitted";
  return {
    status: attempt.status,
    answers: attempt.answers,
    revision: attempt.revision,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    serverNow: quiz.assessmentNow!.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    questions:
      attempt.status === "in_progress"
        ? quiz.questions.map((question) => ({
            text: question.text,
            options: question.options,
            marks: question.marks,
          }))
        : [],
    result: released
      ? {
          score: attempt.score ?? 0,
          percentage: attempt.percentage ?? 0,
          submittedAt: attempt.submittedAt!.toISOString(),
          review: quiz.questions.map((question, index) => ({
            text: question.text,
            options: question.options,
            marks: question.marks,
            selectedOption: attempt.answers[index],
            correctOption: question.correctOption,
            earnedMarks:
              attempt.answers[index] === question.correctOption
                ? question.marks
                : 0,
            explanation: question.explanation ?? "No explanation provided.",
          })),
        }
      : null,
  };
}
// Scores are computed by MongoDB from frozen server keys, never client scores.
export function gradingPipeline(quiz: QuizDocument): Document[] {
  const now = quiz.assessmentNow!;
  const score = {
    $sum: {
      $map: {
        input: { $range: [0, quiz.questions.length] },
        as: "index",
        in: {
          $cond: [
            {
              $eq: [
                { $arrayElemAt: ["$answers", "$$index"] },
                {
                  $arrayElemAt: [
                    {
                      $literal: quiz.questions.map(
                        (question) => question.correctOption,
                      ),
                    },
                    "$$index",
                  ],
                },
              ],
            },
            {
              $arrayElemAt: [
                { $literal: quiz.questions.map((question) => question.marks) },
                "$$index",
              ],
            },
            0,
          ],
        },
      },
    },
  };
  return [
    {
      $set: {
        score,
        status: "submitted",
        submittedAt: {
          $min: ["$deadlineAt", now, ...(quiz.closedAt ? [quiz.closedAt] : [])],
        },
        reason: {
          $cond: [
            { $lte: ["$deadlineAt", now] },
            "expired",
            quiz.closedAt ? "closed" : "manual",
          ],
        },
        revision: { $add: ["$revision", 1] },
      },
    },
    {
      $set: {
        percentage: quiz.totalMarks
          ? {
              $round: [
                { $multiply: [{ $divide: ["$score", quiz.totalMarks] }, 100] },
                2,
              ],
            }
          : 0,
      },
    },
  ];
}
export function createAssessmentRepository(
  run: AssessmentTransaction = transaction,
  database: () => Db = getDB,
) {
  const attempts = (db: Db) => db.collection<AttemptDocument>("quizAttempts");
  async function approved(db: Db, userId: string, session?: ClientSession) {
    const member = await db
      .collection<{ _id: string; fullName: string; status: string }>(
        "membershipApplications",
      )
      .findOne(
        { _id: userId, status: "approved" },
        {
          session,
          projection: { _id: 0, fullName: 1 },
          readPreference: "primary",
        },
      );
    if (!member) throw new AppError(403, "Approved membership required.");
    return member;
  }
  async function gate(
    db: Db,
    id: string,
    actor?: QuizActor,
    session?: ClientSession,
  ) {
    const quiz = await db.collection<QuizDocument>("quizzes").findOneAndUpdate(
      {
        _id: new ObjectId(id),
        status: "published",
        deletedAt: { $exists: false },
        ...(actor && actor.role !== "admin" ? { createdBy: actor.id } : {}),
      },
      [
        {
          $set: {
            assessmentNow: "$$NOW",
            assessmentTick: {
              $add: [{ $ifNull: ["$assessmentTick", 0] }, 1],
            },
          },
        },
      ],
      { session, returnDocument: "after" },
    );
    if (!quiz) throw new AppError(404, "Published quiz not found.");
    return quiz;
  }
  async function settle(db: Db, quiz: QuizDocument, session?: ClientSession) {
    await attempts(db).updateMany(
      {
        quizId: quiz._id.toHexString(),
        status: "in_progress",
        ...(quiz.closedAt ? {} : { deadlineAt: { $lte: quiz.assessmentNow! } }),
      },
      gradingPipeline(quiz),
      { session },
    );
  }
  async function readOwn(
    db: Db,
    id: string,
    userId: string,
    session?: ClientSession,
  ) {
    return attempts(db).findOne(
      { _id: key(id, userId), userId },
      { session, readPreference: "primary" },
    );
  }
  async function act(
    id: string,
    userId: string,
    action: "read" | "start" | "save" | "submit",
    input?: AnswerInput,
  ) {
    return run(async (db, session) => {
      const member = await approved(db, userId, session),
        quiz = await gate(db, id, undefined, session);
      await settle(db, quiz, session);
      let attempt = await readOwn(db, id, userId, session);
      if (!attempt && action === "start") {
        if (quiz.closedAt) throw new AppError(409, "This quiz is closed.");
        const parsed = quizContentSchema.safeParse({
          title: quiz.title,
          description: quiz.description,
          subject: quiz.subject,
          durationMinutes: quiz.durationMinutes,
          questions: quiz.questions,
        });
        if (!parsed.success || quiz.questions.length === 0)
          throw new AppError(409, "This quiz is not ready for attempts.");
        const totalMarks = quiz.questions.reduce(
          (sum, question) => sum + question.marks,
          0,
        );
        await db
          .collection<QuizDocument>("quizzes")
          .updateOne(
            { _id: quiz._id },
            { $set: { hasAttempts: true, totalMarks } },
            { session },
          );
        quiz.hasAttempts = true;
        quiz.totalMarks = totalMarks;
        attempt = {
          _id: key(id, userId),
          quizId: id,
          userId,
          studentName: member.fullName,
          title: quiz.title,
          subject: quiz.subject,
          status: "in_progress",
          answers: quiz.questions.map(() => null),
          revision: 0,
          startedAt: quiz.assessmentNow!,
          deadlineAt: new Date(
            quiz.assessmentNow!.getTime() + quiz.durationMinutes * 60_000,
          ),
          totalMarks,
        };
        await attempts(db).insertOne(attempt, { session });
      }
      if (!attempt) {
        if (action === "read")
          return {
            quiz: safeQuiz(quiz),
            attempt: null,
            serverNow: quiz.assessmentNow!.toISOString(),
          };
        throw new AppError(404, "Attempt not found. Start the quiz first.");
      }
      if (
        attempt.status === "in_progress" &&
        (action === "save" || action === "submit")
      ) {
        if (input) {
          if (input.answers.length !== quiz.questions.length)
            throw new AppError(400, "Answer count must match the quiz.");
          const updated = await attempts(db).findOneAndUpdate(
            {
              _id: attempt._id,
              userId,
              status: "in_progress",
              revision: input.revision,
              deadlineAt: { $gt: quiz.assessmentNow! },
            },
            { $set: { answers: input.answers }, $inc: { revision: 1 } },
            { session, returnDocument: "after" },
          );
          if (!updated)
            throw new AppError(
              409,
              "Answers changed in another request. Reload before continuing.",
            );
          attempt = updated;
        }
        if (action === "submit") {
          await attempts(db).updateOne(
            { _id: attempt._id, userId, status: "in_progress" },
            gradingPipeline(quiz),
            { session },
          );
          attempt = (await readOwn(db, id, userId, session))!;
        }
      }
      return {
        quiz: safeQuiz(quiz),
        attempt: view(quiz, attempt),
        serverNow: quiz.assessmentNow!.toISOString(),
      };
    });
  }
  async function expireQuiz(id: string) {
    await run(async (db, session) => {
      const quiz = await gate(db, id, undefined, session);
      await settle(db, quiz, session);
    });
  }
  async function history(userId: string, page: number) {
    await approved(database(), userId);
    const rows = await attempts(database())
      .find({ userId }, { readPreference: "primary" })
      .sort({ startedAt: -1, _id: 1 })
      .skip((page - 1) * 20)
      .limit(21)
      .toArray();
    const items: HistoryItem[] = [];
    for (const row of rows.slice(0, 20)) {
      const state = await act(row.quizId, userId, "read"),
        attempt = state.attempt!;
      items.push({
        quizId: row.quizId,
        title: row.title,
        subject: row.subject,
        status: attempt.status,
        startedAt: row.startedAt.toISOString(),
        submittedAt: attempt.submittedAt,
        released: !!attempt.result,
        score: attempt.result?.score ?? null,
        percentage: attempt.result?.percentage ?? null,
        totalMarks: row.totalMarks,
      });
    }
    return { items, page, hasNext: rows.length > 20 };
  }
  return {
    async catalog(userId: string, page: number) {
      await approved(database(), userId);
      const rows = await database()
        .collection<QuizDocument>("quizzes")
        .find(
          {
            status: "published",
            deletedAt: { $exists: false },
            closedAt: { $exists: false },
          },
          {
            projection: {
              _id: 1,
              title: 1,
              description: 1,
              subject: 1,
              durationMinutes: 1,
              totalMarks: 1,
              questionCount: 1,
              closedAt: 1,
              resultsReleasedAt: 1,
            },
            readPreference: "primary",
          },
        )
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * 12)
        .limit(13)
        .toArray();
      // safeQuiz never accesses or returns question options/keys.
      return {
        quizzes: rows.slice(0, 12).map((row) => ({
          ...safeQuiz({ ...row, questions: [] }),
          questionCount: row.questionCount,
        })),
        page,
        hasNext: rows.length > 12,
      };
    },
    read: (id: string, userId: string) => act(id, userId, "read"),
    start: (id: string, userId: string) => act(id, userId, "start"),
    save: (id: string, userId: string, input: AnswerInput) =>
      act(id, userId, "save", input),
    submit: (id: string, userId: string, input?: AnswerInput) =>
      act(id, userId, "submit", input),
    history,
    async performance(userId: string) {
      await approved(database(), userId);
      const due = await attempts(database())
        .find(
          {
            userId,
            status: "in_progress",
            $expr: { $lte: ["$deadlineAt", "$$NOW"] },
          },
          { projection: { quizId: 1 }, readPreference: "primary" },
        )
        .limit(100)
        .toArray();
      for (const id of new Set(due.map((row) => row.quizId)))
        await expireQuiz(id);
      const [data] = await attempts(database())
        .aggregate<{
          summary: { count: number; average: number; best: number }[];
          subjects: { _id: string; count: number; average: number }[];
          timeline: { title: string; percentage: number; submittedAt: Date }[];
        }>(
          [
            { $match: { userId, status: "submitted" } },
            {
              $lookup: {
                from: "quizzes",
                let: { id: "$quizId" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$_id", { $toObjectId: "$$id" }] },
                          {
                            $ne: [
                              { $ifNull: ["$resultsReleasedAt", null] },
                              null,
                            ],
                          },
                        ],
                      },
                    },
                  },
                  { $project: { _id: 1 } },
                ],
                as: "releasedQuiz",
              },
            },
            { $match: { "releasedQuiz.0": { $exists: true } } },
            {
              $facet: {
                summary: [
                  {
                    $group: {
                      _id: null,
                      count: { $sum: 1 },
                      average: { $avg: "$percentage" },
                      best: { $max: "$percentage" },
                    },
                  },
                ],
                subjects: [
                  {
                    $group: {
                      _id: "$subject",
                      count: { $sum: 1 },
                      average: { $avg: "$percentage" },
                    },
                  },
                  { $sort: { _id: 1 } },
                ],
                timeline: [
                  { $sort: { submittedAt: -1 } },
                  { $limit: 50 },
                  { $sort: { submittedAt: 1 } },
                  {
                    $project: {
                      _id: 0,
                      title: 1,
                      percentage: 1,
                      submittedAt: 1,
                    },
                  },
                ],
              },
            },
          ],
          { readPreference: "primary", maxTimeMS: 10_000 },
        )
        .toArray();
      return {
        completed: data?.summary[0]?.count ?? 0,
        averagePercentage:
          Math.round((data?.summary[0]?.average ?? 0) * 100) / 100,
        bestPercentage: data?.summary[0]?.best ?? 0,
        subjects: (data?.subjects ?? []).map((row) => ({
          subject: row._id,
          completed: row.count,
          averagePercentage: Math.round(row.average * 100) / 100,
        })),
        timeline: (data?.timeline ?? []).map((row) => ({
          title: row.title,
          percentage: row.percentage,
          submittedAt: row.submittedAt.toISOString(),
        })),
      };
    },
    async staff(id: string, actor: QuizActor, page: number) {
      return run(async (db, session) => {
        const quiz = await gate(db, id, actor, session);
        await settle(db, quiz, session);
        const [report] = await attempts(db)
          .aggregate<{
            totals: {
              participants: number;
              submitted: number;
              average: number;
            }[];
            rankings: {
              studentName: string;
              score: number;
              percentage: number;
              rank: number;
              submittedAt: Date;
            }[];
            questions: {
              _id: number;
              answered: number;
              correct: number;
              total: number;
            }[];
          }>(
            [
              { $match: { quizId: id } },
              {
                $facet: {
                  totals: [
                    {
                      $group: {
                        _id: null,
                        participants: { $sum: 1 },
                        submitted: {
                          $sum: {
                            $cond: [{ $eq: ["$status", "submitted"] }, 1, 0],
                          },
                        },
                        average: {
                          $avg: {
                            $cond: [
                              { $eq: ["$status", "submitted"] },
                              "$score",
                              null,
                            ],
                          },
                        },
                      },
                    },
                  ],
                  rankings: [
                    { $match: { status: "submitted" } },
                    {
                      $setWindowFields: {
                        sortBy: { score: -1 },
                        output: { rank: { $rank: {} } },
                      },
                    },
                    { $sort: { score: -1, submittedAt: 1, _id: 1 } },
                    { $skip: (page - 1) * 20 },
                    { $limit: 21 },
                    {
                      $project: {
                        _id: 0,
                        studentName: 1,
                        score: 1,
                        percentage: 1,
                        rank: 1,
                        submittedAt: 1,
                      },
                    },
                  ],
                  questions: [
                    { $match: { status: "submitted" } },
                    {
                      $unwind: {
                        path: "$answers",
                        includeArrayIndex: "question",
                      },
                    },
                    {
                      $group: {
                        _id: "$question",
                        total: { $sum: 1 },
                        answered: {
                          $sum: { $cond: [{ $ne: ["$answers", null] }, 1, 0] },
                        },
                        correct: {
                          $sum: {
                            $cond: [
                              {
                                $eq: [
                                  "$answers",
                                  {
                                    $arrayElemAt: [
                                      {
                                        $literal: quiz.questions.map(
                                          (question) => question.correctOption,
                                        ),
                                      },
                                      "$question",
                                    ],
                                  },
                                ],
                              },
                              1,
                              0,
                            ],
                          },
                        },
                      },
                    },
                    { $sort: { _id: 1 } },
                  ],
                },
              },
            ],
            { session, maxTimeMS: 10_000 },
          )
          .toArray();
        const submitted = report?.totals[0]?.submitted ?? 0;
        return {
          quiz: safeQuiz(quiz),
          participants: report?.totals[0]?.participants ?? 0,
          submitted,
          averageScore:
            Math.round((report?.totals[0]?.average ?? 0) * 100) / 100,
          rankings: (report?.rankings ?? []).slice(0, 20).map((row) => ({
            name: row.studentName,
            score: row.score,
            percentage: row.percentage,
            rank: row.rank,
            submittedAt: row.submittedAt.toISOString(),
          })),
          page,
          hasNext: (report?.rankings.length ?? 0) > 20,
          questions: quiz.questions.map((question, index) => {
            const stats = report?.questions.find((row) => row._id === index);
            const correct = stats?.correct ?? 0,
              answered = stats?.answered ?? 0;
            return {
              question: index + 1,
              text: question.text,
              correct,
              incorrect: answered - correct,
              unanswered: submitted - answered,
              accuracy: submitted
                ? Math.round((correct / submitted) * 10000) / 100
                : 0,
            };
          }),
        };
      });
    },
    async control(id: string, actor: QuizActor, action: "close" | "release") {
      return run(async (db, session) => {
        const quiz = await gate(db, id, actor, session);
        if (action === "release" && !quiz.closedAt)
          throw new AppError(409, "Close the quiz before releasing results.");
        if (action === "close" && !quiz.closedAt) {
          quiz.closedAt = quiz.assessmentNow!;
          await db
            .collection<QuizDocument>("quizzes")
            .updateOne(
              { _id: quiz._id },
              { $set: { closedAt: quiz.closedAt } },
              { session },
            );
        }
        await settle(db, quiz, session);
        if (action === "release" && !quiz.resultsReleasedAt) {
          quiz.resultsReleasedAt = quiz.assessmentNow!;
          await db
            .collection<QuizDocument>("quizzes")
            .updateOne(
              { _id: quiz._id },
              { $set: { resultsReleasedAt: quiz.resultsReleasedAt } },
              { session },
            );
        }
        return safeQuiz(quiz);
      });
    },
    async expireDue() {
      const due = await attempts(database())
        .find(
          { status: "in_progress", $expr: { $lte: ["$deadlineAt", "$$NOW"] } },
          { projection: { quizId: 1 }, readPreference: "primary" },
        )
        .limit(100)
        .toArray();
      for (const id of new Set(due.map((row) => row.quizId)))
        await expireQuiz(id);
    },
  };
}
export type AssessmentRepository = ReturnType<
  typeof createAssessmentRepository
>;
