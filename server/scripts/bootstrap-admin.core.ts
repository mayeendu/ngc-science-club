import { ObjectId } from "mongodb";
import { z } from "zod";

export const BOOTSTRAP_MARKER_ID = "initial-admin-bootstrap-v1";
export const OWNERSHIP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapError";
  }
}

export type BootstrapUser = {
  _id: ObjectId | string;
  id?: unknown;
  email: string;
  name?: unknown;
  role?: unknown;
  emailVerified?: unknown;
  banned?: unknown;
};

export type BootstrapMarker = {
  _id: string;
  userId: string;
  email: string;
  reviewerEmail: string;
  ownershipReference: string;
  ownershipVerifiedAt: Date;
  completedAt: Date;
};

export interface BootstrapReader {
  hasAdministrator(): Promise<boolean>;
  hasMarker(): Promise<boolean>;
  findUsersByEmail(email: string): Promise<BootstrapUser[]>;
}

export interface BootstrapTransaction extends BootstrapReader {
  claimMarker(marker: BootstrapMarker): Promise<void>;
  promoteStudent(user: BootstrapUser): Promise<number>;
}

export interface BootstrapStore extends BootstrapReader {
  databaseName: string;
  userCollectionName: string;
  transaction<T>(
    operation: (transaction: BootstrapTransaction) => Promise<T>,
  ): Promise<T>;
}

const exactText = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (value) =>
      value === value.trim() &&
      !Array.from(value).some((character) => character.charCodeAt(0) < 32),
    "Use exact values without whitespace or control characters.",
  );

const settingsSchema = z.object({
  BOOTSTRAP_ADMIN_EXPECTED_DB: exactText,
  BOOTSTRAP_ADMIN_USER_ID: exactText,
  BOOTSTRAP_ADMIN_EMAIL: z.email(),
  BOOTSTRAP_ADMIN_OWNER_REVIEWER_EMAIL: z.email(),
  BOOTSTRAP_ADMIN_OWNER_REFERENCE: exactText.refine(
    (value) => value.length >= 8,
  ),
  BOOTSTRAP_ADMIN_OWNER_VERIFIED_AT: z.iso.datetime({ offset: true }),
  BOOTSTRAP_ADMIN_ENABLED: z.enum(["true", "false"]).default("false"),
});

export type BootstrapSettings = {
  expectedDatabase: string;
  userId: string;
  email: string;
  reviewerEmail: string;
  ownershipReference: string;
  ownershipVerifiedAt: Date;
  enabled: boolean;
};

export function readBootstrapSettings(
  input: NodeJS.ProcessEnv,
): BootstrapSettings {
  const result = settingsSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new BootstrapError(
      `Missing or invalid bootstrap configuration: ${fields.join(", ")}.`,
    );
  }
  const value = result.data;
  return {
    expectedDatabase: value.BOOTSTRAP_ADMIN_EXPECTED_DB,
    userId: value.BOOTSTRAP_ADMIN_USER_ID,
    email: value.BOOTSTRAP_ADMIN_EMAIL,
    reviewerEmail: value.BOOTSTRAP_ADMIN_OWNER_REVIEWER_EMAIL,
    ownershipReference: value.BOOTSTRAP_ADMIN_OWNER_REFERENCE,
    ownershipVerifiedAt: new Date(value.BOOTSTRAP_ADMIN_OWNER_VERIFIED_AT),
    enabled: value.BOOTSTRAP_ADMIN_ENABLED === "true",
  };
}

export function idText(id: unknown): string {
  if (id instanceof ObjectId) return id.toHexString();
  if (typeof id === "string" && id.length > 0) return id;
  throw new BootstrapError(
    "Unsupported auth ID storage. Inspect the schema before bootstrapping.",
  );
}

export function hasAdminRole(role: unknown): boolean {
  if (Array.isArray(role)) return role.some(hasAdminRole);
  return (
    typeof role === "string" &&
    role.split(",").some((part) => part.trim().toLowerCase() === "admin")
  );
}

function assertOwnership(settings: BootstrapSettings, now: Date) {
  const verifiedAt = settings.ownershipVerifiedAt.getTime();
  if (
    !Number.isFinite(verifiedAt) ||
    verifiedAt > now.getTime() ||
    now.getTime() - verifiedAt > OWNERSHIP_MAX_AGE_MS
  ) {
    throw new BootstrapError(
      "Independent ownership confirmation must be recorded within the last 24 hours, not in the future.",
    );
  }
  if (settings.email.toLowerCase() === settings.reviewerEmail.toLowerCase()) {
    throw new BootstrapError(
      "The independent ownership reviewer must be different from the target account owner.",
    );
  }
}

