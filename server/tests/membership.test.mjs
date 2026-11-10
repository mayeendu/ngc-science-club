import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import process from "node:process";
import { test } from "node:test";
import { MongoServerError } from "mongodb";
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_membership_memory_only",
});
const { fetch, structuredClone } = globalThis;
const { createApp } = await import("../src/app.ts");
const { createApplicationRepository } =
  await import("../src/modules/membership-applications/application.repository.ts");
const { createMemberRepository } =
  await import("../src/modules/members/member.repository.ts");
const input = {
  fullName: "Fictional Student",
  studentId: "TEST-2026-01",
  department: "Science",
  academicYear: "2026-2027",
  phone: "01712345678",
  reason: "I would like to learn science through experiments.",
};
async function fixture(run) {
  const records = new Map();
  const queries = [];
  const state = {
    role: "student",
    expired: false,
    fail: false,
    userId: "64b000000000000000000001",
  };
  const database = () => ({
    collection(name) {
      assert.equal(name, "membershipApplications");
      return {
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
              if (state.fail) throw new Error("PRIVATE_DATABASE_DETAIL");
              return [...records.values()]
                .filter((record) => record.status === filter.status)
                .sort(
                  (a, b) =>
                    b.submittedAt - a.submittedAt || a._id.localeCompare(b._id),
                )
                .slice(offset, offset + maximum)
                .map((record) => structuredClone(record));
            },
          };
          return cursor;
        },
        async findOneAndUpdate(filter, update, options) {
          if (state.fail) throw new Error("PRIVATE_DATABASE_DETAIL");
          queries.push({ filter, update, options });
          const record = records.get(filter._id);
          if (!record || record.status !== filter.status) return null;
          const next = { ...record, ...update.$set };
          if (update.$unset?.rejectionReason !== undefined)
            delete next.rejectionReason;
          records.set(filter._id, next);
          return structuredClone(next);
        },
        async insertOne(doc) {
          if (state.fail) throw new Error("PRIVATE_DATABASE_DETAIL");
          await Promise.resolve();
          if (records.has(doc._id))
            throw new MongoServerError({
              code: 11000,
              message: "duplicate _id",
            });
          records.set(doc._id, structuredClone(doc));
          return { insertedId: doc._id };
        },
        async findOne(filter, options) {
          if (state.fail) throw new Error("PRIVATE_DATABASE_DETAIL");
          queries.push({ filter, options });
          const record = records.get(filter._id);
          return record && (!filter.status || record.status === filter.status)
            ? record
            : null;
        },
      };
    },
  });
  const repository = createApplicationRepository(database);
  const auth = {
    handler: async () => new globalThis.Response("null"),
    api: {
      getSession: async ({ headers, query }) => {
        assert.equal(query.disableCookieCache, true);
        if (headers.get("cookie") !== "fixture=valid") return null;
        return {
          user: {
            id: state.userId,
            name: "Fictional Student",
            email: "fixture@example.com",
            role: "admin",
          },
          session: {
            id: "fixture",
            userId: state.userId,
            expiresAt: new Date(Date.now() + (state.expired ? -1000 : 60000)),
          },
        };
      },
    },
  };
  const app = createApp(auth, {
    applicationRepository: repository,
    memberRepository: createMemberRepository(database),
    lookupAuthorizationUser: async () => ({ role: state.role, banned: false }),
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/membership-applications`;
  const send = (method = "GET", body, headers = {}) =>
    fetch(base + (method === "GET" ? "/me" : ""), {
      method,
      headers: {
        Cookie: "fixture=valid",
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const adminSend = (method = "GET", body, headers = {}, suffix = "") =>
    fetch(
      `http://127.0.0.1:${server.address().port}/api/admin/memberships${suffix}`,
      {
        method,
        headers: {
          Cookie: "fixture=valid",
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
  try {
    const profileSend = (method = "GET", body, headers = {}, query = "") =>
      fetch(`${base}/me/profile${query}`, {
        method,
        headers: {
          Cookie: "fixture=valid",
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const publicProfile = (id) =>
      fetch(`http://127.0.0.1:${server.address().port}/api/members/${id}`);
    await run({
      send,
      adminSend,
      profileSend,
      publicProfile,
      records,
      state,
      queries,
    });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}

test("only authenticated current students can submit or read status", () =>
  fixture(async ({ send, state, records }) => {
    for (const method of ["GET", "POST"]) {
      assert.equal(
        (
          await send(method, method === "POST" ? input : undefined, {
            Cookie: "",
          })
        ).status,
        401,
      );
      for (const role of ["teacher", "admin", "student,admin", undefined]) {
        state.role = role;
        assert.equal(
          (await send(method, method === "POST" ? input : undefined)).status,
          403,
        );
      }
    }
    assert.equal(records.size, 0);
  }));
test("server uses session identity and creates only pending, private application data", () =>
  fixture(async ({ send, records, state }) => {
    const response = await send("POST", input);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.application.status, "pending");
    assert.deepEqual(Object.keys(body.application).sort(), [
      "status",
      "submittedAt",
    ]);
    const doc = records.get(state.userId);
    assert.equal(doc._id, state.userId);
    assert.equal(doc.status, "pending");
    assert.ok(doc.submittedAt instanceof Date);
    assert.equal(doc.phone, input.phone);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }));
test("forged ownership, roles, status, dates and invalid six-field input cannot write", () =>
  fixture(async ({ send, records }) => {
    const bad = [
      { userId: "another" },
      { role: "admin" },
      { status: "approved" },
      { submittedAt: "2026-01-01" },
      { _id: "another" },
      { phone: "123" },
      { reason: "short" },
      { studentId: "<script>" },
      { fullName: "" },
      { department: "" },
      { academicYear: "" },
    ];
    for (const change of bad)
      assert.equal((await send("POST", { ...input, ...change })).status, 400);
    assert.equal(records.size, 0);
  }));
test("CSRF origin checks reject foreign and missing origins without writes", () =>
  fixture(async ({ send, records }) => {
    for (const Origin of ["https://attacker.example", "null", ""])
      assert.equal((await send("POST", input, { Origin })).status, 403);
    assert.equal(records.size, 0);
  }));
test("atomic insert prevents duplicate and concurrent active applications", () =>
  fixture(async ({ send, records }) => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => send("POST", input)),
    );
    assert.equal(responses.filter((r) => r.status === 201).length, 1);
    assert.equal(responses.filter((r) => r.status === 409).length, 7);
    assert.equal(records.size, 1);
  }));
test("status is private to the verified account and exposes only status/date", () =>
  fixture(async ({ send, state, queries }) => {
    assert.deepEqual(await (await send()).json(), {
      success: true,
      application: null,
    });
    assert.equal((await send("POST", input)).status, 201);
    const response = await send();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body.application).sort(), [
      "status",
      "submittedAt",
    ]);
    assert.deepEqual(queries.at(-1).filter, { _id: state.userId });
    assert.equal(queries.at(-1).options.readPreference, "primary");
    state.userId = "64b000000000000000000002";
    assert.deepEqual(await (await send()).json(), {
      success: true,
      application: null,
    });
  }));
test("expired sessions and role demotions cannot submit", () =>
  fixture(async ({ send, state, records }) => {
    state.expired = true;
    assert.equal((await send("POST", input)).status, 401);
    state.expired = false;
    state.role = "teacher";
    assert.equal((await send("POST", input)).status, 403);
    assert.equal(records.size, 0);
  }));
test("database failures return safe errors and do not report success", () =>
  fixture(async ({ send, state, records }) => {
    state.fail = true;
    for (const method of ["GET", "POST"]) {
      const response = await send(
        method,
        method === "POST" ? input : undefined,
      );
      assert.equal(response.status, 500);
      assert.equal(
        (await response.text()).includes("PRIVATE_DATABASE_DETAIL"),
        false,
      );
    }
    assert.equal(records.size, 0);
  }));

test("admin list and review reject guests, students, teachers and malformed roles", () =>
  fixture(async ({ send, adminSend, state, records }) => {
    await send("POST", input);
    const target = state.userId;
    for (const method of ["GET", "PATCH"]) {
      const suffix = method === "PATCH" ? `/${target}/review` : "";
      const body = method === "PATCH" ? { decision: "approved" } : undefined;
      assert.equal(
        (await adminSend(method, body, { Cookie: "" }, suffix)).status,
        401,
      );
      for (const role of ["student", "teacher", "student,admin", undefined]) {
        state.role = role;
        assert.equal(
          (await adminSend(method, body, { "X-Role": "admin" }, suffix)).status,
          403,
        );
      }
    }
    assert.equal(records.get(target).status, "pending");
  }));

test("admin approval saves trusted reviewer/time and student sees own safe decision", () =>
  fixture(async ({ send, adminSend, state, records, queries }) => {
    await send("POST", input);
    const target = state.userId;
    state.role = "admin";
    state.userId = "64b000000000000000000002";
    const response = await adminSend(
      "PATCH",
      { decision: "approved" },
      {},
      `/${target}/review`,
    );
    assert.equal(response.status, 200);
    const record = records.get(target);
    assert.equal(record.status, "approved");
    assert.equal(record.reviewerId, state.userId);
    assert.ok(record.reviewedAt instanceof Date);
    assert.equal(record.rejectionReason, undefined);
    const update = queries.find((query) => query.update);
    assert.deepEqual(update.filter, { _id: target, status: "pending" });
    assert.equal(update.options.returnDocument, "after");
    state.role = "student";
    state.userId = target;
    const body = await (await send()).json();
    assert.equal(body.application.status, "approved");
    assert.ok(body.application.reviewedAt);
    assert.equal("reviewerId" in body.application, false);
    assert.equal("phone" in body.application, false);
    assert.equal((await send("POST", input)).status, 409);
  }));

test("rejection requires valid reason and rejects forged reviewer, timestamps and transitions", () =>
  fixture(async ({ send, adminSend, state, records }) => {
    await send("POST", input);
    const target = state.userId;
    state.role = "admin";
    for (const body of [
      { decision: "rejected" },
      { decision: "rejected", rejectionReason: "    " },
      { decision: "rejected", rejectionReason: "x".repeat(1001) },
      { decision: "pending" },
      { decision: "approved", reviewerId: "forged" },
      { decision: "approved", reviewedAt: "2026-01-01" },
      { decision: "approved", status: "approved" },
      { decision: "approved", rejectionReason: "extra field" },
    ])
      assert.equal(
        (await adminSend("PATCH", body, {}, `/${target}/review`)).status,
        400,
      );
    assert.equal(records.get(target).status, "pending");
    assert.equal(
      (
        await adminSend(
          "PATCH",
          {
            decision: "rejected",
            rejectionReason: "  Please supply the correct student details.  ",
          },
          {},
          `/${target}/review`,
        )
      ).status,
      200,
    );
    assert.equal(
      records.get(target).rejectionReason,
      "Please supply the correct student details.",
    );
    state.role = "student";
    const body = await (await send()).json();
    assert.equal(body.application.status, "rejected");
    assert.equal(
      body.application.rejectionReason,
      "Please supply the correct student details.",
    );
    assert.equal("reviewerId" in body.application, false);
  }));

test("competing and repeated reviews permit exactly one pending transition", () =>
  fixture(async ({ send, adminSend, state, records }) => {
    await send("POST", input);
    const target = state.userId;
    state.role = "admin";
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        adminSend(
          "PATCH",
          i % 2
            ? { decision: "approved" }
            : {
                decision: "rejected",
                rejectionReason: "Fictional rejection reason.",
              },
          {},
          `/${target}/review`,
        ),
      ),
    );
    assert.equal(responses.filter((r) => r.status === 200).length, 1);
    assert.equal(responses.filter((r) => r.status === 409).length, 7);
    const before = structuredClone(records.get(target));
    assert.equal(
      (
        await adminSend(
          "PATCH",
          { decision: "approved" },
          {},
          `/${target}/review`,
        )
      ).status,
      409,
    );
    assert.deepEqual(records.get(target), before);
  }));

