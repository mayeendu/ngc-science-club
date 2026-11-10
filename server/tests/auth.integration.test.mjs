import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import process from "node:process";
import { after, before, test } from "node:test";

const { fetch, AbortSignal } = globalThis;
// Keep below shared-tier namespace limits while retaining a random identifier.
const testDatabaseName = `ngc_auth_test_${randomBytes(8).toString("hex")}`;
const origin = "http://localhost:3000";
const email = `fictional-${randomUUID()}@example.com`;
const password = randomBytes(32).toString("base64url");
const server = createServer();
let baseURL;
let database;
let databaseAccess;
let auth;
let signupCookie;
let loginCookie;
let envSchema;

// Override only this test process; never write credentials or test settings to disk.
process.env.NODE_ENV = "test";
process.env.DB_NAME = testDatabaseName;
process.env.CLIENT_URL = origin;
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");

before(
  async () => {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseURL = `http://127.0.0.1:${server.address().port}`;
    process.env.BETTER_AUTH_URL = baseURL;
    process.env.PORT = String(server.address().port);
    databaseAccess = await import("../dist/config/db.js");
    ({ envSchema } = await import("../dist/config/env.js"));
    try {
      database = await databaseAccess.connectDB();
    } catch (error) {
      const category = /not authorized|not allowed/i.test(error.message ?? "")
        ? "database permissions"
        : /authentication|bad auth/i.test(error.message ?? "")
          ? "database authentication"
          : /ENOTFOUND|ECONNREFUSED|querySrv|DNS/i.test(error.message ?? "")
            ? "network or DNS"
            : "connection";
      // eslint-disable-next-line preserve-caught-error -- Raw driver causes can contain private connection details.
      throw new Error(
        `Atlas test setup failed (${category}; ${error.name ?? "Error"}; code ${error.code ?? "unknown"}). No credentials printed.`,
      );
    }
    const { createAuth } = await import("../dist/lib/auth.js");
    const { ensureAuthIndexes } = await import("../dist/auth/auth.indexes.js");
    const { createApp } = await import("../dist/app.js");
    await ensureAuthIndexes(database);
    auth = createAuth(database, databaseAccess.getMongoClient());
    await auth.$context;
    server.on("request", createApp(auth));
  },
  { timeout: 60_000 },
);

