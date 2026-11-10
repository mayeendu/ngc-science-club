import { getDB } from "../../config/db.js";
import type { Db, Filter } from "mongodb";
import type {
  MemberList,
  MemberQuery,
  MemberStats,
  PublicMember,
} from "./member.schema.js";

type MemberDocument = {
  _id: string;
  status: string;
  fullName: string;
  department: string;
  academicYear: string;
  reviewedAt?: Date;
};
const projection = {
  _id: 1,
  fullName: 1,
  department: 1,
  academicYear: 1,
  reviewedAt: 1,
};
function publicMember(record: MemberDocument): PublicMember {
  // Never spread a private application into a public response.
  return {
    id: record._id,
    name: record.fullName,
    department: record.department,
    academicYear: record.academicYear,
    membershipDate: record.reviewedAt?.toISOString() ?? null,
  };
}
export interface MemberRepository {
  list(query: MemberQuery): Promise<MemberList>;
  profile(id: string): Promise<PublicMember | null>;
  count(): Promise<number>;
  stats(): Promise<MemberStats>;
}
export function createMemberRepository(
  database: () => Db = getDB,
): MemberRepository {
  const collection = () =>
    database().collection<MemberDocument>("membershipApplications");
  return {
    async list(query) {
      const filter: Filter<MemberDocument> = { status: "approved" };
      if (query.search)
        filter.fullName = {
          $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        };
      if (query.department) filter.department = query.department;
      if (query.academicYear) filter.academicYear = query.academicYear;
      const [records, total] = await Promise.all([
        collection()
          .find(filter, { projection, readPreference: "primary" })
          .sort({ fullName: 1, _id: 1 })
          .skip((query.page - 1) * 12)
          .limit(12)
          .toArray(),
        collection().countDocuments(filter, { readPreference: "primary" }),
      ]);
      return {
        members: records.map(publicMember),
        pagination: {
          page: query.page,
          pageSize: 12,
          total,
          totalPages: Math.ceil(total / 12),
        },
      };
    },
    async profile(id) {
      const record = await collection().findOne(
        { _id: id, status: "approved" },
        { projection, readPreference: "primary" },
      );
      return record ? publicMember(record) : null;
    },
    count() {
      return collection().countDocuments(
        { status: "approved" },
        { readPreference: "primary" },
      );
    },
    async stats() {
      const [result] = await collection()
        .aggregate<{
          departments: { _id: string; count: number }[];
          academicYears: { _id: string }[];
          total: { count: number }[];
        }>(
          [
            { $match: { status: "approved" } },
            {
              $facet: {
                departments: [
                  { $group: { _id: "$department", count: { $sum: 1 } } },
                  { $sort: { _id: 1 } },
                ],
                academicYears: [
                  { $group: { _id: "$academicYear" } },
                  { $sort: { _id: 1 } },
                ],
                total: [{ $count: "count" }],
              },
            },
          ],
          { readPreference: "primary" },
        )
        .toArray();
      return {
        totalMembers: result?.total[0]?.count ?? 0,
        departments: (result?.departments ?? []).map((item) => ({
          department: item._id,
          count: item.count,
        })),
        academicYears: (result?.academicYears ?? []).map((item) => item._id),
      };
    },
  };
}

export function countMembers(): Promise<number> {
  return createMemberRepository().count();
}
