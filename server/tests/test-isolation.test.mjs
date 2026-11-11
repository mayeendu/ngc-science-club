import assert from "node:assert/strict";
import { test } from "node:test";
import process from "node:process";
import { randomBytes } from "node:crypto";
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:1",
  DB_NAME: "fictional_isolation_only",
});
test("isolated mode refuses both database connection entry points before network access", async () => {
  const previous = process.env.NGC_ISOLATED_TEST;
  process.env.NGC_ISOLATED_TEST = "1";
  try {
    const { connectDB, getMongoClient } = await import("../src/config/db.ts");
    await assert.rejects(connectDB(), /disabled in isolated tests/);
    assert.throws(getMongoClient, /disabled in isolated tests/);
  } finally {
    if (previous === undefined) delete process.env.NGC_ISOLATED_TEST;
    else process.env.NGC_ISOLATED_TEST = previous;
  }
});
