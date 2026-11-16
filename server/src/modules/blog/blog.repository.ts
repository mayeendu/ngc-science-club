import { ObjectId, type Db } from "mongodb";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type {
  BlogActor,
  BlogInput,
  BlogPost,
  BlogSummary,
} from "./blog.schema.js";
type BlogDocument = BlogInput & {
  _id: ObjectId;
  authorId: string;
  authorName: string;
  publishedAt: Date;
};
const projection = {
  _id: 1,
  title: 1,
  category: 1,
  body: 1,
  authorName: 1,
  publishedAt: 1,
};
function view(row: BlogDocument): BlogSummary {
  return {
    id: row._id.toHexString(),
    title: row.title,
    category: row.category,
    excerpt: row.body.slice(0, 180),
    authorName: row.authorName,
    publishedAt: row.publishedAt.toISOString(),
  };
}
export interface BlogRepository {
  permission(actor: BlogActor): Promise<void>;
  list(
    page: number,
  ): Promise<{ items: BlogSummary[]; page: number; hasNext: boolean }>;
  detail(id: string): Promise<BlogPost>;
  create(actor: BlogActor, input: BlogInput): Promise<BlogPost>;
}
export function createBlogRepository(
  database: () => Db = getDB,
): BlogRepository {
  const collection = () => database().collection<BlogDocument>("blogPosts");
  async function author(actor: BlogActor) {
    if (actor.role !== "student") return actor.name;
    const member = await database()
      .collection<{ _id: string; status: string; fullName: string }>(
        "membershipApplications",
      )
      .findOne(
        { _id: actor.id, status: "approved" },
        { projection: { _id: 0, fullName: 1 }, readPreference: "primary" },
      );
    if (!member) throw new AppError(403, "Approved membership required.");
    return member.fullName;
  }
  return {
    async permission(actor) {
      await author(actor);
    },
    async list(page) {
      const rows = await collection()
        .find({}, { projection, readPreference: "primary" })
        .sort({ publishedAt: -1, _id: -1 })
        .skip((page - 1) * 12)
        .limit(13)
        .toArray();
      return {
        items: rows.slice(0, 12).map(view),
        page,
        hasNext: rows.length > 12,
      };
    },
    async detail(id) {
      const row = await collection().findOne(
        { _id: new ObjectId(id) },
        { projection, readPreference: "primary" },
      );
      if (!row) throw new AppError(404, "Blog post not found.");
      return { ...view(row), body: row.body };
    },
    async create(actor, input) {
      const authorName = await author(actor);
      const row: BlogDocument = {
        ...input,
        _id: new ObjectId(),
        authorId: actor.id,
        authorName,
        publishedAt: new Date(),
      };
      await collection().insertOne(row);
      return { ...view(row), body: row.body };
    },
  };
}
