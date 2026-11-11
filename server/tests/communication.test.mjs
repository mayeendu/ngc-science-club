import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import process from "node:process";
import { ObjectId } from "mongodb";
import { memoryDatabase } from "./helpers/communication-memory.mjs";
const { fetch, Response } = globalThis;
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "5000",
  CLIENT_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:5000",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  DB_NAME: "fictional_communication_only",
});
const { createApp } = await import("../src/app.ts");
const { createAnnouncementRepository } =
  await import("../src/modules/communication/announcement.repository.ts");
const { createNotificationRepository } =
  await import("../src/modules/communication/notification.repository.ts");
const id = (n) => n.toString(16).padStart(24, "0");
const student = { id: id(100), role: "student" },
  teacher = { id: id(200), role: "teacher" },
  admin = { id: id(300), role: "admin" };
const now = new Date("2026-11-01T00:00:00Z");
function data() {
  return {
    announcements: [
      {
        _id: new ObjectId(id(1)),
        title: "Fictional notice",
        body: "Fictional public announcement.",
        published: true,
        updatedAt: now,
        createdAt: now,
        createdBy: teacher.id,
        version: 1,
      },
      {
        _id: new ObjectId(id(2)),
        title: "PRIVATE_DRAFT",
        body: "PRIVATE_BODY",
        published: false,
        updatedAt: now,
        createdBy: id(999),
        version: 1,
      },
    ],
    membershipApplications: [
      {
        _id: student.id,
        status: "approved",
        reviewedAt: now,
        phone: "PRIVATE_PHONE",
      },
      { _id: id(999), status: "rejected", reviewedAt: now },
    ],
    quizzes: [
      {
        _id: new ObjectId(id(3)),
        title: "Available quiz",
        status: "published",
        updatedAt: now,
      },
      {
        _id: new ObjectId(id(4)),
        title: "Released quiz",
        status: "published",
        updatedAt: now,
        closedAt: now,
        resultsReleasedAt: now,
      },
      {
        _id: new ObjectId(id(5)),
        title: "PRIVATE_HELD_RESULT",
        status: "published",
        updatedAt: now,
        closedAt: now,
      },
    ],
    quizAttempts: [
      {
        _id: "private",
        quizId: id(4),
        userId: student.id,
        status: "submitted",
        score: "PRIVATE_SCORE",
        answers: ["PRIVATE_KEY"],
      },
    ],
    events: [
      {
        _id: new ObjectId(id(6)),
        title: "Cancelled science event",
        updatedAt: now,
        status: "cancelled",
      },
      {
        _id: new ObjectId(id(7)),
        title: "PRIVATE_OTHER_EVENT",
        updatedAt: now,
        status: "published",
      },
    ],
    eventRegistrations: [
      { _id: "private", eventId: id(6), userId: student.id, registeredAt: now },
      { _id: "other", eventId: id(7), userId: id(999), registeredAt: now },
    ],
    notificationReadStates: [],
  };
}
test("actual notification aggregation scopes all sources and never includes private keys or peers", async () => {
  const collections = data(),
    repository = createNotificationRepository(() =>
      memoryDatabase(collections),
    );
  const result = await repository.list(student, 1);
  assert.equal(result.items.length, 5);
  assert.equal(result.unreadCount, 5);
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE_|revision|userId|createdBy/,
  );
  assert.ok(result.items.some((row) => row.body.includes("cancelled")));
  const staff = await repository.list(teacher, 1);
  assert.equal(staff.items.length, 1);
  assert.equal(staff.items[0].kind, "announcement");
  const peer = await repository.list({ ...student, id: id(998) }, 1);
  assert.equal(peer.items.length, 1);
  collections.membershipApplications[0].status = "rejected";
  const rejected = await repository.list(student, 1);
  assert.equal(rejected.items.filter((row) => row.kind === "quiz").length, 0);
});
test("read/unread is own-only, idempotent and source updates become unread", async () => {
  const collections = data(),
    repository = createNotificationRepository(() =>
      memoryDatabase(collections),
    );
  const noticeId = `announcement:${id(1)}`;
  await repository.mark(student, noticeId, true);
  await repository.mark(student, noticeId, true);
  assert.equal(collections.notificationReadStates.length, 1);
  assert.equal((await repository.list(student, 1)).unreadCount, 4);
  assert.equal((await repository.list(teacher, 1)).unreadCount, 1);
  await repository.mark(student, noticeId, false);
  assert.equal((await repository.list(student, 1)).unreadCount, 5);
  await repository.mark(student, noticeId, true);
  collections.announcements[0].updatedAt = new Date("2026-11-02T00:00:00Z");
  assert.equal((await repository.list(student, 1)).unreadCount, 5);
  await assert.rejects(
    repository.mark(teacher, `membership:${student.id}`, true),
    { statusCode: 404 },
  );
  assert.equal((await repository.list(student, 2)).items.length, 0);
});
test("announcement ownership publish/archive/version rules and public projections", async () => {
  const collections = data(),
    repository = createAnnouncementRepository(() =>
      memoryDatabase(collections),
    );
  assert.equal((await repository.list(1)).items.length, 1);
  assert.doesNotMatch(
    JSON.stringify(await repository.list(1)),
    /createdBy|version|published|PRIVATE_/,
  );
  const input = {
    title: "New fictional notice",
    body: "A fictional notice for testing.",
    published: false,
  };
  const row = await repository.create(teacher, input);
  assert.equal(row.version, 1);
  await assert.rejects(
    repository.update(
      { ...teacher, id: id(999) },
      row.id,
      { ...input, published: true },
      1,
    ),
    { statusCode: 409 },
  );
  const responses = await Promise.allSettled([
    repository.update(teacher, row.id, { ...input, published: true }, 1),
    repository.update(teacher, row.id, input, 1),
  ]);
  assert.equal(
    responses.filter((result) => result.status === "fulfilled").length,
    1,
  );
  await repository.remove(admin, row.id, 2);
  assert.equal((await repository.list(1)).items.length, 1);
  assert.equal((await repository.detail(id(1))).title, "Fictional notice");
  await assert.rejects(repository.detail(id(2)), { statusCode: 404 });
  await assert.rejects(repository.detail(row.id), { statusCode: 404 });
});
test("HTTP sessions roles origins and field allowlists protect communication routes", async () => {
  const state = { role: "student", expired: false },
    collections = data(),
    database = () => memoryDatabase(collections);
  const auth = {
    handler: async () => new Response("null"),
    api: {
      getSession: async ({ headers }) =>
        headers.get("cookie") === "fixture=valid"
          ? {
              user: { id: student.id },
              session: {
                userId: student.id,
                expiresAt: new Date(
                  Date.now() + (state.expired ? -1000 : 60000),
                ),
              },
            }
          : null,
    },
  };
  const server = createApp(auth, {
    announcementRepository: createAnnouncementRepository(database),
    notificationRepository: createNotificationRepository(database),
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
    assert.equal(
      (await send("notifications", "GET", undefined, { Cookie: "" })).status,
      401,
    );
    assert.equal((await send("manage/announcements")).status, 403);
    assert.equal((await send("notifications?userId=other")).status, 400);
    assert.equal(
      (
        await send(`notifications/announcement:${id(1)}`, "PATCH", {
          read: true,
          userId: "other",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send(
          `notifications/announcement:${id(1)}`,
          "PATCH",
          { read: true },
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    assert.equal((await send("notifications")).status, 200);
    assert.equal(
      (
        await send(`notifications/announcement:${id(1)}`, "PATCH", {
          read: true,
        })
      ).status,
      200,
    );
    state.role = "teacher";
    assert.equal(
      (
        await send("manage/announcements", "POST", {
          title: "Valid title",
          body: "Fictional full body.",
          published: false,
          createdBy: "other",
        })
      ).status,
      400,
    );
    state.expired = true;
    assert.equal((await send("notifications")).status, 401);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
