import { expect, test } from "@playwright/test";
import { getHealth } from "../src/lib/api";

const apiOrigin = `http://localhost:${process.env.E2E_SERVER_PORT ?? "5000"}`;
const clientOrigin = `http://localhost:${process.env.E2E_CLIENT_PORT ?? "3000"}`;

test("server-rendered homepage connects to the real API", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "NGC Science Club",
  );
  await expect(page.getByRole("status")).toHaveText(
    "NGC Science Club API is running!",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(
    "NGC Science Club API is running!",
  );
});

test("API health, not-found response, and CORS origin are correct", async ({
  request,
}) => {
  const health = await request.get(`${apiOrigin}/api/health`, {
    headers: { Origin: clientOrigin },
  });
  expect(health.status()).toBe(200);
  const body = await health.json();
  expect(body).toMatchObject({
    success: true,
    message: "NGC Science Club API is running!",
    timestamp: expect.any(String),
  });
  expect(Number.isFinite(Date.parse(body.timestamp))).toBe(true);
  expect(health.headers()["cache-control"]).toBe("no-store");
  expect(health.headers()["access-control-allow-origin"]).toBe(clientOrigin);
  const otherOrigin = await request.get(`${apiOrigin}/api/health`, {
    headers: { Origin: "https://untrusted.example" },
  });
  expect(otherOrigin.headers()["access-control-allow-origin"]).not.toBe(
    "https://untrusted.example",
  );
  expect((await request.get(`${apiOrigin}/api/missing`)).status()).toBe(404);
});

test("health helper rejects the old response contract", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    await expect(getHealth(new AbortController().signal)).rejects.toThrow(
      "unexpected health response",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
