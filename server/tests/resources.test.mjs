import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { once } from "node:events";
import { Readable } from "node:stream";
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
  DB_NAME: "fictional_resources_only",
});
const { createResourceRepository } =
  await import("../src/modules/resources/resource.repository.ts");
const { validateResourceFile, MAX_RESOURCE_SIZE } =
  await import("../src/modules/resources/resource-files.ts");
const { createApp } = await import("../src/app.ts");
const teacher = { id: "64b000000000000000000001", role: "teacher" },
  student = { id: "64b000000000000000000002", role: "student" };
const input = {
    title: "Fictional physics note",
    description: "A fictional learning resource for testing.",
    category: "Physics",
    format: "pdf",
    url: "",
  },
  pdf = Buffer.from("%PDF-1.7\nfictional test data\n%%EOF");
function presentation(entries) {
  const locals = [],
    directory = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const filename = Buffer.from(name),
      data = Buffer.from(text);
    let checksum = 0xffffffff;
    for (const byte of data) {
      checksum ^= byte;
      for (let bit = 0; bit < 8; bit++)
        checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
    checksum = (checksum ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, filename, data);
    directory.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const index = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, index, end]);
}
test("PPTX directory recognizes presentation packages and rejects traversal/macro entries", () => {
  const entries = [
    [
      "[Content_Types].xml",
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ],
    [
      "ppt/presentation.xml",
      '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
    ],
  ];
  assert.match(
    validateResourceFile(presentation(entries), "lesson.pptx", "presentation")
      .mime,
    /presentationml/,
  );
  for (const name of ["../escape.xml", "ppt/vbaProject.bin"])
    assert.throws(
      () =>
        validateResourceFile(
          presentation([...entries, [name, "fictional"]]),
          "lesson.pptx",
          "presentation",
        ),
      (error) => error.statusCode === 400,
    );
});
function fixture() {
  const collections = {
      learningResources: [],
      membershipApplications: [{ _id: student.id, status: "approved" }],
    },
    files = new Map();
  const storage = {
    upload: async (bytes) => {
      const id = new ObjectId();
      files.set(String(id), bytes);
      return id;
    },
    remove: async (id) => {
      files.delete(String(id));
    },
    download: (id) => Readable.from([files.get(String(id))]),
  };
  const repository = createResourceRepository(
    () => memoryDatabase(collections),
    storage,
  );
  return { collections, files, storage, repository };
}
test("file validation checks signatures extensions size UTF-8 and bounded presentation directories", () => {
  assert.equal(
    validateResourceFile(pdf, "নোট.pdf", "pdf").mime,
    "application/pdf",
  );
  assert.equal(
    validateResourceFile(Buffer.from("Fictional note"), "notes.txt", "note")
      .mime,
    "text/plain; charset=utf-8",
  );
  for (const [bytes, name, format] of [
    [Buffer.from("fake"), "fake.pdf", "pdf"],
    [pdf, "../note.pdf", "pdf"],
    [pdf, "note.exe", "pdf"],
    [Buffer.alloc(MAX_RESOURCE_SIZE + 1), "big.pdf", "pdf"],
    [Buffer.from([0xff]), "bad.txt", "note"],
    [Buffer.from([0]), "bad.txt", "note"],
    [Buffer.from("PK"), "bad.pptx", "presentation"],
    [Buffer.alloc(30), "bad.pptx", "presentation"],
    [pdf, "note.pdf", "link"],
  ])
    assert.throws(
      () => validateResourceFile(bytes, name, format),
      (error) => error.statusCode === 400,
    );
});
test("draft upload publish browsing search and private downloads preserve ownership", async () => {
  const { repository, files } = fixture();
  const row = await repository.create(teacher, input);
  await assert.rejects(repository.publish(teacher, row.id, 1, true), {
    statusCode: 409,
  });
  await assert.rejects(
    repository.upload({ ...teacher, id: "other" }, row.id, 1, "note.pdf", pdf),
    { statusCode: 409 },
  );
  assert.equal(files.size, 0);
  const uploaded = await repository.upload(teacher, row.id, 1, "note.pdf", pdf);
  assert.equal(uploaded.version, 2);
  assert.equal(files.size, 1);
  const published = await repository.publish(teacher, row.id, 2, true);
  assert.equal(published.published, true);
  await assert.rejects(repository.update(teacher, row.id, input, 3), {
    statusCode: 409,
  });
  const list = await repository.list(student, false, {
    page: 1,
    q: "physics",
    category: "Physics",
  });
  assert.equal(list.items.length, 1);
  assert.doesNotMatch(
    JSON.stringify(list),
    /createdBy|sha256|version|published/,
  );
  assert.deepEqual(
    (await repository.list(student, false, { page: 1, q: ".*" })).items,
    [],
  );
  const download = await repository.download(student, false, row.id);
  const parts = [];
  for await (const part of download.stream) parts.push(part);
  assert.deepEqual(Buffer.concat(parts), pdf);
  await repository.remove({ id: "admin", role: "admin" }, row.id, 3);
  await assert.rejects(repository.download(student, false, row.id), {
    statusCode: 404,
  });
});
test("membership and stale/concurrent uploads fail closed and clean unlinked files", async () => {
  const { repository, storage, files, collections } = fixture();
  const row = await repository.create(teacher, input);
  collections.membershipApplications[0].status = "pending";
  await assert.rejects(repository.list(student, false, { page: 1, q: "" }), {
    statusCode: 403,
  });
  await assert.rejects(repository.download(student, false, row.id), {
    statusCode: 403,
  });
  const original = storage.upload;
  storage.upload = async (bytes) => {
    const id = await original(bytes);
    collections.learningResources[0].version++;
    return id;
  };
  await assert.rejects(repository.upload(teacher, row.id, 1, "note.pdf", pdf), {
    statusCode: 409,
  });
  assert.equal(files.size, 0);
  storage.upload = original;
  const first = await repository.upload(teacher, row.id, 2, "first.pdf", pdf);
  await repository.upload(teacher, row.id, first.version, "second.pdf", pdf);
  assert.equal(files.size, 1);
});
test("HTTP validates roles origins binary limits IDs and forged metadata", async () => {
  const { repository, files } = fixture(),
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
    resourceRepository: repository,
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
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
    });
  try {
    assert.equal(
      (
        await send("manage/resources", "POST", {
          ...input,
          format: "link",
          url: "not-a-url",
        })
      ).status,
      400,
    );
    assert.equal(
      (await send("resources", "GET", undefined, { Cookie: "" })).status,
      401,
    );
    state.role = "student";
    assert.equal((await send("manage/resources")).status, 403);
    state.role = "teacher";
    assert.equal(
      (
        await send("manage/resources", "POST", {
          ...input,
          createdBy: "forged",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send("manage/resources", "POST", input, {
          Origin: "https://evil.example",
        })
      ).status,
      403,
    );
    const response = await send("manage/resources", "POST", input);
    assert.equal(response.status, 201);
    const { resource } = await response.json();
    const headers = {
      "Content-Type": "application/octet-stream",
      "X-File-Name": "note.pdf",
      "X-Resource-Version": "1",
    };
    assert.equal(
      (
        await send(
          `manage/resources/${resource.id}/file`,
          "POST",
          Buffer.alloc(MAX_RESOURCE_SIZE + 1),
          headers,
        )
      ).status,
      413,
    );
    assert.equal(files.size, 0);
    assert.equal(
      (await send(`manage/resources/${resource.id}/file`, "POST", pdf, headers))
        .status,
      200,
    );
    assert.equal((await send("resources?userId=other")).status, 400);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
