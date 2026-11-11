import { test, expect, type Page } from "@playwright/test";
async function mock(page: Page, role = "student") {
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
  const thread = {
    id: "64b000000000000000000001",
    subject: "Fictional suggestion",
    category: "suggestion",
    status: "open",
    version: 1,
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
    messages: [
      {
        author: "member",
        message: "Please add a fictional science workshop.",
        sentAt: "2026-11-01T10:00:00Z",
      },
    ],
    ...(role === "admin"
      ? { memberName: "Fictional Member", assignedTeacherId: "" }
      : {}),
  };
  let replied = false;
  await page.route("**/api/**/feedback**", (route) => {
    if (route.request().method() === "POST") {
      replied = true;
      return route.fulfill({ headers, json: { success: true, thread } });
    }
    return route.fulfill({
      headers,
      json: {
        success: true,
        items: [
          {
            ...thread,
            messages: [
              ...thread.messages,
              ...(replied
                ? [
                    {
                      author: "staff",
                      message: "Fictional staff reply.",
                      sentAt: "2026-11-02T10:00:00Z",
                    },
                  ]
                : []),
            ],
          },
        ],
        page: 1,
        hasNext: false,
      },
    });
  });
  // Root /api/feedback is also intercepted explicitly.
  await page.route("**/api/feedback**", (route) =>
    route.fulfill({
      headers,
      json:
        route.request().method() === "POST"
          ? { success: true, thread }
          : { success: true, items: [thread], page: 1, hasNext: false },
    }),
  );
}
test("student feedback submission and private history", async ({ page }) => {
  await mock(page);
  await page.goto("/dashboard/student/feedback");
  await page
    .getByLabel("Subject", { exact: true })
    .fill("Fictional new suggestion");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Please add another fictional workshop.");
  const posted = page.waitForRequest(
    (request) =>
      request.url().includes("/api/feedback") && request.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Send feedback", exact: true })
    .click();
  await posted;
  await expect(
    page.getByRole("heading", { name: "Fictional suggestion" }),
  ).toBeVisible();
  await expect(page.getByLabel(/Assigned teacher account ID/)).toHaveCount(0);
});
test("teacher replies to assigned feedback and student cannot manage", async ({
  page,
}) => {
  await mock(page, "teacher");
  await page.goto("/dashboard/teacher/feedback");
  await page
    .getByLabel("Reply to Fictional suggestion")
    .fill("Fictional staff reply.");
  await page
    .getByLabel("Status for Fictional suggestion")
    .selectOption("resolved");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.getByText("Fictional staff reply.", { exact: true }),
  ).toBeVisible();
  await mock(page, "student");
  await page.goto("/dashboard/teacher/feedback");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
});
