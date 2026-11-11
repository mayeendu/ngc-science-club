import { ObjectId, type Db } from "mongodb";
import { getDB } from "../../config/db.js";
import { findAuthorizationUser } from "../../lib/authorization-user.js";
import { AppError } from "../../utils/app-error.js";
import type { FacultyContent } from "./faculty.schema.js";
type FacultyDocument = FacultyContent & {
  _id: ObjectId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};
const projection = {
  _id: 1,
  name: 1,
  designation: 1,
  department: 1,
  specialization: 1,
  photo: 1,
  bio: 1,
};
function view(row: FacultyDocument, admin: boolean) {
  return {
    id: row._id.toHexString(),
    name: row.name,
    designation: row.designation,
    department: row.department,
    specialization: row.specialization,
    photo: row.photo,
    bio: row.bio,
    ...(admin
      ? {
          published: row.published,
          teacherAccountId: row.teacherAccountId,
          assignedEventIds: row.assignedEventIds,
          version: row.version,
        }
      : {}),
  };
}
export function createFacultyRepository(database: () => Db = getDB) {
  const collection = () =>
    database().collection<FacultyDocument>("facultyProfiles");
  async function validateLinks(input: FacultyContent) {
    if (input.teacherAccountId) {
      const user = await findAuthorizationUser(
        input.teacherAccountId,
        database(),
      );
      if (user?.role !== "teacher" || user.banned === true)
        throw new AppError(
          400,
          "Link an existing active teacher account. Profile creation never grants roles.",
        );
    }
    if (input.assignedEventIds.length) {
      const count = await database()
        .collection("events")
        .countDocuments({
          _id: { $in: input.assignedEventIds.map((id) => new ObjectId(id)) },
          deletedAt: { $exists: false },
        });
      if (count !== input.assignedEventIds.length)
        throw new AppError(
          400,
          "One or more assigned activities do not exist.",
        );
    }
  }
  return {
    async list(admin: boolean, page: number, department?: string) {
      const rows = await collection()
        .find(
          {
            deletedAt: { $exists: false },
            ...(admin ? {} : { published: true }),
            ...(department ? { department } : {}),
          },
          { ...(admin ? {} : { projection }), readPreference: "primary" },
        )
        .sort({ name: 1, _id: 1 })
        .skip((page - 1) * 12)
        .limit(13)
        .toArray();
      return {
        items: rows.slice(0, 12).map((row) => view(row, admin)),
        page,
        hasNext: rows.length > 12,
      };
    },
    async detail(id: string) {
      const row = await collection().findOne(
        {
          _id: new ObjectId(id),
          published: true,
          deletedAt: { $exists: false },
        },
        { projection, readPreference: "primary" },
      );
      if (!row) throw new AppError(404, "Faculty profile not found.");
      return view(row, false);
    },
    async create(input: FacultyContent) {
      await validateLinks(input);
      const now = new Date();
      const row: FacultyDocument = {
        ...input,
        _id: new ObjectId(),
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await collection().insertOne(row);
      return view(row, true);
    },
    async update(id: string, input: FacultyContent, version: number) {
      await validateLinks(input);
      const row = await collection().findOneAndUpdate(
        { _id: new ObjectId(id), version, deletedAt: { $exists: false } },
        { $set: { ...input, updatedAt: new Date() }, $inc: { version: 1 } },
        { returnDocument: "after" },
      );
      if (!row)
        throw new AppError(
          409,
          "Profile changed or was archived. Refresh before editing.",
        );
      return view(row, true);
    },
    async remove(id: string, version: number) {
      const result = await collection().updateOne(
        { _id: new ObjectId(id), version, deletedAt: { $exists: false } },
        {
          $set: {
            deletedAt: new Date(),
            published: false,
            assignedEventIds: [],
            teacherAccountId: "",
          },
          $inc: { version: 1 },
        },
      );
      if (!result.modifiedCount)
        throw new AppError(
          409,
          "Profile changed or was archived. Refresh before archiving.",
        );
    },
    async assigned(userId: string, page: number) {
      const [data] = await collection()
        .aggregate<{
          items: {
            id: string;
            title: string;
            startsAt: Date;
            venue: string;
            status: string;
          }[];
        }>(
          [
            {
              $match: {
                teacherAccountId: userId,
                deletedAt: { $exists: false },
              },
            },
            { $unwind: "$assignedEventIds" },
            { $group: { _id: "$assignedEventIds" } },
            {
              $lookup: {
                from: "events",
                let: { eventId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$_id", { $toObjectId: "$$eventId" }] },
                      deletedAt: { $exists: false },
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      title: 1,
                      startsAt: 1,
                      venue: 1,
                      status: 1,
                    },
                  },
                ],
                as: "event",
              },
            },
            { $unwind: "$event" },
            { $sort: { "event.startsAt": -1, _id: 1 } },
            { $skip: (page - 1) * 20 },
            { $limit: 21 },
            {
              $project: {
                _id: 0,
                id: { $toString: "$event._id" },
                title: "$event.title",
                startsAt: "$event.startsAt",
                venue: "$event.venue",
                status: "$event.status",
              },
            },
            { $group: { _id: null, items: { $push: "$$ROOT" } } },
          ],
          { maxTimeMS: 10_000, readPreference: "primary" },
        )
        .toArray();
      return {
        items: (data?.items ?? [])
          .slice(0, 20)
          .map((row) => ({
            id: row.id,
            title: row.title,
            startsAt: row.startsAt.toISOString(),
            venue: row.venue,
            status: row.status,
          })),
        page,
        hasNext: (data?.items.length ?? 0) > 20,
      };
    },
  };
}
export type FacultyRepository = ReturnType<typeof createFacultyRepository>;
