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
  DB_NAME: "fictional_assessments_memory_only",
});
const { createAssessmentRepository, gradingPipeline } =
  await import("../src/modules/assessments/assessment.repository.ts");
const { createApp } = await import("../src/app.ts");
const { createQuizRepository } =
  await import("../src/modules/quizzes/quiz.repository.ts");
const id = "64b000000000000000000001",
  owner = { id: "teacher", role: "teacher" };
const clone = (v) =>
  v instanceof ObjectId
    ? new ObjectId(v)
    : v instanceof Date
      ? new Date(v)
      : Array.isArray(v)
        ? v.map(clone)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]))
          : v;
const equal = (a, b) =>
  a instanceof ObjectId ? a.equals(b) : a instanceof Date ? +a === +b : a === b;
// Evaluate the Mongo expressions actually emitted by production grading updates.
function expression(v, row, now, vars = {}) {
  if (
    v instanceof Date ||
    v instanceof ObjectId ||
    v === null ||
    (typeof v !== "object" && typeof v !== "string")
  )
    return v;
  if (typeof v === "string")
    return v === "$$NOW"
      ? now
      : v.startsWith("$$")
        ? vars[v.slice(2)]
        : v.startsWith("$")
          ? row[v.slice(1)]
          : v;
  if (Array.isArray(v)) return v.map((x) => expression(x, row, now, vars));
  const [op, arg] = Object.entries(v)[0],
    ev = (x) => expression(x, row, now, vars);
  if (op === "$literal") return arg;
  if (op === "$map")
    return ev(arg.input).map((x) =>
      expression(arg.in, row, now, { ...vars, [arg.as]: x }),
    );
  if (op === "$cond") return ev(arg[0]) ? ev(arg[1]) : ev(arg[2]);
  const a = Array.isArray(arg) ? arg.map(ev) : ev(arg);
  switch (op) {
    case "$eq":
      return equal(a[0], a[1]);
    case "$ne":
      return !equal(a[0], a[1]);
    case "$lte":
      return a[0] <= a[1];
    case "$gt":
      return a[0] > a[1];
    case "$ifNull":
      return a[0] ?? a[1];
    case "$add":
      return a.reduce((s, x) => s + x, 0);
    case "$sum":
      return a.reduce((s, x) => s + x, 0);
    case "$range":
      return Array.from({ length: a[1] - a[0] }, (_, i) => a[0] + i);
    case "$arrayElemAt":
      return a[0][a[1]];
    case "$min":
      return a.reduce((x, y) => (x < y ? x : y));
    case "$multiply":
      return a[0] * a[1];
    case "$divide":
      return a[0] / a[1];
    case "$round":
      return Math.round(a[0] * 10 ** a[1]) / 10 ** a[1];
    default:
      throw new Error(`Unsupported test expression ${op}`);
  }
}
function fixture() {
  const state = {
    now: new Date("2026-11-01T10:00:00Z"),
    role: "student",
    user: "student",
    approved: true,
    fail: false,
    session: true,
    expired: false,
    aggregateCalls: [],
    aggregateResult: null,
  };
  const rows = {
    quizzes: [
      {
        _id: new ObjectId(id),
        createdBy: "teacher",
        status: "published",
        title: "Fictional physics",
        description: "A fictional quiz",
        subject: "Physics",
        durationMinutes: 1,
        totalMarks: 7,
        questionCount: 2,
        version: 1,
        createdAt: state.now,
        updatedAt: state.now,
        questions: [
          {
            text: "First question",
            options: ["A", "B", "C", "D"],
            correctOption: 2,
            marks: 3,
            explanation: "PRIVATE_EXPLANATION",
          },
          {
            text: "Second question",
            options: ["A", "B", "C", "D"],
            correctOption: 0,
            marks: 4,
          },
        ],
      },
    ],
    quizAttempts: [],
  };
  function matches(row, f) {
    return Object.entries(f).every(([k, v]) =>
      k === "$expr"
        ? expression(v, row, state.now)
        : v &&
            typeof v === "object" &&
            !(v instanceof Date) &&
            !(v instanceof ObjectId)
          ? Object.entries(v).every(([op, x]) =>
              op === "$exists"
                ? k in row === x
                : op === "$ne"
                  ? !equal(row[k], x)
                  : op === "$lte"
                    ? row[k] <= x
                    : op === "$gt"
                      ? row[k] > x
                      : false,
            )
          : equal(row[k], v),
    );
  }
  function update(row, u) {
    if (Array.isArray(u)) {
      for (const stage of u) {
        const values = Object.fromEntries(
          Object.entries(stage.$set).map(([k, v]) => [
            k,
            expression(v, row, state.now),
          ]),
        );
        Object.assign(row, values);
      }
    } else {
      Object.assign(row, clone(u.$set ?? {}));
      for (const [k, v] of Object.entries(u.$inc ?? {}))
        row[k] = (row[k] ?? 0) + v;
    }
  }
  const db = {
    collection(name) {
      if (state.fail) throw new Error("PRIVATE_DATABASE_ERROR");
      if (name === "membershipApplications")
        return {
          findOne: async (f) =>
            state.approved && f._id === state.user
              ? { fullName: "Fictional Student" }
              : null,
        };
      const all = () => rows[name];
      return {
        async findOne(f) {
          return clone(all().find((r) => matches(r, f)) ?? null);
        },
        async findOneAndUpdate(f, u) {
          const row = all().find((r) => matches(r, f));
          if (!row) return null;
          update(row, u);
          return clone(row);
        },
        async updateOne(f, u) {
          const row = all().find((r) => matches(r, f));
          if (row) update(row, u);
          return { matchedCount: row ? 1 : 0 };
        },
        async updateMany(f, u) {
          for (const row of all().filter((r) => matches(r, f))) update(row, u);
        },
        async insertOne(row) {
          assert.ok(
            !all().some((r) => equal(r._id, row._id)),
            "duplicate attempt",
          );
          all().push(clone(row));
        },
        find(f) {
          let skip = 0,
            limit = Infinity;
          const cursor = {
            sort() {
              return cursor;
            },
            skip(n) {
              skip = n;
              return cursor;
            },
            limit(n) {
              limit = n;
              return cursor;
            },
            async toArray() {
              return all()
                .filter((r) => matches(r, f))
                .slice(skip, skip + limit)
                .map(clone);
            },
          };
          return cursor;
        },
        aggregate(pipeline) {
          state.aggregateCalls.push(pipeline);
          return {
            async toArray() {
              if (state.aggregateResult) return [state.aggregateResult];
              return [
                {
                  summary: [],
                  subjects: [],
                  timeline: [],
                  totals: [],
                  rankings: [],
                  questions: [],
                },
              ];
            },
          };
        },
      };
    },
  };
  let queue = Promise.resolve();
  const run = (work) => {
    const next = queue.then(async () => {
      const before = clone(rows);
      try {
        return await work(db);
      } catch (e) {
        Object.assign(rows, before);
        throw e;
      }
    });
    queue = next.catch(() => {});
    return next;
  };
  return {
    state,
    rows,
    db,
    repo: createAssessmentRepository(run, () => db),
    quizRepo: createQuizRepository(() => db),
  };
}
const rejects = (p, status) =>
  assert.rejects(p, (e) => e.statusCode === status);
