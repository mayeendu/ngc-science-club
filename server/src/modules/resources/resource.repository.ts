import { ObjectId, type Db } from "mongodb";
import type { z } from "zod";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type {
  resourceContent,
  resourceQuery,
  ResourceActor,
} from "./resource.schema.js";
import {
  gridResourceStorage,
  validateResourceFile,
  type ResourceStorage,
} from "./resource-files.js";
type Resource = z.infer<typeof resourceContent> & {
  _id: ObjectId;
  createdBy: string;
  published: boolean;
  version: number;
  updatedAt: Date;
  createdAt: Date;
  deletedAt?: Date;
  file?: ReturnType<typeof validateResourceFile> & { id: ObjectId };
};
const scope = (actor: ResourceActor) => ({
  deletedAt: { $exists: false },
  ...(actor.role === "teacher" ? { createdBy: actor.id } : {}),
});
const view = (row: Resource, staff: boolean) => ({
  id: row._id.toHexString(),
  title: row.title,
  description: row.description,
  category: row.category,
  format: row.format,
  url: row.url,
  updatedAt: row.updatedAt.toISOString(),
  file: row.file
    ? { name: row.file.name, mime: row.file.mime, size: row.file.size }
    : null,
  ...(staff ? { version: row.version, published: row.published } : {}),
});
export function createResourceRepository(
  database: () => Db = getDB,
  storage: ResourceStorage = gridResourceStorage,
) {
  const collection = () => database().collection<Resource>("learningResources");
  async function student(actor: ResourceActor) {
    if (
      actor.role === "student" &&
      !(await database()
        .collection<{ _id: string; status: string }>("membershipApplications")
        .findOne(
          { _id: actor.id, status: "approved" },
          { projection: { _id: 1 }, readPreference: "primary" },
        ))
    )
      throw new AppError(403, "Approved membership required.");
  }
  return {
    async list(
      actor: ResourceActor,
      staff: boolean,
      query: z.infer<typeof resourceQuery>,
    ) {
      if (!staff) await student(actor);
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rows = await collection()
        .find(
          {
            ...(staff
              ? scope(actor)
              : { deletedAt: { $exists: false }, published: true }),
            ...(query.category ? { category: query.category } : {}),
            ...(escaped ? { title: { $regex: escaped, $options: "i" } } : {}),
          },
          {
            projection: {
              _id: 1,
              title: 1,
              description: 1,
              category: 1,
              format: 1,
              url: 1,
              updatedAt: 1,
              file: 1,
              ...(staff ? { version: 1, published: 1 } : {}),
            },
            readPreference: "primary",
            maxTimeMS: 10000,
          },
        )
        .sort({ updatedAt: -1, _id: 1 })
        .skip((query.page - 1) * 12)
        .limit(13)
        .toArray();
      return {
        items: rows.slice(0, 12).map((row) => view(row, staff)),
        page: query.page,
        hasNext: rows.length > 12,
      };
    },
    async create(actor: ResourceActor, input: z.infer<typeof resourceContent>) {
      const now = new Date();
      const row: Resource = {
        ...input,
        _id: new ObjectId(),
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
        published: false,
        version: 1,
      };
      await collection().insertOne(row);
      return view(row, true);
    },
    async update(
      actor: ResourceActor,
      id: string,
      input: z.infer<typeof resourceContent>,
      version: number,
    ) {
      const row = await collection().findOneAndUpdate(
        {
          ...scope(actor),
          _id: new ObjectId(id),
          version,
          published: false,
          $or: [{ file: { $exists: false } }, { format: input.format }],
        },
        { $set: { ...input, updatedAt: new Date() }, $inc: { version: 1 } },
        { returnDocument: "after" },
      );
      if (!row)
        throw new AppError(
          409,
          "Unpublish before editing; preserve file format or create a new resource. Refresh changed records.",
        );
      return view(row, true);
    },
    async publish(
      actor: ResourceActor,
      id: string,
      version: number,
      published: boolean,
    ) {
      const row = await collection().findOneAndUpdate(
        {
          ...scope(actor),
          _id: new ObjectId(id),
          version,
          ...(published
            ? {
                $or: [
                  { format: "link", url: { $ne: "" } },
                  { "file.id": { $exists: true } },
                ],
              }
            : {}),
        },
        { $set: { published, updatedAt: new Date() }, $inc: { version: 1 } },
        { returnDocument: "after" },
      );
      if (!row)
        throw new AppError(
          409,
          "Upload a file before publishing, or refresh changed records.",
        );
      return view(row, true);
    },
    async remove(actor: ResourceActor, id: string, version: number) {
      const result = await collection().updateOne(
        { ...scope(actor), _id: new ObjectId(id), version },
        {
          $set: { published: false, deletedAt: new Date() },
          $inc: { version: 1 },
        },
      );
      if (!result.modifiedCount)
        throw new AppError(409, "Resource changed or unavailable.");
    },
    async upload(
      actor: ResourceActor,
      id: string,
      version: number,
      name: string,
      bytes: Buffer,
    ) {
      const filter = {
        ...scope(actor),
        _id: new ObjectId(id),
        version,
        published: false,
      };
      const current = await collection().findOne(filter, {
        readPreference: "primary",
      });
      if (!current)
        throw new AppError(409, "Unpublish and refresh before uploading.");
      const oldFileId = current.file?.id;
      const file = validateResourceFile(bytes, name, current.format);
      const fileId = await storage.upload(bytes);
      try {
        const row = await collection().findOneAndUpdate(
          filter,
          {
            $set: { file: { ...file, id: fileId }, updatedAt: new Date() },
            $inc: { version: 1 },
          },
          { returnDocument: "after" },
        );
        if (!row) throw new AppError(409, "Resource changed during upload.");
        if (oldFileId)
          await storage.remove(oldFileId).catch(() => {
            console.error("Old resource file cleanup failed.");
          });
        return view(row, true);
      } catch (error) {
        await storage.remove(fileId).catch(() => {
          console.error("Unlinked resource file cleanup failed.");
        });
        throw error;
      }
    },
    async download(actor: ResourceActor, staff: boolean, id: string) {
      if (!staff) await student(actor);
      const row = await collection().findOne(
        {
          _id: new ObjectId(id),
          ...(staff
            ? scope(actor)
            : { published: true, deletedAt: { $exists: false } }),
        },
        { readPreference: "primary" },
      );
      if (!row?.file) throw new AppError(404, "Resource file not found.");
      return { file: row.file, stream: storage.download(row.file.id) };
    },
  };
}
export type ResourceRepository = ReturnType<typeof createResourceRepository>;
