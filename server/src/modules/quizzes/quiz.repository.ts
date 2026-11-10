import { ObjectId, type Db, type Filter } from "mongodb";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type {
  QuizActor,
  QuizContent,
  QuizDetail,
  QuizList,
  QuizSummary,
} from "./quiz.schema.js";

export type QuizDocument = QuizContent & {
  _id: ObjectId;
  createdBy: string;
  status: "draft" | "published";
  totalMarks: number;
  questionCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  hasAttempts?: boolean;
  closedAt?: Date;
  resultsReleasedAt?: Date;
  assessmentNow?: Date;
  assessmentTick?: number;
};
const projection = {
  hasAttempts: 1,
  closedAt: 1,
  resultsReleasedAt: 1,
  _id: 1,
  title: 1,
  description: 1,
  subject: 1,
  durationMinutes: 1,
  totalMarks: 1,
  questionCount: 1,
  status: 1,
  version: 1,
  createdAt: 1,
  updatedAt: 1,
};
function summary(doc: QuizDocument): QuizSummary {
  return {
    hasAttempts: doc.hasAttempts === true,
    closed: !!doc.closedAt,
    resultsReleased: !!doc.resultsReleasedAt,
    id: doc._id.toHexString(),
    title: doc.title,
    description: doc.description,
    subject: doc.subject,
    durationMinutes: doc.durationMinutes,
    totalMarks: doc.totalMarks,
    questionCount: doc.questionCount,
    status: doc.status,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
function detail(doc: QuizDocument): QuizDetail {
  return {
    ...summary(doc),
    questions: doc.questions.map((question) => ({
      text: question.text,
      options: question.options,
      correctOption: question.correctOption,
      marks: question.marks,
      explanation: question.explanation ?? "",
    })),
  };
}
function scope(actor: QuizActor): Filter<QuizDocument> {
  return {
    deletedAt: { $exists: false },
    ...(actor.role === "admin" ? {} : { createdBy: actor.id }),
  };
}
function computed(input: QuizContent) {
  return {
    totalMarks: input.questions.reduce(
      (sum, question) => sum + question.marks,
      0,
    ),
    questionCount: input.questions.length,
  };
}
export interface QuizRepository {
  list(
    actor: QuizActor,
    page: number,
    status?: "draft" | "published",
  ): Promise<QuizList>;
  detail(id: string, actor: QuizActor): Promise<QuizDetail>;
  create(actor: QuizActor, input: QuizContent): Promise<QuizDetail>;
  update(
    id: string,
    actor: QuizActor,
    version: number,
    input: QuizContent,
  ): Promise<QuizDetail>;
  setStatus(
    id: string,
    actor: QuizActor,
    version: number,
    status: "draft" | "published",
  ): Promise<QuizSummary>;
  remove(id: string, actor: QuizActor, version: number): Promise<void>;
}
export function createQuizRepository(
  database: () => Db = getDB,
): QuizRepository {
  const collection = () => database().collection<QuizDocument>("quizzes");
  const target = (id: string, actor: QuizActor): Filter<QuizDocument> => ({
    ...scope(actor),
    _id: new ObjectId(id),
  });
  async function conflict(id: string, actor: QuizActor): Promise<never> {
    if (
      !(await collection().findOne(target(id, actor), {
        projection: { _id: 1 },
        readPreference: "primary",
      }))
    )
      throw new AppError(404, "Quiz not found.");
    throw new AppError(
      409,
      "Quiz changed or is not in the required state. Refresh and try again.",
    );
  }
  return {
    async list(actor, page, status) {
      const records = await collection()
        .find(
          { ...scope(actor), ...(status ? { status } : {}) },
          { projection, readPreference: "primary" },
        )
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * 10)
        .limit(11)
        .toArray();
      return {
        quizzes: records.slice(0, 10).map(summary),
        page,
        hasNext: records.length > 10,
      };
    },
    async detail(id, actor) {
      const doc = await collection().findOne(target(id, actor), {
        readPreference: "primary",
      });
      if (!doc) throw new AppError(404, "Quiz not found.");
      return detail(doc);
    },
    async create(actor, input) {
      const now = new Date();
      const doc: QuizDocument = {
        ...input,
        ...computed(input),
        _id: new ObjectId(),
        createdBy: actor.id,
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await collection().insertOne(doc);
      return detail(doc);
    },
    async update(id, actor, version, input) {
      const doc = await collection().findOneAndUpdate(
        {
          ...target(id, actor),
          status: "draft",
          version,
          hasAttempts: { $ne: true },
          closedAt: { $exists: false },
        },
        {
          $set: { ...input, ...computed(input), updatedAt: new Date() },
          $inc: { version: 1 },
        },
        { returnDocument: "after" },
      );
      if (!doc) return conflict(id, actor);
      return detail(doc);
    },
    async setStatus(id, actor, version, status) {
      const doc = await collection().findOneAndUpdate(
        {
          ...target(id, actor),
          version,
          status: status === "published" ? "draft" : "published",
          hasAttempts: { $ne: true },
          closedAt: { $exists: false },
        },
        { $set: { status, updatedAt: new Date() }, $inc: { version: 1 } },
        { returnDocument: "after" },
      );
      if (!doc) return conflict(id, actor);
      return summary(doc);
    },
    async remove(id, actor, version) {
      const doc = await collection().findOneAndUpdate(
        {
          ...target(id, actor),
          version,
          status: "draft",
          hasAttempts: { $ne: true },
          closedAt: { $exists: false },
        },
        {
          $set: { deletedAt: new Date(), updatedAt: new Date() },
          $inc: { version: 1 },
        },
        { returnDocument: "after", projection: { _id: 1 } },
      );
      if (!doc) return conflict(id, actor);
    },
  };
}
