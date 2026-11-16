import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import process from "node:process";
import { URLSearchParams } from "node:url";
import { test } from "node:test";
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_directory_memory_only",
});
const { fetch, structuredClone } = globalThis;
const { createApp } = await import("../src/app.ts");
const { createMemberRepository } =
  await import("../src/modules/members/member.repository.ts");
async function fixture(run) {
  const records = Array.from({ length: 18 }, (_, index) => ({
    _id: (index + 1).toString(16).padStart(24, "0"),
    fullName:
      index === 0
        ? "Fictional [Lab]"
        : `Fictional Member ${String(index).padStart(2, "0")}`,
    status: index < 16 ? "approved" : index === 16 ? "pending" : "rejected",
    department: index % 2 ? "Physics" : "Chemistry",
    academicYear: index % 2 ? "2026-2027" : "2025-2026",
    reviewedAt: new Date("2026-11-01T10:00:00.000Z"),
    phone: "PRIVATE_PHONE",
    email: "PRIVATE_EMAIL",
    studentId: `ROLL-${String(index + 1).padStart(5, "0")}`,
    reason: "PRIVATE_APPLICATION_REASON",
    rejectionReason: "PRIVATE_REJECTION",
    reviewerId: "PRIVATE_REVIEWER",
  }));
  const queries = [];
  const state = { fail: false };
  function matches(record, filter) {
    return Object.entries(filter).every(([key, value]) =>
      value && typeof value === "object" && "$regex" in value
        ? new RegExp(value.$regex, value.$options).test(record[key])
        : record[key] === value,
    );
  }
  const collection = {
    find(filter, options) {
      queries.push({ filter, options });
      let offset = 0,
        maximum = 12;
      const cursor = {
        sort(spec) {
          assert.deepEqual(spec, { fullName: 1, _id: 1 });
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
          if (state.fail) throw new Error("PRIVATE_DATABASE_ERROR");
          return records
            .filter((record) => matches(record, filter))
            .sort(
              (a, b) =>
                a.fullName.localeCompare(b.fullName) ||
                a._id.localeCompare(b._id),
            )
            .slice(offset, offset + maximum)
            .map((record) => structuredClone(record));
        },
      };
      return cursor;
    },
    async countDocuments(filter, options) {
      queries.push({ filter, options });
      if (state.fail) throw new Error("PRIVATE_DATABASE_ERROR");
      return records.filter((record) => matches(record, filter)).length;
    },
    async findOne(filter, options) {
      queries.push({ filter, options });
      if (state.fail) throw new Error("PRIVATE_DATABASE_ERROR");
      return records.find((record) => matches(record, filter)) ?? null;
    },
    aggregate(pipeline, options) {
      assert.deepEqual(pipeline[0], { $match: { status: "approved" } });
      assert.equal(options.readPreference, "primary");
      return {
        async toArray() {
          if (state.fail) throw new Error("PRIVATE_DATABASE_ERROR");
          const members = records.filter(
            (record) => record.status === "approved",
          );
          const departments = [...new Set(members.map((r) => r.department))]
            .sort()
            .map((department) => ({
              _id: department,
              count: members.filter((r) => r.department === department).length,
            }));
          return [
            {
              departments,
              academicYears: [...new Set(members.map((r) => r.academicYear))]
                .sort()
                .map((year) => ({ _id: year })),
              total: members.length ? [{ count: members.length }] : [],
            },
          ];
        },
      };
    },
  };
  const repository = createMemberRepository(() => ({
    collection(name) {
      assert.equal(name, "membershipApplications");
      return collection;
    },
  }));
  const auth = {
    handler: async () => new globalThis.Response("null"),
    api: {
      getSession: async () => {
        throw new Error("Public endpoints must not authenticate");
      },
    },
  };
  const server = createApp(auth, { memberRepository: repository }).listen(
    0,
    "127.0.0.1",
  );
  await once(server, "listening");
  const send = (path = "") =>
    fetch(`http://127.0.0.1:${server.address().port}/api/members${path}`);
  try {
    await run({ records, queries, state, send });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}

test("guest list and profile expose approved public fields only", () =>
  fixture(async ({ send, queries }) => {
    const response = await send();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json();
    assert.equal(body.members.length, 12);
    assert.equal(body.pagination.total, 16);
    for (const member of body.members)
      assert.deepEqual(Object.keys(member).sort(), [
        "academicYear",
        "department",
        "id",
        "membershipDate",
        "name",
        "studentRoll",
      ]);
    assert.equal(JSON.stringify(body).includes("PRIVATE_"), false);
    const profile = await (await send("/000000000000000000000001")).json();
    assert.equal(profile.member.name, "Fictional [Lab]");
    assert.equal(profile.member.membershipDate, "2026-11-01T10:00:00.000Z");
    assert.equal(JSON.stringify(profile).includes("PRIVATE_"), false);
    for (const query of queries) {
      assert.equal(query.filter.status, "approved");
      assert.equal(query.options.readPreference, "primary");
      if (query.options.projection) {
        assert.equal(
          query.options.projection.studentId,
          query.filter._id ? undefined : 1,
        );
        for (const field of [
          "phone",
          "email",
          "reason",
          "reviewerId",
          "rejectionReason",
        ])
          assert.equal(query.options.projection[field], undefined);
      }
    }
  }));

test("pending rejected missing and malformed profiles reveal no details", () =>
  fixture(async ({ send, records }) => {
    for (const record of records.slice(16)) {
      const response = await send("/" + record._id);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        success: false,
        message: "Member not found.",
      });
    }
    assert.equal((await send("/000000000000000000000099")).status, 404);
    assert.equal((await send("/invalid")).status, 400);
  }));

