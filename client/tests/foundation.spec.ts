import { expect, test } from "@playwright/test";

test("homepage connects to the real API and switches languages", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explore science. Discover together.",
  );
  await expect(page.getByRole("status")).toHaveText(
    "Connected — the club API is online.",
  );
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "বিজ্ঞানকে জানি। একসাথে আবিষ্কার করি।",
  );
  await expect(page.getByRole("status")).toContainText("সংযোগ সফল");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("failed connection can recover through retry", async ({ page }) => {
  await page.route("**/api/health", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("We could not reach");
  await page.unroute("**/api/health");
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByRole("status")).toContainText("Connected");
});

test("API health, not-found response, and CORS origin are correct", async ({
  request,
}) => {
  const health = await request.get("http://localhost:4000/api/health", {
    headers: { Origin: "http://localhost:3000" },
  });
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    status: "ok",
    service: "ngc-science-club-api",
  });
  expect(health.headers()["access-control-allow-origin"]).toBe(
    "http://localhost:3000",
  );
  const otherOrigin = await request.get("http://localhost:4000/api/health", {
    headers: { Origin: "https://untrusted.example" },
  });
  expect(otherOrigin.headers()["access-control-allow-origin"]).not.toBe(
    "https://untrusted.example",
  );
  expect(
    (await request.get("http://localhost:4000/api/missing")).status(),
  ).toBe(404);
});
