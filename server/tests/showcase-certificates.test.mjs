import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
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
  DB_NAME: "fictional_showcase_only",
});
const { createApp } = await import("../src/app.ts");
const { createShowcaseRepository } =
  await import("../src/modules/showcase/showcase.repository.ts");
const { createCertificateRepository } =
  await import("../src/modules/certificates/certificate.repository.ts");
const id = (n) => n.toString(16).padStart(24, "0"),
  teacher = { id: id(1), role: "teacher" },
  student = { id: id(2), role: "student" },
  registrationId = id(3) + ":" + student.id;
const content = {
  kind: "achievement",
  title: "Fictional science award",
  description: "A fictional club achievement for testing.",
  occurredOn: "2020-01-01",
  image: "",
  published: true,
};
function fixture() {
  const data = {
    clubShowcase: [],
    certificates: [],
    certificateVerification: [],
    events: [
      {
        _id: new ObjectId(id(3)),
        createdBy: teacher.id,
        title: "Fictional science seminar",
        startsAt: new Date("2020-01-01T10:00:00Z"),
        status: "published",
      },
    ],
    eventRegistrations: [
      {
        _id: registrationId,
        userId: student.id,
        eventId: id(3),
        name: "Fictional Learner",
        status: "registered",
        attendance: "present",
      },
    ],
  };
  const state = { fail: false };
  let tail = Promise.resolve();
  const database = () => {
    const db = memoryDatabase(data);
    return {
      collection(name) {
        const collection = db.collection(name);
        if (name === "certificates" && state.fail)
          collection.insertOne = async () => {
            throw new Error("fictional failed commit");
          };
        return collection;
      },
    };
  };
  const run = (work) => {
    const pending = tail.then(async () => {
      const snapshot = Object.fromEntries(
        Object.entries(data).map(([key, rows]) => [
          key,
          rows.map((row) => ({ ...row })),
        ]),
      );
      try {
        return await work(database());
      } catch (error) {
        for (const [key, rows] of Object.entries(snapshot)) data[key] = rows;
        throw error;
      }
    });
    tail = pending.catch(() => undefined);
    return pending;
  };
  return {
    data,
    state,
    showcase: createShowcaseRepository(database),
    certificates: createCertificateRepository(database, run),
  };
}
test("public showcase filters drafts/archives and staff ownership/version updates", async () => {
  const { showcase } = fixture();
  const row = await showcase.save(teacher, content);
  await showcase.save(
    { ...teacher, id: id(9) },
    { ...content, published: false, title: "PRIVATE_DRAFT" },
  );
  const publicList = await showcase.list({ page: 1 });
  assert.equal(publicList.items.length, 1);
  assert.doesNotMatch(
    JSON.stringify(publicList),
    /createdBy|version|published|PRIVATE_/,
  );
  await assert.rejects(
    showcase.save({ ...teacher, id: id(9) }, content, row.id, 1),
    { statusCode: 409 },
  );
  const results = await Promise.allSettled([
    showcase.save(teacher, content, row.id, 1),
    showcase.save(teacher, content, row.id, 1),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  await showcase.remove({ id: id(99), role: "admin" }, row.id, 2);
  assert.deepEqual((await showcase.list({ page: 1 })).items, []);
});
test("concurrent issuance creates one certificate and one opaque verification ID", async () => {
  const { certificates, data } = fixture();
  const results = await Promise.all([
    certificates.issue(teacher, id(3), registrationId),
    certificates.issue(teacher, id(3), registrationId),
  ]);
  assert.equal(results[0].verificationId, results[1].verificationId);
  assert.match(results[0].verificationId, /^[a-f0-9]{64}$/);
  assert.equal(data.certificates.length, 1);
  assert.equal(data.certificateVerification.length, 1);
  const own = await certificates.list(student, false, 1);
  assert.equal(own.items[0].recipientName, "Fictional Learner");
  assert.deepEqual(
    (await certificates.list({ ...student, id: id(99) }, false, 1)).items,
    [],
  );
  assert.deepEqual(
    (await certificates.list({ ...teacher, id: id(99) }, true, 1)).items,
    [],
  );
  const publicResult = await certificates.verify(results[0].verificationId);
  assert.equal(publicResult.valid, true);
  assert.equal(publicResult.recipientInitials, "F. L.");
  assert.doesNotMatch(
    JSON.stringify(publicResult),
    /Fictional Learner|recipientName|userId|ownerId|registrationId/,
  );
});
test("attendance corrections immediately invalidate and explicit revocation is permanent", async () => {
  const { certificates, data } = fixture();
  const row = await certificates.issue(teacher, id(3), registrationId);
  data.eventRegistrations[0].attendance = "absent";
  assert.equal((await certificates.verify(row.verificationId)).valid, false);
  assert.equal(
    (await certificates.list(student, false, 1)).items[0].valid,
    false,
  );
  await assert.rejects(
    certificates.revoke({ ...teacher, id: id(99) }, row.verificationId, 1),
    { statusCode: 409 },
  );
  await certificates.revoke(teacher, row.verificationId, 1);
  data.eventRegistrations[0].attendance = "present";
  assert.equal((await certificates.verify(row.verificationId)).valid, false);
  const duplicate = await certificates.issue(teacher, id(3), registrationId);
  assert.equal(duplicate.revoked, true);
  assert.equal(data.certificates.length, 1);
});

test("certificate pages use two batched validity reads with private projections", async () => {
  const fixtureData = fixture();
  await fixtureData.certificates.issue(teacher, id(3), registrationId);
  let reads = 0;
  const repository = createCertificateRepository(() => {
    const database = memoryDatabase(fixtureData.data);
    return {
      collection(name) {
        const collection = database.collection(name),
          find = collection.find;
        collection.find = (...args) => {
          reads++;
          if (name !== "certificates")
            assert.deepEqual(args[1].projection, { _id: 1 });
          return find(...args);
        };
        return collection;
      },
    };
  });
  assert.equal((await repository.list(student, false, 1)).items[0].valid, true);
  assert.equal(reads, 3);
  fixtureData.data.events[0].status = "cancelled";
  assert.equal(
    (await repository.list(student, false, 1)).items[0].valid,
    false,
  );
});
test("issuance denies other owners, future/cancelled events and absent/cancelled registrations; failures roll back", async () => {
  for (const mutate of [
    (f) => {
      f.data.events[0].createdBy = id(9);
    },
    (f) => {
      f.data.events[0].startsAt = new Date("2200-01-01");
    },
    (f) => {
      f.data.events[0].status = "cancelled";
    },
    (f) => {
      f.data.eventRegistrations[0].attendance = "absent";
    },
    (f) => {
      f.data.eventRegistrations[0].status = "cancelled";
    },
    (f) => {
      f.state.fail = true;
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(f.certificates.issue(teacher, id(3), registrationId));
    assert.equal(f.data.certificates.length, 0);
    assert.equal(f.data.certificateVerification.length, 0);
    assert.equal(f.data.events[0].certificateTick, undefined);
  }
});
test("HTTP roles, origins and strict bodies protect showcase and certificate management", async () => {
  const f = fixture(),
    state = { role: "teacher" };
  const auth = {
    handler: async () => new Response("null"),
    api: {
      getSession: async ({ headers }) =>
        headers.get("cookie") === "fixture=valid"
          ? {
              user: { id: teacher.id },
              session: {
                userId: teacher.id,
                expiresAt: new Date(Date.now() + 60000),
              },
            }
          : null,
    },
  };
  const server = createApp(auth, {
    showcaseRepository: f.showcase,
    certificateRepository: f.certificates,
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
      (
        await send("manage/showcase", "POST", {
          ...content,
          image: "not-a-url",
        })
      ).status,
      400,
    );
    assert.equal(
      (await send("showcase", "GET", undefined, { Cookie: "" })).status,
      200,
    );
    assert.equal(
      (await send("own/certificates", "GET", undefined, { Cookie: "" })).status,
      401,
    );
    state.role = "student";
    assert.equal((await send("manage/showcase")).status, 403);
    assert.equal((await send("manage/certificates")).status, 403);
    state.role = "teacher";
    assert.equal(
      (
        await send("manage/showcase", "POST", {
          ...content,
          createdBy: "forged",
        })
      ).status,
      400,
    );
    assert.equal(
      (await send("manage/showcase", "POST", { ...content, kind: "gallery" }))
        .status,
      400,
    );
    assert.equal(
      (
        await send("manage/showcase", "POST", {
          ...content,
          occurredOn: "2200-01-01",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send("manage/certificates", "POST", {
          eventId: id(3),
          registrationId,
          recipientName: "forged",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send(
          "manage/certificates",
          "POST",
          { eventId: id(3), registrationId },
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    const response = await send("manage/certificates", "POST", {
      eventId: id(3),
      registrationId,
    });
    assert.equal(response.status, 200);
    const { certificate } = await response.json();
    const verified = await send(
      `certificates/verify/${certificate.verificationId}`,
      "GET",
      undefined,
      { Cookie: "" },
    );
    assert.equal(verified.status, 200);
    assert.doesNotMatch(
      await verified.text(),
      /recipientName|userId|Fictional Learner/,
    );
    assert.equal((await send("certificates/verify/invalid")).status, 400);
    assert.equal(
      (await send(`certificates/verify/${"f".repeat(64)}`)).status,
      404,
    );
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