test("search escapes regex syntax and combines exact department/year filters", () =>
  fixture(async ({ send, queries }) => {
    const searched = await (await send("?search=%5Blab%5D")).json();
    assert.equal(searched.members.length, 1);
    assert.equal(searched.members[0].name, "Fictional [Lab]");
    assert.equal(queries[0].filter.fullName.$regex, "\\[lab\\]");
    const filtered = await (
      await send("?department=Physics&academicYear=2026-2027&search=member")
    ).json();
    assert.equal(filtered.pagination.total, 8);
    assert.ok(
      filtered.members.every(
        (member) =>
          member.department === "Physics" &&
          member.academicYear === "2026-2027",
      ),
    );
    const literal = await (await send("?search=.*")).json();
    assert.equal(literal.pagination.total, 0);
  }));

test("pagination is bounded stable and does not duplicate results", () =>
  fixture(async ({ send }) => {
    const first = await (await send()).json();
    const second = await (await send("?page=2")).json();
    assert.equal(first.pagination.pageSize, 12);
    assert.equal(first.pagination.totalPages, 2);
    assert.equal(second.members.length, 4);
    assert.equal(
      new Set([...first.members, ...second.members].map((member) => member.id))
        .size,
      16,
    );
    const beyond = await (await send("?page=3")).json();
    assert.equal(beyond.members.length, 0);
    for (const path of [
      "?page=0",
      "?page=1001",
      "?page=abc",
      "?status=pending",
      "?department[$ne]=x",
      "?search=" + encodeURIComponent("x".repeat(81)),
    ])
      assert.equal((await send(path)).status, 400);
  }));

test("count and department statistics exclude unapproved records and stay fresh", () =>
  fixture(async ({ send, records }) => {
    assert.deepEqual(await (await send("/count")).json(), {
      success: true,
      totalMembers: 16,
    });
    const stats = await (await send("/stats")).json();
    assert.equal(stats.totalMembers, 16);
    assert.deepEqual(stats.departments, [
      { department: "Chemistry", count: 8 },
      { department: "Physics", count: 8 },
    ]);
    assert.deepEqual(stats.academicYears, ["2025-2026", "2026-2027"]);
    assert.equal(JSON.stringify(stats).includes("PRIVATE_"), false);
    records[16].status = "approved";
    assert.equal((await (await send("/count")).json()).totalMembers, 17);
    assert.equal((await send("/" + records[16]._id)).status, 200);
    records[0].status = "rejected";
    assert.equal((await send("/" + records[0]._id)).status, 404);
    assert.equal((await (await send("/stats")).json()).totalMembers, 16);
    const list = await (await send("?search=%5BLab%5D")).json();
    assert.equal(list.members.length, 0);
  }));

