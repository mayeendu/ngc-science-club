import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import process from "node:process";
import { test } from "node:test";
import { ObjectId } from "mongodb";
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_quizzes_memory_only",
});
const { fetch, structuredClone } = globalThis;
const { createApp } = await import("../src/app.ts");
const { createQuizRepository } =
  await import("../src/modules/quizzes/quiz.repository.ts");
const content = {
  title: "Fictional science quiz",
  description: "Explore fictional science questions.",
  subject: "Physics",
  durationMinutes: 30,
  questions: [
    {
      text: "Which option is correct?",
      options: ["First", "Second", "SECRET_ANSWER", "Fourth"],
      correctOption: 2,
      marks: 3,
    },
    {
      text: "Which option is different?",
      options: ["One", "Two", "Three", "Four"],
      correctOption: 0,
      marks: 4,
    },
  ],
};
const clone = (row) => ({
  ...structuredClone(row),
  _id: new ObjectId(row._id.toHexString()),
});
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) =>
    key === "_id"
      ? row._id.equals(value)
      : value && typeof value === "object" && "$exists" in value
        ? key in row === value.$exists
        : value && typeof value === "object" && "$ne" in value
          ? row[key] !== value.$ne
          : row[key] === value,
  );
}
async function fixture(run) {
  const records = new Map(),
    queries = [];
  const state = {
    role: "teacher",
    id: "64b000000000000000000001",
    expired: false,
    revoked: false,
    fail: false,
  };
  const collection = {
    async insertOne(doc) {
      if (state.fail) throw new Error("PRIVATE_DB_SENTINEL");
      records.set(doc._id.toHexString(), clone(doc));
      return { insertedId: doc._id };
    },
    async findOne(filter, options) {
      if (state.fail) throw new Error("PRIVATE_DB_SENTINEL");
      queries.push({ filter, options });
      const row = [...records.values()].find((row) => matches(row, filter));
      return row ? clone(row) : null;
    },
    async findOneAndUpdate(filter, update, options) {
      if (state.fail) throw new Error("PRIVATE_DB_SENTINEL");
      queries.push({ filter, update, options });
      const row = [...records.values()].find((row) => matches(row, filter));
      if (!row) return null;
      const next = {
        ...row,
        ...update.$set,
        version: row.version + (update.$inc?.version ?? 0),
      };
      records.set(row._id.toHexString(), clone(next));
      return clone(next);
    },
    find(filter, options) {
      queries.push({ filter, options });
      let offset = 0,
        maximum = 10;
      const cursor = {
        sort() {
          return cursor;
        },
        skip(value) {
          offset = value;
          return cursor;
        },
        limit(value) {
          maximum = value;
          return cursor;
        },
        async toArray() {
          if (state.fail) throw new Error("PRIVATE_DB_SENTINEL");
          return [...records.values()]
            .filter((row) => matches(row, filter))
            .sort(
              (a, b) =>
                b.createdAt - a.createdAt ||
                a._id.toHexString().localeCompare(b._id.toHexString()),
            )
            .slice(offset, offset + maximum)
            .map(clone);
        },
      };
      return cursor;
    },
  };
  const repository = createQuizRepository(() => ({
    collection(name) {
      assert.equal(name, "quizzes");
      return collection;
    },
  }));
  const auth = {
    handler: async () => new globalThis.Response("null"),
    api: {
      getSession: async ({ headers, query }) => {
        assert.equal(query.disableCookieCache, true);
        return headers.get("cookie") === "fixture=valid" && !state.revoked
          ? {
              user: { id: state.id, role: "admin" },
              session: {
                userId: state.id,
                expiresAt: new Date(
                  Date.now() + (state.expired ? -1000 : 60000),
                ),
              },
            }
          : null;
      },
    },
  };
  const server = createApp(auth, {
    quizRepository: repository,
    lookupAuthorizationUser: async () => ({ role: state.role, banned: false }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = (method = "GET", path = "", body, headers = {}) =>
    fetch(origin + "/api/manage/quizzes" + path, {
      method,
      headers: {
        Cookie: "fixture=valid",
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const create = async (input = content) => {
    const response = await send("POST", "", input);
    assert.equal(response.status, 201);
    return (await response.json()).quiz;
  };
  try {
    await run({ send, create, records, queries, state, origin });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}

test("only current teachers/admins can reach any management operation", () =>
  fixture(async ({ send, create, state, records }) => {
    const quiz = await create();
    for (const [method, path, body] of [
      ["GET", "", undefined],
      ["GET", "/" + quiz.id, undefined],
      ["POST", "", content],
      ["PATCH", "/" + quiz.id, { ...content, version: 1 }],
      ["PATCH", `/${quiz.id}/status`, { status: "published", version: 1 }],
      ["DELETE", "/" + quiz.id, { version: 1 }],
    ]) {
      assert.equal(
        (await send(method, path, body, { Cookie: "" })).status,
        401,
      );
      for (const role of ["student", "student,admin", undefined]) {
        state.role = role;
        assert.equal(
          (await send(method, path, body, { "X-Role": "admin" })).status,
          403,
        );
      }
      state.role = "teacher";
    }
    assert.equal(records.size, 1);
    assert.equal(records.get(quiz.id).version, 1);
  }));

test("server owns creator timestamps totals and list projections omit answer keys", () =>
  fixture(async ({ create, send, state, records, queries }) => {
    const quiz = await create();
    assert.equal(quiz.totalMarks, 7);
    assert.equal(quiz.questionCount, 2);
    assert.equal(quiz.status, "draft");
    assert.equal(quiz.version, 1);
    assert.equal(records.get(quiz.id).createdBy, state.id);
    assert.ok(records.get(quiz.id).createdAt instanceof Date);
    const list = await (await send()).json();
    assert.equal(list.quizzes.length, 1);
    assert.equal("questions" in list.quizzes[0], false);
    assert.equal(JSON.stringify(list).includes("SECRET_ANSWER"), false);
    assert.equal("createdBy" in list.quizzes[0], false);
    assert.equal(queries.at(-1).options.projection.questions, undefined);
    assert.equal(
      (await (await send("GET", "/" + quiz.id)).json()).quiz.questions[0]
        .correctOption,
      2,
    );
  }));

test("teachers cannot read mutate publish or delete another teachers quiz; admins can manage it", () =>
  fixture(async ({ create, send, state, records }) => {
    const quiz = await create();
    const creator = state.id;
    state.id = "64b000000000000000000002";
    assert.deepEqual((await (await send()).json()).quizzes, []);
    for (const [method, path, body] of [
      ["GET", "/" + quiz.id, undefined],
      ["PATCH", "/" + quiz.id, { ...content, version: 1 }],
      ["PATCH", `/${quiz.id}/status`, { status: "published", version: 1 }],
      ["DELETE", "/" + quiz.id, { version: 1 }],
    ])
      assert.equal(
        (await send(method, path, body, { "X-Role": "admin" })).status,
        404,
      );
    assert.equal(records.get(quiz.id).createdBy, creator);
    state.role = "admin";
    assert.equal((await (await send()).json()).quizzes.length, 1);
    assert.equal((await send("GET", "/" + quiz.id)).status, 200);
    assert.equal(
      (
        await send("PATCH", "/" + quiz.id, {
          ...content,
          title: "Admin revised title",
          version: 1,
        })
      ).status,
      200,
    );
    assert.equal(records.get(quiz.id).createdBy, creator);
  }));

test("draft edit publish unpublish archive flow preserves version and published immutability", () =>
  fixture(async ({ create, send, records }) => {
    const quiz = await create();
    const revised = {
      ...content,
      title: "Revised fictional quiz",
      questions: content.questions.map((q) => ({ ...q, marks: 5 })),
    };
    const edited = await send("PATCH", "/" + quiz.id, {
      ...revised,
      version: 1,
    });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).quiz.totalMarks, 10);
    assert.equal(
      (
        await send("PATCH", `/${quiz.id}/status`, {
          status: "published",
          version: 2,
        })
      ).status,
      200,
    );
    assert.equal(
      (await send("PATCH", "/" + quiz.id, { ...content, version: 3 })).status,
      409,
    );
    assert.equal(
      (await send("DELETE", "/" + quiz.id, { version: 3 })).status,
      409,
    );
    assert.equal(
      (
        await send("PATCH", `/${quiz.id}/status`, {
          status: "draft",
          version: 3,
        })
      ).status,
      200,
    );
    assert.equal(
      (await send("DELETE", "/" + quiz.id, { version: 4 })).status,
      204,
    );
    assert.ok(records.get(quiz.id).deletedAt instanceof Date);
    assert.equal(records.get(quiz.id).version, 5);
    assert.equal((await send("GET", "/" + quiz.id)).status, 404);
    assert.deepEqual((await (await send()).json()).quizzes, []);
  }));

test("invalid and forged payloads cannot set owner marks status or answer structures", () =>
  fixture(async ({ send, records }) => {
    for (const change of [
      { createdBy: "other" },
      { totalMarks: 999 },
      { version: 8 },
      { role: "admin" },
      { status: "published" },
      { title: "" },
      { durationMinutes: 0 },
      { questions: Array.from({ length: 51 }, () => content.questions[0]) },
      ...[
        { options: ["One", "Two", "Three"] },
        { options: ["One", "Two", "Three", "Four", "Five"] },
        { options: ["One", "one", "Three", "Four"] },
        { correctOption: 4 },
        { correctOption: [0, 1] },
        { marks: 0 },
        { marks: 1.5 },
      ].map((question) => ({
        questions: [{ ...content.questions[0], ...question }],
      })),
    ])
      assert.equal(
        (await send("POST", "", { ...content, ...change })).status,
        400,
      );
    assert.equal(records.size, 0);
  }));

test("empty drafts save but cannot publish until questions are complete", () =>
  fixture(async ({ create, send, records }) => {
    const quiz = await create({ ...content, questions: [] });
    assert.equal(quiz.totalMarks, 0);
    assert.equal(
      (
        await send("PATCH", `/${quiz.id}/status`, {
          status: "published",
          version: 1,
        })
      ).status,
      400,
    );
    assert.equal(records.get(quiz.id).status, "draft");
    assert.equal(
      (await send("PATCH", "/" + quiz.id, { ...content, version: 1 })).status,
      200,
    );
    assert.equal(
      (
        await send("PATCH", `/${quiz.id}/status`, {
          status: "published",
          version: 2,
        })
      ).status,
      200,
    );
  }));

test("stale and simultaneous draft writes cannot overwrite newer changes", () =>
  fixture(async ({ create, send, records }) => {
    const quiz = await create();
    const responses = await Promise.all([
      send("PATCH", "/" + quiz.id, {
        ...content,
        title: "First teacher update",
        version: 1,
      }),
      send("PATCH", "/" + quiz.id, {
        ...content,
        title: "Second teacher update",
        version: 1,
      }),
    ]);
    assert.equal(responses.filter((r) => r.status === 200).length, 1);
    assert.equal(responses.filter((r) => r.status === 409).length, 1);
    assert.equal(records.get(quiz.id).version, 2);
    assert.equal(
      (
        await send("PATCH", `/${quiz.id}/status`, {
          status: "published",
          version: 1,
        })
      ).status,
      409,
    );
    assert.equal(
      (await send("DELETE", "/" + quiz.id, { version: 1 })).status,
      409,
    );
  }));

test("list filters pagination IDs origin and expired sessions are checked safely", () =>
  fixture(async ({ create, send, state, records }) => {
    for (let index = 0; index < 13; index++)
      await create({ ...content, title: `Fictional quiz ${index}` });
    const first = await (await send()).json();
    const second = await (await send("GET", "?page=2")).json();
    assert.equal(first.quizzes.length, 10);
    assert.equal(first.hasNext, true);
    assert.equal(second.quizzes.length, 3);
    assert.equal(second.hasNext, false);
    const quiz = first.quizzes[0];
    for (const [method, path, body] of [
      ["POST", "", content],
      ["PATCH", "/" + quiz.id, { ...content, version: 1 }],
      ["PATCH", `/${quiz.id}/status`, { status: "published", version: 1 }],
      ["DELETE", "/" + quiz.id, { version: 1 }],
    ])
      for (const Origin of ["https://attacker.example", ""])
        assert.equal((await send(method, path, body, { Origin })).status, 403);
    for (const path of [
      "?page=0",
      "?page=1001",
      "?createdBy=other",
      "?status=invalid",
      "/invalid-id",
    ])
      assert.equal((await send("GET", path)).status, 400);
    assert.equal(
      (
        await send("PATCH", "/" + quiz.id, {
          ...content,
          version: 1,
          status: "published",
        })
      ).status,
      400,
    );
    assert.equal(records.get(quiz.id).status, "draft");
    state.expired = true;
    assert.equal((await send()).status, 401);
    state.expired = false;
    state.revoked = true;
    assert.equal((await send()).status, 401);
  }));

test("no public or student route exposes answers and database errors stay private", () =>
  fixture(async ({ create, send, state, origin }) => {
    const quiz = await create();
    assert.equal((await fetch(origin + "/api/quizzes/" + quiz.id)).status, 404);
    state.role = "student";
    const forbidden = await send("GET", "/" + quiz.id);
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.text()).includes("SECRET_ANSWER"), false);
    state.role = "teacher";
    state.fail = true;
    for (const [method, path, body] of [
      ["GET", "", undefined],
      ["GET", "/" + quiz.id, undefined],
      ["POST", "", content],
      ["PATCH", "/" + quiz.id, { ...content, version: 1 }],
      ["DELETE", "/" + quiz.id, { version: 1 }],
    ]) {
      const response = await send(method, path, body);
      assert.equal(response.status, 500);
      assert.equal(
        (await response.text()).includes("PRIVATE_DB_SENTINEL"),
        false,
      );
    }
  }));
