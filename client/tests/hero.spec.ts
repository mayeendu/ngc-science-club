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

test("four science banners support navigation, languages and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Four fields of science" });
  await expect(hero.getByRole("heading", { level: 1 })).toContainText(
    "Small questions.",
  );
  for (const name of ["Chemistry", "Mathematics", "Biology", "Physics"]) {
    await hero
      .getByRole("button", { name: `Show ${name}`, exact: true })
      .click();
    await expect(
      hero.getByRole("group", { name: new RegExp(name) }),
    ).toBeVisible();
  }
  await hero.getByRole("button", { name: "Next banner", exact: true }).click();
  await expect(hero.getByRole("heading", { level: 1 })).toContainText(
    "Mix curiosity.",
  );
  await hero
    .getByRole("button", { name: "Previous banner", exact: true })
    .click();
  await expect(hero.getByRole("heading", { level: 1 })).toContainText(
    "Small questions.",
  );
  await expect(
    hero.getByRole("link", { name: "Join the science community" }),
  ).toHaveAttribute("href", "/signup");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Members", exact: true }),
  ).toHaveAttribute("href", "/members");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await hero.getByRole("heading", { level: 1 }).click();
  await page.screenshot({
    path: `test-results/hero-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "ছোট্ট প্রশ্নে",
  );
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page
    .getByRole("switch", { name: "Appearance", exact: true })
    .setChecked(true);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".science-hero")).toHaveCSS(
    "background-color",
    "rgb(30, 41, 36)",
  );
});

test("autoplay advances after six seconds and pause stops rotation", async ({
  page,
}) => {
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Four fields of science" });
  await expect(hero.getByRole("heading", { level: 1 })).toContainText(
    "Small questions.",
  );
  await page.mouse.move(0, 0);
  await expect(hero.getByRole("heading", { level: 1 })).toContainText(
    "Mix curiosity.",
    { timeout: 9000 },
  );
  await hero
    .getByRole("button", { name: "Pause banners", exact: true })
    .click();
  await page.getByRole("button", { name: "English", exact: true }).focus();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(6500);
  await expect(hero.getByRole("heading", { level: 1 })).toContainText(
    "Mix curiosity.",
  );
});

test("reduced motion disables automatic rotation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(6500);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Small questions.",
  );
});