after(async () => {
  if (server.listening) {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  try {
    // Destructive cleanup is limited to the exact randomly generated test DB.
    if (database) {
      assert.equal(database.databaseName, testDatabaseName);
      assert.match(database.databaseName, /^ngc_auth_test_[a-f0-9]{16}$/);
      await database.dropDatabase();
    }
  } finally {
    await databaseAccess?.closeDB();
  }
});

async function request(
  path,
  { method = "GET", body, cookie, requestOrigin = origin } = {},
) {
  const headers = { Origin: requestOrigin };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  return fetch(`${baseURL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
}

function cookiesFrom(response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

test("auth environment rejects missing/short secrets and unsafe URLs", () => {
  const valid = { ...process.env };
  assert.equal(envSchema.safeParse(valid).success, true);
  for (const overrides of [
    { BETTER_AUTH_SECRET: undefined },
    { BETTER_AUTH_SECRET: "short" },
    { BETTER_AUTH_URL: "not-a-url" },
    { BETTER_AUTH_URL: "http://localhost:5000/api/auth" },
    { BETTER_AUTH_URL: "http://user:password@localhost:5000" },
    { NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:5000" },
  ]) {
    assert.equal(
      envSchema.safeParse({ ...valid, ...overrides }).success,
      false,
    );
  }
});

test("health, member count and auth readiness remain available", async () => {
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).success, true);
  const count = await request("/api/members/count");
  assert.equal(count.status, 200);
  assert.equal((await count.json()).totalMembers, 0);
  const ready = await request("/api/auth/ok");
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).ok, true);
  const session = await request("/api/auth/get-session");
  assert.equal(session.status, 200);
  assert.equal(await session.json(), null);
});

test("CORS allows credentialed POST preflights only for the configured client", async () => {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(
    response.headers.get("access-control-allow-credentials"),
    "true",
  );
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
  const rejected = await request("/api/auth/sign-up/email", {
    method: "POST",
    requestOrigin: "https://untrusted.example",
    body: { name: "Fictional Student", email, password },
  });
  assert.equal(rejected.status, 403);
  assert.notEqual(
    rejected.headers.get("access-control-allow-origin"),
    "https://untrusted.example",
  );
});

test("invalid signup is rejected without creating a user", async () => {
  const invalid = await request("/api/auth/sign-up/email", {
    method: "POST",
    body: {
      name: "Fictional Student",
      email: "invalid-email",
      password: "tiny",
    },
  });
  assert.equal(invalid.status, 400);
  assert.equal(await database.collection("user").countDocuments(), 0);
});

test("signup parses JSON before express.json and stores a hash rather than a password", async () => {
  const response = await request("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: "Fictional Student", email, password, role: "admin" },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.email, email);
  assert.equal(body.user.emailVerified, false);
  assert.equal(Object.hasOwn(body.user, "password"), false);
  signupCookie = cookiesFrom(response);
  assert.ok(signupCookie.length > 0);
  assert.ok(
    response.headers
      .getSetCookie()
      .some((value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)),
  );
  const user = await database.collection("user").findOne({ email });
  assert.ok(user);
  assert.equal(Object.hasOwn(user, "role"), false);
  assert.equal(Object.hasOwn(user, "password"), false);
  const account = await database
    .collection("account")
    .findOne({ userId: user._id });
  assert.ok(account);
  assert.equal(account.providerId, "credential");
  assert.ok(
    typeof account.password === "string" &&
      account.password.length > 0 &&
      account.password !== password,
  );
  assert.equal(await database.collection("members").countDocuments(), 0);
});

test("cookie sessions work and duplicate signup cannot create a second account", async () => {
  const session = await request("/api/auth/get-session", {
    cookie: signupCookie,
  });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user.email, email);
  const duplicate = await request("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: "Fictional Duplicate", email, password },
  });
  assert.ok(duplicate.status >= 400 && duplicate.status < 500);
  assert.equal(await database.collection("user").countDocuments({ email }), 1);
});

test("wrong password fails and valid login issues a session cookie", async () => {
  const wrong = await request("/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password: "deliberately-wrong-password" },
  });
  assert.equal(wrong.status, 401);
  const valid = await request("/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(valid.status, 200);
  loginCookie = cookiesFrom(valid);
  assert.ok(loginCookie.length > 0);
  const session = await request("/api/auth/get-session", {
    cookie: loginCookie,
  });
  assert.equal((await session.json()).user.email, email);
});

test("logout revokes the server session, including replay of the previous cookie", async () => {
  const logout = await request("/api/auth/sign-out", {
    method: "POST",
    cookie: loginCookie,
    body: {},
  });
  assert.equal(logout.status, 200);
  const replay = await request("/api/auth/get-session", {
    cookie: loginCookie,
  });
  assert.equal(replay.status, 200);
  assert.equal(await replay.json(), null);
});

test("auth index setup enforces uniqueness, relationship lookups and expiry cleanup", async () => {
  const userIndexes = await database.collection("user").indexes();
  assert.ok(
    userIndexes.some((index) => index.unique === true && index.key.email === 1),
  );
  const sessionIndexes = await database.collection("session").indexes();
  assert.ok(
    sessionIndexes.some(
      (index) => index.unique === true && index.key.token === 1,
    ),
  );
  assert.ok(sessionIndexes.some((index) => index.key.userId === 1));
  const accountIndexes = await database.collection("account").indexes();
  assert.ok(accountIndexes.some((index) => index.key.userId === 1));
  assert.ok(
    accountIndexes.some(
      (index) =>
        index.unique === true &&
        index.key.providerId === 1 &&
        index.key.accountId === 1,
    ),
  );
  assert.ok(
    sessionIndexes.some(
      (index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0,
    ),
  );
  const verificationIndexes = await database
    .collection("verification")
    .indexes();
  assert.ok(verificationIndexes.some((index) => index.key.identifier === 1));
  assert.ok(
    verificationIndexes.some(
      (index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0,
    ),
  );
  assert.strictEqual(databaseAccess.getDB(), database);
});
