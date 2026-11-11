import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import process from "node:process";
import { ObjectId } from "mongodb";
const { fetch, Response } = globalThis;
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_feedback_only",
});
const { createApp } = await import("../src/app.ts");
const { createFeedbackRepository } =
  await import("../src/modules/feedback/feedback.repository.ts");
const { AUTH_USER_COLLECTION } = await import("../src/lib/auth-storage.ts");
const teacherId = "64b000000000000000000001";
const input = {
  category: "suggestion",
  subject: "Fictional suggestion",
  message: "Please add a fictional optics workshop.",
};
const match = (row, filter) =>
  Object.entries(filter).every(([key, value]) => {
    const actual = key.split(".").reduce((obj, part) => obj?.[part], row);
    return value && typeof value === "object" && !(value instanceof ObjectId)
      ? "$exists" in value && (actual !== undefined) === value.$exists
      : String(actual) === String(value);
  });
function memory(state) {
  return {
    collection(name) {
      if (name === AUTH_USER_COLLECTION)
        return {
          findOne: async () => ({ role: state.linkRole, banned: false }),
        };
      assert.equal(name, "feedbackThreads");
      const mutate = (filter, update) => {
        const row = state.rows.find((row) => match(row, filter));
        if (!row) return null;
        if (update.$push) row.messages.push(update.$push.messages);
        Object.assign(row, update.$set);
        row.version++;
        return row;
      };
      return {
        insertOne: async (row) => state.rows.push(row),
        find(filter) {
          let rows = state.rows.filter((row) => match(row, filter));
          const cursor = {
            sort: () => cursor,
            skip: (n) => {
              rows = rows.slice(n);
              return cursor;
            },
            limit: (n) => {
              rows = rows.slice(0, n);
              return cursor;
            },
            toArray: async () => rows,
          };
          return cursor;
        },
        findOneAndUpdate: async (filter, update) => mutate(filter, update),
        updateOne: async (filter, update) => ({
          modifiedCount: mutate(filter, update) ? 1 : 0,
        }),
      };
    },
  };
}
async function fixture(run) {
  const state = {
    rows: [],
    role: "student",
    identity: "fictional-member",
    linkRole: "teacher",
    expired: false,
    banned: false,
  };
  const repository = createFeedbackRepository(() => memory(state));
  const auth = {
    handler: async () => new Response("null"),
    api: {
      getSession: async ({ headers }) =>
        headers.get("cookie") === "fixture=valid"
          ? {
              user: { id: state.identity, name: "Fictional Member" },
              session: {
                userId: state.identity,
                expiresAt: new Date(
                  Date.now() + (state.expired ? -1000 : 60000),
                ),
              },
            }
          : null,
    },
  };
  const server = createApp(auth, {
    feedbackRepository: repository,
    lookupAuthorizationUser: async () => ({
      role: state.role,
      banned: state.banned,
    }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const send = (path = "feedback", method = "GET", body, headers = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, {
      method,
      headers: {
        Cookie: "fixture=valid",
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    await run({ state, send, repository });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}
test("own feedback is private, ignores supplied identity and isolates peers", () =>
  fixture(async ({ send, state }) => {
    const response = await send("feedback", "POST", input);
    assert.equal(response.status, 201);
    const { thread } = await response.json();
    assert.equal(thread.messages[0].author, "member");
    assert.doesNotMatch(
      JSON.stringify(thread),
      /userId|assignedTeacherId|memberName/,
    );
    assert.equal(
      (
        await send("feedback", "POST", {
          ...input,
          userId: "other",
          role: "admin",
        })
      ).status,
      400,
    );
    state.identity = "peer";
    const list = await (await send()).json();
    assert.deepEqual(list.items, []);
    assert.equal(
      (
        await send(`feedback/${thread.id}/replies`, "POST", {
          version: 1,
          message: "forged",
        })
      ).status,
      409,
    );
    assert.equal(state.rows[0].messages.length, 1);
  }));
test("admin assignment scopes teachers, replies set status and member replies reopen", () =>
  fixture(async ({ send, state }) => {
    const { thread } = await (await send("feedback", "POST", input)).json();
    state.role = "teacher";
    state.identity = teacherId;
    assert.deepEqual((await (await send("manage/feedback")).json()).items, []);
    assert.equal(
      (
        await send(`manage/feedback/${thread.id}/replies`, "POST", {
          version: 1,
          message: "not assigned",
          status: "resolved",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await send(`manage/feedback/${thread.id}/assignment`, "PUT", {
          version: 1,
          teacherAccountId: teacherId,
        })
      ).status,
      403,
    );
    state.role = "admin";
    assert.equal(
      (
        await send(`manage/feedback/${thread.id}/assignment`, "PUT", {
          version: 1,
          teacherAccountId: teacherId,
        })
      ).status,
      200,
    );
    state.role = "teacher";
    const list = await (await send("manage/feedback")).json();
    assert.equal(list.items.length, 1);
    assert.doesNotMatch(
      JSON.stringify(list),
      /assignedTeacherId|userId|memberName/,
    );
    const reply = await send(`manage/feedback/${thread.id}/replies`, "POST", {
      version: 2,
      message: "Thanks, we will arrange it.",
      status: "resolved",
    });
    assert.equal(reply.status, 200);
    assert.equal((await reply.json()).thread.status, "resolved");
    state.role = "student";
    state.identity = "fictional-member";
    const reopen = await send(`feedback/${thread.id}/replies`, "POST", {
      version: 3,
      message: "A follow-up question.",
    });
    assert.equal((await reopen.json()).thread.status, "open");
    assert.equal((await send("feedback?status=resolved")).status, 200);
    assert.deepEqual(
      (await (await send("feedback?status=resolved")).json()).items,
      [],
    );
  }));
test("versions prevent concurrent replies and bound thread size", () =>
  fixture(async ({ send, state }) => {
    const { thread } = await (await send("feedback", "POST", input)).json();
    const results = await Promise.all([
      send(`feedback/${thread.id}/replies`, "POST", {
        version: 1,
        message: "first",
      }),
      send(`feedback/${thread.id}/replies`, "POST", {
        version: 1,
        message: "second",
      }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    state.rows[0].messages = Array.from({ length: 50 }, () => ({
      author: "member",
      message: "fictional",
      sentAt: new Date(),
    }));
    assert.equal(
      (
        await send(`feedback/${thread.id}/replies`, "POST", {
          version: 2,
          message: "too many",
        })
      ).status,
      409,
    );
  }));
test("session role origin assignment and strict input checks protect private threads", () =>
  fixture(async ({ send, state }) => {
    assert.equal(
      (await send("feedback", "GET", undefined, { Cookie: "" })).status,
      401,
    );
    assert.equal((await send("manage/feedback")).status, 403);
    assert.equal(
      (
        await send("feedback", "POST", input, {
          Origin: "https://evil.example",
        })
      ).status,
      403,
    );
    for (const query of [
      "userId=other",
      "page=0",
      "category[$ne]=general",
      "status=unknown",
    ])
      assert.equal((await send(`feedback?${query}`)).status, 400);
    assert.equal(
      (await send("feedback", "POST", { ...input, message: "x" })).status,
      400,
    );
    const { thread } = await (await send("feedback", "POST", input)).json();
    state.role = "admin";
    state.linkRole = "student";
    assert.equal(
      (
        await send(`manage/feedback/${thread.id}/assignment`, "PUT", {
          version: 1,
          teacherAccountId: teacherId,
        })
      ).status,
      400,
    );
    state.banned = true;
    assert.equal((await send()).status, 403);
    state.banned = false;
    state.expired = true;
    assert.equal((await send()).status, 401);
  }));
