import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import process from "node:process";
import { test } from "node:test";
import { URL } from "node:url";
import express from "express";
import { memoryAdapter } from "better-auth/adapters/memory";

// Do not read/write real users. All auth records and role changes are memory-only.
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_memory_only",
});
const { structuredClone, fetch } = globalThis;
const { createApp } = await import("../src/app.ts");
const { createAuthWithDatabase } = await import("../src/lib/auth.ts");
const { requireAuth } =
  await import("../src/middleware/require-auth.middleware.ts");
const { createRequireRole } =
  await import("../src/middleware/require-role.middleware.ts");
const { parseAppRole } = await import("../src/types/roles.ts");
const { findAuthorizationUser } =
  await import("../src/lib/authorization-user.ts");
const { errorHandler } = await import("../src/middleware/error.middleware.ts");
const { authRoles } = await import("../src/lib/auth-access.ts");

const paths = [
  "/api/student/overview",
  "/api/teacher/overview",
  "/api/admin/overview",
];
const expected = {
  student: [200, 403, 403],
  teacher: [200, 200, 403],
  admin: [200, 200, 200],
};
function context(role = "student") {
  const userId = "64b000000000000000000001";
  const createdAt = new Date();
  const authentication = {
    user: {
      id: userId,
      name: "Fictional User",
      email: "fictional@example.com",
      emailVerified: true,
      role,
      createdAt,
      updatedAt: createdAt,
    },
    session: {
      id: "fictional-session",
      token: "fixture-only-not-a-real-token",
      userId,
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(Date.now() + 60_000),
    },
  };
  const state = {
    sessionCalls: 0,
    lookupCalls: 0,
    authentication,
    currentUser: { role, banned: false },
    sessionError: false,
    lookupError: false,
    revoked: false,
  };
  const auth = {
    handler: async () =>
      new globalThis.Response("null", {
        headers: { "Content-Type": "application/json" },
      }),
    api: {
      getSession: async ({ headers, query }) => {
        state.sessionCalls++;
        assert.equal(query.disableCookieCache, true);
        if (state.sessionError) throw new Error("PRIVATE_SESSION_DETAIL");
        return headers.get("cookie") === "fixture-session=valid" &&
          !state.revoked
          ? structuredClone(state.authentication)
          : null;
      },
    },
  };
  const lookup = async (id) => {
    state.lookupCalls++;
    assert.equal(id, userId);
    if (state.lookupError) throw new Error("PRIVATE_DATABASE_DETAIL");
    return structuredClone(state.currentUser);
  };
  return {
    app: createApp(auth, { lookupAuthorizationUser: lookup }),
    auth,
    lookup,
    state,
  };
}

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function request(
  base,
  path,
  { cookie = "fixture-session=valid", headers = {}, body } = {},
) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const connection = httpRequest(
      new URL(path, base),
      {
        method: "GET",
        headers: {
          Origin: "http://localhost:3000",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
      },
      (response) => {
        let content = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          content += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: JSON.parse(content),
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    connection.setTimeout(5000, () =>
      connection.destroy(new Error("Test request timed out.")),
    );
    connection.on("error", reject);
    connection.end(payload);
  });
}

function assertDecision(response, status) {
  assert.equal(response.status, status);
  assert.deepEqual(
    response.body,
    status === 200
      ? { success: true, message: "Access granted" }
      : {
          success: false,
          message:
            status === 401
              ? "Authentication required"
              : "Insufficient permissions",
        },
  );
}

for (const path of paths) {
  test(`anonymous request to ${path} is 401`, async () => {
    const { app, state } = context();
    await withServer(app, async (base) =>
      assertDecision(await request(base, path, { cookie: null }), 401),
    );
    assert.equal(state.lookupCalls, 0);
  });
}

for (const [role, statuses] of Object.entries(expected)) {
  for (const [index, path] of paths.entries()) {
    test(`${role} on ${path}: HTTP ${statuses[index]}`, async () => {
      const { app, state } = context(role);
      await withServer(app, async (base) =>
        assertDecision(await request(base, path), statuses[index]),
      );
      assert.equal(state.sessionCalls, 1);
      assert.equal(state.lookupCalls, 1);
    });
  }
}

