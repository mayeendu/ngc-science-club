import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  const headers = {
    "access-control-allow-origin": "http://localhost:3100",
    "access-control-allow-credentials": "true",
  };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ headers, json: null }),
  );
  await page.route("**/api/health", (route) =>
    route.fulfill({
      headers,
      json: {
        success: true,
        message: "Fictional health",
        timestamp: new Date().toISOString(),
      },
    }),
  );
  await page.route("**/api/faculty**", (route) =>
    route.fulfill({
      headers,
      json: {
        success: true,
        items: [
          {
            id: "64b000000000000000000001",
            name: "Home",
            designation: "Lecturer",
            department: "Physics",
            specialization: "Optics",
            photo: "",
            bio: "Private original content.",
          },
        ],
        page: 1,
        hasNext: false,
      },
    }),
  );
});
test("Bangla default, shared switch, reload persistence and unchanged user content", async ({
  page,
}) => {
  await page.goto("/faculty");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(
    page.getByRole("heading", { name: "শিক্ষক পরামর্শক", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.getByLabel("ভাষা / Language", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Faculty mentors", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator('a[href="/login"]').click();
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await page.getByLabel("ভাষা / Language", { exact: true }).selectOption("bn");
  await expect(page.getByLabel("ইমেইল ঠিকানা", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
});
test("Bangla authentication validation and keyboard language selection", async ({
  page,
}) => {
  await page.goto("/signup");
  await page
    .getByRole("button", { name: "অ্যাকাউন্ট তৈরি করুন", exact: true })
    .click();
  await expect(
    page.getByText("নামে অন্তত ২টি অক্ষর থাকতে হবে", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("ভাষা / Language", { exact: true }).focus();
  await page.keyboard.press("e");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Join NGC Science Club" }),
  ).toBeVisible();
});
test("blocked storage retains a working language choice in this tab", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value: () => {
        throw new Error("blocked");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new Error("blocked");
      },
    });
  });
  await page.goto("/login");
  await page.getByLabel("ভাষা / Language", { exact: true }).selectOption("en");
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
