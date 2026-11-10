import { ObjectId, type Db } from "mongodb";
import { getDB } from "../config/db.js";
import { AUTH_USER_COLLECTION } from "./auth-storage.js";

export type AuthorizationUser = { role: unknown; banned: unknown };
export type AuthorizationUserLookup = (
  userId: string,
) => Promise<AuthorizationUser | null>;

// The inspected/configured Mongo adapter uses ObjectId _id, exposed as a string in sessions.
export async function findAuthorizationUser(
  userId: string,
  database?: Db,
): Promise<AuthorizationUser | null> {
  if (typeof userId !== "string" || !/^[a-f0-9]{24}$/i.test(userId))
    return null;
  const record = await (database ?? getDB())
    .collection<{ _id: ObjectId; role?: unknown; banned?: unknown }>(
      AUTH_USER_COLLECTION,
    )
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { _id: 0, role: 1, banned: 1 }, readPreference: "primary" },
    );
  return record ? { role: record.role, banned: record.banned } : null;
}
