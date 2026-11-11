import { type Db, type Document } from "mongodb";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type { CommunicationActor } from "./communication.schema.js";
type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  date: Date;
  revision: Date;
  read: boolean;
};
const prefix = (kind: string, value: unknown) => ({
  $concat: [kind + ":", { $toString: value }],
});
// Every source carries its own audience predicate before any read-state join.
export function notificationPipeline(
  actor: CommunicationActor,
  approved: boolean,
): Document[] {
  const student = actor.role === "student" && approved;
  return [
    { $match: { published: true, deletedAt: { $exists: false } } },
    {
      $project: {
        _id: 0,
        id: prefix("announcement", "$_id"),
        kind: { $literal: "announcement" },
        title: 1,
        body: {
          $literal: "A club announcement has been published or updated.",
        },
        href: { $concat: ["/announcements/", { $toString: "$_id" }] },
        date: "$updatedAt",
        revision: "$updatedAt",
      },
    },
    {
      $unionWith: {
        coll: "membershipApplications",
        pipeline: [
          {
            $match: {
              _id: actor.id,
              status: { $in: ["approved", "rejected"] },
              reviewedAt: { $type: "date" },
            },
          },
          {
            $project: {
              _id: 0,
              id: prefix("membership", "$_id"),
              kind: { $literal: "membership" },
              title: { $literal: "Membership decision" },
              body: {
                $concat: ["Your membership application was ", "$status", "."],
              },
              href: { $literal: "/dashboard/student" },
              date: "$reviewedAt",
              revision: "$reviewedAt",
            },
          },
        ],
      },
    },
    {
      $unionWith: {
        coll: "quizzes",
        pipeline: [
          {
            $match: student
              ? { status: "published", deletedAt: { $exists: false } }
              : { _id: { $exists: false } },
          },
          {
            $lookup: {
              from: "quizAttempts",
              let: { quizId: { $toString: "$_id" } },
              pipeline: [
                {
                  $match: {
                    userId: actor.id,
                    status: "submitted",
                    $expr: { $eq: ["$quizId", "$$quizId"] },
                  },
                },
                { $project: { _id: 1 } },
                { $limit: 1 },
              ],
              as: "ownAttempt",
            },
          },
          {
            $match: {
              $or: [
                { closedAt: { $exists: false } },
                {
                  resultsReleasedAt: { $type: "date" },
                  "ownAttempt.0": { $exists: true },
                },
              ],
            },
          },
          {
            $project: {
              _id: 0,
              id: prefix("quiz", "$_id"),
              kind: { $literal: "quiz" },
              title: 1,
              body: {
                $cond: [
                  { $ne: [{ $ifNull: ["$resultsReleasedAt", null] }, null] },
                  "Your quiz result is available.",
                  "A science quiz is available.",
                ],
              },
              href: {
                $concat: ["/dashboard/student/quizzes/", { $toString: "$_id" }],
              },
              date: { $max: ["$updatedAt", "$resultsReleasedAt", "$closedAt"] },
              revision: {
                $max: ["$updatedAt", "$resultsReleasedAt", "$closedAt"],
              },
            },
          },
        ],
      },
    },
    {
      $unionWith: {
        coll: "eventRegistrations",
        pipeline: [
          { $match: { userId: actor.id } },
          {
            $lookup: {
              from: "events",
              let: { eventId: "$eventId" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [
                        "$_id",
                        {
                          $convert: {
                            input: "$$eventId",
                            to: "objectId",
                            onError: null,
                            onNull: null,
                          },
                        },
                      ],
                    },
                    deletedAt: { $exists: false },
                    status: { $in: ["published", "cancelled"] },
                  },
                },
                { $project: { _id: 1, title: 1, updatedAt: 1, status: 1 } },
              ],
              as: "event",
            },
          },
          { $unwind: "$event" },
          {
            $project: {
              _id: 0,
              id: prefix("event", "$event._id"),
              kind: { $literal: "event" },
              title: "$event.title",
              body: {
                $cond: [
                  { $eq: ["$event.status", "cancelled"] },
                  "An event you registered for has been cancelled.",
                  "Your event registration or activity has an update.",
                ],
              },
              href: { $literal: "/dashboard/student/events" },
              date: {
                $max: [
                  "$event.updatedAt",
                  "$registeredAt",
                  "$cancelledAt",
                  "$markedAt",
                ],
              },
              revision: {
                $max: [
                  "$event.updatedAt",
                  "$registeredAt",
                  "$cancelledAt",
                  "$markedAt",
                ],
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "notificationReadStates",
        let: {
          stateId: { $concat: [{ $literal: actor.id + ":" }, "$id"] },
          revision: "$revision",
        },
        pipeline: [
          {
            $match: {
              read: true,
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$stateId"] },
                  { $eq: ["$revision", "$$revision"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "readState",
      },
    },
    { $set: { read: { $gt: [{ $size: "$readState" }, 0] } } },
    {
      $project: {
        _id: 0,
        id: 1,
        kind: 1,
        title: 1,
        body: 1,
        href: 1,
        date: 1,
        revision: 1,
        read: 1,
      },
    },
  ];
}
function view(row: Notice) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    date: row.date.toISOString(),
    read: row.read,
  };
}
export function createNotificationRepository(database: () => Db = getDB) {
  async function approved(actor: CommunicationActor) {
    return (
      actor.role === "student" &&
      !!(await database()
        .collection<{ _id: string; status: string }>("membershipApplications")
        .findOne(
          { _id: actor.id, status: "approved" },
          { projection: { _id: 1 }, readPreference: "primary" },
        ))
    );
  }
  return {
    async list(actor: CommunicationActor, page: number) {
      const [data] = await database()
        .collection("announcements")
        .aggregate<{ items: Notice[]; unread: { count: number }[] }>(
          [
            ...notificationPipeline(actor, await approved(actor)),
            {
              $facet: {
                items: [
                  { $sort: { date: -1, id: 1 } },
                  { $skip: (page - 1) * 20 },
                  { $limit: 21 },
                ],
                unread: [{ $match: { read: false } }, { $count: "count" }],
              },
            },
          ],
          { maxTimeMS: 10_000, readPreference: "primary" },
        )
        .toArray();
      return {
        items: (data?.items ?? []).slice(0, 20).map(view),
        unreadCount: data?.unread[0]?.count ?? 0,
        page,
        hasNext: (data?.items.length ?? 0) > 20,
      };
    },
    async mark(actor: CommunicationActor, id: string, read: boolean) {
      const [row] = await database()
        .collection("announcements")
        .aggregate<Notice>(
          [
            ...notificationPipeline(actor, await approved(actor)),
            { $match: { id } },
            { $limit: 1 },
          ],
          { maxTimeMS: 10_000, readPreference: "primary" },
        )
        .toArray();
      if (!row) throw new AppError(404, "Notification not found.");
      // Natural key prevents duplicate read states; source revisions make later updates unread.
      await database()
        .collection<{
          _id: string;
          read: boolean;
          revision: Date;
          updatedAt: Date;
        }>("notificationReadStates")
        .updateOne(
          { _id: actor.id + ":" + id },
          { $set: { read, revision: row.revision, updatedAt: new Date() } },
          { upsert: true },
        );
    },
  };
}
export type NotificationRepository = ReturnType<
  typeof createNotificationRepository
>;
