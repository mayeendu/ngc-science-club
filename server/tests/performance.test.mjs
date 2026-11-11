import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import process from "node:process";
const { fetch, Response } = globalThis;
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_performance_only",
});
const { createApp } = await import("../src/app.ts");
const { createPerformanceRepository } =
  await import("../src/modules/performance/performance.repository.ts");
const { parsePerformanceQuery } =
  await import("../src/modules/performance/performance.schema.ts");
const { ObjectId } = await import("mongodb");
const id = (n) => n.toString(16).padStart(24, "0");
const quizzes = [1, 2, 3, 4].map((n) => ({
  _id: new ObjectId(id(n)),
  createdBy: n === 2 ? "other-teacher" : "teacher",
  status: "published",
  ...(n !== 3 ? { resultsReleasedAt: new Date(), closedAt: new Date() } : {}),
  ...(n === 4 ? { deletedAt: new Date() } : {}),
}));
const attempt = (q, userId, percentage, day = "2026-01-02") => ({
  quizId: id(q),
  userId,
  studentName: `Fictional ${userId}`,
  title: `Quiz ${q}`,
  subject: "Physics",
  status: "submitted",
  submittedAt: new Date(`${day}T12:00:00Z`),
  score: percentage / 10,
  totalMarks: 10,
  percentage,
  answers: ["PRIVATE_KEY"],
  email: "PRIVATE_EMAIL",
});
const records = [
  attempt(1, "student", 80),
  attempt(1, "second", 60),
  attempt(1, "third", 60),
  attempt(2, "student", 100),
  attempt(3, "student", 0),
  attempt(4, "student", 0),
  attempt(1, "student", 20, "2025-12-31"),
];
const field = (row, key) =>
  key.split(".").reduce((value, part) => value?.[part], row);
