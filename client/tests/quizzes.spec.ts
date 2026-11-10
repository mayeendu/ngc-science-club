import { expect, test, type Page } from "@playwright/test";
import { z } from "zod";
import {
  quizFormSchema,
  type QuizDetail,
  type QuizSummary,
} from "../src/lib/quiz-api";
function seedQuiz(index = 1): QuizDetail {
  return {
    id: index.toString(16).padStart(24, "0"),
    title: `Fictional science quiz ${index}`,
    description: "Explore fictional science questions.",
    subject: "Physics",
    durationMinutes: 30,
    totalMarks: 2,
    questionCount: 1,
    status: "draft",
    version: 1,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    questions: [
      {
        text: "Which fictional option is correct?",
        options: ["First", "Second", "PRIVATE_ANSWER", "Fourth"],
        correctOption: 2,
        marks: 2,
      },
    ],
  };
}
function summary(q: QuizDetail): QuizSummary {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    subject: q.subject,
    durationMinutes: q.durationMinutes,
    totalMarks: q.totalMarks,
    questionCount: q.questionCount,
    status: q.status,
    version: q.version,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}
type Fixture = {
  role?: string;
  guest?: boolean;
  quizzes: QuizDetail[];
  failure?: number;
  saveFailure?: number;
  requests?: { method: string; body: unknown }[];
  calls?: number;
};
async function mockQuizzes(page: Page, fixture: Fixture) {
  const headers = () => ({
    "access-control-allow-origin": new URL(page.url()).origin,
    "access-control-allow-credentials": "true",
  });
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      status: 200,
      headers: headers(),
      contentType: "application/json",
      body: JSON.stringify(
        fixture.guest
          ? null
          : {
              user: {
                id: "64b000000000000000000001",
                name: "Fictional Teacher",
                email: "fixture@example.com",
                role: fixture.role ?? "teacher",
              },
              session: {
                id: "fixture",
                userId: "64b000000000000000000001",
                token: "fictional-fixture-only",
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
      ),
    }),
  );
  await page.route("**/api/teacher/overview", (route) =>
    route.fulfill({
      status: 200,
      headers: headers(),
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Access granted" }),
    }),
  );
  await page.route("**/api/manage/quizzes**", async (route) => {
    fixture.calls = (fixture.calls ?? 0) + 1;
    const url = new URL(route.request().url()),
      method = route.request().method();
    const path = url.pathname
      .replace("/api/manage/quizzes", "")
      .split("/")
      .filter(Boolean);
    const row = fixture.quizzes.find((q) => q.id === path[0]);
    const respond = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: headers(),
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (fixture.failure) return respond(fixture.failure, { success: false });
    if (method === "GET") {
      if (path.length)
        return respond(
          row ? 200 : 404,
          row ? { success: true, quiz: row } : { success: false },
        );
      const current = Number(url.searchParams.get("page") ?? 1),
        filtered = fixture.quizzes.filter(
          (q) =>
            !url.searchParams.get("status") ||
            q.status === url.searchParams.get("status"),
        );
      return respond(200, {
        success: true,
        quizzes: filtered.slice((current - 1) * 10, current * 10).map(summary),
        page: current,
        hasNext: filtered.length > current * 10,
      });
    }
    const body: unknown = route.request().postDataJSON();
    fixture.requests?.push({ method, body });
    if (fixture.saveFailure)
      return respond(fixture.saveFailure, { success: false });
    if (method === "POST") {
      const input = quizFormSchema.parse(body);
      const id = (fixture.quizzes.length + 100).toString(16).padStart(24, "0");
      const quiz = {
        ...seedQuiz(),
        ...input,
        id,
        totalMarks: input.questions.reduce((sum, q) => sum + q.marks, 0),
        questionCount: input.questions.length,
      };
      fixture.quizzes.push(quiz);
      return respond(201, { success: true, quiz });
    }
    if (!row) return respond(404, { success: false });
    const version = z.object({ version: z.number() }).parse(body).version;
    if (version !== row.version) return respond(409, { success: false });
    if (path[1] === "status") {
      const status = z
        .object({ status: z.enum(["draft", "published"]) })
        .parse(body).status;
      if (status === "published" && row.questions.length === 0)
        return respond(400, { success: false });
      row.status = status;
      row.version++;
      return respond(200, { success: true, quiz: summary(row) });
    }
    if (row.status !== "draft") return respond(409, { success: false });
    if (method === "DELETE") {
      fixture.quizzes = fixture.quizzes.filter((q) => q.id !== row.id);
      return route.fulfill({ status: 204, headers: headers() });
    }
    const input = quizFormSchema.parse(
      z
        .object({
          title: z.string(),
          description: z.string(),
          subject: z.string(),
          durationMinutes: z.number(),
          questions: quizFormSchema.shape.questions,
        })
        .parse(body),
    );
    Object.assign(row, input, {
      totalMarks: input.questions.reduce((sum, q) => sum + q.marks, 0),
      questionCount: input.questions.length,
      version: row.version + 1,
    });
    return respond(200, { success: true, quiz: row });
  });
}
async function metadata(page: Page) {
  await page
    .getByLabel("Quiz title", { exact: true })
    .fill("New fictional science quiz");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Explore science with fictional questions.");
  await page.getByLabel("Subject", { exact: true }).fill("Physics");
}
async function fillQuestion(page: Page, index: number) {
  await page
    .getByLabel(`Question ${index} text`, { exact: true })
    .fill("Which fictional option is correct?");
  for (let i = 1; i <= 4; i++)
    await page
      .getByLabel(`Question ${index} option ${i}`, { exact: true })
      .fill(`Option value ${i}`);
  await page
    .getByLabel(`Question ${index} correct answer`, { exact: true })
    .selectOption("2");
  await page.getByLabel(`Question ${index} marks`, { exact: true }).fill("2");
}
async function confirm(page: Page, button: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
}

