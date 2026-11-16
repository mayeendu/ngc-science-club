import { test, expect } from "@playwright/test";

test("homepage activity grid, local images, keyboard links and bilingual copy", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers: {
        "access-control-allow-origin": `http://localhost:${process.env.E2E_CLIENT_PORT ?? "3100"}`,
        "access-control-allow-credentials": "true",
      },
      json: null,
    }),
  );
  await page.goto("/");
  const section = page.getByRole("region", {
    name: "Science Club Activity",
    exact: true,
  });
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("article")).toHaveCount(6);
  await expect(section.getByRole("heading", { level: 3 })).toHaveText([
    "Regular Science Quiz",
    "Science Olympiad",
    "Educational Study Tour",
    "Science Project & Innovation",
    "Science Workshop & Seminar",
    "Environment & Conservation",
  ]);
  for (const [width, columns] of [
    [390, 1],
    [820, 2],
    [1280, 3],
  ] as const) {
    await page.setViewportSize({ width, height: 950 });
    const cards = await section.getByRole("article").evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: Math.round(box.x), height: box.height };
      }),
    );
    expect(new Set(cards.map((card) => card.x)).size).toBe(columns);
    expect(
      Math.max(...cards.map((card) => card.height)) -
        Math.min(...cards.map((card) => card.height)),
    ).toBeLessThan(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  for (const image of await section.getByRole("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("alt", /Illustrated placeholder:/);
    await expect
      .poll(() =>
        image.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await expect(section.getByRole("link")).toHaveCount(4);
  for (const link of await section.getByRole("link").all())
    await expect(link).toHaveAttribute("href", "/events");
  await section.getByRole("link").first().focus();
  await expect(section.getByRole("link").first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(section.getByRole("link").nth(1)).toBeFocused();
  await section.getByRole("heading", { level: 2 }).click();
  await section.screenshot({
    path: `test-results/activities-${test.info().project.name}.png`,
  });
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "বিজ্ঞান ক্লাবের কার্যক্রম", exact: true })
      .getByRole("heading", { level: 3 }),
  ).toHaveText([
    "নিয়মিত বিজ্ঞান কুইজ",
    "বিজ্ঞান অলিম্পিয়াড",
    "শিক্ষামূলক ভ্রমণ",
    "বিজ্ঞান প্রকল্প ও উদ্ভাবন",
    "বিজ্ঞান কর্মশালা ও সেমিনার",
    "পরিবেশ ও সংরক্ষণ",
  ]);
});
