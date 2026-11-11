import { ObjectId, type Db } from "mongodb";
import type { z } from "zod";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type {
  announcementContent,
  CommunicationActor,
} from "./communication.schema.js";
type Announcement = z.infer<typeof announcementContent> & {
  _id: ObjectId;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt?: Date;
};
const projection = {
  _id: 1,
  title: 1,
  body: 1,
  published: 1,
  createdAt: 1,
  updatedAt: 1,
  version: 1,
};
const scope = (actor: CommunicationActor) => ({
  deletedAt: { $exists: false },
  ...(actor.role === "teacher" ? { createdBy: actor.id } : {}),
});
function view(row: Announcement, staff: boolean) {
  return {
    id: row._id.toHexString(),
    title: row.title,
    body: row.body,
    updatedAt: row.updatedAt.toISOString(),
    ...(staff ? { published: row.published, version: row.version } : {}),
  };
}
export function createAnnouncementRepository(database: () => Db = getDB) {
  const collection = () => database().collection<Announcement>("announcements");
  return {
    async detail(id: string) {
      const row = await collection().findOne(
        {
          _id: new ObjectId(id),
          published: true,
          deletedAt: { $exists: false },
        },
        { projection, readPreference: "primary" },
      );
      if (!row) throw new AppError(404, "Announcement not found.");
      return view(row, false);
    },
    async list(page: number, actor?: CommunicationActor) {
      const rows = await collection()
        .find(
          actor
            ? scope(actor)
            : { deletedAt: { $exists: false }, published: true },
          { projection, readPreference: "primary" },
        )
        .sort({ updatedAt: -1, _id: 1 })
        .skip((page - 1) * 12)
        .limit(13)
        .toArray();
      return {
        items: rows.slice(0, 12).map((row) => view(row, !!actor)),
        page,
        hasNext: rows.length > 12,
      };
    },
    async create(
      actor: CommunicationActor,
      input: z.infer<typeof announcementContent>,
    ) {
      const now = new Date();
      const row: Announcement = {
        ...input,
        _id: new ObjectId(),
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      await collection().insertOne(row);
      return view(row, true);
    },
    async update(
      actor: CommunicationActor,
      id: string,
      input: z.infer<typeof announcementContent>,
      version: number,
    ) {
      const row = await collection().findOneAndUpdate(
        { ...scope(actor), _id: new ObjectId(id), version },
        { $set: { ...input, updatedAt: new Date() }, $inc: { version: 1 } },
        { returnDocument: "after" },
      );
      if (!row)
        throw new AppError(
          409,
          "Announcement unavailable or changed. Refresh before editing.",
        );
      return view(row, true);
    },
    async remove(actor: CommunicationActor, id: string, version: number) {
      const result = await collection().updateOne(
        { ...scope(actor), _id: new ObjectId(id), version },
        {
          $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
            published: false,
          },
          $inc: { version: 1 },
        },
      );
      if (!result.modifiedCount)
        throw new AppError(
          409,
          "Announcement unavailable or changed. Refresh before archiving.",
        );
    },
  };
}
export type AnnouncementRepository = ReturnType<
  typeof createAnnouncementRepository
>;
