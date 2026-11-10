import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import process from "node:process";
import { test } from "node:test";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getCookies } from "better-auth/cookies";

Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_security_memory_only",
});
const { fetch, Request } = globalThis;
const { createAuthWithDatabase } = await import("../src/lib/auth.ts");
const { createApp } = await import("../src/app.ts");
const { envSchema } = await import("../src/config/env.ts");
const { AUTH_IP_HEADER } = await import("../src/lib/auth-security.ts");
const password = "Fictional-Security-Fixture!123";
const origin = "http://localhost:3000";
let clock = Date.now();

function securityTest(name, run) {
  test(name, async (t) => {
    // Built-in limiter memory is process-wide. Advance isolated fake time between
    // cases so tests exercise real limits without leaking counters or sleeping.
    clock += 120_000;
    t.mock.timers.enable({ apis: ["Date"], now: clock });
    const memory = { user: [], session: [], account: [], verification: [] };
    const auth = createAuthWithDatabase(memoryAdapter(memory));
    const lookup = async (id) => {
      const user = memory.user.find((value) => value.id === id);
      return user ? { role: user.role, banned: user.banned } : null;
    };
    const server = createApp(auth, { lookupAuthorizationUser: lookup }).listen(
      0,
      "127.0.0.1",
    );
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const send = (path, options = {}) =>
      fetch(`${base}${path}`, {
        ...options,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    const signup = (body = {}) =>
      send("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          name: "Fictional Student",
          email: "fixture@example.com",
          password,
          ...body,
        }),
      });
    const login = (body = {}, headers = {}) =>
      send("/api/auth/sign-in/email", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "fixture@example.com",
          password,
          ...body,
        }),
      });
    const cookie = (response) =>
      response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    try {
      await run({ auth, memory, send, signup, login, cookie, t });
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
  });
}

securityTest(
  "API headers cover public/private/error responses and exact credentialed CORS",
  async ({ send }) => {
    for (const path of [
      "/api/health",
      "/api/me",
      "/api/admin/overview",
      "/api/missing",
    ]) {
      const response = await send(path);
      assert.equal(response.headers.get("x-powered-by"), null);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.match(
        response.headers.get("content-security-policy"),
        /default-src 'none'/,
      );
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
      assert.equal(
        response.headers.get("access-control-allow-credentials"),
        "true",
      );
      assert.equal(response.headers.get("strict-transport-security"), null);
    }
    const untrusted = await send("/api/health", {
      headers: { Origin: "https://attacker.example" },
    });
    assert.notEqual(
      untrusted.headers.get("access-control-allow-origin"),
      "https://attacker.example",
    );
    const preflight = await send("/api/auth/sign-in/email", {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  },
);

securityTest(
  "public signup cannot assign teacher/admin or ban fields and never duplicates credentials",
  async ({ signup, memory }) => {
    for (const role of ["teacher", "admin", "student,admin"]) {
      const response = await signup({ role });
      assert.equal(response.status, 400);
    }
    // Core emailVerified input is ignored (not a client-assignable field).
    const normal = await signup({ emailVerified: true });
    assert.equal(normal.status, 200);
    const body = await normal.json();
    assert.equal(body.user.role, "student");
    assert.equal(body.user.emailVerified, false);
    assert.equal(memory.user.length, 1);
    assert.equal(memory.account.length, 1);
    assert.notEqual(memory.user[0].banned, true);
    assert.notEqual(memory.account[0].password, password);
    assert.equal("password" in body.user, false);
    const forgedBan = await signup({
      email: "banned-fixture@example.com",
      banned: true,
    });
    assert.equal(forgedBan.status, 200);
    assert.equal((await forgedBan.json()).user.role, "student");
    assert.notEqual(memory.user[1].banned, true);
  },
);

securityTest(
  "cookie flags retain HttpOnly Lax host-only policy and HTTPS Secure prefix",
  async ({ auth, signup }) => {
    const response = await signup();
    assert.equal(response.status, 200);
    const header = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("better-auth.session_token="));
    assert.ok(header);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Lax/i);
    assert.doesNotMatch(header, /;\s*Domain=/i);
    const secure = getCookies({
      ...auth.options,
      baseURL: "https://api.example.test",
    }).sessionToken;
    assert.ok(secure.name.startsWith("__Secure-"));
    assert.equal(secure.attributes.secure, true);
    assert.equal(secure.attributes.httpOnly, true);
    assert.equal(secure.attributes.sameSite, "lax");
    assert.equal(secure.attributes.domain, undefined);
    assert.equal(auth.options.advanced.disableCSRFCheck, undefined);
    assert.equal(auth.options.advanced.disableOriginCheck, undefined);
    assert.notEqual(auth.options.session?.cookieCache?.enabled, true);
  },
);

