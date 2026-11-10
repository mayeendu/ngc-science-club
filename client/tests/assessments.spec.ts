import { expect, test, type Page } from "@playwright/test";
import { attemptStateSchema } from "../src/lib/assessment-api";
const id = "64b000000000000000000001";
async function fixture(
  page: Page,
  options: {
    role?: string;
    guest?: boolean;
    expired?: boolean;
    denied?: boolean;
    short?: boolean;
    failure?: number;
    empty?: boolean;
  } = {},
) {
  const quiz = {
    id,
    title: "Fictional physics",
    description: "A fictional practice quiz.",
    subject: "Physics",
    durationMinutes: 1,
    totalMarks: 7,
    questionCount: 2,
    closed: false,
    resultsReleased: false,
  };
  const questions = [
    {
      text: "First fictional question",
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      marks: 3,
    },
    {
      text: "Second fictional question",
      options: ["One", "Two", "Three", "Four"],
      marks: 4,
    },
  ];
  const state: {
    attempt: null | {
      status: "in_progress" | "submitted";
      answers: (number | null)[];
      revision: number;
      startedAt: string;
      deadlineAt: string;
      serverNow: string;
      submittedAt: string | null;
      questions: typeof questions;
      result: null | {
        score: number;
        percentage: number;
        submittedAt: string;
        review: ((typeof questions)[number] & {
          selectedOption: number | null;
          correctOption: number;
          earnedMarks: number;
          explanation: string;
        })[];
      };
    };
    calls: { method: string; path: string; body: unknown }[];
  } = { attempt: null, calls: [] };
  const headers = () => ({
    "access-control-allow-origin": new URL(page.url()).origin,
    "access-control-allow-credentials": "true",
  });
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers: headers(),
      json: options.guest
        ? null
        : {
            user: {
              id: "fixture",
              name: "Fictional Learner",
              email: "fiction@example.com",
              role: options.role ?? "student",
            },
            session: {
              id: "fixture",
              userId: "fixture",
              token: "fictional-only",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
    }),
  );
  await page.route("**/api/*/overview", (route) =>
    route.fulfill({
      status: options.expired ? 401 : 200,
      headers: headers(),
      json: { success: !options.expired, message: "Access granted" },
    }),
  );
  await page.route("**/api/student/assessments/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    state.calls.push({
      path,
      method,
      body: method === "GET" ? null : req.postDataJSON(),
    });
    const respond = (body: unknown, status = 200) =>
      route.fulfill({ status, headers: headers(), json: body });
    if (options.failure || options.denied)
      return respond({ success: false }, options.failure ?? 403);
    if (path.endsWith("/performance"))
      return respond({
        success: true,
        completed: 0,
        averagePercentage: 0,
        bestPercentage: 0,
        subjects: [],
        timeline: [],
      });
    if (path.endsWith("/results"))
      return respond({ success: true, items: [], page: 1, hasNext: false });
    if (path.endsWith("/quizzes"))
      return respond({
        success: true,
        quizzes: options.empty ? [] : [quiz],
        page: 1,
        hasNext: false,
      });
    const now = new Date().toISOString();
    if (path.endsWith("/start") && !state.attempt)
      state.attempt = {
        status: "in_progress",
        answers: [null, null],
        revision: 0,
        startedAt: now,
        deadlineAt: new Date(
          Date.now() + (options.short ? 1500 : 60000),
        ).toISOString(),
        serverNow: now,
        submittedAt: null,
        questions,
        result: null,
      };
    if (path.endsWith("/answers") && state.attempt) {
      const body = req.postDataJSON();
      state.attempt.answers = body.answers;
      state.attempt.revision++;
    }
    if (path.endsWith("/submit") && state.attempt) {
      const body = req.postDataJSON();
      if (body.answers) state.attempt.answers = body.answers;
      state.attempt.status = "submitted";
      state.attempt.questions = [];
      state.attempt.submittedAt = now;
      state.attempt.revision++;
    }
    if (state.attempt) state.attempt.serverNow = now;
    return respond({
      success: true,
      quiz,
      serverNow: now,
      attempt: state.attempt,
    });
  });
  return { state, quiz, questions };
}
test("catalog, instructions, navigation, autosave, refresh and held submission", async ({
  page,
}) => {
  const { state } = await fixture(page);
  await page.goto("/dashboard/student/quizzes");
  await page.getByRole("link", { name: "View quiz" }).click();
  await expect(
    page.getByRole("heading", { name: "Quiz instructions" }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("radio", { name: "Gamma", exact: true }).check();
  await expect.poll(() => state.attempt?.answers[0]).toBe(2);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("radio", { name: "One", exact: true }).check();
  await expect.poll(() => state.attempt?.answers[1]).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Gamma", exact: true }),
  ).toBeChecked();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit quiz", exact: true }).click();
  await expect(
    page.getByText("Results are awaiting teacher release."),
  ).toBeVisible();
  await expect(page.getByText("Correct answer:", { exact: false })).toHaveCount(
    0,
  );
  expect(
    state.calls
      .filter((c) => c.method !== "GET")
      .every((c) => !JSON.stringify(c.body).includes("userId")),
  ).toBe(true);
});
test("countdown automatically submits persisted answers with an empty body", async ({
  page,
}) => {
  const { state } = await fixture(page, { short: true });
  await page.goto(`/dashboard/student/quizzes/${id}`);
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Attempt submitted" }),
  ).toBeVisible();
  expect(state.calls.find((c) => c.path.endsWith("/submit"))?.body).toEqual({});
});
test("released review displays scores and explanations only after refresh", async ({
  page,
}) => {
  const { state, quiz, questions } = await fixture(page);
  await page.goto(`/dashboard/student/quizzes/${id}`);
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Submit quiz", exact: true }).click();
  await expect(
    page.getByText("Results are awaiting teacher release."),
  ).toBeVisible();
  quiz.closed = true;
  quiz.resultsReleased = true;
  state.attempt!.result = {
    score: 3,
    percentage: 42.86,
    submittedAt: new Date().toISOString(),
    review: questions.map((q, i) => ({
      ...q,
      selectedOption: i === 0 ? 2 : null,
      correctOption: i === 0 ? 2 : 0,
      earnedMarks: i === 0 ? 3 : 0,
      explanation: "Released fictional explanation",
    })),
  };
  await page.getByRole("button", { name: "Refresh result" }).click();
  await expect(page.getByText("Score: 3 / 7 (42.86%)")).toBeVisible();
  await expect(page.getByText("Released fictional explanation")).toHaveCount(2);
});
for (const role of ["teacher", "admin"])
  test(`${role} direct student URL is denied`, async ({ page }) => {
    await fixture(page, { role });
    await page.goto(`/dashboard/student/quizzes/${id}`);
    await expect(
      page.getByRole("heading", { name: /Access Denied/ }),
    ).toBeVisible();
  });