for (const [label, role] of [
  ["missing", undefined],
  ["null", null],
  ["unknown", "owner"],
  ["empty", ""],
  ["case mismatch", "Admin"],
  ["whitespace", " admin "],
  ["multi-role", "student,admin"],
  ["array", ["admin"]],
  ["object", { role: "admin" }],
  ["number", 1],
]) {
  test(`${label} stored role receives no role-protected access`, async () => {
    const { app, state } = context("admin");
    state.currentUser.role = role;
    await withServer(app, async (base) => {
      for (const path of paths) assertDecision(await request(base, path), 403);
    });
  });
}

test("expired, revoked, malformed and mismatched sessions are rejected before role lookup", async () => {
  for (const change of [
    (state) => {
      state.authentication.session.expiresAt = new Date(Date.now() - 1);
    },
    (state) => {
      state.revoked = true;
    },
    (state) => {
      state.authentication.session.expiresAt = "not-a-date";
    },
    (state) => {
      state.authentication.session.userId = "different-user";
    },
  ]) {
    const { app, state } = context("admin");
    change(state);
    await withServer(app, async (base) => {
      for (const path of paths) assertDecision(await request(base, path), 401);
    });
    assert.equal(state.lookupCalls, 0);
  }
});

test("forged body, query and headers never grant roles or authenticate a request", async () => {
  const { app } = context("student");
  await withServer(app, async (base) => {
    assertDecision(
      await request(base, "/api/admin/overview", {
        body: { role: "admin", user: { role: "admin" } },
      }),
      403,
    );
    assertDecision(
      await request(base, "/api/admin/overview?role=admin&userId=other"),
      403,
    );
    assertDecision(
      await request(base, "/api/admin/overview", {
        headers: { "x-role": "admin", "x-user-role": "admin", role: "admin" },
      }),
      403,
    );
    assertDecision(
      await request(base, "/api/admin/overview", {
        cookie: null,
        body: { role: "admin" },
        headers: { "x-role": "admin" },
      }),
      401,
    );
  });
});

test("role changes take effect on the next request despite a stale session role", async () => {
  const { app, state } = context("admin");
  await withServer(app, async (base) => {
    assertDecision(await request(base, "/api/admin/overview"), 200);
    state.currentUser.role = "student";
    assertDecision(await request(base, "/api/admin/overview"), 403);
    assertDecision(await request(base, "/api/student/overview"), 200);
    state.currentUser.role = "teacher";
    assertDecision(await request(base, "/api/teacher/overview"), 200);
    assertDecision(await request(base, "/api/admin/overview"), 403);
    assert.equal(state.authentication.user.role, "admin");
  });
});

test("deleted or banned users fail closed", async () => {
  const { app, state } = context("admin");
  await withServer(app, async (base) => {
    state.currentUser.banned = true;
    assertDecision(await request(base, "/api/admin/overview"), 403);
    state.currentUser = null;
    assertDecision(await request(base, "/api/admin/overview"), 401);
  });
});

test("database and session-service failures return generic 500 responses", async () => {
  for (const kind of ["lookupError", "sessionError"]) {
    const { app, state } = context("admin");
    state[kind] = true;
    await withServer(app, async (base) => {
      const response = await request(base, "/api/admin/overview");
      assert.equal(response.status, 500);
      assert.deepEqual(response.body, {
        success: false,
        message: "Internal server error",
      });
      assert.equal(JSON.stringify(response.body).includes("PRIVATE_"), false);
    });
  }
});

test("requireAuth caches only verification within one request; requireRole never re-verifies the session", async () => {
  const { auth, lookup, state } = context("admin");
  const app = express();
  app.get(
    "/double",
    requireAuth(auth),
    requireAuth(auth),
    createRequireRole(lookup)("admin"),
    (_req, res) => res.json({ success: true, message: "Access granted" }),
  );
  app.use(errorHandler);
  await withServer(app, async (base) =>
    assertDecision(await request(base, "/double"), 200),
  );
  assert.equal(state.sessionCalls, 1);
  assert.equal(state.lookupCalls, 1);
});

test("requireRole without verified middleware context returns 401, even with forged locals", async () => {
  const { lookup, state } = context("admin");
  const app = express();
  app.use((_req, res, next) => {
    res.locals.user = { id: "forged", role: "admin" };
    next();
  });
  app.get("/admin", createRequireRole(lookup)("admin"), (_req, res) =>
    res.json({ success: true, message: "Access granted" }),
  );
  await withServer(app, async (base) =>
    assertDecision(await request(base, "/admin"), 401),
  );
  assert.equal(state.lookupCalls, 0);
});

