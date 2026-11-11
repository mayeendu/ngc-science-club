import { test, expect, type Page } from "@playwright/test";
const token = "a".repeat(64),
  eventId = "64b000000000000000000003",
  userId = "64b000000000000000000002";
async function mock(
  page: Page,
  role: "student" | "teacher" | "guest" = "student",
) {
  const headers = {
    "access-control-allow-origin": "http://localhost:3100",
    "access-control-allow-credentials": "true",
  };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers,
      json:
        role === "guest"
          ? null
          : {
              user: {
                id: userId,
                name: "Fictional Learner",
                email: "fixture@example.com",
                emailVerified: true,
                role,
              },
              session: {
                id: "fixture",
                userId,
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
        unreadCount: 0,
        page: 1,
        hasNext: false,
      },
    }),
  );
  await page.route("https://example.com/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="blue"/></svg>',
    }),
  );
  const item = {
    id: eventId,
    kind: "achievement",
    title: "Fictional science award",
    description: "Fictional science club achievement.",
    occurredOn: "2020-01-01",
    image: "https://example.com/fixture.jpg",
    ...(role === "teacher" ? { version: 1, published: true } : {}),
  };
  await page.route("**/api/**showcase**", (route) =>
    route.fulfill({
      headers,
      json:
        route.request().method() === "GET"
          ? { success: true, items: [item], page: 1, hasNext: false }
          : { success: true, item },
    }),
  );
  let issued = role !== "teacher",
    revoked = false;
  const certificate = () => ({
    verificationId: token,
    recipientName: "Fictional Learner",
    eventTitle: "Fictional science seminar",
    eventDate: "2020-01-01T10:00:00Z",
    issuedAt: "2026-11-01T10:00:00Z",
    version: revoked ? 2 : 1,
    valid: !revoked,
    revoked,
  });
  await page.route("**/api/own/certificates**", (route) =>
    route.fulfill({
      headers,
      json: { success: true, items: [certificate()], page: 1, hasNext: false },
    }),
  );
  await page.route("**/api/manage/certificates**", (route) => {
    if (route.request().method() === "POST") issued = true;
    if (route.request().method() === "PATCH") revoked = true;
    return route.fulfill({
      headers,
      json:
        route.request().method() === "GET"
          ? {
              success: true,
              items: issued ? [certificate()] : [],
              page: 1,
              hasNext: false,
            }
          : { success: true, certificate: certificate() },
    });
  });
  await page.route("**/api/certificates/verify/**", (route) =>
    route.fulfill({
      headers,
      json: {
        success: true,
        certificate: {
          verificationId: token,
          eventTitle: "Fictional science seminar",
          eventDate: "2020-01-01T10:00:00Z",
          issuedAt: "2026-11-01T10:00:00Z",
          recipientInitials: "F. L.",
          valid: !revoked,
        },
      },
    }),
  );
  const event = {
    id: eventId,
    title: "Fictional science seminar",
    description: "A fictional science seminar for testing.",
    category: "seminar",
    startsAt: "2020-01-01T10:00:00Z",
    venue: "Fictional lab",
    capacity: 20,
    image: "",
    status: "published",
    registeredCount: 1,
    version: 1,
    createdAt: "2020-01-01T00:00:00Z",
  };
  await page.route("**/api/manage/events**", (route) =>
    route.fulfill({
      headers,
      json: route.request().url().includes("/participants")
        ? {
            success: true,
            event,
            items: [
              {
                id: `${eventId}:${userId}`,
                name: "Fictional Learner",
                status: "registered",
                attendance: "present",
                version: 1,
                registeredAt: "2020-01-01T00:00:00Z",
              },
            ],
            counts: { registered: 1, present: 1, absent: 0 },
            page: 1,
            hasNext: false,
          }
        : { success: true, events: [event], page: 1, hasNext: false },
    }),
  );
}
test("public achievements, gallery and private-by-default certificate verification", async ({
  page,
}) => {
  await mock(page, "guest");
  await page.goto("/achievements");
  await expect(
    page.getByRole("heading", { name: "Fictional science award" }),
  ).toBeVisible();
  await page.goto("/gallery");
  await expect(
    page.getByRole("img", { name: "Fictional science award" }),
  ).toBeVisible();
  await page.goto(`/certificates/verify/${token}`);
  await expect(
    page.getByRole("heading", { name: "Valid", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Recipient initials: F. L.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Fictional Learner", { exact: true }),
  ).toHaveCount(0);
});
test("staff edits public content and confirms archival", async ({ page }) => {
  await mock(page, "teacher");
  await page.goto("/dashboard/teacher/showcase");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Image URL (optional HTTPS)", { exact: true })
    .fill("not-a-url");
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page
    .getByRole("textbox", { name: /Image URL/ })
    .fill("https://example.com/fixture.jpg");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Updated fictional award");
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByRole("button", { name: "Save content" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("own certificate preview isolates printable content and supports PDF output", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/dashboard/student/certificates");
  await page.getByRole("button", { name: "Preview certificate" }).click();
  const dialog = page.getByRole("dialog", { name: "Certificate preview" });
  await expect(
    dialog.getByRole("heading", { name: "Fictional Learner" }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeHidden();
  await expect(
    dialog.getByRole("heading", { name: "Certificate of participation" }),
  ).toBeVisible();
  expect(
    (await page.pdf({ preferCSSPageSize: true })).subarray(0, 4).toString(),
  ).toBe("%PDF");
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Close preview" }).click();
  await expect(dialog).toHaveCount(0);
});
test("staff issues from attendance and permanent revocation updates validity", async ({
  page,
}) => {
  await mock(page, "teacher");
  await page.goto("/dashboard/teacher/certificates");
  await page
    .getByRole("combobox", { name: "Event", exact: true })
    .selectOption(eventId);
  await page
    .getByRole("button", { name: "Issue certificate for Fictional Learner" })
    .click();
  await expect(
    page.getByRole("button", { name: "Preview certificate" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Revoke certificate", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Preview certificate" }),
  ).toBeDisabled();
});
test("students cannot access certificate or showcase management", async ({
  page,
}) => {
  await mock(page);
  for (const path of [
    "/dashboard/teacher/certificates",
    "/dashboard/teacher/showcase",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Access Denied" }),
    ).toBeVisible();
  }
});