test("guest redirects to login", async ({ page }) => {
  await fixture(page, { guest: true });
  await page.goto("/dashboard/student/quizzes");
  await expect(page).toHaveURL(/\/login$/);
});
test("expired session redirects to login", async ({ page }) => {
  await fixture(page, { expired: true });
  await page.goto("/dashboard/student/results");
  await expect(page).toHaveURL(/\/login$/);
});
test("pending membership displays API denial", async ({ page }) => {
  await fixture(page, { denied: true });
  await page.goto("/dashboard/student/quizzes");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Approved membership",
  );
});
test("catalog errors and empty states", async ({ page }) => {
  await fixture(page, { empty: true });
  await page.goto("/dashboard/student/quizzes");
  await expect(
    page.getByText("No open published quizzes are available."),
  ).toBeVisible();
});
test("empty performance handles zero data", async ({ page }) => {
  await fixture(page);
  await page.goto("/dashboard/student/results");
  await expect(
    page.getByRole("heading", { name: "Released results" }),
  ).toBeVisible();
  await expect(page.getByText("0%")).toHaveCount(2);
});
test("client response validation refuses leaked answer keys in active questions", () => {
  const now = new Date().toISOString();
  expect(
    attemptStateSchema.safeParse({
      success: true,
      quiz: {
        id,
        title: "Quiz",
        description: "",
        subject: "Physics",
        durationMinutes: 1,
        totalMarks: 1,
        questionCount: 1,
        closed: false,
        resultsReleased: false,
      },
      serverNow: now,
      attempt: {
        status: "in_progress",
        answers: [null],
        revision: 0,
        startedAt: now,
        deadlineAt: now,
        serverNow: now,
        submittedAt: null,
        result: null,
        questions: [
          {
            text: "Question",
            options: ["A", "B", "C", "D"],
            marks: 1,
            correctOption: 2,
          },
        ],
      },
    }).success,
  ).toBe(false);
});
test("teacher report closes then releases with explicit confirmation", async ({
  page,
}) => {
  const { quiz } = await fixture(page, { role: "teacher" });
  const controls: string[] = [];
  await page.route("**/api/manage/quiz-assessments/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": new URL(page.url()).origin,
      "access-control-allow-credentials": "true",
    };
    if (route.request().method() === "POST") {
      controls.push(path);
      if (path.endsWith("/close")) quiz.closed = true;
      else quiz.resultsReleased = true;
      return route.fulfill({ headers, json: { success: true, quiz } });
    }
    return route.fulfill({
      headers,
      json: {
        success: true,
        quiz,
        participants: 0,
        submitted: 0,
        averageScore: 0,
        rankings: [],
        questions: [
          {
            question: 1,
            text: "Fictional question",
            correct: 0,
            incorrect: 0,
            unanswered: 0,
            accuracy: 0,
          },
        ],
        page: 1,
        hasNext: false,
      },
    });
  });
  await page.goto(`/dashboard/teacher/quizzes/${id}/results`);
  await expect(
    page.getByRole("button", { name: "Release results", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close quiz", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(controls).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Closed; results held")).toBeVisible();
  await page
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByText("Results released", { exact: true }),
  ).toBeVisible();
  expect(controls).toHaveLength(2);
});
