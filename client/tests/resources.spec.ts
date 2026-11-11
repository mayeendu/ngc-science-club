import { test, expect, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
async function mock(page: Page, role = "student", deny = false) {
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
  const row = {
    id: "64b000000000000000000002",
    title: "Fictional physics resource",
    description: "A fictional optics note for testing.",
    category: "Physics",
    format: "pdf",
    url: "",
    updatedAt: "2026-11-01T10:00:00Z",
    file: { name: "fictional.pdf", size: 30, mime: "application/pdf" },
    ...(role !== "student" ? { published: false, version: 1 } : {}),
  };
  await page.route("**/api/**resources**", (route) => {
    const request = route.request();
    if (request.url().includes("/download"))
      return route.fulfill({
        headers: {
          ...headers,
          "Content-Disposition": "attachment; filename=fictional.pdf",
        },
        contentType: "application/pdf",
        body: "%PDF-1.7\nfictional\n%%EOF",
      });
    return route.fulfill({
      headers,
      status: deny ? 403 : 200,
      json: deny
        ? { success: false }
        : request.method() === "GET"
          ? { success: true, items: [row], page: 1, hasNext: false }
          : { success: true, resource: row },
    });
  });
}
test("student browse filters and authenticated attachment download", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/dashboard/student/resources");
  await expect(
    page.getByRole("heading", { name: "Fictional physics resource" }),
  ).toBeVisible();
  await page.getByLabel("Search resources").fill("optics");
  const request = page.waitForRequest((request) =>
    request.url().includes("q=optics"),
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  await request;
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download resource" }).click();
  expect((await downloading).suggestedFilename()).toBe("fictional.pdf");
});
test("staff creates resource draft and uploads a file", async ({ page }) => {
  await mock(page, "teacher");
  await page.goto("/dashboard/teacher/resources");
  await page.getByRole("button", { name: "Add resource", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Fictional new resource");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A fictional lesson note for a test.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  const uploading = page.waitForRequest(
    (request) => request.url().includes("/file") && request.method() === "POST",
  );
  await page
    .getByLabel("Upload resource file")
    .setInputFiles({
      name: "fictional.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nfictional\n%%EOF"),
    });
  expect((await uploading).headers()["x-resource-version"]).toBe("1");
});
test("student management and pending membership are denied", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/dashboard/teacher/resources");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
  await mock(page, "student", true);
  await page.goto("/dashboard/student/resources");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
});