test("admin listing filters, paginates and explicitly projects student details only", () =>
  fixture(async ({ adminSend, state, records, queries }) => {
    state.role = "admin";
    for (let i = 0; i < 16; i++) {
      const id = (i + 1).toString(16).padStart(24, "0");
      records.set(id, {
        ...input,
        _id: id,
        status: i < 12 ? "pending" : i < 14 ? "approved" : "rejected",
        submittedAt: new Date(2026, 0, 1, i),
        reviewerId: "private-reviewer",
        unrelatedSecret: "PRIVATE_SENTINEL",
      });
    }
    const first = await (await adminSend()).json();
    assert.equal(first.applications.length, 10);
    assert.equal(first.hasNext, true);
    assert.equal(first.page, 1);
    const second = await (
      await adminSend("GET", undefined, {}, "?status=pending&page=2")
    ).json();
    assert.equal(second.applications.length, 2);
    assert.equal(second.hasNext, false);
    assert.equal(
      new Set([...first.applications, ...second.applications].map((a) => a.id))
        .size,
      12,
    );
    for (const status of ["approved", "rejected"]) {
      const body = await (
        await adminSend("GET", undefined, {}, `?status=${status}`)
      ).json();
      assert.equal(body.applications.length, 2);
      assert.ok(body.applications.every((a) => a.status === status));
    }
    assert.equal(JSON.stringify(first).includes("PRIVATE_SENTINEL"), false);
    assert.equal("reviewerId" in first.applications[0], false);
    assert.equal(first.applications[0].phone, input.phone);
    assert.equal(queries[0].options.projection.reviewerId, undefined);
    for (const suffix of [
      "?status=unknown",
      "?page=0",
      "?page=1001",
      "?role=admin",
      "?status[$ne]=pending",
    ])
      assert.equal((await adminSend("GET", undefined, {}, suffix)).status, 400);
  }));

