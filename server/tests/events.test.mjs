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
  DB_NAME: "fictional_events_memory_only",
});
const { createEventRepository } =
  await import("../src/modules/events/event.repository.ts");
const { eventContentSchema } =
  await import("../src/modules/events/event.schema.ts");
const { createApp } = await import("../src/app.ts");
const owner = { id: "teacher", role: "teacher" },
  admin = { id: "admin", role: "admin" };
const copy = (v) =>
  v instanceof ObjectId
    ? new ObjectId(v)
    : v instanceof Date
      ? new Date(v)
      : Array.isArray(v)
        ? v.map(copy)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)]))
          : v;
const equal = (a, b) =>
  a instanceof ObjectId ? a.equals(b) : a instanceof Date ? +a === +b : a === b;
function fixture() {
  const state = {
    now: new Date(),
    approved: true,
    role: "student",
    user: "student",
    session: true,
    expired: false,
    fail: false,
    failRegistration: false,
    queries: [],
    pipelines: [],
    summary: null,
  };
  const rows = { events: [], eventRegistrations: [] };
  function expr(value, row) {
    if (typeof value === "string")
      return value === "$$NOW"
        ? state.now
        : value.startsWith("$")
          ? row[value.slice(1)]
          : value;
    if (
      value === null ||
      typeof value !== "object" ||
      value instanceof Date ||
      value instanceof ObjectId
    )
      return value;
    const [op, arg] = Object.entries(value)[0],
      a = arg.map((x) => expr(x, row));
    switch (op) {
      case "$add":
        return a[0] + a[1];
      case "$ifNull":
        return a[0] ?? a[1];
      case "$gt":
        return a[0] > a[1];
      case "$lt":
        return a[0] < a[1];
      case "$lte":
        return a[0] <= a[1];
      case "$eq":
        return equal(a[0], a[1]);
      default:
        throw new Error(`Unknown mock expression ${op}`);
    }
  }
  function matches(row, filter) {
    return Object.entries(filter).every(([k, v]) =>
      k === "$expr"
        ? expr(v, row)
        : v &&
            typeof v === "object" &&
            !(v instanceof Date) &&
            !(v instanceof ObjectId)
          ? Object.entries(v).every(([op, x]) =>
              op === "$exists"
                ? k in row === x
                : op === "$in"
                  ? x.includes(row[k])
                  : op === "$gt"
                    ? row[k] > x
                    : op === "$ne"
                      ? !equal(row[k], x)
                      : false,
            )
          : equal(row[k], v),
    );
  }
  function update(row, u) {
    if (Array.isArray(u)) {
      for (const stage of u) {
        const values = Object.fromEntries(
          Object.entries(stage.$set).map(([k, v]) => [k, expr(v, row)]),
        );
        Object.assign(row, values);
      }
    } else {
      Object.assign(row, copy(u.$set ?? {}));
      for (const [k, v] of Object.entries(u.$inc ?? {}))
        row[k] = (row[k] ?? 0) + v;
    }
  }
  function project(row, projection) {
    return projection
      ? Object.fromEntries(
          Object.entries(projection)
            .filter(([, v]) => v === 1)
            .filter(([k]) => k in row)
            .map(([k]) => [k, copy(row[k])]),
        )
      : copy(row);
  }
  const db = {
    collection(name) {
      if (state.fail) throw new Error("PRIVATE_DATABASE_FAILURE");
      if (name === "membershipApplications")
        return {
          findOne: async () =>
            state.approved ? { fullName: `Fictional ${state.user}` } : null,
        };
      const all = () => rows[name];
      return {
        async insertOne(row) {
          all().push(copy(row));
          return { insertedId: row._id };
        },
        async findOne(filter, options) {
          state.queries.push({ name, filter, options });
          const row = all().find((r) => matches(r, filter));
          return row ? project(row, options?.projection) : null;
        },
        async findOneAndUpdate(filter, u) {
          const row = all().find((r) => matches(r, filter));
          if (!row) return null;
          update(row, u);
          return copy(row);
        },
        async updateOne(filter, u) {
          const row = all().find((r) => matches(r, filter));
          if (row) update(row, u);
          return { matchedCount: row ? 1 : 0 };
        },
        async replaceOne(filter, row) {
          if (state.failRegistration) throw new Error("PRIVATE_INSERT_FAILURE");
          const index = all().findIndex((r) => matches(r, filter));
          if (index < 0) all().push(copy(row));
          else all()[index] = copy(row);
        },
        find(filter, options) {
          state.queries.push({ name, filter, options });
          let offset = 0,
            maximum = Infinity;
          const cursor = {
            sort() {
              return cursor;
            },
            skip(n) {
              offset = n;
              return cursor;
            },
            limit(n) {
              maximum = n;
              return cursor;
            },
            async toArray() {
              return all()
                .filter((r) => matches(r, filter))
                .slice(offset, offset + maximum)
                .map((row) => project(row, options?.projection));
            },
          };
          return cursor;
        },
        aggregate(pipeline) {
          state.pipelines.push({ name, pipeline });
          return {
            async toArray() {
              if (state.summary) return [copy(state.summary)];
              if (name === "events") return [{ totals: [], categories: [] }];
              if (pipeline.some((stage) => stage.$unwind === "$event")) {
                const userId = pipeline[0].$match.userId;
                return rows.eventRegistrations
                  .filter((r) => r.userId === userId)
                  .flatMap((r) => {
                    const event = rows.events.find(
                      (e) =>
                        e._id.toHexString() === r.eventId &&
                        ["published", "cancelled"].includes(e.status) &&
                        !e.deletedAt,
                    );
                    return event
                      ? [{ event: copy(event), registration: copy(r) }]
                      : [];
                  });
              }
              return [];
            },
          };
        },
      };
    },
  };
  let queue = Promise.resolve();
  const run = (work) => {
    const next = queue.then(async () => {
      const before = copy(rows);
      try {
        return await work(db);
      } catch (error) {
        Object.assign(rows, before);
        throw error;
      }
    });
    queue = next.catch(() => {});
    return next;
  };
  const repo = createEventRepository(() => db, run),
    input = {
      title: "Fictional science workshop",
      description: "An isolated fictional event for testing only.",
      category: "workshop",
      startsAt: new Date(+state.now + 86400000).toISOString(),
      venue: "Fictional laboratory",
      capacity: 1,
      image: "",
    };
  async function published(overrides = {}) {
    const created = await repo.create(owner, { ...input, ...overrides });
    return repo.changeStatus(created.id, owner, created.version, "published");
  }
  return { repo, state, rows, input, published };
}
const reject = (promise, status) =>
  assert.rejects(promise, (error) => error.statusCode === status);
