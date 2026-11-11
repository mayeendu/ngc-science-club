import { ObjectId, type Db, type Filter } from "mongodb";
import type { z } from "zod";
import { getDB } from "../../config/db.js";
import { findAuthorizationUser } from "../../lib/authorization-user.js";
import { AppError } from "../../utils/app-error.js";
import type {
  FeedbackActor,
  feedbackCreate,
  feedbackQuery,
} from "./feedback.schema.js";
type Message = { author: "member" | "staff"; message: string; sentAt: Date };
type FeedbackDocument = {
  _id: ObjectId;
  userId: string;
  name: string;
  category: string;
  subject: string;
  status: "open" | "in_review" | "resolved";
  messages: Message[];
  assignedTeacherId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
const scope = (
  actor: FeedbackActor,
  staff: boolean,
): Filter<FeedbackDocument> =>
  staff
    ? actor.role === "admin"
      ? {}
      : { assignedTeacherId: actor.id }
    : { userId: actor.id };
function view(row: FeedbackDocument, admin: boolean) {
  return {
    id: row._id.toHexString(),
    category: row.category,
    subject: row.subject,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: row.messages.map((item) => ({
      author: item.author,
      message: item.message,
      sentAt: item.sentAt.toISOString(),
    })),
    ...(admin
      ? { memberName: row.name, assignedTeacherId: row.assignedTeacherId }
      : {}),
  };
}
export function createFeedbackRepository(database: () => Db = getDB) {
  const collection = () =>
    database().collection<FeedbackDocument>("feedbackThreads");
  return {
    async create(actor: FeedbackActor, input: z.infer<typeof feedbackCreate>) {
      const now = new Date();
      const row: FeedbackDocument = {
        _id: new ObjectId(),
        userId: actor.id,
        name: actor.name,
        category: input.category,
        subject: input.subject,
        status: "open",
        messages: [{ author: "member", message: input.message, sentAt: now }],
        assignedTeacherId: "",
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await collection().insertOne(row);
      return view(row, false);
    },
    async list(
      actor: FeedbackActor,
      staff: boolean,
      query: z.infer<typeof feedbackQuery>,
    ) {
      const rows = await collection()
        .find(
          {
            ...scope(actor, staff),
            ...(query.status ? { status: query.status } : {}),
            ...(query.category ? { category: query.category } : {}),
          },
          {
            projection: {
              _id: 1,
              category: 1,
              subject: 1,
              status: 1,
              version: 1,
              createdAt: 1,
              updatedAt: 1,
              messages: 1,
              ...(staff && actor.role === "admin"
                ? { name: 1, assignedTeacherId: 1 }
                : {}),
            },
            readPreference: "primary",
          },
        )
        .sort({ updatedAt: -1, _id: 1 })
        .skip((query.page - 1) * 10)
        .limit(11)
        .toArray();
      return {
        items: rows
          .slice(0, 10)
          .map((row) => view(row, staff && actor.role === "admin")),
        page: query.page,
        hasNext: rows.length > 10,
      };
    },
    async reply(
      actor: FeedbackActor,
      staff: boolean,
      id: string,
      version: number,
      message: string,
      status?: FeedbackDocument["status"],
    ) {
      const now = new Date();
      const row = await collection().findOneAndUpdate(
        {
          _id: new ObjectId(id),
          ...scope(actor, staff),
          version,
          "messages.49": { $exists: false },
        },
        {
          $push: {
            messages: {
              author: staff ? "staff" : "member",
              message,
              sentAt: now,
            },
          },
          $set: { status: staff ? status! : "open", updatedAt: now },
          $inc: { version: 1 },
        },
        { returnDocument: "after" },
      );
      if (!row)
        throw new AppError(
          409,
          "Thread unavailable, changed, or reached its 50-message limit. Refresh before replying.",
        );
      return view(row, staff && actor.role === "admin");
    },
    async assign(id: string, version: number, teacherAccountId: string) {
      if (teacherAccountId) {
        const user = await findAuthorizationUser(teacherAccountId, database());
        if (user?.role !== "teacher" || user.banned === true)
          throw new AppError(400, "Select an existing active teacher.");
      }
      const result = await collection().updateOne(
        { _id: new ObjectId(id), version },
        {
          $set: { assignedTeacherId: teacherAccountId, updatedAt: new Date() },
          $inc: { version: 1 },
        },
      );
      if (!result.modifiedCount)
        throw new AppError(
          409,
          "Thread changed or unavailable. Refresh before assignment.",
        );
    },
  };
}
export type FeedbackRepository = ReturnType<typeof createFeedbackRepository>;
