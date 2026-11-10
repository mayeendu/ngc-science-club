import { expect, test, type Page } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";
type Fixture = {
  role?: string;
  guest?: boolean;
  failure?: number;
  empty?: boolean;
  slow?: boolean;
  calls?: string[];
};
async function mockAnalytics(page: Page, fixture: Fixture) {
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
                name: "Fictional Admin",
                email: "fixture@example.com",
                emailVerified: true,
                role: fixture.role ?? "admin",
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
  await page.route("**/api/admin/overview", (route) =>
    route.fulfill({
      status: 200,
      headers: headers(),
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Access granted" }),
    }),
  );
  await page.route("**/api/admin/membership-analytics**", async (route) => {
    fixture.calls?.push(route.request().url());
    if (fixture.slow) await delay(300);
    const url = new URL(route.request().url());
    const zero = fixture.empty;
    const analytics = {
      range: {
        from: url.searchParams.get("from") ?? "2026-01-01",
        to: url.searchParams.get("to") ?? "2026-03-31",
      },
      kpis: {
        totalApplications: zero ? 0 : 10,
        pending: zero ? 0 : 3,
        approved: zero ? 0 : 6,
        rejected: zero ? 0 : 1,
        approvalRate: zero ? 0 : 60,
      },
      monthly: ["2026-01", "2026-02", "2026-03"].map((month, i) => ({
        month,
        applications: zero ? 0 : i + 2,
        approvedMembers: zero ? 0 : i + 1,
      })),
      departments: zero
        ? []
        : [
            { department: "Physics", members: 4 },
            { department: "Chemistry", members: 2 },
          ],
      recent: zero
        ? []
        : [
            { status: "pending", submittedAt: "2026-03-01T10:00:00.000Z" },
            { status: "approved", submittedAt: "2026-02-01T10:00:00.000Z" },
          ],
      trend: {
        previousApplications: zero ? 0 : 5,
        change: zero ? 0 : 5,
        changePercent: zero ? 0 : 100,
      },
    };
    return route.fulfill({
      status: fixture.failure ?? 200,
      headers: headers(),
      contentType: "application/json",
      body: JSON.stringify(
        fixture.failure ? { success: false } : { success: true, analytics },
      ),
    });
  });
}

test("admin dashboard analytics renders KPIs charts anonymous recent activity and accessible data", async ({
  page,
}) => {
  await mockAnalytics(page, {});
  await page.goto("/dashboard/admin");
  await page
    .getByRole("link", { name: "Membership analytics", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/admin\/analytics$/);
  await expect(
    page.getByRole("heading", { name: "Membership analytics", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Total applications",
    "Pending",
    "Approved",
    "Rejected",
    "Approval rate",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(page.getByText("60%", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Monthly membership growth chart",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Department membership distribution chart",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recent applications", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("fixture@example.com");
  await expect(page.getByRole("main")).not.toContainText("Fictional Admin");
  await page.getByText("View chart data", { exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Monthly activity (UTC)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: "Approved members by department",
      exact: true,
    }),
  ).toContainText("Physics");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("date filters request backend calculations and handle zero data", async ({
  page,
}) => {
  const fixture: Fixture = { calls: [] };
  await mockAnalytics(page, fixture);
  await page.goto("/dashboard/admin/analytics");
  await expect(page.getByText("60%", { exact: true })).toBeVisible();
  await page.getByLabel("From date (UTC)", { exact: true }).fill("2026-01-01");
  await page.getByLabel("To date (UTC)", { exact: true }).fill("2026-03-31");
  fixture.empty = true;
  await page
    .getByRole("button", { name: "Apply date range", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "No membership activity in this range",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
  const request = new URL(fixture.calls!.at(-1)!);
  expect(request.searchParams.get("from")).toBe("2026-01-01");
  expect(request.searchParams.get("to")).toBe("2026-03-31");
  await expect(page.getByRole("main")).not.toContainText("Infinity");
  await expect(page.getByRole("main")).not.toContainText("NaN");
});

for (const role of ["student", "teacher"])
  test(`${role} cannot view membership analytics`, async ({ page }) => {
    const fixture: Fixture = { role, calls: [] };
    await mockAnalytics(page, fixture);
    await page.goto("/dashboard/admin/analytics");
    await expect(
      page.getByRole("heading", { name: "Access Denied", exact: true }),
    ).toBeVisible();
    expect(fixture.calls).toHaveLength(0);
  });

test("guest analytics visit redirects to login", async ({ page }) => {
  await mockAnalytics(page, { guest: true });
  await page.goto("/dashboard/admin/analytics");
  await expect(page).toHaveURL(/\/login$/);
});

test("analytics skeleton and failed load support retry", async ({ page }) => {
  const fixture: Fixture = { failure: 500, slow: true };
  await mockAnalytics(page, fixture);
  await page.goto("/dashboard/admin/analytics");
  await expect(
    page.getByRole("status", { name: "Loading analytics", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Unable to load membership analytics.",
  );
  fixture.failure = undefined;
  fixture.slow = false;
  await page
    .getByRole("button", { name: "Retry analytics", exact: true })
    .click();
  await expect(page.getByText("60%", { exact: true })).toBeVisible();
});

test("backend denial overrides stale admin session and expired access redirects", async ({
  page,
}) => {
  const fixture: Fixture = { failure: 403 };
  await mockAnalytics(page, fixture);
  await page.goto("/dashboard/admin/analytics");
  await expect(
    page.getByRole("heading", { name: "Access Denied", exact: true }),
  ).toBeVisible();
  fixture.failure = 401;
  await page.goto("/dashboard/admin/analytics");
  await expect(page).toHaveURL(/\/login$/);
});

test("invalid date order is rejected before querying analytics", async ({
  page,
}) => {
  const fixture: Fixture = { calls: [] };
  await mockAnalytics(page, fixture);
  await page.goto("/dashboard/admin/analytics");
  await expect(page.getByText("60%", { exact: true })).toBeVisible();
  const before = fixture.calls!.length;
  await page.getByLabel("From date (UTC)", { exact: true }).fill("2026-04-01");
  await page.getByLabel("To date (UTC)", { exact: true }).fill("2026-01-01");
  await page
    .getByRole("button", { name: "Apply date range", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Select valid dates in order",
  );
  expect(fixture.calls).toHaveLength(before);
});
