import type { ClientSession, Db, MongoClient } from "mongodb";
import { AUTH_USER_COLLECTION } from "../src/lib/auth-storage.js";
import {
  BOOTSTRAP_MARKER_ID,
  BootstrapError,
  type BootstrapMarker,
  type BootstrapStore,
  type BootstrapTransaction,
  type BootstrapUser,
} from "./bootstrap-admin.core.js";

export const BOOTSTRAP_STATE_COLLECTION = "systemState";
const adminRolePattern = /(^|,)\s*admin\s*(,|$)/i;

export function createBootstrapStore(
  database: Db,
  client: MongoClient,
): BootstrapStore {
  const users = database.collection<BootstrapUser>(AUTH_USER_COLLECTION);
  const markers = database.collection<BootstrapMarker>(
    BOOTSTRAP_STATE_COLLECTION,
  );

  function reader(session?: ClientSession) {
    const options = session ? { session } : {};
    return {
      async hasAdministrator() {
        // MongoDB regex queries also match array elements; fail closed for legacy arrays.
        return (
          (await users.findOne(
            { role: adminRolePattern },
            { ...options, projection: { _id: 1 } },
          )) !== null
        );
      },
      async hasMarker() {
        return (
          (await markers.findOne(
            { _id: BOOTSTRAP_MARKER_ID },
            { ...options, projection: { _id: 1 } },
          )) !== null
        );
      },
      findUsersByEmail(email: string) {
        return users
          .find(
            { email },
            {
              ...options,
              projection: {
                _id: 1,
                id: 1,
                email: 1,
                name: 1,
                role: 1,
                emailVerified: 1,
                banned: 1,
              },
            },
          )
          .limit(2)
          .toArray();
      },
    };
  }

  return {
    databaseName: database.databaseName,
    userCollectionName: AUTH_USER_COLLECTION,
    ...reader(),
    async transaction<T>(
      operation: (transaction: BootstrapTransaction) => Promise<T>,
    ) {
      const session = client.startSession();
      try {
        return await session.withTransaction(
          async () =>
            operation({
              ...reader(session),
              async claimMarker(marker) {
                await markers.insertOne(marker, { session });
              },
              async promoteStudent(user) {
                const result = await users.updateOne(
                  {
                    _id: user._id,
                    email: user.email,
                    role: "student",
                    emailVerified: true,
                    banned: { $ne: true },
                  },
                  { $set: { role: "admin" } },
                  { session },
                );
                return result.modifiedCount;
              },
            }),
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            readPreference: "primary",
          },
        );
      } catch (error) {
        if (error instanceof BootstrapError) throw error;
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          throw new BootstrapError(
            "Another bootstrap already claimed the one-time marker. No promotion was committed by this run.",
          );
        }
        // Never fall back to an unprotected update on non-transactional servers.
        throw new BootstrapError(
          "Bootstrap transaction failed. Check Atlas transaction support and permissions, then inspect the role and one-time marker before any retry.",
        );
      } finally {
        await session.endSession();
      }
    },
  };
}
