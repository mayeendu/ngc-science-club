import { ObjectId, type Db, type ClientSession, type Filter } from "mongodb";
import { getDB, getMongoClient } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type {
  EventActor,
  EventContent,
  EventStatus,
  EventView,
} from "./event.schema.js";
export type EventDocument = Omit<EventContent, "startsAt"> & {
  _id: ObjectId;
  startsAt: Date;
  createdBy: string;
  status: EventStatus;
  version: number;
  registeredCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  operationNow?: Date;
  tick?: number;
};
export type EventRegistration = {
  _id: string;
  eventId: string;
  userId: string;
  name: string;
  status: "registered" | "cancelled";
  attendance: "unmarked" | "present" | "absent";
  version: number;
  registeredAt: Date;
  cancelledAt?: Date;
  markedBy?: string;
  markedAt?: Date;
};
type Transaction = <T>(
  work: (db: Db, session?: ClientSession) => Promise<T>,
) => Promise<T>;
const transaction: Transaction = (work) =>
  getMongoClient().withSession((session) =>
    session.withTransaction(() => work(getDB(), session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    }),
  );
const publicProjection = {
  _id: 1,
  title: 1,
  description: 1,
  category: 1,
  startsAt: 1,
  venue: 1,
  capacity: 1,
  image: 1,
  status: 1,
  registeredCount: 1,
  version: 1,
  createdAt: 1,
};
function view(row: EventDocument): EventView {
  return {
    id: row._id.toHexString(),
    title: row.title,
    description: row.description,
    category: row.category,
    startsAt: row.startsAt.toISOString(),
    venue: row.venue,
    capacity: row.capacity,
    image: row.image,
    status: row.status,
    registeredCount: row.registeredCount,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  };
}
function registrationView(row: EventRegistration) {
  return {
    id: row._id,
    status: row.status,
    attendance: row.attendance,
    version: row.version,
    registeredAt: row.registeredAt.toISOString(),
  };
}
const scope = (actor: EventActor): Filter<EventDocument> => ({
  deletedAt: { $exists: false },
  ...(actor.role === "teacher" ? { createdBy: actor.id } : {}),
});
export function createEventRepository(
  database: () => Db = getDB,
  run: Transaction = transaction,
) {
  const events = (db: Db) => db.collection<EventDocument>("events"),
    registrations = (db: Db) =>
      db.collection<EventRegistration>("eventRegistrations");
  async function approved(db: Db, userId: string, session?: ClientSession) {
    const member = await db
      .collection<{ _id: string; status: string; fullName: string }>(
        "membershipApplications",
      )
      .findOne(
        { _id: userId, status: "approved" },
        { session, projection: { fullName: 1 }, readPreference: "primary" },
      );
    if (!member) throw new AppError(403, "Approved membership required.");
    return member;
  }
  async function gate(
    db: Db,
    id: string,
    actor?: EventActor,
    session?: ClientSession,
  ) {
    const event = await events(db).findOneAndUpdate(
      {
        _id: new ObjectId(id),
        ...(actor
          ? scope(actor)
          : {
              deletedAt: { $exists: false },
              status: { $in: ["published", "cancelled"] },
            }),
      },
      [
        {
          $set: {
            operationNow: "$$NOW",
            tick: { $add: [{ $ifNull: ["$tick", 0] }, 1] },
          },
        },
      ],
      { session, returnDocument: "after" },
    );
    if (!event) throw new AppError(404, "Event not found.");
    return event;
  }
  const future = (row: EventDocument) => row.startsAt > row.operationNow!;
  function dateAllowed(input: EventContent, now: Date) {
    if (input.category !== "achievement" && new Date(input.startsAt) <= now)
      throw new AppError(400, "Event date and time must be in the future.");
  }
  return {
    async list(
      page: number,
      filter: {
        period?: "upcoming" | "past" | "all";
        category?: EventContent["category"];
        status?: EventStatus;
      } = {},
      actor?: EventActor,
    ) {
      const query: Filter<EventDocument> = {
        ...(actor
          ? scope(actor)
          : {
              deletedAt: { $exists: false },
              status: { $in: ["published", "cancelled"] },
            }),
        ...(filter.category ? { category: filter.category } : {}),
        ...(actor && filter.status ? { status: filter.status } : {}),
        ...(!actor && filter.period !== "all"
          ? {
              $expr: {
                [filter.period === "past" ? "$lte" : "$gt"]: [
                  "$startsAt",
                  "$$NOW",
                ],
              },
            }
          : {}),
      };
      const rows = await events(database())
        .find(query, {
          projection: publicProjection,
          readPreference: "primary",
        })
        .sort({ startsAt: filter.period === "past" ? -1 : 1, _id: 1 })
        .skip((page - 1) * 12)
        .limit(13)
        .toArray();
      return {
        events: rows.slice(0, 12).map(view),
        page,
        hasNext: rows.length > 12,
      };
    },
    async detail(id: string) {
      const row = await events(database()).findOne(
        {
          _id: new ObjectId(id),
          deletedAt: { $exists: false },
          status: { $in: ["published", "cancelled"] },
        },
        { projection: publicProjection, readPreference: "primary" },
      );
      if (!row) throw new AppError(404, "Event not found.");
      return view(row);
    },
    async create(actor: EventActor, input: EventContent) {
      const now = new Date();
      dateAllowed(input, now);
      const row: EventDocument = {
        ...input,
        _id: new ObjectId(),
        startsAt: new Date(input.startsAt),
        createdBy: actor.id,
        status: "draft",
        version: 1,
        registeredCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await events(database()).insertOne(row);
      return view(row);
    },
    async update(
      id: string,
      actor: EventActor,
      version: number,
      input: EventContent,
    ) {
      return run(async (db, session) => {
        const row = await gate(db, id, actor, session);
        if (
          row.version !== version ||
          row.status !== "draft" ||
          row.registeredCount !== 0
        )
          throw new AppError(409, "Only a current, empty draft can be edited.");
        dateAllowed(input, row.operationNow!);
        await events(db).updateOne(
          { _id: row._id, version },
          {
            $set: {
              ...input,
              startsAt: new Date(input.startsAt),
              updatedAt: row.operationNow,
            },
            $inc: { version: 1 },
          },
          { session },
        );
        return view({
          ...row,
          ...input,
          startsAt: new Date(input.startsAt),
          version: version + 1,
        });
      });
    },
    async changeStatus(
      id: string,
      actor: EventActor,
      version: number,
      status: EventStatus,
    ) {
      return run(async (db, session) => {
        const row = await gate(db, id, actor, session);
        if (
          row.version !== version ||
          row.status === "cancelled" ||
          row.status === status
        )
          throw new AppError(
            409,
            "Event changed or transition is unavailable.",
          );
        if (status === "draft" && (row.registeredCount > 0 || !future(row)))
          throw new AppError(
            409,
            "An event with registrations or a past start cannot become a draft.",
          );
        if (status === "published")
          dateAllowed(
            { ...row, startsAt: row.startsAt.toISOString() },
            row.operationNow!,
          );
        if (
          status === "cancelled" &&
          (row.status !== "published" || !future(row))
        )
          throw new AppError(
            409,
            "Only an upcoming published event can be cancelled.",
          );
        await events(db).updateOne(
          { _id: row._id, version },
          {
            $set: { status, updatedAt: row.operationNow },
            $inc: { version: 1 },
          },
          { session },
        );
        return view({ ...row, status, version: version + 1 });
      });
    },
    async remove(id: string, actor: EventActor, version: number) {
      return run(async (db, session) => {
        const row = await gate(db, id, actor, session);
        if (
          row.version !== version ||
          row.status !== "draft" ||
          row.registeredCount !== 0
        )
          throw new AppError(
            409,
            "Only a current, empty draft can be archived.",
          );
        await events(db).updateOne(
          { _id: row._id },
          { $set: { deletedAt: row.operationNow }, $inc: { version: 1 } },
          { session },
        );
      });
    },
    async own(id: string, userId: string) {
      await approved(database(), userId);
      const event = await this.detail(id);
      const row = await registrations(database()).findOne(
        { _id: `${id}:${userId}`, userId },
        { readPreference: "primary" },
      );
      return { event, registration: row ? registrationView(row) : null };
    },
    async register(id: string, userId: string, cancel = false) {
      return run(async (db, session) => {
        const member = await approved(db, userId, session),
          row = await gate(db, id, undefined, session);
        const key = `${id}:${userId}`,
          existing = await registrations(db).findOne(
            { _id: key, userId },
            { session },
          );
        if (cancel) {
          if (!existing || existing.status === "cancelled")
            return {
              event: view(row),
              registration: existing ? registrationView(existing) : null,
            };
          if (!future(row))
            throw new AppError(
              409,
              "Registration cannot be cancelled after the event starts.",
            );
          const updated = await events(db).updateOne(
            { _id: row._id, registeredCount: { $gt: 0 } },
            { $inc: { registeredCount: -1 } },
            { session },
          );
          if (!updated.matchedCount)
            throw new AppError(
              409,
              "Registration count changed. Please retry.",
            );
          await registrations(db).updateOne(
            { _id: key, status: "registered" },
            {
              $set: { status: "cancelled", cancelledAt: row.operationNow },
              $inc: { version: 1 },
            },
            { session },
          );
          return {
            event: view({ ...row, registeredCount: row.registeredCount - 1 }),
            registration: registrationView({
              ...existing,
              status: "cancelled",
              version: existing.version + 1,
            }),
          };
        }
        if (existing?.status === "registered")
          return { event: view(row), registration: registrationView(existing) };
        if (
          row.status !== "published" ||
          !future(row) ||
          row.category === "achievement"
        )
          throw new AppError(409, "Registration is closed for this event.");
        const reserved = await events(db).updateOne(
          {
            _id: row._id,
            status: "published",
            $expr: { $lt: ["$registeredCount", "$capacity"] },
          },
          { $inc: { registeredCount: 1 } },
          { session },
        );
        if (!reserved.matchedCount)
          throw new AppError(409, "This event is full.");
        const next: EventRegistration = {
          _id: key,
          eventId: id,
          userId,
          name: member.fullName,
          status: "registered",
          attendance: "unmarked",
          version: (existing?.version ?? 0) + 1,
          registeredAt: row.operationNow!,
        };
        await registrations(db).replaceOne({ _id: key }, next, {
          session,
          upsert: true,
        });
        return {
          event: view({ ...row, registeredCount: row.registeredCount + 1 }),
          registration: registrationView(next),
        };
      });
    },
    async mine(userId: string, page: number) {
      await approved(database(), userId);
      const rows = await registrations(database())
        .aggregate<{ event: EventDocument; registration: EventRegistration }>(
          [
            { $match: { userId } },
            { $sort: { registeredAt: -1, _id: 1 } },
            {
              $lookup: {
                from: "events",
                let: { id: "$eventId" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$_id", { $toObjectId: "$$id" }] },
                      deletedAt: { $exists: false },
                      status: { $in: ["published", "cancelled"] },
                    },
                  },
                  { $project: publicProjection },
                ],
                as: "event",
              },
            },
            { $unwind: "$event" },
            { $skip: (page - 1) * 12 },
            { $limit: 13 },
            {
              $project: {
                _id: 0,
                event: 1,
                registration: {
                  _id: "$_id",
                  status: "$status",
                  attendance: "$attendance",
                  version: "$version",
                  registeredAt: "$registeredAt",
                },
              },
            },
          ],
          { readPreference: "primary", maxTimeMS: 10000 },
        )
        .toArray();
      return {
        items: rows.slice(0, 12).map((row) => ({
          event: view(row.event),
          registration: registrationView(row.registration),
        })),
        page,
        hasNext: rows.length > 12,
      };
    },
    async participants(id: string, actor: EventActor, page: number) {
      return run(async (db, session) => {
        const row = await gate(db, id, actor, session);
        const items = await registrations(db)
          .find(
            { eventId: id, status: "registered" },
            {
              session,
              projection: {
                _id: 1,
                name: 1,
                status: 1,
                attendance: 1,
                version: 1,
                registeredAt: 1,
              },
            },
          )
          .sort({ registeredAt: 1, _id: 1 })
          .skip((page - 1) * 20)
          .limit(21)
          .toArray();
        const [counts] = await registrations(db)
          .aggregate<{ registered: number; present: number; absent: number }>(
            [
              { $match: { eventId: id, status: "registered" } },
              {
                $group: {
                  _id: null,
                  registered: { $sum: 1 },
                  present: {
                    $sum: {
                      $cond: [{ $eq: ["$attendance", "present"] }, 1, 0],
                    },
                  },
                  absent: {
                    $sum: { $cond: [{ $eq: ["$attendance", "absent"] }, 1, 0] },
                  },
                },
              },
            ],
            { session, maxTimeMS: 10000 },
          )
          .toArray();
        return {
          event: view(row),
          items: items
            .slice(0, 20)
            .map((item) => ({ ...registrationView(item), name: item.name })),
          counts: {
            registered: counts?.registered ?? 0,
            present: counts?.present ?? 0,
            absent: counts?.absent ?? 0,
          },
          page,
          hasNext: items.length > 20,
        };
      });
    },
    async attendance(
      id: string,
      actor: EventActor,
      input: {
        registrationId: string;
        attendance: "present" | "absent";
        version: number;
      },
    ) {
      return run(async (db, session) => {
        const row = await gate(db, id, actor, session);
        if (row.status !== "published" || future(row))
          throw new AppError(
            409,
            "Attendance opens when a published event starts.",
          );
        const updated = await registrations(db).findOneAndUpdate(
          {
            _id: input.registrationId,
            eventId: id,
            status: "registered",
            version: input.version,
          },
          {
            $set: {
              attendance: input.attendance,
              markedBy: actor.id,
              markedAt: row.operationNow,
            },
            $inc: { version: 1 },
          },
          { session, returnDocument: "after" },
        );
        if (!updated)
          throw new AppError(
            409,
            "Registration changed or was not found. Refresh before marking attendance.",
          );
        return { ...registrationView(updated), name: updated.name };
      });
    },
    async statistics(actor: EventActor) {
      const [result] = await events(database())
        .aggregate<{
          totals: {
            total: number;
            published: number;
            draft: number;
            cancelled: number;
            registrations: number;
          }[];
          categories: { _id: string; count: number }[];
        }>(
          [
            { $match: scope(actor) },
            {
              $facet: {
                totals: [
                  {
                    $group: {
                      _id: null,
                      total: { $sum: 1 },
                      published: {
                        $sum: {
                          $cond: [{ $eq: ["$status", "published"] }, 1, 0],
                        },
                      },
                      draft: {
                        $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
                      },
                      cancelled: {
                        $sum: {
                          $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
                        },
                      },
                      registrations: { $sum: "$registeredCount" },
                    },
                  },
                ],
                categories: [
                  { $group: { _id: "$category", count: { $sum: 1 } } },
                  { $sort: { _id: 1 } },
                ],
              },
            },
          ],
          { readPreference: "primary", maxTimeMS: 10000 },
        )
        .toArray();
      const [attendance] = await registrations(database())
        .aggregate<{ present: number; absent: number }>(
          [
            { $match: { status: "registered" } },
            {
              $lookup: {
                from: "events",
                let: { id: "$eventId" },
                pipeline: [
                  {
                    $match: {
                      ...scope(actor),
                      $expr: { $eq: ["$_id", { $toObjectId: "$$id" }] },
                    },
                  },
                  { $project: { _id: 1 } },
                ],
                as: "event",
              },
            },
            { $match: { "event.0": { $exists: true } } },
            {
              $group: {
                _id: null,
                present: {
                  $sum: { $cond: [{ $eq: ["$attendance", "present"] }, 1, 0] },
                },
                absent: {
                  $sum: { $cond: [{ $eq: ["$attendance", "absent"] }, 1, 0] },
                },
              },
            },
          ],
          { readPreference: "primary", maxTimeMS: 10000 },
        )
        .toArray();
      return {
        total: result?.totals[0]?.total ?? 0,
        published: result?.totals[0]?.published ?? 0,
        draft: result?.totals[0]?.draft ?? 0,
        cancelled: result?.totals[0]?.cancelled ?? 0,
        registrations: result?.totals[0]?.registrations ?? 0,
        present: attendance?.present ?? 0,
        absent: attendance?.absent ?? 0,
        categories: (result?.categories ?? []).map((row) => ({
          category: row._id,
          count: row.count,
        })),
      };
    },
  };
}
export type EventRepository = ReturnType<typeof createEventRepository>;
