import { ObjectId, type Db } from "mongodb";
import type { z } from "zod";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type { ResourceActor } from "../resources/resource.schema.js";
import type { showcaseContent, showcaseQuery } from "./showcase.schema.js";
type Showcase = z.infer<typeof showcaseContent> & {
  _id: ObjectId;
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};
const scope = (actor?: ResourceActor) => ({
  deletedAt: { $exists: false },
  ...(actor
    ? actor.role === "teacher"
      ? { createdBy: actor.id }
      : {}
    : { published: true }),
});
const view = (row: Showcase, staff: boolean) => ({
  id: row._id.toHexString(),
  kind: row.kind,
  title: row.title,
  description: row.description,
  occurredOn: row.occurredOn,
  image: row.image,
  ...(staff ? { published: row.published, version: row.version } : {}),
});
export function createShowcaseRepository(database: () => Db = getDB) {
  const collection = () => database().collection<Showcase>("clubShowcase");
  return {
    async list(query: z.infer<typeof showcaseQuery>, actor?: ResourceActor) {
      const rows = await collection()
        .find(
          { ...scope(actor), ...(query.kind ? { kind: query.kind } : {}) },
          {
            projection: {
              _id: 1,
              kind: 1,
              title: 1,
              description: 1,
              occurredOn: 1,
              image: 1,
              ...(actor ? { published: 1, version: 1 } : {}),
            },
            readPreference: "primary",
          },
        )
        .sort({ occurredOn: -1, _id: 1 })
        .skip((query.page - 1) * 12)
        .limit(13)
        .toArray();
      return {
        items: rows.slice(0, 12).map((row) => view(row, !!actor)),
        page: query.page,
        hasNext: rows.length > 12,
      };
    },
    async save(
      actor: ResourceActor,
      input: z.infer<typeof showcaseContent>,
      id?: string,
      version?: number,
    ) {
      if (id) {
        const row = await collection().findOneAndUpdate(
          { ...scope(actor), _id: new ObjectId(id), version },
          { $set: { ...input, updatedAt: new Date() }, $inc: { version: 1 } },
          { returnDocument: "after" },
        );
        if (!row)
          throw new AppError(
            409,
            "Content unavailable or changed. Refresh before editing.",
          );
        return view(row, true);
      }
      const now = new Date();
      const row: Showcase = {
        ...input,
        _id: new ObjectId(),
        createdBy: actor.id,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await collection().insertOne(row);
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
        throw new AppError(409, "Content unavailable or changed.");
    },
  };
}
export type ShowcaseRepository = ReturnType<typeof createShowcaseRepository>;