test("staff CRUD enforces draft versioning, future dates and public projections", async () => {
  const { repo, published, state, input } = fixture();
  const event = await published();
  const list = await repo.list(1, { period: "upcoming" });
  assert.equal(list.events.length, 1);
  assert.ok(!JSON.stringify(list).includes("createdBy"));
  assert.ok(!JSON.stringify(list).includes("operationNow"));
  await reject(repo.update(event.id, owner, event.version, input), 409);
  await repo.changeStatus(event.id, owner, event.version, "draft");
  await reject(repo.remove(event.id, owner, event.version), 409);
  const current = (await repo.list(1, {}, owner)).events[0];
  await repo.update(event.id, owner, current.version, {
    ...input,
    title: "Updated fictional workshop",
  });
  await repo.remove(event.id, owner, current.version + 1);
  assert.equal((await repo.list(1, {}, owner)).events.length, 0);
  await reject(repo.detail(event.id), 404);
  assert.equal(state.queries[0].options.projection.createdBy, undefined);
});
test("teachers cannot read participants, edit, delete, change status or mark attendance for another owner's event", async () => {
  const { repo, published, input } = fixture(),
    event = await published(),
    other = { id: "other", role: "teacher" };
  for (const operation of [
    () => repo.participants(event.id, other, 1),
    () => repo.update(event.id, other, event.version, input),
    () => repo.remove(event.id, other, event.version),
    () => repo.changeStatus(event.id, other, event.version, "cancelled"),
    () =>
      repo.attendance(event.id, other, {
        registrationId: "foreign",
        version: 1,
        attendance: "present",
      }),
  ])
    await reject(operation(), 404);
  await repo.changeStatus(event.id, admin, event.version, "cancelled");
});
test("duplicate and concurrent registrations reserve one place and never overbook", async () => {
  const { repo, published, rows } = fixture(),
    event = await published();
  const outcomes = await Promise.allSettled([
    repo.register(event.id, "student"),
    repo.register(event.id, "student"),
    repo.register(event.id, "other"),
  ]);
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 2);
  assert.equal(rows.events[0].registeredCount, 1);
  assert.equal(rows.eventRegistrations.length, 1);
  assert.equal(outcomes[2].reason.statusCode, 409);
});
test("cancel is idempotent and frees a place; re-registration reuses the unique record", async () => {
  const { repo, published, rows } = fixture(),
    event = await published();
  await repo.register(event.id, "student");
  await Promise.all([
    repo.register(event.id, "student", true),
    repo.register(event.id, "student", true),
  ]);
  assert.equal(rows.events[0].registeredCount, 0);
  await repo.register(event.id, "other");
  await reject(repo.register(event.id, "student"), 409);
  await repo.register(event.id, "other", true);
  await repo.register(event.id, "student");
  assert.equal(rows.events[0].registeredCount, 1);
  assert.equal(rows.eventRegistrations.length, 2);
  assert.equal(
    rows.eventRegistrations.find((r) => r.userId === "student").attendance,
    "unmarked",
  );
});
test("failed registration storage rolls back the reserved place", async () => {
  const { repo, published, state, rows } = fixture(),
    event = await published();
  state.failRegistration = true;
  await assert.rejects(repo.register(event.id, "student"));
  assert.equal(rows.events[0].registeredCount, 0);
  assert.equal(rows.eventRegistrations.length, 0);
});
test("registration and cancellation close at exact server event start", async () => {
  const { repo, published, state, rows } = fixture(),
    event = await published({ capacity: 2 });
  await repo.register(event.id, "student");
  state.now = new Date(event.startsAt);
  await reject(repo.register(event.id, "other"), 409);
  await reject(repo.register(event.id, "student", true), 409);
  assert.equal(rows.events[0].registeredCount, 1);
});
test("pending members cannot register, cancel, read own status or my events", async () => {
  const { repo, published, state } = fixture(),
    event = await published();
  state.approved = false;
  for (const op of [
    () => repo.register(event.id, "student"),
    () => repo.register(event.id, "student", true),
    () => repo.own(event.id, "student"),
    () => repo.mine("student", 1),
  ])
    await reject(op(), 403);
});
test("cancelled events remain public but block registration and attendance", async () => {
  const { repo, published, state } = fixture(),
    event = await published();
  await repo.register(event.id, "student");
  await repo.changeStatus(event.id, owner, event.version, "cancelled");
  assert.equal((await repo.detail(event.id)).status, "cancelled");
  await reject(repo.register(event.id, "other"), 409);
  await reject(
    repo.attendance(event.id, owner, {
      registrationId: `${event.id}:student`,
      attendance: "present",
      version: 1,
    }),
    409,
  );
  await repo.register(event.id, "student", true);
  state.now = new Date(event.startsAt);
  await reject(
    repo.changeStatus(event.id, owner, event.version + 1, "published"),
    409,
  );
});
test("registered or started events cannot unpublish; cancellation is terminal", async () => {
  const { repo, published } = fixture(),
    event = await published();
  await repo.register(event.id, "student");
  await reject(repo.changeStatus(event.id, owner, event.version, "draft"), 409);
  await repo.changeStatus(event.id, owner, event.version, "cancelled");
  await reject(
    repo.changeStatus(event.id, owner, event.version + 1, "draft"),
    409,
  );
});
test("attendance requires start, correct event registration and fresh version, storing trusted reviewer metadata", async () => {
  const { repo, published, state, rows } = fixture(),
    event = await published();
  const registered = await repo.register(event.id, "student"),
    input = {
      registrationId: registered.registration.id,
      attendance: "present",
      version: registered.registration.version,
    };
  await reject(repo.attendance(event.id, owner, input), 409);
  state.now = new Date(event.startsAt);
  const saved = await repo.attendance(event.id, owner, input);
  assert.equal(saved.attendance, "present");
  assert.equal(rows.eventRegistrations[0].markedBy, owner.id);
  await reject(
    repo.attendance(event.id, owner, { ...input, attendance: "absent" }),
    409,
  );
  await reject(
    repo.attendance(event.id, owner, { ...input, registrationId: "other" }),
    409,
  );
  assert.equal(
    (await repo.own(event.id, "student")).registration.attendance,
    "present",
  );
  assert.equal((await repo.own(event.id, "other")).registration, null);
});
test("achievements can be historical and displayed but cannot accept registrations", async () => {
  const { repo, published, state, input } = fixture();
  const event = await published({
    category: "achievement",
    startsAt: new Date(+state.now - 86400000).toISOString(),
  });
  assert.equal(
    (await repo.list(1, { period: "past", category: "achievement" })).events
      .length,
    1,
  );
  await reject(repo.register(event.id, "student"), 409);
  await reject(
    repo.create(owner, {
      ...input,
      startsAt: new Date(+state.now - 86400000).toISOString(),
    }),
    400,
  );
});
test("scoped analytics uses owner filter and minimal participant list projections", async () => {
  const { repo, published, state } = fixture(),
    event = await published();
  await repo.register(event.id, "student");
  const participants = await repo.participants(event.id, owner, 1);
  assert.equal(participants.items[0].name, "Fictional student");
  for (const field of ["userId", "phone", "email", "markedBy"])
    assert.ok(!JSON.stringify(participants).includes(field));
  const stats = await repo.statistics(owner);
  assert.equal(stats.total, 0);
  assert.equal(stats.present, 0);
  assert.equal(
    state.pipelines.find((p) => p.name === "events").pipeline[0].$match
      .createdBy,
    owner.id,
  );
  const attendance = state.pipelines.at(-1);
  assert.equal(
    attendance.pipeline[1].$lookup.pipeline[0].$match.createdBy,
    owner.id,
  );
});
test("registration racing cancellation of event cannot create attendance or overbook", async () => {
  const { repo, published, rows } = fixture(),
    event = await published();
  await Promise.all([
    repo.register(event.id, "student"),
    repo.changeStatus(event.id, owner, event.version, "cancelled"),
  ]);
  assert.equal(rows.events[0].status, "cancelled");
  assert.equal(rows.events[0].registeredCount, 1);
  assert.equal(rows.eventRegistrations[0].attendance, "unmarked");
});
test("drafts and archived events never appear publicly; my events pipeline scopes session user", async () => {
  const { repo, input, published, state } = fixture();
  const draft = await repo.create(owner, input);
  await reject(repo.detail(draft.id), 404);
  const event = await published();
  await repo.register(event.id, "student");
  const mine = await repo.mine("student", 1);
  assert.equal(mine.items.length, 1);
  assert.ok(!JSON.stringify(mine).includes("createdBy"));
  assert.deepEqual(state.pipelines.at(-1).pipeline[0], {
    $match: { userId: "student" },
  });
});
test("strict validation rejects forged owner, dates, capacity, unsafe images and attendance fields", () => {
  const { input } = fixture();
  for (const value of [
    { ...input, userId: "admin" },
    { ...input, createdBy: "other" },
    { ...input, registeredCount: 999 },
    { ...input, status: "published" },
    { ...input, startsAt: "not-a-date" },
    { ...input, capacity: 0 },
    { ...input, capacity: 1001 },
    { ...input, image: "javascript:alert(1)" },
    { ...input, image: "https://user:password@example.com/image.png" },
  ])
    assert.equal(eventContentSchema.safeParse(value).success, false);
});
test("HTTP routes enforce role, origin, membership, allowlists and safe errors", async () => {
  const { repo, state, input } = fixture();
  const auth = {
    handler: async () => new globalThis.Response("null"),
    api: {
      getSession: async () =>
        state.session
          ? {
              user: { id: state.user, role: "admin" },
              session: {
                userId: state.user,
                expiresAt: new Date(
                  Date.now() + (state.expired ? -1000 : 60000),
                ),
              },
            }
          : null,
    },
  };
  const server = createApp(auth, {
    eventRepository: repo,
    lookupAuthorizationUser: async () => ({ role: state.role, banned: false }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`,
    send = (path, method = "GET", body, origin = "http://localhost:3000") =>
      globalThis.fetch(base + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "x-role": "admin",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
  try {
    state.session = false;
    assert.equal((await send("/events")).status, 200);
    assert.equal((await send("/student/events")).status, 401);
    state.session = true;
    assert.equal((await send("/manage/events")).status, 403);
    state.role = "teacher";
    let response = await send("/manage/events", "POST", input);
    assert.equal(response.status, 201);
    let event = (await response.json()).event;
    assert.equal(
      (
        await send(
          `/manage/events/${event.id}/status`,
          "PATCH",
          { version: event.version, status: "published" },
          "https://evil.example",
        )
      ).status,
      403,
    );
    response = await send(`/manage/events/${event.id}/status`, "PATCH", {
      version: event.version,
      status: "published",
    });
    event = (await response.json()).event;
    state.role = "student";
    for (const body of [
      { userId: "other" },
      { role: "admin" },
      { attendance: "present" },
    ])
      assert.equal(
        (await send(`/student/events/${event.id}/register`, "POST", body))
          .status,
        400,
      );
    assert.equal(
      (await send(`/student/events/${event.id}/register`, "POST", {})).status,
      200,
    );
    assert.equal(
      (await send(`/manage/events/${event.id}/attendance`, "PATCH", {})).status,
      403,
    );
    state.expired = true;
    assert.equal((await send("/student/events")).status, 401);
    state.expired = false;
    assert.equal((await send("/events?page=0")).status, 400);
    assert.equal((await send("/events?createdBy=teacher")).status, 400);
    assert.equal((await send("/events/not-valid")).status, 400);
    state.fail = true;
    response = await send(`/events/${event.id}`);
    assert.equal(response.status, 500);
    assert.ok(
      !JSON.stringify(await response.json()).includes(
        "PRIVATE_DATABASE_FAILURE",
      ),
    );
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