test("teacher dynamic editor creates edits publishes unpublishes and deletes a quiz", async ({
  page,
}) => {
  const fixture: Fixture = { quizzes: [], requests: [] };
  await mockQuizzes(page, fixture);
  await page.goto("/dashboard/teacher");
  await page
    .getByRole("link", { name: "Manage science quizzes", exact: true })
    .click();
  await page.getByRole("button", { name: "New quiz", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect(fixture.requests).toHaveLength(0);
  await metadata(page);
  await fillQuestion(page, 1);
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await fillQuestion(page, 2);
  await expect(
    page.getByLabel("Total marks (calculated)", { exact: true }),
  ).toHaveValue("4");
  await page
    .getByRole("button", { name: "Remove question 2", exact: true })
    .click();
  await expect(
    page.getByLabel("Total marks (calculated)", { exact: true }),
  ).toHaveValue("2");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Managed science quizzes", exact: true }),
  ).toContainText("New fictional science quiz");
  expect(Object.keys(fixture.requests![0].body as object).sort()).toEqual([
    "description",
    "durationMinutes",
    "questions",
    "subject",
    "title",
  ]);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel action", exact: true })
    .click();
  expect(fixture.requests).toHaveLength(1);
  await confirm(page, "Publish");
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeDisabled();
  await confirm(page, "Unpublish");
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Quiz title", { exact: true })).toHaveValue(
    "New fictional science quiz",
  );
  await page
    .getByLabel("Quiz title", { exact: true })
    .fill("Revised fictional science quiz");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("table")).toContainText(
    "Revised fictional science quiz",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await confirm(page, "Delete");
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "No quizzes on this page.",
  );
  expect(fixture.requests).toHaveLength(5);
});

test("duplicate option validation is accessible and empty drafts cannot publish", async ({
  page,
}) => {
  const fixture: Fixture = { quizzes: [], requests: [] };
  await mockQuizzes(page, fixture);
  await page.goto("/dashboard/teacher/quizzes");
  await page.getByRole("button", { name: "New quiz", exact: true }).click();
  await metadata(page);
  await fillQuestion(page, 1);
  await page
    .getByLabel("Question 1 option 4", { exact: true })
    .fill("Option value 1");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Provide four distinct options.", { exact: true }),
  ).toBeVisible();
  expect(fixture.requests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Remove question 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeVisible();
  await confirm(page, "Publish");
  await expect(
    page.getByText(
      "Invalid quiz. Check all fields and include a complete MCQ before publishing.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeVisible();
});

test("admin can manage quizzes through the teacher route", async ({ page }) => {
  await mockQuizzes(page, { role: "admin", quizzes: [seedQuiz()] });
  await page.goto("/dashboard/teacher/quizzes");
  await expect(page.getByRole("table")).toContainText(
    "Fictional science quiz 1",
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByLabel("Question 1 option 3", { exact: true }),
  ).toHaveValue("PRIVATE_ANSWER");
});

test("guest and student cannot access quiz management or fetch answer keys", async ({
  page,
}) => {
  const fixture: Fixture = { guest: true, quizzes: [seedQuiz()], calls: 0 };
  await mockQuizzes(page, fixture);
  await page.goto("/dashboard/teacher/quizzes");
  await expect(page).toHaveURL(/\/login$/);
  expect(fixture.calls).toBe(0);
  fixture.guest = false;
  fixture.role = "student";
  await page.goto("/dashboard/teacher/quizzes");
  await expect(
    page.getByRole("heading", { name: "Access Denied", exact: true }),
  ).toBeVisible();
  expect(fixture.calls).toBe(0);
  await expect(page.getByRole("main")).not.toContainText("PRIVATE_ANSWER");
});

test("staff quiz filters pagination and failed list support refresh", async ({
  page,
}) => {
  const rows = Array.from({ length: 13 }, (_, i) => seedQuiz(i + 1));
  rows[0].status = "published";
  const fixture: Fixture = { quizzes: rows, failure: 500 };
  await mockQuizzes(page, fixture);
  await page.goto("/dashboard/teacher/quizzes");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Unable to manage quizzes.",
  );
  fixture.failure = undefined;
  await page
    .getByRole("button", { name: "Refresh quizzes", exact: true })
    .click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(11);
  await page.getByRole("button", { name: "Next quizzes", exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
  await page
    .getByLabel("Quiz status", { exact: true })
    .selectOption("published");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeDisabled();
});

test("stale edit conflicts refresh and expired API access redirects", async ({
  page,
}) => {
  const fixture: Fixture = { quizzes: [seedQuiz()] };
  await mockQuizzes(page, fixture);
  await page.goto("/dashboard/teacher/quizzes");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Quiz title", { exact: true })).toBeVisible();
  fixture.saveFailure = 409;
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByText(
      "Quiz changed or is published. Refresh; unpublish before editing or deleting.",
      { exact: true },
    ),
  ).toBeVisible();
  fixture.failure = 401;
  await page
    .getByRole("button", { name: "Refresh quizzes", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});
