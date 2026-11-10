import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import process from "node:process";
import { test } from "node:test";
import { URL } from "node:url";
import { ObjectId } from "mongodb";
import { memoryAdapter } from "better-auth/adapters/memory";
import {
  assertCandidate,
  BootstrapError,
  executeBootstrap,
  hasAdminRole,
  idText,
  ownershipPhrase,
  previewBootstrap,
  promotionPhrase,
  readBootstrapSettings,
} from "../scripts/bootstrap-admin.core.ts";
import { createBootstrapStore } from "../scripts/bootstrap-admin.store.ts";

// All records and writes in this suite are in memory; no MongoDB connection.
const { structuredClone } = globalThis;
const now = new Date("2026-11-10T10:00:00.000Z");
function settings(overrides = {}) {
  return {
    expectedDatabase: "fictional_bootstrap_test",
    userId: "student-a",
    email: "student@example.com",
    reviewerEmail: "independent-reviewer@example.com",
    ownershipReference: "COLLEGE-VERIFICATION-TEST-001",
    ownershipVerifiedAt: new Date(now.getTime() - 60_000),
    enabled: true,
    ...overrides,
  };
}
function student(overrides = {}) {
  return {
    _id: "student-a",
    email: "student@example.com",
    name: "Fictional Student",
    role: "student",
    emailVerified: true,
    banned: false,
    untouched: "preserve-me",
    ...overrides,
  };
}
function confirmation(value = settings(), overrides = {}) {
  return {
    interactive: true,
    ownership: ownershipPhrase(value),
    promotion: promotionPhrase(value),
    ...overrides,
  };
}

class FakeStore {
  databaseName = "fictional_bootstrap_test";
  userCollectionName = "user";
  marker = null;
  transactions = 0;
  queue = Promise.resolve();
  constructor(users = [student()]) {
    this.users = structuredClone(users);
  }
  async hasAdministrator() {
    return this.users.some((user) => hasAdminRole(user.role));
  }
  async hasMarker() {
    return this.marker !== null;
  }
  async findUsersByEmail(email) {
    return structuredClone(this.users.filter((user) => user.email === email));
  }
  async transaction(operation) {
    const previous = this.queue;
    let release;
    this.queue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    this.transactions++;
    const before = {
      users: structuredClone(this.users),
      marker: structuredClone(this.marker),
    };
    try {
      return await operation({
        hasAdministrator: () => this.hasAdministrator(),
        hasMarker: () => this.hasMarker(),
        findUsersByEmail: (email) => this.findUsersByEmail(email),
        claimMarker: async (marker) => {
          if (this.marker)
            throw new BootstrapError("One-time marker already exists.");
          this.marker = structuredClone(marker);
        },
        promoteStudent: async (reviewed) => {
          const target = this.users.find(
            (user) =>
              user._id === reviewed._id &&
              user.email === reviewed.email &&
              user.role === "student" &&
              user.emailVerified === true &&
              user.banned !== true,
          );
          if (!target || this.failUpdate) return 0;
          target.role = "admin";
          return 1;
        },
      });
    } catch (error) {
      this.users = before.users;
      this.marker = before.marker;
      throw error;
    } finally {
      release();
    }
  }
}

test("configuration requires exact identity and independent recent ownership evidence", () => {
  const input = {
    BOOTSTRAP_ADMIN_EXPECTED_DB: "fictional_bootstrap_test",
    BOOTSTRAP_ADMIN_USER_ID: "student-a",
    BOOTSTRAP_ADMIN_EMAIL: "student@example.com",
    BOOTSTRAP_ADMIN_OWNER_REVIEWER_EMAIL: "independent-reviewer@example.com",
    BOOTSTRAP_ADMIN_OWNER_REFERENCE: "COLLEGE-TEST-001",
    BOOTSTRAP_ADMIN_OWNER_VERIFIED_AT: "2026-11-10T09:59:00.000Z",
  };
  assert.equal(readBootstrapSettings(input).enabled, false);
  for (const field of Object.keys(input)) {
    assert.throws(
      () => readBootstrapSettings({ ...input, [field]: undefined }),
      BootstrapError,
    );
  }
  assert.throws(
    () =>
      readBootstrapSettings({
        ...input,
        BOOTSTRAP_ADMIN_USER_ID: " student-a",
      }),
    BootstrapError,
  );
});

test("ObjectId and string IDs are compared exactly, without guessing or coercion", () => {
  const identifier = new ObjectId();
  assert.equal(idText(identifier), identifier.toHexString());
  assertCandidate(
    student({ _id: identifier }),
    settings({ userId: identifier.toHexString() }),
  );
  assert.throws(
    () => assertCandidate(student({ _id: identifier }), settings()),
    BootstrapError,
  );
  assert.throws(() => idText(123), BootstrapError);
  assert.throws(
    () => assertCandidate(student({ id: "ambiguous-id" }), settings()),
    BootstrapError,
  );
});

