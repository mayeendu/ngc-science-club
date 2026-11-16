import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/blog**", (route) =>
    route.fulfill({
      headers: headers(),
      json: { success: true, items: [], page: 1, hasNext: false },
    }),
  );
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
  const read = section.getByRole("link", { name: /^Read more:/ }).first();
  await read.click();
  await expect(page).toHaveURL(/\/blog\/first-experiment$/);
  await expect(page.getByRole("article")).toContainText(
    "Change one factor at a time.",
  );
  await expect(page.getByRole("article").getByRole("img")).toHaveAttribute(
    "src",
    /workshop-bd\.jpg/,
  );
  await page
    .getByRole("link", { name: "Back to all blogs", exact: true })
    .click();
  await expect(page).toHaveURL(/\/blog$/);
  await page.goto("/");
  await section.getByRole("heading", { level: 2 }).click();
  await section.screenshot({
    path: `test-results/news-${test.info().project.name}.png`,
  });
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(page.locator("#news-blog-heading")).toHaveText(
    "ক্লাবের সংবাদ ও বিজ্ঞানের নতুন ভাবনায় সাথে থাকো।",
  );
  await page
    .getByRole("link", { name: /^আরও পড়ো:/ })
    .first()
    .click();
  await expect(page.getByRole("article")).toContainText(
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
    .getByRole("link", { name: /^Read more:/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/blog\/first-experiment$/);
  await expect(page.getByRole("article").getByRole("img")).toBeVisible();
  await page
    .getByRole("link", { name: "Back to all blogs", exact: true })
    .click();
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
  await page.route("**/api/announcements/fictional-news", (route) =>
    route.fulfill({
      headers: headers(),
      json: {
        success: true,
        announcement: {
          id: "fictional-news",
          title: "Fictional science gathering",
          body: "Fictional announcement for isolated tests.",
          updatedAt: "2026-11-16T09:00:00.000Z",
        },
      },
    }),
  );
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
  ).toHaveAttribute("href", "/blog/news-fictional-news");
  await expect(section.locator("time")).toHaveAttribute(
    "datetime",
    "2026-11-16T09:00:00.000Z",
  );
  await section
    .getByRole("link", {
      name: "Read more: Fictional science gathering",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/blog\/news-fictional-news$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Fictional science gathering",
  );
  await expect(page.getByRole("article")).toContainText(
    "Fictional announcement for isolated tests.",
  );
  await expect(page.getByRole("article").getByRole("img")).toBeVisible();
  await page
    .getByRole("link", { name: "Back to all blogs", exact: true })
    .click();
  await expect(page).toHaveURL(/\/blog$/);
});

test("every science note has a reloadable article page with a header photo and back link", async ({
  page,
}) => {
  await page.route("**/api/announcements?**", (route) =>
    route.fulfill({
      headers: headers(),
      json: { success: true, items: [], page: 1, hasNext: false },
    }),
  );
  for (const slug of [
    "first-experiment",
    "everyday-physics",
    "campus-biodiversity",
  ]) {
    await page.goto("/blog");
    await page.locator(`a[href="/blog/${slug}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
    const header = page.getByRole("article").locator("header");
    await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
    const image = header.getByRole("img");
    await expect(image).toHaveAttribute("src", /-bd\.jpg/);
    await expect
      .poll(() =>
        image.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("article").locator("header + div > p"),
    ).toHaveCount(3);
    await page.reload();
    await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
    await page
      .getByRole("link", { name: "Back to all blogs", exact: true })
      .click();
    await expect(page).toHaveURL(/\/blog$/);
  }
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
