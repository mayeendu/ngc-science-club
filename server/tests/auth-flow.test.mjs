import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import process from "node:process";
import { memoryAdapter } from "better-auth/adapters/memory";
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_auth_flow_memory",
});
const { fetch } = globalThis;
const { createAuthWithDatabase } = await import("../src/lib/auth.ts");
const { createApp } = await import("../src/app.ts");
test("signup origin rejection, validation, password hashing, student default and cookie session flow (memory only)", async () => {
  const memory = { user: [], account: [], session: [], verification: [] };
  const auth = createAuthWithDatabase(memoryAdapter(memory));
  const server = createApp(auth, {
    lookupAuthorizationUser: async (id) =>
      memory.user.find((user) => user.id === id) ?? null,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const payload = {
    name: "Fictional Student",
    email: "fixture@example.com",
    password: "Fictional-Secure-Password!123",
  };
  const send = (path, body, origin = "http://localhost:3000", cookie = "") =>
    fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
        Cookie: cookie,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    for (const origin of [
      "https://evil.example",
      "http://localhost:3000.evil.example",
      "null",
      "",
    ]) {
      assert.equal((await send("sign-up/email", payload, origin)).status, 403);
      assert.equal(memory.user.length, 0);
    }
    assert.equal(
      (
        await send("sign-up/email", {
          ...payload,
          email: "invalid",
          password: "tiny",
        })
      ).status,
      400,
    );
    assert.equal(memory.user.length, 0);
    assert.equal(
      (await send("sign-up/email", { ...payload, role: "admin" })).status,
      400,
    );
    assert.equal(memory.user.length, 0);
    const response = await send("sign-up/email", payload);
    assert.equal(response.status, 200);
    assert.equal(memory.user[0].role, "student");
    assert.notEqual(memory.account[0].password, payload.password);
    assert.ok(memory.account[0].password.length > 20);
    const cookies = response.headers.getSetCookie();
    assert.ok(
      cookies.some(
        (cookie) => /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie),
      ),
    );
    const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
    const session = await send("get-session", undefined, undefined, cookie);
    assert.equal((await session.json()).user.email, payload.email);
    assert.equal((await send("sign-out", {}, undefined, cookie)).status, 200);
    assert.equal(
      await (await send("get-session", undefined, undefined, cookie)).json(),
      null,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
