import { randomBytes } from "node:crypto";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import { getDB, getMongoClient } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
import type { ResourceActor } from "../resources/resource.schema.js";
type Certificate = {
  _id: string;
  eventId: string;
  userId: string;
  ownerId: string;
  recipientName: string;
  eventTitle: string;
  eventDate: Date;
  issuedAt: Date;
  verificationId: string;
  version: number;
  revokedAt?: Date;
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
const privateView = (row: Certificate, valid: boolean) => ({
  revoked: !!row.revokedAt,
  verificationId: row.verificationId,
  recipientName: row.recipientName,
  eventTitle: row.eventTitle,
  eventDate: row.eventDate.toISOString(),
  issuedAt: row.issuedAt.toISOString(),
  version: row.version,
  valid,
});
export function createCertificateRepository(
  database: () => Db = getDB,
  run: Transaction = transaction,
) {
  const collection = (db = database()) =>
    db.collection<Certificate>("certificates");
  async function byToken(token: string) {
    const pointer = await database()
      .collection<{ _id: string; registrationId: string }>(
        "certificateVerification",
      )
      .findOne({ _id: token }, { readPreference: "primary" });
    if (!pointer) throw new AppError(404, "Certificate not found.");
    const row = await collection().findOne(
      { _id: pointer.registrationId, verificationId: token },
      { readPreference: "primary" },
    );
    if (!row) throw new AppError(404, "Certificate not found.");
    return row;
  }
  async function valid(row: Certificate) {
    if (row.revokedAt) return false;
    const [registration, event] = await Promise.all([
      database()
        .collection<{ _id: string; attendance: string; status: string }>(
          "eventRegistrations",
        )
        .findOne(
          { _id: row._id, attendance: "present", status: "registered" },
          { projection: { _id: 1 }, readPreference: "primary" },
        ),
      database()
        .collection("events")
        .findOne(
          {
            _id: new ObjectId(row.eventId),
            status: "published",
            deletedAt: { $exists: false },
          },
          { projection: { _id: 1 }, readPreference: "primary" },
        ),
    ]);
    return !!registration && !!event;
  }
  return {
    async issue(actor: ResourceActor, eventId: string, registrationId: string) {
      try {
        return await run(async (db, session) => {
          const now = new Date();
          // Touch the same event/registration documents as attendance writes so issuance cannot race corrections.
          const event = await db
            .collection<{
              _id: ObjectId;
              createdBy: string;
              title: string;
              startsAt: Date;
              status: string;
              deletedAt?: Date;
              certificateTick?: number;
            }>("events")
            .findOneAndUpdate(
              {
                _id: new ObjectId(eventId),
                status: "published",
                deletedAt: { $exists: false },
                startsAt: { $lte: now },
                ...(actor.role === "teacher" ? { createdBy: actor.id } : {}),
              },
              { $inc: { certificateTick: 1 } },
              { session, returnDocument: "after" },
            );
          if (!event) throw new AppError(404, "Owned started event not found.");
          const registration = await db
            .collection<{
              _id: string;
              eventId: string;
              userId: string;
              name: string;
              status: string;
              attendance: string;
              certificateTick?: number;
            }>("eventRegistrations")
            .findOneAndUpdate(
              {
                _id: registrationId,
                eventId,
                status: "registered",
                attendance: "present",
              },
              { $inc: { certificateTick: 1 } },
              { session, returnDocument: "after" },
            );
          if (!registration)
            throw new AppError(
              409,
              "Confirmed present attendance is required.",
            );
          const existing = await collection(db).findOne(
            { _id: registrationId },
            { session },
          );
          if (existing) return privateView(existing, !existing.revokedAt);
          const row: Certificate = {
            _id: registrationId,
            eventId,
            userId: registration.userId,
            ownerId: event.createdBy,
            recipientName: registration.name,
            eventTitle: event.title,
            eventDate: event.startsAt,
            issuedAt: now,
            verificationId: randomBytes(32).toString("hex"),
            version: 1,
          };
          await db
            .collection<{ _id: string; registrationId: string }>(
              "certificateVerification",
            )
            .insertOne(
              { _id: row.verificationId, registrationId },
              { session },
            );
          await collection(db).insertOne(row, { session });
          return privateView(row, true);
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          const existing = await collection().findOne({
            _id: registrationId,
            eventId,
            ...(actor.role === "teacher" ? { ownerId: actor.id } : {}),
          });
          if (existing) return privateView(existing, await valid(existing));
        }
        throw error;
      }
    },
    async list(actor: ResourceActor, staff: boolean, page: number) {
      const rows = await collection()
        .find(
          staff
            ? actor.role === "admin"
              ? {}
              : { ownerId: actor.id }
            : { userId: actor.id },
          { readPreference: "primary" },
        )
        .sort({ issuedAt: -1, _id: 1 })
        .skip((page - 1) * 12)
        .limit(13)
        .toArray();
      const pageRows = rows.slice(0, 12);
      const [registrations, events] = pageRows.length
        ? await Promise.all([
            database()
              .collection<{ _id: string }>("eventRegistrations")
              .find(
                {
                  _id: { $in: pageRows.map((row) => row._id) },
                  attendance: "present",
                  status: "registered",
                },
                { projection: { _id: 1 }, readPreference: "primary" },
              )
              .toArray(),
            database()
              .collection("events")
              .find(
                {
                  _id: {
                    $in: [...new Set(pageRows.map((row) => row.eventId))].map(
                      (id) => new ObjectId(id),
                    ),
                  },
                  status: "published",
                  deletedAt: { $exists: false },
                },
                { projection: { _id: 1 }, readPreference: "primary" },
              )
              .toArray(),
          ])
        : [[], []];
      const registrationIds = new Set(
          registrations.map((row) => String(row._id)),
        ),
        eventIds = new Set(events.map((row) => String(row._id)));
      return {
        items: pageRows.map((row) =>
          privateView(
            row,
            !row.revokedAt &&
              registrationIds.has(row._id) &&
              eventIds.has(row.eventId),
          ),
        ),
        page,
        hasNext: rows.length > 12,
      };
    },
    async verify(token: string) {
      const row = await byToken(token);
      return {
        verificationId: row.verificationId,
        eventTitle: row.eventTitle,
        eventDate: row.eventDate.toISOString(),
        issuedAt: row.issuedAt.toISOString(),
        recipientInitials: row.recipientName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => [...part][0] + ".")
          .join(" "),
        valid: await valid(row),
      };
    },
    async revoke(actor: ResourceActor, token: string, version: number) {
      const row = await byToken(token);
      const result = await collection().updateOne(
        {
          _id: row._id,
          version,
          revokedAt: { $exists: false },
          ...(actor.role === "teacher" ? { ownerId: actor.id } : {}),
        },
        { $set: { revokedAt: new Date() }, $inc: { version: 1 } },
      );
      if (!result.modifiedCount)
        throw new AppError(409, "Certificate unavailable, revoked or changed.");
    },
  };
}
export type CertificateRepository = ReturnType<
  typeof createCertificateRepository
>;