test("review endpoints reject foreign origins, expired sessions, invalid IDs and DB failures", () =>
  fixture(async ({ send, adminSend, state, records }) => {
    await send("POST", input);
    const target = state.userId;
    state.role = "admin";
    for (const Origin of ["https://attacker.example", ""])
      assert.equal(
        (
          await adminSend(
            "PATCH",
            { decision: "approved" },
            { Origin },
            `/${target}/review`,
          )
        ).status,
        403,
      );
    assert.equal(
      (
        await adminSend(
          "PATCH",
          { decision: "approved" },
          {},
          "/not-an-id/review",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await adminSend(
          "PATCH",
          { decision: "approved" },
          {},
          "/64b000000000000000000099/review",
        )
      ).status,
      409,
    );
    state.expired = true;
    assert.equal((await adminSend()).status, 401);
    state.expired = false;
    state.role = "student";
    assert.equal(
      (
        await adminSend(
          "PATCH",
          { decision: "approved" },
          {},
          `/${target}/review`,
        )
      ).status,
      403,
    );
    state.role = "admin";
    state.fail = true;
    for (const [method, suffix] of [
      ["GET", ""],
      ["PATCH", `/${target}/review`],
    ]) {
      const response = await adminSend(
        method,
        method === "PATCH" ? { decision: "approved" } : undefined,
        {},
        suffix,
      );
      assert.equal(response.status, 500);
      assert.equal(
        (await response.text()).includes("PRIVATE_DATABASE_DETAIL"),
        false,
      );
    }
    assert.equal(records.get(target).status, "pending");
  }));

function approvedProfileRecord(id) {
  return {
    ...input,
    _id: id,
    status: "approved",
    submittedAt: new Date("2026-11-01T10:00:00Z"),
    reviewedAt: new Date("2026-11-02T10:00:00Z"),
    reviewerId: "trusted-reviewer",
  };
}

test("own member profile requires authentication current student role and approved membership", () =>
  fixture(async ({ profileSend, state, records }) => {
    for (const method of ["GET", "PATCH"]) {
      const body =
        method === "PATCH" ? { fullName: "Updated Member" } : undefined;
      assert.equal(
        (await profileSend(method, body, { Cookie: "" })).status,
        401,
      );
      for (const status of [undefined, "pending", "rejected"]) {
        if (status)
          records.set(state.userId, {
            ...approvedProfileRecord(state.userId),
            status,
          });
        else records.clear();
        assert.equal((await profileSend(method, body)).status, 403);
      }
      records.set(state.userId, approvedProfileRecord(state.userId));
      for (const role of ["teacher", "admin", "student,admin", undefined]) {
        state.role = role;
        assert.equal((await profileSend(method, body)).status, 403);
      }
      state.role = "student";
    }
  }));

test("own profile response exposes only personal fields and protects other account records", () =>
  fixture(async ({ profileSend, state, records, queries }) => {
    records.set(state.userId, approvedProfileRecord(state.userId));
    const other = "64b000000000000000000002";
    records.set(other, {
      ...approvedProfileRecord(other),
      phone: "01999999999",
    });
    const response = await profileSend(
      "GET",
      undefined,
      {},
      `?userId=${other}`,
    );
    assert.equal(response.status, 200);
    const { profile } = await response.json();
    assert.equal(profile.phone, input.phone);
    assert.equal(profile.studentId, input.studentId);
    assert.equal(profile.status, "approved");
    assert.equal(profile.membershipDate, "2026-11-02T10:00:00.000Z");
    assert.equal(profile.completion, 100);
    assert.equal("reason" in profile, false);
    assert.equal("reviewerId" in profile, false);
    assert.equal("email" in profile, false);
    assert.equal("role" in profile, false);
    assert.deepEqual(queries.at(-1).filter, {
      _id: state.userId,
      status: "approved",
    });
    assert.equal(queries.at(-1).options.projection.reviewerId, undefined);
  }));

test("profile PATCH changes only allowed fields with an atomic approved/owner condition", () =>
  fixture(async ({ profileSend, publicProfile, state, records, queries }) => {
    const original = approvedProfileRecord(state.userId);
    records.set(state.userId, structuredClone(original));
    const other = "64b000000000000000000002";
    records.set(other, approvedProfileRecord(other));
    const beforeOther = structuredClone(records.get(other));
    const response = await profileSend("PATCH", {
      fullName: "  Updated Fictional Member  ",
      phone: "01912345678",
      department: "Physics",
      academicYear: "2027-2028",
    });
    assert.equal(response.status, 200);
    const { profile } = await response.json();
    assert.equal(profile.fullName, "Updated Fictional Member");
    assert.equal(profile.completion, 100);
    assert.equal(profile.phone, "01912345678");
    const publicResult = await (await publicProfile(state.userId)).json();
    assert.equal(publicResult.member.name, "Updated Fictional Member");
    assert.equal(publicResult.member.department, "Physics");
    assert.equal(publicResult.member.academicYear, "2027-2028");
    assert.equal("phone" in publicResult.member, false);
    assert.equal("studentId" in publicResult.member, false);
    const record = records.get(state.userId);
    for (const key of [
      "status",
      "studentId",
      "reviewerId",
      "reviewedAt",
      "submittedAt",
      "reason",
    ])
      assert.deepEqual(record[key], original[key]);
    assert.ok(record.profileUpdatedAt instanceof Date);
    assert.deepEqual(records.get(other), beforeOther);
    const update = queries.find((query) => query.update);
    assert.deepEqual(update.filter, { _id: state.userId, status: "approved" });
    assert.deepEqual(Object.keys(update.update.$set).sort(), [
      "academicYear",
      "department",
      "fullName",
      "phone",
      "profileUpdatedAt",
    ]);
  }));

test("mass assignment invalid fields empty patches and foreign origins cannot edit member profile", () =>
  fixture(async ({ profileSend, state, records }) => {
    records.set(state.userId, approvedProfileRecord(state.userId));
    const before = structuredClone(records.get(state.userId));
    for (const body of [
      {},
      { userId: "someone" },
      { _id: "someone" },
      { role: "admin" },
      { status: "approved" },
      { studentId: "changed" },
      { reviewerId: "forged" },
      { reviewedAt: "2026-01-01" },
      { reason: "changed" },
      { profileUpdatedAt: "2026-01-01" },
      { fullName: "" },
      { phone: "bad" },
      { department: "" },
      { academicYear: "x" },
    ])
      assert.equal((await profileSend("PATCH", body)).status, 400);
    for (const Origin of ["https://attacker.example", ""])
      assert.equal(
        (await profileSend("PATCH", { fullName: "Changed" }, { Origin }))
          .status,
        403,
      );
    assert.deepEqual(records.get(state.userId), before);
    state.expired = true;
    assert.equal(
      (await profileSend("PATCH", { fullName: "Changed" })).status,
      401,
    );
  }));

test("profile updates stop after approval removal and errors do not disclose private data", () =>
  fixture(async ({ profileSend, state, records }) => {
    records.set(state.userId, approvedProfileRecord(state.userId));
    assert.equal((await profileSend()).status, 200);
    records.get(state.userId).status = "rejected";
    assert.equal(
      (await profileSend("PATCH", { fullName: "Changed" })).status,
      403,
    );
    assert.equal(records.get(state.userId).fullName, input.fullName);
    state.fail = true;
    for (const method of ["GET", "PATCH"]) {
      const response = await profileSend(
        method,
        method === "PATCH" ? { fullName: "Changed" } : undefined,
      );
      assert.equal(response.status, 500);
      assert.equal(
        (await response.text()).includes("PRIVATE_DATABASE_DETAIL"),
        false,
      );
    }
  }));

test("legacy missing fields have useful completion and can be completed without inventing joining dates", () =>
  fixture(async ({ profileSend, state, records }) => {
    const record = approvedProfileRecord(state.userId);
    delete record.phone;
    delete record.reviewedAt;
    records.set(state.userId, record);
    const initial = await (await profileSend()).json();
    assert.equal(initial.profile.completion, 75);
    assert.equal(initial.profile.phone, "");
    assert.equal(initial.profile.membershipDate, null);
    const response = await profileSend("PATCH", { phone: "01912345678" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).profile.completion, 100);
  }));
