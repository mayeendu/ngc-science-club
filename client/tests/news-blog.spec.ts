import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers: {
        "access-control-allow-origin": `http://localhost:${process.env.E2E_CLIENT_PORT ?? "3100"}`,
        "access-control-allow-credentials": "true",
      },
      json: null,
    }),
  );
});
const headers = () => ({
  "access-control-allow-origin": `http://localhost:${process.env.E2E_CLIENT_PORT ?? "3100"}`,
  "access-control-allow-credentials": "true",
});

test("science notes follow activities, fit all layouts, and open accessible bilingual articles", async ({
  page,
}) => {
  await page.route("**/api/announcements?**", (route) =>
    route.fulfill({
      headers: headers(),
      json: { success: true, items: [], page: 1, hasNext: false },
    }),
  );
  await page.goto("/");
  const section = page.getByRole("region", {
    name: "Stay updated with our news and blog.",
    exact: true,
  });
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("article")).toHaveCount(3);
  await expect(
    section.getByRole("link", { name: "Explore all club news", exact: true }),
  ).toHaveAttribute("href", "/announcements");
  expect(
    await page
      .locator("#science-activities-heading")
      .evaluate((node) =>
        Boolean(
          node.compareDocumentPosition(
            document.querySelector("#news-blog-heading")!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Learn with mentors", exact: true }),
  ).toHaveCount(0);
  for (const [width, count] of [
    [390, 1],
    [820, 2],
    [1280, 3],
  ] as const) {
    await page.setViewportSize({ width, height: 950 });
    const columns = await section
      .getByRole("article")
      .evaluateAll(
        (cards) =>
          new Set(
            cards.map((card) => Math.round(card.getBoundingClientRect().x)),
          ).size,
      );
    expect(columns).toBe(count);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  for (const image of await section.getByRole("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  const read = section.getByRole("button", { name: /^Read more:/ }).first();
  await read.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Change one factor at a time.");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(read).toBeFocused();
  await section.getByRole("heading", { level: 2 }).click();
  await section.screenshot({
    path: `test-results/news-${test.info().project.name}.png`,
  });
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(page.locator("#news-blog-heading")).toHaveText(
    "ক্লাবের সংবাদ ও বিজ্ঞানের নতুন ভাবনায় সাথে থাকো।",
  );
  await page
    .getByRole("button", { name: /^আরও পড়ো:/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "একবারে একটি বিষয় বদলাও।",
  );
});

test("navbar Blog link opens the public bilingual blog page", async ({
  page,
}) => {
  await page.route("**/api/announcements?**", (route) =>
    route.fulfill({
      headers: headers(),
      json: { success: true, items: [], page: 1, hasNext: false },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Blog", exact: true })
    .click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Science Club Blog",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
  await page
    .getByRole("button", { name: /^Read more:/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Science Club Blog",
  );
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "বিজ্ঞান ক্লাবের ব্লগ",
  );
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "ব্লগ", exact: true }),
  ).toBeVisible();
});

test("published news uses actual title date and announcement destination", async ({
  page,
}) => {
  await page.route("**/api/announcements?**", (route) =>
    route.fulfill({
      headers: headers(),
      json: {
        success: true,
        items: [
          {
            id: "fictional-news",
            title: "Fictional science gathering",
            body: "Fictional announcement for isolated tests.",
            updatedAt: "2026-11-16T09:00:00.000Z",
          },
        ],
        page: 1,
        hasNext: false,
      },
    }),
  );
  await page.goto("/");
  const section = page.getByRole("region", {
    name: "Stay updated with our news and blog.",
    exact: true,
  });
  await expect(
    section.getByRole("heading", {
      name: "Fictional science gathering",
      exact: true,
    }),
  ).toBeVisible();
  await expect(section.getByRole("article")).toHaveCount(3);
  await expect(
    section.getByRole("link", {
      name: "Read more: Fictional science gathering",
      exact: true,
    }),
  ).toHaveAttribute("href", "/announcements/fictional-news");
  await expect(section.locator("time")).toHaveAttribute(
    "datetime",
    "2026-11-16T09:00:00.000Z",
  );
});

test("news failure keeps science notes available and retry restores published news", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/announcements?**", (route) =>
    route.fulfill({
      status: failed ? 500 : 200,
      headers: headers(),
      json: failed
        ? { success: false }
        : { success: true, items: [], page: 1, hasNext: false },
    }),
  );
  await page.goto("/");
  const section = page.getByRole("region", {
    name: "Stay updated with our news and blog.",
    exact: true,
  });
  await expect(section.getByRole("status")).toContainText(
    "Club news is unavailable.",
  );
  await expect(section.getByRole("article")).toHaveCount(3);
  failed = false;
  await section
    .getByRole("button", { name: "Retry news", exact: true })
    .click();
  await expect(section.getByRole("status")).toHaveCount(0);
});
