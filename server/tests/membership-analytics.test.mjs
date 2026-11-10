import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import process from "node:process";
import { test } from "node:test";
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_analytics_only",
});
const { fetch } = globalThis;
const { createApp } = await import("../src/app.ts");
const { createAnalyticsRepository } =
  await import("../src/modules/membership-analytics/analytics.repository.ts");
const { parseAnalyticsRange } =
  await import("../src/modules/membership-analytics/analytics.schema.ts");

// Small generic evaluator for the actual read-only pipeline. No database writes.
function expression(value, row) {
  if (typeof value === "string" && value.startsWith("$"))
    return row[value.slice(1)];
  if (value && typeof value === "object") {
    if ("$eq" in value)
      return expression(value.$eq[0], row) === expression(value.$eq[1], row);
    if ("$cond" in value)
      return expression(
        value.$cond[expression(value.$cond[0], row) ? 1 : 2],
        row,
      );
    if ("$dateToString" in value)
      return expression(value.$dateToString.date, row)
        .toISOString()
        .slice(0, 7);
  }
  return value;
}
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some((branch) => matches(row, branch));
    if (value && typeof value === "object" && !(value instanceof Date))
      return Object.entries(value).every(([op, target]) =>
        op === "$gte"
          ? row[key] >= target
          : op === "$lt"
            ? row[key] < target
            : op === "$in"
              ? target.includes(row[key])
              : false,
      );
    return row[key] === value;
  });
}
function evaluate(source, pipeline) {
  let rows = source;
  for (const stage of pipeline) {
    if (stage.$match) rows = rows.filter((row) => matches(row, stage.$match));
    else if (stage.$project)
      rows = rows.map((row) =>
        Object.fromEntries(
          Object.entries(stage.$project)
            .filter(([key, flag]) => flag === 1 && key in row)
            .map(([key]) => [key, row[key]]),
        ),
      );
    else if (stage.$sort)
      rows = [...rows].sort((a, b) => {
        for (const [key, direction] of Object.entries(stage.$sort)) {
          if (a[key] > b[key]) return direction;
          if (a[key] < b[key]) return -direction;
        }
        return 0;
      });
    else if (stage.$limit) rows = rows.slice(0, stage.$limit);
    else if (stage.$count)
      rows = rows.length ? [{ [stage.$count]: rows.length }] : [];
    else if (stage.$group) {
      const grouped = new Map();
      for (const row of rows) {
        const id = expression(stage.$group._id, row);
        let entry = grouped.get(id);
        if (!entry) {
          entry = { _id: id };
          grouped.set(id, entry);
        }
        for (const [key, op] of Object.entries(stage.$group)) {
          if (key !== "_id")
            entry[key] = (entry[key] ?? 0) + Number(expression(op.$sum, row));
        }
      }
      rows = [...grouped.values()];
    } else if (stage.$facet)
      rows = [
        Object.fromEntries(
          Object.entries(stage.$facet).map(([key, branch]) => [
            key,
            evaluate(rows, branch),
          ]),
        ),
      ];
    else throw new Error("Unexpected aggregation stage");
  }
  return rows;
}
function records() {
  return [
    {
      status: "pending",
      submittedAt: new Date("2026-01-01T00:00:00Z"),
      department: "Physics",
    },
    {
      status: "approved",
      submittedAt: new Date("2026-01-15T12:00:00Z"),
      reviewedAt: new Date("2026-02-01T00:00:00Z"),
      department: "Physics",
    },
    {
      status: "rejected",
      submittedAt: new Date("2026-03-31T23:59:59.999Z"),
      department: "Chemistry",
    },
    {
      status: "approved",
      submittedAt: new Date("2026-04-01T00:00:00Z"),
      reviewedAt: new Date("2026-04-01T00:00:00Z"),
      department: "Biology",
    },
    {
      status: "approved",
      submittedAt: new Date("2025-12-01T00:00:00Z"),
      reviewedAt: new Date("2026-01-31T23:59:59Z"),
      department: "Chemistry",
    },
    {
      status: "pending",
      submittedAt: new Date("2025-12-15T00:00:00Z"),
      department: "Physics",
    },
  ].map((row, index) => ({
    ...row,
    _id: `PRIVATE_ID_${index}`,
    fullName: "PRIVATE_NAME",
    email: "PRIVATE_EMAIL",
    phone: "PRIVATE_PHONE",
    studentId: "PRIVATE_STUDENT",
    reason: "PRIVATE_REASON",
    reviewerId: "PRIVATE_REVIEWER",
  }));
}
async function fixture(run) {
  const state = {
    role: "admin",
    expired: false,
    revoked: false,
    fail: false,
    calls: 0,
  };
  const source = records();
  let pipeline;
  const repository = createAnalyticsRepository(() => ({
    collection(name) {
      assert.equal(name, "membershipApplications");
      return {
        aggregate(stages, options) {
          state.calls++;
          pipeline = stages;
          assert.equal(options.readPreference, "primary");
          assert.equal(options.maxTimeMS, 10000);
          return {
            async toArray() {
              if (state.fail) throw new Error("PRIVATE_DRIVER_ERROR");
              return evaluate(source, stages);
            },
          };
        },
      };
    },
  }));
  const auth = {
    handler: async () => new globalThis.Response("null"),
    api: {
      getSession: async ({ headers, query }) => {
        assert.equal(query.disableCookieCache, true);
        return headers.get("cookie") === "fixture=valid" && !state.revoked
          ? {
              user: { id: "64b000000000000000000001", role: "admin" },
              session: {
                userId: "64b000000000000000000001",
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
    analyticsRepository: repository,
    lookupAuthorizationUser: async () => ({ role: state.role, banned: false }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const send = (query = "?from=2026-01-01&to=2026-03-31", headers = {}) =>
    fetch(
      `http://127.0.0.1:${server.address().port}/api/admin/membership-analytics${query}`,
      { headers: { Cookie: "fixture=valid", ...headers } },
    );
  try {
    await run({ send, state, source, pipeline: () => pipeline });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}

test("analytics rejects guests, non-admin roles, forged headers and stale/expired sessions", () =>
  fixture(async ({ send, state }) => {
    assert.equal((await send(undefined, { Cookie: "" })).status, 401);
    for (const role of ["student", "teacher", "student,admin", undefined]) {
      state.role = role;
      assert.equal((await send(undefined, { "X-Role": "admin" })).status, 403);
    }
    state.role = "admin";
    state.expired = true;
    assert.equal((await send()).status, 401);
    state.expired = false;
    state.revoked = true;
    assert.equal((await send()).status, 401);
    assert.equal(state.calls, 0);
  }));

test("actual pipeline calculates UTC cohorts approvals, rounded rates, departments and trends", () =>
  fixture(async ({ send }) => {
    const response = await send();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const { analytics } = await response.json();
    assert.deepEqual(analytics.kpis, {
      totalApplications: 3,
      pending: 1,
      approved: 1,
      rejected: 1,
      approvalRate: 33.33,
    });
    assert.deepEqual(analytics.monthly, [
      { month: "2026-01", applications: 2, approvedMembers: 1 },
      { month: "2026-02", applications: 0, approvedMembers: 1 },
      { month: "2026-03", applications: 1, approvedMembers: 0 },
    ]);
    assert.deepEqual(analytics.departments, [
      { department: "Chemistry", members: 1 },
      { department: "Physics", members: 1 },
    ]);
    assert.deepEqual(analytics.trend, {
      previousApplications: 2,
      change: 1,
      changePercent: 50,
    });
    assert.equal(analytics.recent.length, 3);
    assert.equal(analytics.recent[0].status, "rejected");
    assert.equal(JSON.stringify(analytics).includes("PRIVATE_"), false);
  }));

test("identifying fields are removed before facets and anonymous recent results are bounded", () =>
  fixture(async ({ send, pipeline, source }) => {
    for (let i = 0; i < 10; i++)
      source.push({
        ...source[0],
        submittedAt: new Date(
          `2026-02-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        ),
      });
    const { analytics } = await (await send()).json();
    assert.equal(analytics.recent.length, 5);
    assert.deepEqual(Object.keys(analytics.recent[0]).sort(), [
      "status",
      "submittedAt",
    ]);
    assert.deepEqual(pipeline()[1], {
      $project: {
        _id: 0,
        status: 1,
        department: 1,
        submittedAt: 1,
        reviewedAt: 1,
      },
    });
    assert.equal(JSON.stringify(analytics).includes("PRIVATE_"), false);
  }));

test("invalid missing reversed oversized and injected date parameters fail before aggregation", () =>
  fixture(async ({ send, state }) => {
    for (const query of [
      "?from=2026-01-01",
      "?to=2026-01-01",
      "?from=bad&to=bad",
      "?from=2026-02-30&to=2026-03-01",
      "?from=2026-02-01&to=2026-01-01",
      "?from=2020-01-01&to=2026-01-01",
      "?from=1999-01-01&to=1999-02-01",
      "?role=admin",
      "?from[$ne]=x&to=2026-01-01",
    ])
      assert.equal((await send(query)).status, 400);
    assert.equal(state.calls, 0);
  }));

test("empty datasets produce zero rates zero-filled months and no Infinity", () =>
  fixture(async ({ send, source }) => {
    source.splice(0);
    const { analytics } = await (await send()).json();
    assert.deepEqual(analytics.kpis, {
      totalApplications: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      approvalRate: 0,
    });
    assert.equal(analytics.trend.changePercent, 0);
    assert.equal(analytics.monthly.length, 3);
    assert.ok(
      analytics.monthly.every(
        (row) => row.applications === 0 && row.approvedMembers === 0,
      ),
    );
    assert.deepEqual(analytics.recent, []);
    assert.deepEqual(analytics.departments, []);
  }));

test("no previous baseline returns null trend percentage and fresh status changes alter counts", () =>
  fixture(async ({ send, source }) => {
    source.splice(0, source.length, {
      status: "pending",
      submittedAt: new Date("2026-01-01T00:00:00Z"),
      department: "Physics",
    });
    let body = await (await send()).json();
    assert.equal(body.analytics.trend.changePercent, null);
    assert.equal(body.analytics.kpis.pending, 1);
    source[0].status = "approved";
    source[0].reviewedAt = new Date("2026-01-02T00:00:00Z");
    body = await (await send()).json();
    assert.equal(body.analytics.kpis.approved, 1);
    assert.equal(body.analytics.kpis.approvalRate, 100);
    assert.equal(body.analytics.monthly[0].approvedMembers, 1);
  }));

test("default and leap-day ranges use inclusive UTC boundaries and bounded month counts", () => {
  const range = parseAnalyticsRange({}, new Date("2026-11-11T12:00:00Z"));
  assert.equal(range.from, "2025-12-01");
  assert.equal(range.to, "2026-11-11");
  assert.equal(range.end.toISOString(), "2026-11-12T00:00:00.000Z");
  const leap = parseAnalyticsRange({ from: "2024-02-29", to: "2024-02-29" });
  assert.equal(leap.end.toISOString(), "2024-03-01T00:00:00.000Z");
  assert.equal(leap.end - leap.start, 86400000);
});

test("database errors do not expose driver details", () =>
  fixture(async ({ send, state }) => {
    state.fail = true;
    const response = await send();
    assert.equal(response.status, 500);
    assert.equal(
      (await response.text()).includes("PRIVATE_DRIVER_ERROR"),
      false,
    );
  }));
