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
  DB_NAME: "fictional_blog_memory_only",
});
const { createApp } = await import("../src/app.ts");
const { createBlogRepository } =
  await import("../src/modules/blog/blog.repository.ts");
const id = "64b000000000000000000001";
const input = {
  title: "A fictional experiment",
  category: "Physics",
  body: "This fictional classroom experiment explores motion with simple materials and careful observations.",
};
async function fixture(run) {
  const state = {
    rows: [],
    role: "student",
    approved: true,
    banned: false,
    expired: false,
    fail: false,
    queries: [],
    membershipReads: 0,
  };
  const database = {
    collection(name) {
      if (name === "membershipApplications")
        return {
          async findOne(filter, options) {
            state.membershipReads++;
            assert.deepEqual(filter, { _id: id, status: "approved" });
            assert.deepEqual(options.projection, { _id: 0, fullName: 1 });
            assert.equal(options.readPreference, "primary");
            return state.approved
              ? { fullName: "Fictional Approved Member" }
              : null;
          },
        };
      assert.equal(name, "blogPosts");
      return {
        async insertOne(row) {
          if (state.fail) throw new Error("PRIVATE_DATABASE_DETAIL");
          state.rows.push(row);
        },
        async findOne(filter, options) {
          state.queries.push({ filter, options });
          if (state.fail) throw new Error("PRIVATE_DATABASE_DETAIL");
          return (
            state.rows.find((row) => String(row._id) === String(filter._id)) ??
            null
          );
        },
        find(filter, options) {
          state.queries.push({ filter, options });
          let rows = [...state.rows];
          const cursor = {
            sort(spec) {
              assert.deepEqual(spec, { publishedAt: -1, _id: -1 });
              rows.sort(
                (a, b) =>
                  b.publishedAt - a.publishedAt ||
                  String(b._id).localeCompare(String(a._id)),
              );
              return cursor;
            },
            skip(n) {
              rows = rows.slice(n);
              return cursor;
            },
            limit(n) {
              rows = rows.slice(0, n);
              return cursor;
            },
            async toArray() {
              if (state.fail) throw new Error("PRIVATE_DATABASE_DETAIL");
              return rows;
            },
          };
          return cursor;
        },
      };
    },
  };
  const repository = createBlogRepository(() => database);
  const auth = {
    handler: async () => new Response("null"),
    api: {
      getSession: async ({ headers }) =>
        headers.get("cookie") === "fixture=valid"
          ? {
              user: { id, name: "Fictional Staff" },
              session: {
                userId: id,
                expiresAt: new Date(
                  Date.now() + (state.expired ? -1000 : 60000),
                ),
              },
            }
          : null,
    },
  };
  const server = createApp(auth, {
    blogRepository: repository,
    lookupAuthorizationUser: async () => ({
      role: state.role,
      banned: state.banned,
    }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const send = (path = "", method = "GET", body, headers = {}) =>
    fetch("http://127.0.0.1:" + server.address().port + "/api/blog" + path, {
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
test("approved students publish with trusted bylines and public responses exclude private identity", () =>
  fixture(async ({ send, state }) => {
    assert.equal((await send("/permission")).status, 200);
    const before = Date.now();
    const response = await send("", "POST", input);
    assert.equal(response.status, 201);
    const { post } = await response.json();
    assert.equal(post.authorName, "Fictional Approved Member");
    assert.equal(post.body, input.body);
    assert.ok(new Date(post.publishedAt).getTime() >= before);
    assert.match(post.id, /^[a-f0-9]{24}$/);
    assert.equal(state.rows[0].authorId, id);
    assert.equal("authorId" in post, false);
    const listing = await (
      await send("", "GET", undefined, { Cookie: "" })
    ).json();
    assert.equal(listing.items.length, 1);
    assert.equal("body" in listing.items[0], false);
    assert.equal("authorId" in listing.items[0], false);
    const detail = await (
      await send("/" + post.id, "GET", undefined, { Cookie: "" })
    ).json();
    assert.equal(detail.post.body, input.body);
    assert.equal("authorId" in detail.post, false);
    for (const query of state.queries)
      assert.equal(query.options.projection.authorId, undefined);
  }));
test("guests expired banned invalid roles and unapproved students cannot publish", () =>
  fixture(async ({ send, state }) => {
    assert.equal((await send("", "POST", input, { Cookie: "" })).status, 401);
    state.expired = true;
    assert.equal((await send("", "POST", input)).status, 401);
    state.expired = false;
    state.banned = true;
    assert.equal((await send("", "POST", input)).status, 403);
    state.banned = false;
    state.role = "student,admin";
    assert.equal((await send("", "POST", input)).status, 403);
    state.role = "student";
    state.approved = false;
    assert.equal((await send("/permission")).status, 403);
    assert.equal(
      (await send("", "POST", input, { "X-Role": "admin" })).status,
      403,
    );
    assert.equal(state.rows.length, 0);
  }));
test("membership is checked again when publishing and staff use their verified roles", () =>
  fixture(async ({ send, state }) => {
    assert.equal((await send("/permission")).status, 200);
    state.approved = false;
    assert.equal((await send("", "POST", input)).status, 403);
    for (const role of ["teacher", "admin"]) {
      state.role = role;
      assert.equal((await send("", "POST", input)).status, 201);
    }
    assert.equal(state.rows.length, 2);
    assert.equal(state.rows[0].authorName, "Fictional Staff");
  }));
test("forged fields invalid content oversized bodies and foreign origins cannot write", () =>
  fixture(async ({ send, state }) => {
    for (const change of [
      { title: "x" },
      { title: "x".repeat(151) },
      { category: "Unknown" },
      { body: "short" },
      { body: "x".repeat(10001) },
      { authorId: "forged" },
      { authorName: "forged" },
      { role: "admin" },
      { publishedAt: "2026-01-01" },
      { id: "forged" },
    ])
      assert.equal(
        (await send("", "POST", { ...input, ...change })).status,
        400,
      );
    for (const Origin of ["https://attacker.example", ""])
      assert.equal((await send("", "POST", input, { Origin })).status, 403);
    assert.equal((await send("?authorId=forged", "POST", input)).status, 400);
    assert.equal(state.rows.length, 0);
  }));
test("public pagination is bounded stable and details handle invalid or missing IDs", () =>
  fixture(async ({ state, send }) => {
    for (let index = 0; index < 15; index++)
      state.rows.push({
        ...input,
        _id: new ObjectId(),
        authorId: id,
        authorName: "Fictional Author",
        publishedAt: new Date("2026-11-01"),
      });
    const first = await (await send("?page=1")).json();
    const second = await (await send("?page=2")).json();
    assert.equal(first.items.length, 12);
    assert.equal(first.hasNext, true);
    assert.equal(second.items.length, 3);
    assert.equal(second.hasNext, false);
    assert.equal(
      new Set([...first.items, ...second.items].map((item) => item.id)).size,
      15,
    );
    for (const path of ["?page=0", "?page=1001", "?role=admin", "/invalid"])
      assert.equal((await send(path)).status, 400);
    assert.equal((await send("/000000000000000000000099")).status, 404);
  }));
test("database failures return safe errors and literal HTML remains plain content", () =>
  fixture(async ({ send, state }) => {
    const body = "<script>alert('fictional')</script>" + input.body;
    const response = await send("", "POST", { ...input, body });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).post.body, body);
    state.fail = true;
    for (const [path, method, data] of [
      ["", "GET", undefined],
      ["", "POST", input],
    ]) {
      const failed = await send(path, method, data);
      assert.equal(failed.status, 500);
      assert.equal(
        (await failed.text()).includes("PRIVATE_DATABASE_DETAIL"),
        false,
      );
    }
  }));