securityTest(
  "foreign-origin signup/login/logout are rejected without altering existing users or sessions",
  async ({ signup, login, cookie, send, memory }) => {
    assert.equal((await signup()).status, 200);
    const session = cookie(await login());
    const before = {
      users: memory.user.length,
      sessions: memory.session.length,
    };
    for (const path of ["sign-up/email", "sign-in/email", "sign-out"]) {
      const response = await send(`/api/auth/${path}`, {
        method: "POST",
        headers: { Origin: "https://attacker.example", Cookie: session },
        body: JSON.stringify({
          name: "Attacker",
          email: "intruder@example.com",
          password,
        }),
      });
      assert.equal(response.status, 403);
    }
    assert.deepEqual(
      { users: memory.user.length, sessions: memory.session.length },
      before,
    );
    assert.equal(
      (await send("/api/me", { headers: { Cookie: session } })).status,
      200,
    );
  },
);

securityTest(
  "untrusted callback URLs are rejected",
  async ({ signup, login }) => {
    assert.equal((await signup()).status, 200);
    const response = await login({
      callbackURL: "https://attacker.example/steal",
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("location"), null);
  },
);

securityTest(
  "logout revokes cookie replay and tampered cookies cannot authenticate",
  async ({ signup, login, cookie, send }) => {
    assert.equal((await signup()).status, 200);
    const response = await login();
    assert.equal(response.status, 200);
    const session = cookie(response);
    assert.equal(
      (await send("/api/me", { headers: { Cookie: session } })).status,
      200,
    );
    const tampered = await send("/api/me", {
      headers: { Cookie: "better-auth.session_token=forged" },
    });
    assert.equal(tampered.status, 401);
    assert.equal(
      (
        await send("/api/auth/sign-out", {
          method: "POST",
          headers: { Cookie: session },
          body: "{}",
        })
      ).status,
      200,
    );
    assert.equal(
      (await send("/api/me", { headers: { Cookie: session } })).status,
      401,
    );
  },
);

securityTest(
  "login burst is capped atomically despite forged IP headers and varying query strings",
  async ({ send, memory }) => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        send(`/api/auth/sign-in/email?attempt=${index}`, {
          method: "POST",
          headers: {
            [AUTH_IP_HEADER]: `192.0.2.${index + 1}`,
            "X-Forwarded-For": `198.51.100.${index + 1}`,
            "X-Real-IP": `203.0.113.${index + 1}`,
          },
          body: JSON.stringify({ email: "nobody@example.com", password }),
        }),
      ),
    );
    assert.equal(
      responses.filter((response) => response.status === 401).length,
      5,
    );
    const limited = responses.filter((response) => response.status === 429);
    assert.equal(limited.length, 3);
    for (const response of limited) {
      assert.ok(Number(response.headers.get("x-retry-after")) > 0);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
    }
    assert.equal(memory.session.length, 0);
    assert.equal((await send("/api/health")).status, 200);
    assert.equal((await send("/api/auth/get-session")).status, 200);
    assert.equal(
      (await send("/api/auth/sign-out", { method: "POST", body: "{}" })).status,
      200,
    );
  },
);

securityTest(
  "signup burst is throttled before expensive valid account creation",
  async ({ signup, memory }) => {
    for (let index = 0; index < 5; index++)
      assert.equal((await signup({ email: "invalid" })).status, 400);
    const response = await signup();
    assert.equal(response.status, 429);
    assert.equal(memory.user.length, 0);
  },
);

securityTest(
  "server environment rejects padded secrets and URL credentials/paths/insecure production origins",
  async () => {
    const valid = { ...process.env };
    assert.equal(envSchema.safeParse(valid).success, true);
    for (const BETTER_AUTH_URL of [
      "ftp://localhost",
      "https://user:password@example.com",
      "https://api.example.com/api/auth",
      "https://api.example.com/?token=x",
    ]) {
      assert.equal(
        envSchema.safeParse({ ...valid, BETTER_AUTH_URL }).success,
        false,
      );
    }
    assert.equal(
      envSchema.safeParse({ ...valid, BETTER_AUTH_SECRET: " ".repeat(40) })
        .success,
      false,
    );
    assert.equal(
      envSchema.safeParse({ ...valid, NODE_ENV: "production" }).success,
      false,
    );
    assert.equal(
      envSchema.safeParse({
        ...valid,
        NODE_ENV: "production",
        CLIENT_URL: "https://club.example.com",
        BETTER_AUTH_URL: "https://api.example.com",
      }).success,
      true,
    );
  },
);

securityTest(
  "direct handler ignores spoofed forwarding headers outside its configured trusted header",
  async ({ auth }) => {
    assert.deepEqual(auth.options.advanced.ipAddress.ipAddressHeaders, [
      AUTH_IP_HEADER,
    ]);
    assert.equal(auth.options.rateLimit.enabled, true);
    assert.equal(auth.options.rateLimit.storage, "memory");
    const result = await auth.handler(
      new Request("http://localhost:5000/api/auth/get-session"),
    );
    assert.equal(result.status, 200);
  },
);

securityTest(
  "malformed JSON returns 400 without logging submitted secrets",
  async ({ send, t }) => {
    const logs = [];
    t.mock.method(globalThis.console, "error", (...args) => logs.push(args));
    const response = await send("/api/me", {
      method: "POST",
      body: '{"password":"PRIVATE_LOG_SENTINEL"',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Invalid JSON body",
    });
    assert.equal(JSON.stringify(logs).includes("PRIVATE_LOG_SENTINEL"), false);
    assert.equal(logs.length, 1);
  },
);