export function assertCandidate(
  user: BootstrapUser,
  settings: BootstrapSettings,
): void {
  if (Object.hasOwn(user, "id")) {
    throw new BootstrapError(
      "An unexpected logical id field exists. Resolve the schema ambiguity before proceeding.",
    );
  }
  if (idText(user._id) !== settings.userId || user.email !== settings.email) {
    throw new BootstrapError(
      "The exact stored user ID and email do not match the configured account.",
    );
  }
  if (user.role !== "student") {
    throw new BootstrapError(
      "Target must have the explicit student role. Missing, teacher, admin and mixed roles are ineligible.",
    );
  }
  if (user.emailVerified !== true) {
    throw new BootstrapError(
      "Target email is not verified. Bootstrap never changes email verification.",
    );
  }
  if (user.banned === true)
    throw new BootstrapError("Banned accounts cannot be bootstrapped.");
}

async function inspectCandidate(
  reader: BootstrapReader,
  settings: BootstrapSettings,
) {
  if (await reader.hasMarker())
    throw new BootstrapError(
      "First-admin bootstrap was already completed; it cannot be reused.",
    );
  if (await reader.hasAdministrator())
    throw new BootstrapError(
      "An administrator already exists. Bootstrap is refused.",
    );
  const users = await reader.findUsersByEmail(settings.email);
  if (users.length !== 1)
    throw new BootstrapError(
      "Expected exactly one existing account with the exact configured email.",
    );
  const user = users[0]!;
  assertCandidate(user, settings);
  return user;
}

export async function previewBootstrap(
  store: BootstrapStore,
  settings: BootstrapSettings,
  now = new Date(),
) {
  if (store.databaseName !== settings.expectedDatabase)
    throw new BootstrapError(
      "Configured database does not match the expected database. Nothing was changed.",
    );
  assertOwnership(settings, now);
  return inspectCandidate(store, settings);
}

export function ownershipPhrase(settings: BootstrapSettings) {
  return `OWNERSHIP VERIFIED ${settings.email} BY ${settings.reviewerEmail}`;
}

export function promotionPhrase(settings: BootstrapSettings) {
  return `PROMOTE ${settings.userId} ${settings.email}`;
}

export async function executeBootstrap(
  store: BootstrapStore,
  settings: BootstrapSettings,
  confirmation: { interactive: boolean; ownership: string; promotion: string },
  now = new Date(),
) {
  if (!settings.enabled)
    throw new BootstrapError(
      "Execution is disabled. BOOTSTRAP_ADMIN_ENABLED must be exactly true.",
    );
  if (
    !confirmation.interactive ||
    confirmation.ownership !== ownershipPhrase(settings) ||
    confirmation.promotion !== promotionPhrase(settings)
  ) {
    throw new BootstrapError(
      "Interactive ownership and promotion confirmations did not match. Nothing was changed.",
    );
  }
  await previewBootstrap(store, settings, now);
  return store.transaction(async (transaction) => {
    // A fixed unique _id serializes concurrent runs. It commits with the role change.
    await transaction.claimMarker({
      _id: BOOTSTRAP_MARKER_ID,
      userId: settings.userId,
      email: settings.email,
      reviewerEmail: settings.reviewerEmail,
      ownershipReference: settings.ownershipReference,
      ownershipVerifiedAt: settings.ownershipVerifiedAt,
      completedAt: now,
    });
    // Re-read identity, verification, ban and roles inside the transaction.
    if (await transaction.hasAdministrator())
      throw new BootstrapError(
        "An administrator now exists. Bootstrap is refused.",
      );
    const users = await transaction.findUsersByEmail(settings.email);
    if (users.length !== 1)
      throw new BootstrapError(
        "Target account changed after review. Nothing was changed.",
      );
    assertCandidate(users[0]!, settings);
    if ((await transaction.promoteStudent(users[0]!)) !== 1) {
      throw new BootstrapError(
        "Target no longer matches the verified student account. Nothing was changed.",
      );
    }
    return { userId: settings.userId, role: "admin" as const };
  });
}
