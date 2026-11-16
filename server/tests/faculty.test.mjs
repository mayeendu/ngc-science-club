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
  DB_NAME: "fictional_faculty_only",
});
const { createApp } = await import("../src/app.ts");
const { createFacultyRepository } =
  await import("../src/modules/faculty/faculty.repository.ts");
const { AUTH_USER_COLLECTION } = await import("../src/lib/auth-storage.ts");
const teacherId = "64b000000000000000000001",
  eventId = "64b000000000000000000002";
const input = {
  name: "Fictional Mentor",
  designation: "Lecturer",
  department: "Physics",
  specialization: "Optics",
  photo: "",
  bio: "Fictional mentor biography for testing.",
  published: true,
  teacherAccountId: teacherId,
  assignedEventIds: [eventId],
};
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) =>
    value && typeof value === "object" && !(value instanceof ObjectId)
      ? "$exists" in value
        ? (row[key] !== undefined) === value.$exists
        : "$in" in value
          ? value.$in.some((id) => String(id) === String(row[key]))
          : false
      : String(row[key]) === String(value),
  );
}
function memory(state) {
  return {
    collection(name) {
      if (name === AUTH_USER_COLLECTION)
        return {
          findOne: async (filter) => {
            assert.equal(String(filter._id), teacherId);
            return { role: state.linkRole, banned: state.linkBanned };
          },
        };
      if (name === "events")
        return {
          countDocuments: async (filter) => {
            assert.deepEqual(filter.deletedAt, { $exists: false });
            return filter._id.$in.filter((id) => String(id) === eventId).length;
          },
        };
      assert.equal(name, "facultyProfiles");
      return {
        find(filter, options) {
          let rows = state.rows.filter((row) => matches(row, filter));
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
            toArray: async () =>
              rows.map((row) =>
                options.projection
                  ? Object.fromEntries(
                      Object.entries(options.projection)
                        .filter(([, flag]) => flag)
                        .map(([key]) => [key, row[key]]),
                    )
                  : { ...row },
              ),
          };
          return cursor;
        },
        findOne: async (filter, options) => {
          const row = state.rows.find((row) => matches(row, filter));
          return row && options.projection
            ? Object.fromEntries(
                Object.entries(options.projection).map(([key]) => [
                  key,
                  row[key],
                ]),
              )
            : (row ?? null);
        },
        insertOne: async (row) => {
          state.rows.push(row);
          state.writes++;
        },
        async findOneAndUpdate(filter, update) {
          const row = state.rows.find((row) => matches(row, filter));
          if (!row) return null;
          Object.assign(row, update.$set);
          row.version += update.$inc.version;
          state.writes++;
          return row;
        },
        async updateOne(filter, update) {
          const row = await this.findOneAndUpdate(filter, update);
          return { modifiedCount: row ? 1 : 0 };
        },
        aggregate(pipeline, options) {
          if (pipeline[1]?.$group) {
            assert.equal(pipeline[0].$match.published, true);
            assert.deepEqual(pipeline[0].$match.deletedAt, { $exists: false });
            assert.equal(options.maxTimeMS, 10000);
            assert.equal(pipeline[3].$limit, 200);
            const field = pipeline[1].$group._id.slice(1);
            const values = [
              ...new Set(
                state.rows
                  .filter(
                    (row) =>
                      row.published &&
                      !row.deletedAt &&
                      typeof row[field] === "string" &&
                      row[field] !== "",
                  )
                  .map((row) => row[field]),
              ),
            ]
              .sort()
              .slice(0, 200);
            return {
              toArray: async () => values.map((value) => ({ _id: value })),
            };
          }
          assert.deepEqual(pipeline[0], {
            $match: {
              teacherAccountId: state.identity,
              deletedAt: { $exists: false },
            },
          });
          assert.equal(options.maxTimeMS, 10000);
          const projection = pipeline.find((stage) => stage.$project).$project;
          assert.deepEqual(Object.keys(projection).sort(), [
            "_id",
            "id",
            "startsAt",
            "status",
            "title",
            "venue",
          ]);
          return { toArray: async () => [] };
        },
      };
    },
  };
}
async function fixture(run) {
  const state = {
    role: "admin",
    identity: teacherId,
    rows: [],
    writes: 0,
    linkRole: "teacher",
    linkBanned: false,
    expired: false,
  };
  const repository = createFacultyRepository(() => memory(state));
  const auth = {
    handler: async () => new Response("null"),
    api: {
      getSession: async ({ headers }) =>
        headers.get("cookie") === "fixture=valid"
          ? {
              user: { id: state.identity },
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
    facultyRepository: repository,
    lookupAuthorizationUser: async () => ({ role: state.role, banned: false }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const send = (path, method = "GET", body, headers = {}) =>
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
    await run({ send, state, repository });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}
test("admin CRUD and public directory expose only published profile allowlist", () =>
  fixture(async ({ send, state }) => {
    const created = await send("admin/faculty", "POST", input);
    assert.equal(created.status, 201);
    const { profile } = await created.json();
    assert.equal(profile.version, 1);
    const publicList = await (
      await send("faculty", "GET", undefined, { Cookie: "" })
    ).json();
    assert.equal(publicList.items.length, 1);
    assert.doesNotMatch(
      JSON.stringify(publicList),
      /teacherAccountId|assignedEventIds|version|createdAt/,
    );
    const detail = await (await send(`faculty/${profile.id}`)).json();
    assert.equal(detail.profile.name, input.name);
    assert.equal(
      (
        await send(`admin/faculty/${profile.id}`, "PUT", {
          ...input,
          published: false,
          version: 1,
        })
      ).status,
      200,
    );
    assert.equal((await send(`faculty/${profile.id}`)).status, 404);
    assert.equal(
      (await send(`admin/faculty/${profile.id}`, "DELETE", { version: 2 }))
        .status,
      200,
    );
    assert.equal((await (await send("admin/faculty")).json()).items.length, 0);
    assert.equal(state.rows[0].teacherAccountId, "");
  }));
test("fresh admin-only authorization and trusted origins protect every mutation", () =>
  fixture(async ({ send, state }) => {
    assert.equal(
      (await send("admin/faculty", "POST", input, { Cookie: "" })).status,
      401,
    );
    for (const role of ["student", "teacher", "student,admin"]) {
      state.role = role;
      assert.equal((await send("admin/faculty")).status, 403);
      assert.equal((await send("admin/faculty", "POST", input)).status, 403);
    }
    state.role = "admin";
    assert.equal(
      (
        await send("admin/faculty", "POST", input, {
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    state.expired = true;
    assert.equal((await send("admin/faculty")).status, 401);
    assert.equal(state.writes, 0);
  }));
test("profile creation cannot grant roles, link students or invalid activities", () =>
  fixture(async ({ send, state }) => {
    for (const body of [
      { ...input, role: "teacher" },
      { ...input, createdAt: "2026-01-01" },
      { ...input, photo: "javascript:alert(1)" },
      { ...input, teacherAccountId: "", assignedEventIds: [eventId] },
      { ...input, assignedEventIds: [eventId, eventId] },
    ])
      assert.equal((await send("admin/faculty", "POST", body)).status, 400);
    state.linkRole = "student";
    assert.equal((await send("admin/faculty", "POST", input)).status, 400);
    state.linkRole = "teacher";
    state.linkBanned = true;
    assert.equal((await send("admin/faculty", "POST", input)).status, 400);
    state.linkBanned = false;
    assert.equal(
      (
        await send("admin/faculty", "POST", {
          ...input,
          assignedEventIds: ["64b000000000000000000099"],
        })
      ).status,
      400,
    );
    assert.equal(state.writes, 0);
  }));
test("concurrent edits require versions; teacher assignments derive identity from session", () =>
  fixture(async ({ send, state }) => {
    const { profile } = await (
      await send("admin/faculty", "POST", input)
    ).json();
    const responses = await Promise.all([
      send(`admin/faculty/${profile.id}`, "PUT", { ...input, version: 1 }),
      send(`admin/faculty/${profile.id}`, "PUT", { ...input, version: 1 }),
    ]);
    assert.deepEqual(responses.map((row) => row.status).sort(), [200, 409]);
    state.role = "teacher";
    assert.equal((await send("teacher/activities")).status, 200);
    assert.equal((await send("teacher/activities?userId=other")).status, 400);
    state.role = "student";
    assert.equal((await send("teacher/activities")).status, 403);
    assert.equal((await send("faculty?page=0")).status, 400);
    assert.equal((await send("faculty/not-an-id")).status, 400);
  }));

const teacherEntry = {
  name: "Fictional Teacher",
  designation: "Lecturer",
  department: "Physics",
  bcsBatch: "40th",
  email: "fictional-teacher@example.com",
  phone: "01712345678",
};
test("teacher entry allows fresh staff roles and publishes professional fields with private contacts", () =>
  fixture(async ({ send, state }) => {
    for (const role of ["teacher", "admin"]) {
      state.role = role;
      const response = await send("manage/teachers", "POST", teacherEntry);
      assert.equal(response.status, 201);
      const { profile } = await response.json();
      assert.equal(profile.name, teacherEntry.name);
      assert.equal("email" in profile, false);
      assert.equal("phone" in profile, false);
      const record = state.rows.find((row) => String(row._id) === profile.id);
      assert.equal(record.email, teacherEntry.email);
      assert.equal(record.phone, teacherEntry.phone);
      assert.equal(record.teacherAccountId, "");
      assert.equal(record.published, true);
      assert.ok(record.createdAt instanceof Date);
      const publicProfile = (await (await send("faculty/" + profile.id)).json())
        .profile;
      assert.equal(publicProfile.bcsBatch, "40th");
      assert.equal("email" in publicProfile, false);
      assert.equal("phone" in publicProfile, false);
    }
    state.role = "admin";
    const managed = await (await send("admin/faculty")).json();
    assert.equal(managed.items[0].email, teacherEntry.email);
    assert.equal(managed.items[0].phone, teacherEntry.phone);
  }));
test("teacher entry rejects guests students expired roles forged fields invalid inputs and foreign origins", () =>
  fixture(async ({ send, state }) => {
    assert.equal(
      (await send("manage/teachers", "POST", teacherEntry, { Cookie: "" }))
        .status,
      401,
    );
    for (const role of ["student", "teacher,admin", undefined]) {
      state.role = role;
      assert.equal(
        (await send("manage/teachers", "POST", teacherEntry)).status,
        403,
      );
    }
    state.role = "teacher";
    state.expired = true;
    assert.equal(
      (await send("manage/teachers", "POST", teacherEntry)).status,
      401,
    );
    state.expired = false;
    for (const change of [
      { name: "" },
      { designation: "x" },
      { department: "" },
      { bcsBatch: "" },
      { email: "bad" },
      { phone: "123" },
      { role: "teacher" },
      { published: false },
      { teacherAccountId: teacherId },
      { createdAt: "2026-01-01" },
    ])
      assert.equal(
        (await send("manage/teachers", "POST", { ...teacherEntry, ...change }))
          .status,
        400,
      );
    for (const Origin of ["https://untrusted.example", ""])
      assert.equal(
        (await send("manage/teachers", "POST", teacherEntry, { Origin }))
          .status,
        403,
      );
    assert.equal(state.writes, 0);
  }));

test("faculty dropdowns and combined department/designation filtering only use public records", () =>
  fixture(async ({ send, state }) => {
    for (const row of [
      { department: "Physics", designation: "Lecturer", published: true },
      { department: "Physics", designation: "Professor", published: true },
      { department: "Chemistry", designation: "Lecturer", published: true },
      {
        department: "Private department",
        designation: "Private designation",
        published: false,
      },
      {
        department: "Deleted department",
        designation: "Deleted designation",
        published: true,
        deletedAt: new Date(),
      },
    ])
      state.rows.push({ ...input, _id: new ObjectId(), version: 1, ...row });
    const response = await send("faculty/filters", "GET", undefined, {
      Cookie: "",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      departments: ["Chemistry", "Physics"],
      designations: ["Lecturer", "Professor"],
    });
    const combined = await (
      await send("faculty?department=Physics&designation=Lecturer")
    ).json();
    assert.equal(combined.items.length, 1);
    assert.equal(combined.items[0].designation, "Lecturer");
    assert.equal(combined.items[0].department, "Physics");
    assert.equal("phone" in combined.items[0], false);
    const designation = await (
      await send("faculty?designation=Lecturer")
    ).json();
    assert.equal(designation.items.length, 2);
    assert.equal(
      (await (await send("faculty?designation=NoMatch")).json()).items.length,
      0,
    );
    for (const suffix of [
      "?designation=",
      "?designation=" + "x".repeat(121),
      "?designation[$ne]=Professor",
    ])
      assert.equal((await send("faculty" + suffix)).status, 400);
    assert.equal((await send("faculty/filters?role=admin")).status, 400);
    assert.equal(state.writes, 0);
  }));
