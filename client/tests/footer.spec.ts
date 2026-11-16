import { test, expect } from "@playwright/test";

test("public footer matches app routes, follows activities, and translates", async ({
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
  const footer = page.getByRole("contentinfo");
  await expect(footer).toHaveCount(1);
  await expect(footer.getByRole("navigation")).toHaveCount(3);
  await expect(
    footer
      .getByRole("navigation", { name: "Our club", exact: true })
      .getByRole("link"),
  ).toHaveCount(3);
  expect(
    await footer
      .locator("a")
      .evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute("href")))].sort(),
      ),
  ).toEqual(
    [
      "/",
      "/announcements",
      "/achievements",
      "/certificates/verify",
      "/events",
      "/faculty",
      "/gallery",
      "/login",
      "/members",
      "/signup",
    ].sort(),
  );
  const activity = page.getByRole("region", {
    name: "Science Club Activity",
    exact: true,
  });
  expect(
    await activity.evaluate((node) =>
      Boolean(
        node.compareDocumentPosition(document.querySelector("footer")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true);
  await footer.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await footer
    .getByRole("link", { name: "NGC Science Club", exact: true })
    .focus();
  await expect(
    footer.getByRole("link", { name: "NGC Science Club", exact: true }),
  ).toBeFocused();
  await expect(footer).toHaveCSS("background-color", "rgb(8, 11, 16)");
  await footer.getByRole("heading", { name: "Our club", exact: true }).click();
  await footer.screenshot({
    path: `test-results/footer-${test.info().project.name}.png`,
  });
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(
    footer.getByRole("heading", { name: "আমাদের ক্লাব", exact: true }),
  ).toBeVisible();
  await expect(
    footer.getByText("সর্বস্বত্ব সংরক্ষিত।", { exact: false }),
  ).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