test("role parser and middleware reject invalid application configuration", () => {
  for (const role of [undefined, null, {}, [], "teacher,admin", "ADMIN"])
    assert.equal(parseAppRole(role), null);
  for (const role of ["student", "teacher", "admin"])
    assert.equal(parseAppRole(role), role);
  assert.throws(() => createRequireRole()(), /valid application role/);
  assert.throws(() => createRequireRole()("owner"), /valid application role/);
});

test("authoritative Mongo lookup uses ObjectId, a minimal projection and primary reads", async () => {
  let calls = 0;
  const database = {
    collection(name) {
      assert.equal(name, "user");
      return {
        findOne: async (filter, options) => {
          calls++;
          assert.equal(filter._id.toHexString(), "64b000000000000000000001");
          assert.deepEqual(options.projection, { _id: 0, role: 1, banned: 1 });
          assert.equal(options.readPreference, "primary");
          return { role: "teacher", banned: false };
        },
      };
    },
  };
  assert.deepEqual(
    await findAuthorizationUser("64b000000000000000000001", database),
    { role: "teacher", banned: false },
  );
  assert.equal(await findAuthorizationUser("invalid", database), null);
  assert.equal(calls, 1);
});

test("ordinary authentication, profile and public health behavior are preserved", async () => {
  const { app, state } = context("student");
  state.currentUser.role = undefined;
  await withServer(app, async (base) => {
    const health = await request(base, "/api/health", { cookie: null });
    assert.equal(health.status, 200);
    assert.equal(health.body.success, true);
    const anonymous = await request(base, "/api/me", { cookie: null });
    assertDecision(anonymous, 401);
    assert.equal(
      anonymous.headers["access-control-allow-origin"],
      "http://localhost:3000",
    );
    const profile = await request(base, "/api/me");
    assert.equal(profile.status, 200);
    assert.deepEqual(Object.keys(profile.body.user).sort(), [
      "email",
      "id",
      "name",
    ]);
    assert.equal(Object.hasOwn(profile.body, "session"), false);
  });
});

test("plugin custom roles give no administrative powers to students or teachers", () => {
  for (const role of ["student", "teacher"]) {
    assert.equal(
      authRoles[role].authorize({ user: ["set-role"] }).success,
      false,
    );
    assert.equal(
      authRoles[role].authorize({ user: ["create"] }).success,
      false,
    );
  }
  assert.equal(authRoles.admin.authorize({ user: ["set-role"] }).success, true);
});

test("real memory-only signup/login/session/logout and plugin protections remain functional", async () => {
  const memory = { user: [], session: [], account: [], verification: [] };
  const auth = createAuthWithDatabase(memoryAdapter(memory));
  const signup = await auth.handler(
    new globalThis.Request("http://localhost:5000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Fictional Student",
        email: "rbac@example.com",
        password: "Fictional-Test-Password!",
      }),
    }),
  );
  assert.equal(signup.status, 200);
  assert.equal((await signup.json()).user.role, "student");
  const lookup = async (id) => {
    const user = memory.user.find((value) => value.id === id);
    return user ? { role: user.role, banned: user.banned } : null;
  };
  await withServer(
    createApp(auth, { lookupAuthorizationUser: lookup }),
    async (base) => {
      const login = await fetch(`${base}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "rbac@example.com",
          password: "Fictional-Test-Password!",
        }),
      });
      assert.equal(login.status, 200);
      const cookie = login.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      assertDecision(
        await request(base, "/api/student/overview", { cookie }),
        200,
      );
      assertDecision(
        await request(base, "/api/teacher/overview", { cookie }),
        403,
      );
      for (const role of ["teacher", "student,admin"]) {
        memory.user[0].role = role;
        assertDecision(
          await request(base, "/api/admin/overview", { cookie }),
          403,
        );
        const adminResponse = await request(
          base,
          "/api/auth/admin/list-users",
          { cookie },
        );
        assertDecision(adminResponse, 403);
      }
      memory.user[0].role = "admin";
      assertDecision(
        await request(base, "/api/admin/overview", { cookie }),
        200,
      );
      const adminResponse = await request(base, "/api/auth/admin/list-users", {
        cookie,
      });
      assert.equal(adminResponse.status, 200);
      const logout = await fetch(`${base}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      assert.equal(logout.status, 200);
      assertDecision(
        await request(base, "/api/student/overview", { cookie }),
        401,
      );
    },
  );
});