test("empty directories and unavailable legacy dates are handled honestly", () =>
  fixture(async ({ send, records }) => {
    delete records[0].reviewedAt;
    assert.equal(
      (await (await send("/" + records[0]._id)).json()).member.membershipDate,
      null,
    );
    records.forEach((record) => (record.status = "pending"));
    assert.deepEqual((await (await send()).json()).members, []);
    const stats = await (await send("/stats")).json();
    assert.deepEqual(stats, {
      success: true,
      totalMembers: 0,
      departments: [],
      academicYears: [],
    });
  }));

test("database failures fail safely without exposing private record details", () =>
  fixture(async ({ send, state }) => {
    state.fail = true;
    for (const path of ["", "/count", "/stats", "/000000000000000000000001"]) {
      const response = await send(path);
      assert.equal(response.status, 500);
      assert.equal((await response.text()).includes("PRIVATE_"), false);
    }
  }));

test("roll and section match exactly, combine with year and retain private projections", () =>
  fixture(async ({ send, records, queries }) => {
    records[0].studentId = "00123";
    records[0].section = "Science 1";
    records[1].studentId = "00123";
    records[1].section = "Science 2";
    records[2].studentId = "00123";
    records[2].section = "Science 1";
    records[2].academicYear = "2024-2025";
    records[16].studentId = "00123";
    records[16].section = "Science 1";
    const query = new URLSearchParams({
      studentRoll: " 00123 ",
      section: " Science 1 ",
      academicYear: "2025-2026",
    });
    const response = await send("?" + query);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.members[0].id, records[0]._id);
    assert.deepEqual(Object.keys(body.members[0]).sort(), [
      "academicYear",
      "department",
      "id",
      "membershipDate",
      "name",
      "studentRoll",
    ]);
    assert.equal(queries[0].filter.studentId, "00123");
    assert.equal(queries[0].filter.section, "Science 1");
    assert.equal(queries[0].options.projection.studentId, 1);
    assert.equal(body.members[0].studentRoll, "00123");
    const profile = await (await send("/" + records[0]._id)).json();
    assert.equal(Object.hasOwn(profile.member, "studentRoll"), false);
    delete records[0].studentId;
    const legacy = await (await send("?search=%5BLab%5D")).json();
    assert.equal(legacy.members[0].studentRoll, null);
    records[0].studentId = "00123";
    assert.equal(queries[0].options.projection.section, undefined);
    for (const path of [
      "?studentRoll=001",
      "?studentRoll=123",
      "?section=Science",
      "?section=.*",
    ]) {
      assert.equal((await (await send(path)).json()).pagination.total, 0);
    }
    assert.equal(
      (await (await send("?section=Science%202")).json()).pagination.total,
      1,
    );
    assert.equal(
      (await (await send("?studentRoll=00123")).json()).pagination.total,
      3,
    );
    assert.equal(
      (
        await (
          await send(
            "?studentRoll=00123&section=Science%201&academicYear=2025-2026&search=missing",
          )
        ).json()
      ).pagination.total,
      0,
    );
  }));

test("invalid roll/section queries are rejected before database access", () =>
  fixture(async ({ send, queries }) => {
    for (const path of [
      "?studentRoll=",
      "?studentRoll=.*",
      "?studentRoll=" + "1".repeat(41),
      "?section=",
      "?section=" + "s".repeat(61),
      "?studentRoll[$ne]=x",
      "?section[$ne]=x",
      "?studentRoll=1&studentRoll=2",
    ]) {
      assert.equal((await send(path)).status, 400, path);
    }
    assert.equal(queries.length, 0);
  }));
