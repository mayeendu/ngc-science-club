import { test, expect, type Page } from "@playwright/test";
async function mock(page: Page, role = "admin") {
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
          name: "Fictional Admin",
          role,
          email: "fixture@example.com",
          emailVerified: true,
        },
        session: {
          id: "fixture",
          userId: "fictional",
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
  await page.route("**/api/notifications**", (route) =>
    route.fulfill({
      headers,
      json: {
        success: true,
        items: [],
        page: 1,
        hasNext: false,
        unreadCount: 0,
      },
    }),
  );
  await page.route("**/api/admin/reports**", (route) =>
    route.request().url().includes("export.csv")
      ? route.fulfill({
          headers: {
            ...headers,
            "content-disposition": 'attachment; filename="fictional.csv"',
          },
          contentType: "text/csv",
          body: "section,count\nmembers,2\n",
        })
      : route.fulfill({
          headers,
          json: {
            success: true,
            report: {
              range: { from: "2026-01-01", to: "2026-02-28" },
              generatedAt: "2026-03-01T00:00:00Z",
              sections: [
                "members",
                "quizzes",
                "events",
                "attendance",
                "feedback",
              ].map((key) => ({
                key,
                total: 2,
                states: [
                  {
                    state: key === "attendance" ? "present" : "pending",
                    count: 2,
                  },
                ],
                monthly: [{ month: "2026-01", count: 2 }],
              })),
            },
          },
        }),
  );
}
test("admin filters aggregate reports and exports CSV and printable PDF", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/dashboard/admin/reports");
  await expect(
    page.getByRole("heading", { name: "Club reports" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill("2026-01-01");
  await page.getByLabel("To", { exact: true }).fill("2026-02-28");
  const request = page.waitForRequest((request) =>
    request.url().includes("admin/reports?from=2026-01-01&to=2026-02-28"),
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  await request;
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await downloaded).suggestedFilename()).toContain("club-report");
  expect((await page.pdf()).subarray(0, 4).toString()).toBe("%PDF");
});
test("student cannot access unified reports", async ({ page }) => {
  await mock(page, "student");
  await page.goto("/dashboard/admin/reports");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
});