test("dry run makes no changes and reviews only the exact existing account", async () => {
  const store = new FakeStore();
  const original = structuredClone(store.users);
  const selected = await previewBootstrap(store, settings(), now);
  assert.equal(selected.email, settings().email);
  assert.deepEqual(store.users, original);
  assert.equal(store.marker, null);
  assert.equal(store.transactions, 0);
});

test("wrong ID, email, missing user and duplicate identity all refuse without writes", async () => {
  for (const [store, config] of [
    [new FakeStore(), settings({ userId: "wrong-id" })],
    [new FakeStore(), settings({ email: "wrong@example.com" })],
    [new FakeStore([]), settings()],
    [new FakeStore([student(), student({ _id: "duplicate" })]), settings()],
  ]) {
    const original = structuredClone(store.users);
    await assert.rejects(previewBootstrap(store, config, now), BootstrapError);
    assert.deepEqual(store.users, original);
    assert.equal(store.marker, null);
    assert.equal(store.transactions, 0);
  }
});

test("unverified, banned, roleless, null, teacher and mixed-role targets are never promoted", async () => {
  for (const overrides of [
    { emailVerified: false },
    { emailVerified: "true" },
    { banned: true },
    { role: undefined },
    { role: null },
    { role: "teacher" },
    { role: "admin" },
    { role: "student,teacher" },
    { role: ["student"] },
  ]) {
    const store = new FakeStore([student(overrides)]);
    const original = structuredClone(store.users);
    await assert.rejects(
      executeBootstrap(store, settings(), confirmation(), now),
      BootstrapError,
    );
    assert.deepEqual(store.users, original);
    assert.equal(store.transactions, 0);
  }
});

test("existing administrators and one-time markers block bootstrap", async () => {
  for (const role of [
    "admin",
    "teacher,admin",
    "student, admin",
    ["teacher", "admin"],
  ]) {
    const store = new FakeStore([
      student(),
      student({ _id: "other", email: "other@example.com", role }),
    ]);
    await assert.rejects(
      executeBootstrap(store, settings(), confirmation(), now),
      BootstrapError,
    );
    assert.equal(store.transactions, 0);
  }
  const store = new FakeStore();
  store.marker = { completed: true };
  await assert.rejects(
    executeBootstrap(store, settings(), confirmation(), now),
    BootstrapError,
  );
});

test("disabled, noninteractive, incorrect and absent confirmations cannot write", async () => {
  for (const [config, approved] of [
    [settings({ enabled: false }), confirmation()],
    [settings(), confirmation(settings(), { interactive: false })],
    [settings(), confirmation(settings(), { ownership: "yes" })],
    [settings(), confirmation(settings(), { promotion: "yes" })],
  ]) {
    const store = new FakeStore();
    await assert.rejects(
      executeBootstrap(store, config, approved, now),
      BootstrapError,
    );
    assert.equal(store.transactions, 0);
  }
});

test("wrong database, self-attestation, stale and future evidence refuse", async () => {
  for (const config of [
    settings({ expectedDatabase: "different-database" }),
    settings({ reviewerEmail: "student@example.com" }),
    settings({
      ownershipVerifiedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
    }),
    settings({ ownershipVerifiedAt: new Date(now.getTime() + 60_000) }),
  ]) {
    const store = new FakeStore();
    await assert.rejects(
      executeBootstrap(store, config, confirmation(config), now),
      BootstrapError,
    );
    assert.equal(store.transactions, 0);
  }
});

test("approved in-memory execution changes only the intended role and marker", async () => {
  const unrelated = student({
    _id: "teacher-b",
    email: "teacher@example.com",
    role: "teacher",
  });
  const store = new FakeStore([student(), unrelated]);
  const before = structuredClone(store.users);
  const result = await executeBootstrap(store, settings(), confirmation(), now);
  assert.equal(result.role, "admin");
  assert.deepEqual(store.users[0], { ...before[0], role: "admin" });
  assert.deepEqual(store.users[1], before[1]);
  assert.equal(store.marker.userId, settings().userId);
  await assert.rejects(
    executeBootstrap(store, settings(), confirmation(), now),
    BootstrapError,
  );
});

test("a failed conditional update rolls back the marker as well as user changes", async () => {
  const store = new FakeStore();
  store.failUpdate = true;
  await assert.rejects(
    executeBootstrap(store, settings(), confirmation(), now),
    BootstrapError,
  );
  assert.equal(store.users[0].role, "student");
  assert.equal(store.marker, null);
});

test("identity and privilege changes after preview are rechecked transactionally", async () => {
  const store = new FakeStore();
  const transaction = store.transaction.bind(store);
  store.transaction = (operation) => {
    store.users[0].role = "teacher";
    return transaction(operation);
  };
  await assert.rejects(
    executeBootstrap(store, settings(), confirmation(), now),
    BootstrapError,
  );
  assert.equal(store.users[0].role, "teacher");
  assert.equal(store.marker, null);
});

