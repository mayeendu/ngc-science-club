import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stdin, stdout } from "node:process";
import { closeDB, connectDB, getMongoClient } from "../src/config/db.js";
import { AUTH_USER_COLLECTION } from "../src/lib/auth-storage.js";
import {
  BootstrapError,
  executeBootstrap,
  idText,
  ownershipPhrase,
  previewBootstrap,
  promotionPhrase,
  readBootstrapSettings,
} from "./bootstrap-admin.core.js";
import { createBootstrapStore } from "./bootstrap-admin.store.js";

async function main() {
  const arguments_ = process.argv.slice(2);
  const mode = arguments_[0] ?? "--check";
  if (
    arguments_.length > 1 ||
    !["--check", "--dry-run", "--execute", "--help"].includes(mode)
  ) {
    throw new BootstrapError(
      "Use only --check, --dry-run, --execute or --help. Noninteractive confirmation flags are not supported.",
    );
  }
  if (mode === "--help") {
    stdout.write(
      "--check: read-only schema/admin summary (default)\n--dry-run: read-only target review\n--execute: enabled configuration plus two exact interactive confirmations; writes only after confirmation\n",
    );
    return;
  }
  const settings =
    mode === "--check" ? undefined : readBootstrapSettings(process.env);
  if (
    mode === "--execute" &&
    (!settings?.enabled || !stdin.isTTY || !stdout.isTTY)
  ) {
    throw new BootstrapError(
      "Execution requires BOOTSTRAP_ADMIN_ENABLED=true and an interactive terminal. No --yes, pipes or automatic execution.",
    );
  }

  try {
    const database = await connectDB();
    const store = createBootstrapStore(database, getMongoClient());
    if (mode === "--check") {
      const users = database.collection(AUTH_USER_COLLECTION);
      const summary = {
        database: database.databaseName,
        userCollection: AUTH_USER_COLLECTION,
        totalUsers: await users.countDocuments(),
        administratorExists: await store.hasAdministrator(),
        bootstrapAlreadyCompleted: await store.hasMarker(),
        explicitVerifiedStudents: await users.countDocuments({
          role: "student",
          emailVerified: true,
          banned: { $ne: true },
        }),
        missingRoleUsers: await users.countDocuments({
          role: { $exists: false },
        }),
        storedIdTypes: await users
          .aggregate([
            { $group: { _id: { $type: "$_id" }, count: { $sum: 1 } } },
          ])
          .toArray(),
      };
      stdout.write(
        `${JSON.stringify(summary, null, 2)}\nRead-only check complete. No changes made.\n`,
      );
      return;
    }
    if (!settings) throw new BootstrapError("Bootstrap settings are required.");
    const candidate = await previewBootstrap(store, settings);
    stdout.write(
      `${JSON.stringify(
        {
          database: database.databaseName,
          userCollection: store.userCollectionName,
          idType: typeof candidate._id === "string" ? "string" : "ObjectId",
          userId: idText(candidate._id),
          email: candidate.email,
          name:
            typeof candidate.name === "string"
              ? candidate.name
              : "(not stored)",
          role: candidate.role,
          emailVerified: candidate.emailVerified,
          reviewer: settings.reviewerEmail,
          ownershipReference: settings.ownershipReference,
          ownershipVerifiedAt: settings.ownershipVerifiedAt.toISOString(),
        },
        null,
        2,
      )}\n`,
    );
    if (mode === "--dry-run") {
      stdout.write("Dry run complete. No changes made.\n");
      return;
    }

    stdout.write(
      "Stop all other role-changing processes before proceeding. Verify the owner independently using the referenced college approval record. Configuration alone does not prove identity.\n",
    );
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      const ownership = await prompt.question(
        `Type exactly: ${ownershipPhrase(settings)}\n> `,
      );
      const promotion = await prompt.question(
        `Type exactly: ${promotionPhrase(settings)}\n> `,
      );
      await executeBootstrap(store, settings, {
        interactive: true,
        ownership,
        promotion,
      });
      stdout.write(
        "First administrator promotion committed. Only the target role and one-time marker changed. Sign out and sign in again to verify.\n",
      );
    } finally {
      prompt.close();
    }
  } finally {
    await closeDB();
  }
}

// Importing tooling never connects or writes. No application module imports it.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof BootstrapError
        ? error.message
        : "Bootstrap failed. No connection strings or raw database errors are printed. Review the selected database before retrying.",
    );
    process.exitCode = 1;
  });
}
