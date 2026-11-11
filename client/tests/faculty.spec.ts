import { test, expect, type Page } from "@playwright/test";
const profile = {
  id: "64b000000000000000000001",
  name: "Fictional Mentor",
  designation: "Lecturer",
  department: "Physics",
  specialization: "Optics",
  photo: "",
  bio: "Fictional biography for a college science mentor.",
};
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
          id: profile.id,
          name: "Fictional Admin",
          email: "fixture@example.com",
          emailVerified: true,
          role,
        },
        session: {
          id: "fixture",
          userId: profile.id,
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
  await page.route("**/api/faculty**", (route) =>
    route.fulfill({
      headers,
      json: route.request().url().includes(profile.id)
        ? { success: true, profile }
        : { success: true, items: [profile], page: 1, hasNext: false },
    }),
  );
  await page.route("**/api/teacher/activities**", (route) =>
    route.fulfill({
      headers,
      json: {
        success: true,
        page: 1,
        hasNext: false,
        items: [
          {
            id: profile.id,
            title: "Fictional science seminar",
            venue: "College lab",
            startsAt: "2026-12-01T04:00:00Z",
            status: "published",
          },
        ],
      },
    }),
  );
  const managed = {
    ...profile,
    version: 1,
    published: true,
    teacherAccountId: "",
    assignedEventIds: [],
  };
  await page.route("**/api/admin/faculty**", (route) =>
    route.fulfill({
      headers,
      json:
        route.request().method() === "GET"
          ? { success: true, page: 1, hasNext: false, items: [managed] }
          : { success: true, profile: managed },
    }),
  );
}
test("public directory and faculty profile", async ({ page }) => {
  await mock(page);
  await page.goto("/faculty");
  await expect(
    page.getByRole("heading", { name: "Fictional Mentor" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View mentor profile" }).click();
  await expect(page.getByText(profile.bio)).toBeVisible();
});
test("admin edits and confirms archival", async ({ page }) => {
  await mock(page);
  await page.goto("/dashboard/admin/faculty");
  await page.getByRole("button", { name: "Edit Fictional Mentor" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    profile.name,
  );
  await page
    .getByLabel("Biography")
    .fill("Updated fictional mentor biography.");
  await page.getByRole("button", { name: "Save faculty profile" }).click();
  await expect(
    page.getByRole("button", { name: "Save faculty profile" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Archive Fictional Mentor" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("assigned teacher activities and denied student management", async ({
  page,
}) => {
  await mock(page, "teacher");
  await page.goto("/dashboard/teacher/activities");
  await expect(
    page.getByRole("heading", { name: "Fictional science seminar" }),
  ).toBeVisible();
  await mock(page, "student");
  await page.goto("/dashboard/admin/faculty");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
});
