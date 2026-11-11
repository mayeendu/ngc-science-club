import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import process from "node:process";
import { memoryDatabase } from "./helpers/communication-memory.mjs";
const { fetch, Response } = globalThis;
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_reports_only",
});
const { createApp } = await import("../src/app.ts");
const { createReportRepository, reportCsv } =
  await import("../src/modules/reports/report.repository.ts");
const { parseAnalyticsRange } =
  await import("../src/modules/membership-analytics/analytics.schema.ts");
const range = () =>
  parseAnalyticsRange({ from: "2026-01-01", to: "2026-02-28" });
function fixture() {
  const date = new Date("2026-01-01T00:00:00Z"),
    privateFields = {
      name: "Private Student",
      email: "private@example.com",
      answers: [3],
      subject: "=HYPERLINK(secret)",
    };
  const data = {
    membershipApplications: [
      { ...privateFields, submittedAt: date, status: "approved" },
      { submittedAt: new Date("2026-03-01"), status: "approved" },
    ],
    quizzes: [
      { createdAt: date, status: "draft" },
      { createdAt: date, deletedAt: date, status: "published" },
    ],
    events: [{ startsAt: date, status: "cancelled" }],
    eventRegistrations: [
      {
        ...privateFields,
        registeredAt: date,
        status: "registered",
        attendance: "present",
      },
      { registeredAt: date, status: "cancelled", attendance: "present" },
    ],
    feedbackThreads: [{ ...privateFields, createdAt: date, status: "open" }],
  };
  return createReportRepository(() => memoryDatabase(data));
}
test("actual report aggregations respect UTC cohorts archives cancellations and privacy", async () => {
  const report = await fixture().get(range());
  assert.deepEqual(
    report.sections.map((section) => section.total),
    [1, 1, 1, 1, 1],
  );
  assert.equal(
    report.sections[3].states.find((state) => state.state === "present").count,
    1,
  );
  assert.deepEqual(report.sections[0].monthly, [
    { month: "2026-01", count: 1 },
  ]);
  assert.doesNotMatch(
    JSON.stringify(report),
    /Private|email|answers|HYPERLINK|userId/,
  );
  const csv = reportCsv(report);
  assert.match(csv, /"attendance","present","1"/);
  assert.doesNotMatch(csv, /HYPERLINK|private@/);
});
test("empty reports and strict bounded filters", async () => {
  const report = await createReportRepository(() => memoryDatabase({})).get(
    range(),
  );
  assert.equal(
    report.sections.every(
      (section) => section.total === 0 && section.monthly.length === 0,
    ),
    true,
  );
  for (const input of [
    { from: "2026-01-01" },
    { from: "2026-03-01", to: "2026-01-01" },
    { from: "2020-01-01", to: "2026-01-01" },
    { userId: "forged" },
    { from: "2026-02-30", to: "2026-03-01" },
  ])
    assert.throws(() => parseAnalyticsRange(input));
});
test("reports and CSV require a fresh admin role before database access", async () => {
  const state = { role: "admin", calls: 0 };
  const auth = {
    handler: async () => new Response("null"),
    api: {
      getSession: async ({ headers }) =>
        headers.get("cookie") === "fixture=valid"
          ? {
              user: { id: "fictional" },
              session: {
                userId: "fictional",
                expiresAt: new Date(Date.now() + 60000),
              },
            }
          : null,
    },
  };
  const repository = fixture();
  const server = createApp(auth, {
    lookupAuthorizationUser: async () => ({ role: state.role, banned: false }),
    reportRepository: {
      get: async (range) => {
        state.calls++;
        return repository.get(range);
      },
    },
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const send = (path = "", cookie = "fixture=valid") =>
    fetch(
      `http://127.0.0.1:${server.address().port}/api/admin/reports${path}`,
      { headers: { Cookie: cookie } },
    );
  try {
    assert.equal((await send("", "")).status, 401);
    for (const role of ["student", "teacher", null]) {
      state.role = role;
      assert.equal((await send()).status, 403);
      assert.equal((await send("/export.csv")).status, 403);
    }
    assert.equal(state.calls, 0);
    state.role = "admin";
    assert.equal((await send("?userId=forged")).status, 400);
    assert.equal((await send()).status, 200);
    const csv = await send("/export.csv?from=2026-01-01&to=2026-02-28");
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-type"), /text\/csv/);
    assert.match(csv.headers.get("cache-control"), /no-store/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
