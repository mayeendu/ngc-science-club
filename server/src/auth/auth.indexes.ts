import type { Db } from "mongodb";

// Versioned with the default Better Auth 1.7.18 MongoDB model/field names.
// Idempotent: existing data/index conflicts fail startup rather than being removed.
export async function ensureAuthIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection("user").createIndex(
      { email: 1 },
      {
        unique: true,
        name: "user_email_uidx",
      },
    ),
    database.collection("session").createIndexes([
      { key: { token: 1 }, unique: true, name: "session_token_uidx" },
      { key: { userId: 1 }, name: "session_userId_idx" },
      {
        key: { expiresAt: 1 },
        expireAfterSeconds: 0,
        name: "session_expiresAt_ttl",
      },
    ]),
    database.collection("account").createIndexes([
      { key: { userId: 1 }, name: "account_userId_idx" },
      {
        key: { providerId: 1, accountId: 1 },
        unique: true,
        name: "account_providerId_accountId_uidx",
      },
    ]),
    database.collection("verification").createIndexes([
      { key: { identifier: 1 }, name: "verification_identifier_idx" },
      {
        key: { expiresAt: 1 },
        expireAfterSeconds: 0,
        name: "verification_expiresAt_ttl",
      },
    ]),
  ]);
}