test("start is idempotent and concurrent starts create one attempt with server deadline", async () => {
  const { repo, rows, state } = fixture();
  const results = await Promise.all([
    repo.start(id, "student"),
    repo.start(id, "student"),
  ]);
  assert.equal(rows.quizAttempts.length, 1);
  assert.equal(results[0].attempt.deadlineAt, "2026-11-01T10:01:00.000Z");
  state.now = new Date(+state.now + 20000);
  assert.equal(
    (await repo.start(id, "student")).attempt.startedAt,
    results[0].attempt.startedAt,
  );
  assert.equal(rows.quizzes[0].hasAttempts, true);
});
test("student responses exclude keys, explanations, scores and private identity before release", async () => {
  const { repo } = fixture();
  for (const result of [
    await repo.read(id, "student"),
    await repo.start(id, "student"),
    await repo.submit(id, "student", { revision: 0, answers: [2, 0] }),
  ]) {
    const text = JSON.stringify(result);
    for (const field of [
      "correctOption",
      "PRIVATE_EXPLANATION",
      "studentName",
      "userId",
      "score",
    ])
      assert.ok(!text.includes(field));
  }
  assert.equal((await repo.history("student", 1)).items[0].score, null);
});
test("autosave uses revision compare-and-set and never accepts another account's attempt", async () => {
  const { repo, state, rows } = fixture();
  await repo.start(id, "student");
  await repo.save(id, "student", { revision: 0, answers: [2, null] });
  await rejects(
    repo.save(id, "student", { revision: 0, answers: [0, 0] }),
    409,
  );
  await rejects(repo.save(id, "student", { revision: 1, answers: [0] }), 400);
  state.user = "other";
  await rejects(repo.submit(id, "other"), 404);
  assert.deepEqual(rows.quizAttempts[0].answers, [2, null]);
});
test("deadline settles persisted answers; late replacement is ignored", async () => {
  const { repo, state, rows } = fixture();
  await repo.start(id, "student");
  await repo.save(id, "student", { revision: 0, answers: [2, null] });
  state.now = new Date("2026-11-01T10:01:00Z");
  const late = await repo.submit(id, "student", {
    revision: 1,
    answers: [2, 0],
  });
  assert.equal(late.attempt.status, "submitted");
  assert.equal(late.attempt.result, null);
  assert.equal(rows.quizAttempts[0].score, 3);
  assert.equal(rows.quizAttempts[0].percentage, 42.86);
  assert.equal(rows.quizAttempts[0].reason, "expired");
  assert.deepEqual(rows.quizAttempts[0].answers, [2, null]);
});
test("duplicate concurrent submissions score once and preserve original answers", async () => {
  const { repo, rows } = fixture();
  await repo.start(id, "student");
  await Promise.all([
    repo.submit(id, "student", { revision: 0, answers: [2, 0] }),
    repo.submit(id, "student", { revision: 0, answers: [0, 1] }),
  ]);
  assert.equal(rows.quizAttempts[0].score, 7);
  assert.equal(rows.quizAttempts[0].revision, 2);
});
test("close settles attempts, blocks new starts and permits explicit one-way release", async () => {
  const { repo, rows, state } = fixture();
  await repo.start(id, "student");
  await repo.save(id, "student", { revision: 0, answers: [null, 0] });
  await rejects(repo.control(id, owner, "release"), 409);
  await repo.control(id, owner, "close");
  assert.equal(rows.quizAttempts[0].reason, "closed");
  state.user = "new";
  await rejects(repo.start(id, "new"), 409);
  state.user = "student";
  assert.equal((await repo.read(id, "student")).attempt.result, null);
  await repo.control(id, owner, "release");
  const result = (await repo.read(id, "student")).attempt.result;
  assert.equal(result.score, 4);
  assert.equal(result.review[0].explanation, "PRIVATE_EXPLANATION");
  assert.equal(result.review[0].correctOption, 2);
  assert.equal((await repo.history("student", 1)).items[0].score, 4);
});
test("teacher ownership is enforced; admins can close another teacher quiz", async () => {
  const { repo } = fixture();
  await rejects(
    repo.control(id, { id: "other", role: "teacher" }, "close"),
    404,
  );
  await rejects(repo.staff(id, { id: "other", role: "teacher" }, 1), 404);
  await repo.control(id, { id: "admin", role: "admin" }, "close");
});
test("pending members cannot list, start, read history or performance", async () => {
  const { repo, state } = fixture();
  state.approved = false;
  for (const p of [
    repo.catalog("student", 1),
    repo.start(id, "student"),
    repo.history("student", 1),
    repo.performance("student"),
  ])
    await rejects(p, 403);
});
test("expiry sweep grades saved answers even without browser submission", async () => {
  const { repo, state, rows } = fixture();
  await repo.start(id, "student");
  state.now = new Date("2026-11-01T10:02:00Z");
  await repo.expireDue();
  assert.equal(rows.quizAttempts[0].status, "submitted");
  assert.equal(rows.quizAttempts[0].score, 0);
  assert.equal(
    rows.quizAttempts[0].submittedAt.toISOString(),
    "2026-11-01T10:01:00.000Z",
  );
});
test("published quizzes with attempts cannot be unpublished or edited", async () => {
  const { repo, quizRepo, rows } = fixture();
  await repo.start(id, "student");
  const before = clone(rows.quizzes[0]);
  await rejects(quizRepo.setStatus(id, owner, 1, "draft"), 409);
  assert.deepEqual(rows.quizzes[0], before);
});
test("analytics empty states stay finite and performance pipeline filters current user and released results", async () => {
  const { repo, state } = fixture();
  const result = await repo.performance("student");
  assert.equal(result.completed, 0);
  assert.equal(result.averagePercentage, 0);
  assert.deepEqual(state.aggregateCalls[0][0], {
    $match: { userId: "student", status: "submitted" },
  });
  assert.ok(
    JSON.stringify(state.aggregateCalls[0]).includes("$resultsReleasedAt"),
  );
  assert.ok(JSON.stringify(state.aggregateCalls[0]).includes("releasedQuiz.0"));
  const report = await repo.staff(id, owner, 1);
  assert.equal(report.averageScore, 0);
  assert.equal(report.questions[0].accuracy, 0);
  assert.ok(JSON.stringify(state.aggregateCalls[1]).includes("$rank"));
});
test("report maps bounded rankings and question counts without leaking private aggregate fields", async () => {
  const { repo, state } = fixture();
  state.aggregateResult = {
    totals: [{ participants: 3, submitted: 2, average: 5.5 }],
    rankings: [
      {
        studentName: "Fictional Student",
        score: 7,
        percentage: 100,
        rank: 1,
        submittedAt: state.now,
        email: "PRIVATE_EMAIL",
      },
      {
        studentName: "Fictional Other",
        score: 4,
        percentage: 57.14,
        rank: 2,
        submittedAt: state.now,
      },
    ],
    questions: [
      { _id: 0, total: 2, answered: 1, correct: 1 },
      { _id: 1, total: 2, answered: 2, correct: 2 },
    ],
  };
  const report = await repo.staff(id, owner, 1);
  assert.equal(report.participants, 3);
  assert.equal(report.averageScore, 5.5);
  assert.deepEqual(report.questions[0], {
    question: 1,
    text: "First question",
    correct: 1,
    incorrect: 0,
    unanswered: 1,
    accuracy: 50,
  });
  assert.equal(report.questions[1].accuracy, 100);
  assert.equal(report.rankings[0].rank, 1);
  assert.ok(!JSON.stringify(report).includes("PRIVATE_EMAIL"));
});
test("performance maps released aggregate averages and timeline safely", async () => {
  const { repo, state } = fixture();
  state.aggregateResult = {
    summary: [{ count: 2, average: 71.4285, best: 100 }],
    subjects: [{ _id: "Physics", count: 2, average: 71.4285 }],
    timeline: [
      { title: "Fictional physics", percentage: 100, submittedAt: state.now },
    ],
  };
  const result = await repo.performance("student");
  assert.equal(result.completed, 2);
  assert.equal(result.averagePercentage, 71.43);
  assert.equal(result.subjects[0].averagePercentage, 71.43);
  assert.equal(result.timeline[0].submittedAt, state.now.toISOString());
});
test("close racing a final save cannot change a finalized attempt", async () => {
  const { repo, rows } = fixture();
  await repo.start(id, "student");
  await Promise.all([
    repo.control(id, owner, "close"),
    repo.save(id, "student", { revision: 0, answers: [2, 0] }),
  ]);
  assert.equal(rows.quizAttempts[0].score, 0);
  assert.deepEqual(rows.quizAttempts[0].answers, [null, null]);
});
test("close racing a start either settles that attempt or blocks the start", async () => {
  const { repo, rows } = fixture();
  await Promise.all([
    repo.start(id, "student"),
    repo.control(id, owner, "close"),
  ]);
  assert.equal(rows.quizAttempts.length, 1);
  assert.equal(rows.quizAttempts[0].status, "submitted");
  assert.equal(rows.quizAttempts[0].reason, "closed");
});
test("grading handles incorrect, unanswered and zero-total safely", () => {
  const quiz = fixture().rows.quizzes[0];
  quiz.assessmentNow = new Date();
  const row = {
    answers: [1, null],
    deadlineAt: new Date(Date.now() + 10000),
    revision: 0,
  };
  for (const stage of gradingPipeline(quiz))
    Object.assign(
      row,
      Object.fromEntries(
        Object.entries(stage.$set).map(([k, v]) => [
          k,
          expression(v, row, quiz.assessmentNow),
        ]),
      ),
    );
  assert.equal(row.score, 0);
  assert.equal(row.percentage, 0);
  quiz.totalMarks = 0;
  assert.equal(gradingPipeline(quiz)[1].$set.percentage, 0);
});
test("HTTP authorization, forged fields, origin and safe database failures", async () => {
  const { repo, state } = fixture();
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
    assessmentRepository: repo,
    lookupAuthorizationUser: async () => ({ role: state.role, banned: false }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const send = (path, method = "GET", body, origin = "http://localhost:3000") =>
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
    const student = `/student/assessments/quizzes/${id}`;
    state.session = false;
    assert.equal((await send(student)).status, 401);
    state.session = true;
    state.expired = true;
    assert.equal((await send(student)).status, 401);
    state.expired = false;
    assert.equal((await send(`/manage/quiz-assessments/${id}`)).status, 403);
    for (const body of [
      { role: "admin" },
      { userId: "other" },
      { score: 7 },
      { deadlineAt: "2099-01-01" },
    ])
      assert.equal((await send(student + "/start", "POST", body)).status, 400);
    assert.equal(
      (await send(student + "/start", "POST", {}, "https://evil.example"))
        .status,
      403,
    );
    assert.equal((await send(student + "/start", "POST", {})).status, 200);
    assert.equal(
      (
        await send(student + "/answers", "PUT", {
          revision: 0,
          answers: [4, null],
        })
      ).status,
      400,
    );
    state.role = "teacher";
    assert.equal((await send(student)).status, 403);
    state.role = "student";
    state.fail = true;
    const response = await send(student);
    assert.equal(response.status, 500);
    assert.ok(
      !JSON.stringify(await response.json()).includes("PRIVATE_DATABASE_ERROR"),
    );
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
