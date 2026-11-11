import { expect, test, type Page } from "@playwright/test";

async function mock(
  page: Page,
  options: {
    role?: string;
    failure?: number;
    empty?: boolean;
    calls?: string[];
  } = {},
) {
  const role = options.role ?? "student";
  const headers = {
    "access-control-allow-origin": "http://localhost:3100",
    "access-control-allow-credentials": "true",
  };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers,
      json: {
        user: {
          id: "fictional",
          name: "Fictional Member",
          email: "fixture@example.com",
          emailVerified: true,
          role,
        },
        session: {
          id: "fixture",
          userId: "fictional",
          token: "fictional-only",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      },
    }),
  );
  await page.route("**/api/*/overview", (route) =>
    route.fulfill({
      headers,
      json: { success: true, message: "Access granted" },
    }),
  );
  await page.route("**/api/*/performance?*", (route) => {
    options.calls?.push(route.request().url());
    return route.fulfill({
      headers,
      status: options.failure ?? 200,
      json: options.failure
        ? { success: false }
        : {
            success: true,
            range: { from: "2026-01-01", to: "2026-01-31" },
            completed: options.empty ? 0 : 2,
            averagePercentage: options.empty ? 0 : 75,
            bestPercentage: options.empty ? 0 : 90,
            page: 1,
            quizzesHasNext: false,
            rankingsHasNext: false,
            historyHasNext: false,
            quizzes: options.empty
              ? []
              : [
                  {
                    quizId: "fictional-quiz",
                    title: "Fictional Physics",
                    subject: "Physics",
                    completed: 2,
                    averagePercentage: 75,
                  },
                ],
            timeline: options.empty
              ? []
              : [{ month: "2026-01", completed: 2, averagePercentage: 75 }],
            history:
              role === "student" && !options.empty
                ? [
                    {
                      quizId: "fictional-quiz",
                      title: "Fictional Physics",
                      subject: "Physics",
                      submittedAt: "2026-01-02T12:00:00Z",
                      score: 9,
                      totalMarks: 10,
                      percentage: 90,
                    },
                  ]
                : [],
            rankings:
              role !== "student" && !options.empty
                ? [
                    {
                      name: "Fictional Student",
                      completed: 2,
                      averagePercentage: 75,
                      rank: 1,
                    },
                  ]
                : [],
          },
    });
  });
}
test("own analytics charts, scores, filters and participation links", async ({
  page,
}) => {
  const calls: string[] = [];
  await mock(page, { calls });
  await page.goto("/dashboard/student/performance");
  await expect(
    page.getByRole("heading", { name: "My performance", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Monthly average percentage chart" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "9 / 10" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Student rankings" }),
  ).toHaveCount(0);
  await page.getByLabel("From (UTC)").fill("2026-01-01");
  await page.getByLabel("To (UTC)").fill("2026-01-31");
  await page.getByLabel("Subject (exact match)").fill("Physics");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect.poll(() => calls.at(-1)).toContain("subject=Physics");
  await expect(
    page.getByRole("link", { name: "My event participation and attendance" }),
  ).toHaveAttribute("href", "/dashboard/student/events");
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
});
test("teacher comparisons, rankings and underlying data tables", async ({
  page,
}) => {
  await mock(page, { role: "teacher" });
  await page.goto("/dashboard/teacher/analytics");
  await expect(
    page.getByRole("heading", { name: "Student rankings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Fictional Student" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Monthly progress data" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Released score history" }),
  ).toHaveCount(0);
});
test("empty, failure and backend permission states", async ({ page }) => {
  await mock(page, { empty: true });
  await page.goto("/dashboard/student/performance");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "No released results match these filters." }),
  ).toBeVisible();
  await mock(page, { failure: 500 });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await mock(page, { failure: 403 });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /access denied/i }),
  ).toBeVisible();
});
test("student cannot render teacher analytics", async ({ page }) => {
  const calls: string[] = [];
  await mock(page, { calls });
  await page.goto("/dashboard/teacher/analytics");
  await expect(
    page.getByRole("heading", { name: /access denied/i }),
  ).toBeVisible();
  expect(calls).toHaveLength(0);
});