test("concurrent in-memory bootstrap attempts permit only one winner", async () => {
  const store = new FakeStore([
    student(),
    student({ _id: "student-b", email: "second@example.com" }),
  ]);
  const second = settings({ userId: "student-b", email: "second@example.com" });
  const results = await Promise.allSettled([
    executeBootstrap(store, settings(), confirmation(), now),
    executeBootstrap(store, second, confirmation(second), now),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(store.users.filter((user) => user.role === "admin").length, 1);
});

test("MongoDB store writes only role and marker with exact transactional filters", async () => {
  const identifier = new ObjectId();
  const selected = student({ _id: identifier });
  const writes = [];
  const session = {
    withTransaction: async (operation, options) => {
      assert.equal(options.readConcern.level, "snapshot");
      assert.equal(options.writeConcern.w, "majority");
      return operation();
    },
    endSession: async () => {},
  };
  const database = {
    databaseName: "fictional_bootstrap_test",
    collection(name) {
      assert.ok(["user", "systemState"].includes(name));
      return {
        findOne: async () => null,
        find: () => ({ limit: () => ({ toArray: async () => [selected] }) }),
        insertOne: async (document, options) => {
          assert.strictEqual(options.session, session);
          writes.push({ name, document });
        },
        updateOne: async (filter, update, options) => {
          assert.strictEqual(options.session, session);
          writes.push({ name, filter, update });
          return { modifiedCount: 1 };
        },
      };
    },
  };
  const store = createBootstrapStore(database, { startSession: () => session });
  const config = settings({ userId: identifier.toHexString() });
  await executeBootstrap(store, config, confirmation(config), now);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].name, "systemState");
  assert.deepEqual(writes[1].update, { $set: { role: "admin" } });
  assert.deepEqual(writes[1].filter, {
    _id: identifier,
    email: selected.email,
    role: "student",
    emailVerified: true,
    banned: { $ne: true },
  });
});

test("tooling is not imported or executed by startup, HTTP routes or frontend", () => {
  for (const file of ["../src/index.ts", "../src/app.ts"]) {
    assert.equal(
      readFileSync(new URL(file, import.meta.url), "utf8").includes(
        "bootstrap-admin",
      ),
      false,
    );
  }
  const command = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  for (const name of ["dev", "start", "build", "postinstall", "prestart"]) {
    assert.equal(
      (command.scripts[name] ?? "").includes("bootstrap-admin"),
      false,
    );
  }
  assert.equal(
    readFileSync(
      new URL("../../client/src/lib/auth-client.ts", import.meta.url),
      "utf8",
    ).includes("BOOTSTRAP_ADMIN"),
    false,
  );
});

test("real Better Auth signup and Admin endpoints cannot grant public privileges (memory only)", async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "5000";
  process.env.CLIENT_URL = "http://localhost:3000";
  process.env.BETTER_AUTH_URL = "http://localhost:5000";
  process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.DB_NAME = "fictional_memory_only";
  const { createAuthWithDatabase } = await import("../src/lib/auth.ts");
  const memory = { user: [], session: [], account: [], verification: [] };
  const auth = createAuthWithDatabase(memoryAdapter(memory));
  const send = (path, body, cookie) =>
    auth.handler(
      new globalThis.Request(`http://localhost:5000/api/auth${path}`, {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  const ordinary = await send("/sign-up/email", {
    name: "Fictional Student",
    email: "ordinary@example.com",
    password: "Fictional-Test-Only-Password!",
  });
  assert.equal(ordinary.status, 200);
  const ordinaryBody = await ordinary.json();
  assert.equal(ordinaryBody.user.role, "student");
  assert.equal(ordinaryBody.user.emailVerified, false);
  const cookie = ordinary.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const count = memory.user.length;
  for (const [index, role] of [
    "admin",
    "teacher",
    "student,admin",
    ["admin"],
  ].entries()) {
    const response = await send("/sign-up/email", {
      name: "Fictional Student",
      email: `fictional-${index}@example.com`,
      password: "Fictional-Test-Only-Password!",
      role,
    });
    assert.equal(response.status, 400);
    assert.equal(memory.user.length, count);
  }
  for (const session of [undefined, cookie]) {
    const create = await send(
      "/admin/create-user",
      {
        name: "Forbidden Admin",
        email: "forbidden@example.com",
        password: "Fictional-Test-Only-Password!",
        role: "admin",
      },
      session,
    );
    assert.ok([401, 403].includes(create.status));
    const setRole = await send(
      "/admin/set-role",
      { userId: memory.user[0].id, role: "admin" },
      session,
    );
    assert.ok([401, 403].includes(setRole.status));
  }
  assert.equal(memory.user.length, count);
  assert.equal(
    memory.user.some((user) => hasAdminRole(user.role)),
    false,
  );
  delete memory.user[0].role;
  const legacy = await send(
    "/admin/set-role",
    { userId: memory.user[0].id, role: "admin" },
    cookie,
  );
  assert.ok([401, 403].includes(legacy.status));
  assert.equal(Object.hasOwn(memory.user[0], "role"), false);
  const bootstrap = await send("/bootstrap-admin", { role: "admin" });
  assert.equal(bootstrap.status, 404);
  const { getDB } = await import("../src/config/db.ts");
  assert.throws(() => getDB(), /not connected/);
});
