import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { randomBytes } from "node:crypto";
const { fetch, Response, setTimeout } = globalThis;
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:1",
  DB_NAME: "fictional_deployment_only",
});
const { createApp } = await import("../src/app.ts");
const { createShutdown } = await import("../src/lib/shutdown.ts");
test("readiness checks dependencies, returns 503 on failure, and never exposes details", async () => {
  let available = true;
  const auth = {
    handler: async () => new Response("null"),
    api: { getSession: async () => null },
  };
  const server = createApp(auth, {
    readiness: async () => {
      if (!available) throw new Error("PRIVATE mongodb credential detail");
    },
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const get = (path) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/${path}`);
  try {
    const response = await get("ready");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.deepEqual(await response.json(), { success: true, status: "ready" });
    available = false;
    const failed = await get("ready");
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), {
      success: false,
      status: "unavailable",
    });
    assert.equal((await get("health")).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("shutdown is idempotent and drains requests and worker before closing the database", async () => {
  const calls = [];
  let drain;
  const server = {
    close: (callback) => {
      calls.push("stop-listening");
      drain = callback;
    },
    closeIdleConnections: () => calls.push("idle"),
    closeAllConnections: () => calls.push("force"),
  };
  const shutdown = createShutdown(
    server,
    async () => {
      calls.push("worker");
    },
    async () => {
      calls.push("database");
    },
    { exit: (code) => calls.push(code) },
  );
  const first = shutdown();
  assert.equal(shutdown(), first);
  await Promise.resolve();
  assert.equal(calls.includes("database"), false);
  drain();
  await first;
  assert.deepEqual(calls, ["stop-listening", "idle", "worker", "database", 0]);
});
test("shutdown deadline aborts stalled connections and exits unsuccessfully", async () => {
  const calls = [];
  const shutdown = createShutdown(
    {
      close: () => {},
      closeIdleConnections: () => {},
      closeAllConnections: () => calls.push("force"),
    },
    async () => {},
    async () => {},
    { timeoutMs: 10, exit: (code) => calls.push(code) },
  );
  void shutdown();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(calls, ["force", 1]);
});
test("production environment preflight is offline and redacts invalid configuration", () => {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    CLIENT_URL: "https://club.example.edu.bd",
    BETTER_AUTH_URL: "https://api.club.example.edu.bd",
    NGC_ISOLATED_TEST: "1",
  };
  const run = (extra) =>
    spawnSync(process.execPath, ["scripts/check-production.mjs"], {
      encoding: "utf8",
      env: { ...env, ...extra },
    });
  assert.equal(run({}).status, 0);
  for (const extra of [
    { CLIENT_URL: "http://unsafe.example" },
    { BETTER_AUTH_SECRET: "PRIVATE_SHORT_VALUE" },
    { MONGODB_URI: "PRIVATE_BAD_URI" },
  ]) {
    const result = run(extra);
    assert.equal(result.status, 1);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /PRIVATE_SHORT_VALUE|PRIVATE_BAD_URI/,
    );
  }
});