function expr(value, row, vars = {}) {
  if (typeof value === "string" && value.startsWith("$$"))
    return vars[value.slice(2)];
  if (typeof value === "string" && value.startsWith("$"))
    return field(row, value.slice(1));
  if (!value || typeof value !== "object" || value instanceof Date)
    return value;
  if (value.$eq) {
    const [a, b] = value.$eq.map((v) => expr(v, row, vars));
    return String(a) === String(b);
  }
  if (value.$convert) return expr(value.$convert.input, row, vars);
  if (value.$round)
    return Math.round(expr(value.$round[0], row, vars) * 100) / 100;
  if (value.$dateToString)
    return expr(value.$dateToString.date, row, vars).toISOString().slice(0, 7);
  return value;
}
function matches(row, filter, vars) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$expr") return !!expr(expected, row, vars);
    const actual = field(row, key);
    if (expected && typeof expected === "object")
      return Object.entries(expected).every(([op, value]) => {
        if (op === "$exists") return (actual !== undefined) === value;
        if (op === "$type") return actual instanceof Date;
        if (op === "$gte") return actual >= value;
        if (op === "$lt") return actual < value;
        throw new Error(`Unsupported match ${op}`);
      });
    return actual === expected;
  });
}
// Evaluate the production pipeline against fictional records, including the scoped join.
function evaluate(source, pipeline, vars = {}) {
  let rows = source.map((row) => ({ ...row }));
  for (const stage of pipeline) {
    if (stage.$match)
      rows = rows.filter((row) => matches(row, stage.$match, vars));
    else if (stage.$lookup)
      rows = rows.map((row) => ({
        ...row,
        [stage.$lookup.as]: evaluate(
          quizzes,
          stage.$lookup.pipeline,
          Object.fromEntries(
            Object.entries(stage.$lookup.let).map(([key, value]) => [
              key,
              expr(value, row),
            ]),
          ),
        ),
      }));
    else if (stage.$project)
      rows = rows.map((row) =>
        Object.fromEntries(
          Object.entries(stage.$project)
            .filter(([key, value]) => value === 1 && key in row)
            .map(([key]) => [key, row[key]]),
        ),
      );
    else if (stage.$facet)
      rows = [
        Object.fromEntries(
          Object.entries(stage.$facet).map(([key, pipeline]) => [
            key,
            evaluate(rows, pipeline),
          ]),
        ),
      ];
    else if (stage.$group) {
      const groups = new Map();
      for (const row of rows) {
        const key = expr(stage.$group._id, row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
      rows = [...groups].map(([key, values]) => {
        const result = { _id: key };
        for (const [name, op] of Object.entries(stage.$group)) {
          if (name === "_id") continue;
          if ("$sum" in op)
            result[name] = values.reduce(
              (sum, row) => sum + expr(op.$sum, row),
              0,
            );
          else if ("$avg" in op)
            result[name] =
              values.reduce((sum, row) => sum + expr(op.$avg, row), 0) /
              values.length;
          else if ("$max" in op)
            result[name] = Math.max(...values.map((row) => expr(op.$max, row)));
          else if ("$first" in op) result[name] = expr(op.$first, values[0]);
          else throw new Error("Unsupported group");
        }
        return result;
      });
    } else if (stage.$sort)
      rows.sort((a, b) => {
        for (const [key, direction] of Object.entries(stage.$sort)) {
          if (a[key] > b[key]) return direction;
          if (a[key] < b[key]) return -direction;
        }
        return 0;
      });
    else if (stage.$skip !== undefined) rows = rows.slice(stage.$skip);
    else if (stage.$limit) rows = rows.slice(0, stage.$limit);
    else if (stage.$set)
      rows = rows.map((row) => ({
        ...row,
        ...Object.fromEntries(
          Object.entries(stage.$set).map(([key, value]) => [
            key,
            expr(value, row),
          ]),
        ),
      }));
    else if (stage.$setWindowFields) {
      rows.sort((a, b) => b.average - a.average);
      let rank = 0;
      rows = rows.map((row, index) => {
        if (index === 0 || row.average !== rows[index - 1].average)
          rank = index + 1;
        return { ...row, rank };
      });
    } else throw new Error(`Unexpected stage ${Object.keys(stage)}`);
  }
  return rows;
}
function fixtureDb(state) {
  return {
    collection(name) {
      if (name === "membershipApplications")
        return {
          findOne: async (filter) => {
            assert.deepEqual(filter, { _id: "student", status: "approved" });
            return state.approved ? { _id: "student" } : null;
          },
        };
      assert.equal(name, "quizAttempts");
      return {
        aggregate(pipeline, options) {
          state.calls++;
          assert.equal(options.maxTimeMS, 10000);
          return {
            toArray: async () => {
              if (state.fail) throw new Error("PRIVATE_DRIVER_ERROR");
              return evaluate(records, pipeline);
            },
          };
        },
      };
    },
  };
}
async function fixture(run) {
  const state = {
    role: "student",
    approved: true,
    calls: 0,
    expired: false,
    banned: false,
  };
  const auth = {
    handler: async () => new Response("null"),
    api: {
      getSession: async ({ headers }) =>
        headers.get("cookie") === "fixture=valid"
          ? {
              user: { id: state.role === "student" ? "student" : "teacher" },
              session: {
                userId: state.role === "student" ? "student" : "teacher",
                expiresAt: new Date(
                  Date.now() + (state.expired ? -1000 : 60000),
                ),
              },
            }
          : null,
    },
  };
  const repository = createPerformanceRepository(() => fixtureDb(state));
  const server = createApp(auth, {
    performanceRepository: repository,
    lookupAuthorizationUser: async () => ({
      role: state.role,
      banned: state.banned,
    }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const send = (
    path = "student",
    query = "from=2026-01-01&to=2026-01-31",
    cookie = "fixture=valid",
  ) =>
    fetch(
      `http://127.0.0.1:${server.address().port}/api/${path}/performance?${query}`,
      { headers: { Cookie: cookie } },
    );
  try {
    await run({ state, send, repository });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}
test("student cohort excludes peers, unreleased, deleted and out-of-range results", () =>
  fixture(async ({ send }) => {
    const response = await send();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const data = await response.json();
    assert.equal(data.completed, 2);
    assert.equal(data.averagePercentage, 90);
    assert.equal(data.bestPercentage, 100);
    assert.equal(data.history.length, 2);
    assert.deepEqual(data.rankings, []);
    assert.deepEqual(data.timeline, [
      { month: "2026-01", completed: 2, averagePercentage: 90 },
    ]);
    assert.doesNotMatch(
      JSON.stringify(data),
      /PRIVATE_|studentName|userId|Fictional second/,
    );
  }));
test("teacher scope precedes comparison and shared ranks; admin may compare all", () =>
  fixture(async ({ send, state }) => {
    state.role = "teacher";
    const data = await (await send("manage")).json();
    assert.equal(data.completed, 3);
    assert.equal(data.averagePercentage, 66.67);
    assert.equal(data.quizzes.length, 1);
    assert.deepEqual(
      data.rankings.map((row) => row.rank),
      [1, 2, 2],
    );
    assert.deepEqual(data.history, []);
    assert.doesNotMatch(JSON.stringify(data), /PRIVATE_|userId/);
    state.role = "admin";
    const admin = await (await send("manage")).json();
    assert.equal(admin.completed, 4);
    assert.equal(admin.averagePercentage, 75);
  }));
test("fresh RBAC, approved membership and session expiry enforced before aggregation", () =>
  fixture(async ({ send, state }) => {
    assert.equal((await send("student", undefined, "")).status, 401);
    assert.equal((await send("manage")).status, 403);
    state.approved = false;
    assert.equal((await send()).status, 403);
    state.role = "teacher";
    assert.equal((await send()).status, 403);
    state.expired = true;
    assert.equal((await send("manage")).status, 401);
    state.expired = false;
    state.banned = true;
    assert.equal((await send("manage")).status, 403);
    assert.equal(state.calls, 0);
  }));
test("strict filters, empty cohorts and redacted errors", () =>
  fixture(async ({ send, state }) => {
    for (const query of [
      "userId=other",
      "role=admin",
      "from=2026-01-01",
      "from=2026-02-30&to=2026-03-02",
      "from=2026-02-01&to=2026-01-01",
      "page=0",
      "page=1&page=2",
      "subject[$ne]=Physics",
      "from=2000-01-01&to=2026-01-01",
    ])
      assert.equal((await send("student", query)).status, 400, query);
    const empty = await (await send("student", "subject=Chemistry")).json();
    assert.equal(empty.completed, 0);
    assert.equal(empty.averagePercentage, 0);
    assert.deepEqual(empty.history, []);
    state.fail = true;
    const response = await send();
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /PRIVATE_DRIVER_ERROR/);
  }));
test("rank pagination retains global ranks and reports the final page", async () => {
  const originalLength = records.length;
  try {
    for (let n = 0; n < 20; n++) records.push(attempt(1, `extra-${n}`, 50 - n));
    const repository = createPerformanceRepository(() =>
      fixtureDb({ calls: 0 }),
    );
    const actor = { id: "teacher", role: "teacher" };
    const query = { from: "2026-01-01", to: "2026-01-31" };
    const first = await repository.get(actor, parsePerformanceQuery(query));
    const second = await repository.get(
      actor,
      parsePerformanceQuery({ ...query, page: "2" }),
    );
    assert.equal(first.rankings.length, 20);
    assert.equal(first.rankingsHasNext, true);
    assert.equal(second.rankings.length, 3);
    assert.equal(second.rankings[0].rank, 21);
    assert.equal(second.rankingsHasNext, false);
    assert.equal(second.completed, first.completed);
  } finally {
    records.splice(originalLength);
  }
});
test("bounded pagination and inclusive UTC end date", async () => {
  const state = { approved: true, calls: 0 };
  const repository = createPerformanceRepository(() => fixtureDb(state));
  const query = parsePerformanceQuery({
    from: "2026-01-02",
    to: "2026-01-02",
    page: "2",
  });
  const data = await repository.get({ id: "student", role: "student" }, query);
  assert.equal(data.completed, 2);
  assert.equal(data.page, 2);
  assert.deepEqual(data.history, []);
  assert.deepEqual(data.quizzes, []);
  assert.equal(data.historyHasNext, false);
});
