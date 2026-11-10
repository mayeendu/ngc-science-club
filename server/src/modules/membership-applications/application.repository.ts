import { MongoServerError, type Db } from "mongodb";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type {
  ApplicationInput,
  ApplicationSummary,
  AdminApplication,
  ApplicationList,
  ApplicationListInput,
  ReviewInput,
  MemberProfilePatch,
  OwnMemberProfile,
} from "./application.schema.js";
import { memberProfileFieldsSchema } from "./application.schema.js";

type ApplicationDocument = ApplicationInput & {
  _id: string;
  status: ApplicationSummary["status"];
  submittedAt: Date;
  reviewerId?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  profileUpdatedAt?: Date;
};
const ownProfileProjection = {
  _id: 0,
  fullName: 1,
  phone: 1,
  department: 1,
  academicYear: 1,
  studentId: 1,
  reviewedAt: 1,
};
function ownProfile(record: ApplicationDocument): OwnMemberProfile {
  const fields = {
    fullName: record.fullName ?? "",
    phone: record.phone ?? "",
    department: record.department ?? "",
    academicYear: record.academicYear ?? "",
  };
  const checks = [
    memberProfileFieldsSchema.shape.fullName.safeParse(fields.fullName),
    memberProfileFieldsSchema.shape.phone.safeParse(fields.phone),
    memberProfileFieldsSchema.shape.department.safeParse(fields.department),
    memberProfileFieldsSchema.shape.academicYear.safeParse(fields.academicYear),
  ];
  return {
    ...fields,
    studentId: record.studentId ?? "",
    status: "approved",
    membershipDate: record.reviewedAt?.toISOString() ?? null,
    completion: checks.filter((check) => check.success).length * 25,
  };
}
function summary(record: ApplicationDocument): ApplicationSummary {
  return {
    status: record.status,
    submittedAt: record.submittedAt.toISOString(),
    ...(record.reviewedAt
      ? { reviewedAt: record.reviewedAt.toISOString() }
      : {}),
    ...(record.status === "rejected" && record.rejectionReason
      ? { rejectionReason: record.rejectionReason }
      : {}),
  };
}
function adminDetails(record: ApplicationDocument): AdminApplication {
  return {
    id: record._id,
    fullName: record.fullName,
    studentId: record.studentId,
    department: record.department,
    academicYear: record.academicYear,
    phone: record.phone,
    reason: record.reason,
    ...summary(record),
  };
}
export interface ApplicationRepository {
  ownProfile(userId: string): Promise<OwnMemberProfile>;
  updateOwnProfile(
    userId: string,
    input: MemberProfilePatch,
  ): Promise<OwnMemberProfile>;
  create(userId: string, input: ApplicationInput): Promise<ApplicationSummary>;
  findForUser(userId: string): Promise<ApplicationSummary | null>;
  list(input: ApplicationListInput): Promise<ApplicationList>;
  review(
    id: string,
    reviewerId: string,
    input: ReviewInput,
  ): Promise<ApplicationSummary>;
}
export function createApplicationRepository(
  database: () => Db = getDB,
): ApplicationRepository {
  const collection = () =>
    database().collection<ApplicationDocument>("membershipApplications");
  return {
    async ownProfile(userId) {
      const record = await collection().findOne(
        { _id: userId, status: "approved" },
        { projection: ownProfileProjection, readPreference: "primary" },
      );
      if (!record) throw new AppError(403, "Approved membership required.");
      return ownProfile(record);
    },
    async updateOwnProfile(userId, input) {
      const record = await collection().findOneAndUpdate(
        { _id: userId, status: "approved" },
        { $set: { ...input, profileUpdatedAt: new Date() } },
        { returnDocument: "after", projection: ownProfileProjection },
      );
      if (!record) throw new AppError(403, "Approved membership required.");
      return ownProfile(record);
    },
    async create(userId, input) {
      const submittedAt = new Date();
      try {
        // MongoDB's built-in unique _id index makes simultaneous submissions safe.
        await collection().insertOne({
          ...input,
          _id: userId,
          status: "pending",
          submittedAt,
        });
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) {
          throw new AppError(409, "You already have a membership application.");
        }
        throw error;
      }
      return { status: "pending", submittedAt: submittedAt.toISOString() };
    },
    async findForUser(userId) {
      const record = await collection().findOne(
        { _id: userId },
        {
          projection: {
            _id: 0,
            status: 1,
            submittedAt: 1,
            reviewedAt: 1,
            rejectionReason: 1,
          },
          readPreference: "primary",
        },
      );
      return record ? summary(record) : null;
    },
    async list(input) {
      const records = await collection()
        .find(
          { status: input.status },
          {
            projection: {
              _id: 1,
              fullName: 1,
              studentId: 1,
              department: 1,
              academicYear: 1,
              phone: 1,
              reason: 1,
              status: 1,
              submittedAt: 1,
              reviewedAt: 1,
              rejectionReason: 1,
            },
            readPreference: "primary",
          },
        )
        .sort({ submittedAt: -1, _id: 1 })
        .skip((input.page - 1) * 10)
        .limit(11)
        .toArray();
      return {
        applications: records.slice(0, 10).map(adminDetails),
        page: input.page,
        hasNext: records.length > 10,
      };
    },
    async review(id, reviewerId, input) {
      const changes = {
        status: input.decision,
        reviewerId,
        reviewedAt: new Date(),
      };
      // The status condition and write happen atomically; no read-then-write race.
      const record = await collection().findOneAndUpdate(
        { _id: id, status: "pending" },
        input.decision === "rejected"
          ? { $set: { ...changes, rejectionReason: input.rejectionReason } }
          : { $set: changes, $unset: { rejectionReason: "" } },
        { returnDocument: "after" },
      );
      if (!record)
        throw new AppError(
          409,
          "Application is no longer pending or does not exist.",
        );
      return summary(record);
    },
  };
}
