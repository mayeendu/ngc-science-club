import { test, expect, type Page } from "@playwright/test";
async function mock(page: Page, role = "student", failure = 0) {
  const headers = {
    "access-control-allow-origin": "http://localhost:3100",
    "access-control-allow-credentials": "true",
  };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers,
      json: {
        user: {
          id: "64b000000000000000000001",
          name: "Fictional Member",
          email: "fixture@example.com",
          emailVerified: true,
          role,
        },
        session: {
          id: "fixture",
          userId: "64b000000000000000000001",
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
  const announcement = {
    id: "64b000000000000000000002",
    title: "Fictional science notice",
    body: "Fictional public science announcement.",
    updatedAt: "2026-11-01T10:00:00Z",
  };
  await page.route("**/api/announcements**", (route) =>
    route.fulfill({
      headers,
      json: route.request().url().includes(announcement.id)
        ? { success: true, announcement }
        : { success: true, items: [announcement], page: 1, hasNext: false },
    }),
  );
  await page.route("**/api/manage/announcements**", (route) =>
    route.fulfill({
      headers,
      json:
        route.request().method() === "GET"
          ? {
              success: true,
              items: [{ ...announcement, published: false, version: 1 }],
              page: 1,
              hasNext: false,
            }
          : {
              success: true,
              announcement: { ...announcement, published: true, version: 2 },
            },
    }),
  );
  let read = false;
  await page.route("**/api/notifications**", (route) => {
    if (route.request().method() === "PATCH") {
      read = (route.request().postDataJSON() as { read: boolean }).read;
      return route.fulfill({ headers, json: { success: true } });
    }
    return route.fulfill({
      headers,
      status: failure || 200,
      json: failure
        ? { success: false }
        : {
            success: true,
            items: [
              {
                id: `announcement:${announcement.id}`,
                kind: "announcement",
                title: announcement.title,
                body: "A club announcement has been published or updated.",
                date: announcement.updatedAt,
                href: `/announcements/${announcement.id}`,
                read,
              },
            ],
            unreadCount: read ? 0 : 1,
            page: 1,
            hasNext: false,
          },
    });
  });
}
test("public announcements and staff publish controls", async ({ page }) => {
  await mock(page, "teacher");
  await page.goto("/announcements");
  await expect(
    page.getByText("Fictional public science announcement.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Read announcement", exact: true })
    .click();
  await expect(page).toHaveURL(/\/announcements\/64b/);
  await expect(
    page
      .getByText("Fictional public science announcement.", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.goto("/dashboard/teacher/announcements");
  await page
    .getByRole("button", { name: "Edit Fictional science notice" })
    .click();
  await page.getByLabel("Publish announcement", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save announcement", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save announcement", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Archive Fictional science notice" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep unchanged" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("notification bell, count, mark read/unread and target", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/dashboard/notifications");
  await expect(
    page.getByRole("link", { name: "Notifications (1 unread)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(
    page.getByText("0 unread notifications", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Notifications (0 unread)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark unread", exact: true }).click();
  await expect(
    page.getByText("1 unread notifications", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Fictional science notice" }),
  ).toHaveAttribute("href", /\/announcements\//);
});
test("student denied announcement management and notification failures are recoverable", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/dashboard/teacher/announcements");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
  await mock(page, "student", 500);
  await page.goto("/dashboard/notifications");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await mock(page);
  await page.getByRole("button", { name: "Refresh notifications" }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional science notice" }),
  ).toBeVisible();
});
