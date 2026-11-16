import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers: {
        "access-control-allow-origin": "http://localhost:3100",
        "access-control-allow-credentials": "true",
      },
      json: null,
    }),
  );
});
test("keyboard skip navigation and persisted light/dark switch with system default", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  const appearance = page.getByRole("switch", {
    name: "Appearance",
    exact: true,
  });
  await expect(appearance).not.toBeChecked();
  // Before an explicit choice, the switch follows the operating system.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(appearance).toBeChecked();
  await expect(appearance.locator("span")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(appearance).not.toBeChecked();
  await expect(appearance.locator("span")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await appearance.focus();
  await page.keyboard.press("Space");
  await expect(appearance).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await appearance.click();
  await expect(appearance).not.toBeChecked();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  // Explicit light stays selected even if the operating system becomes dark.
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(appearance).not.toBeChecked();
});
test("public pages fit mobile width and Bengali labels retain their font and contrast", async ({
  page,
}) => {
  await page.route("**/api/faculty**", (route) =>
    route.fulfill({
      headers: {
        "access-control-allow-origin": "http://localhost:3100",
        "access-control-allow-credentials": "true",
      },
      json: { success: true, faculty: [], page: 1, hasNext: false },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await page
    .getByRole("switch", { name: "চেহারা", exact: true })
    .setChecked(true);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    font: getComputedStyle(document.body).fontFamily,
    bg: getComputedStyle(document.body).backgroundColor,
    fg: getComputedStyle(document.body).color,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.font).toContain("Nirmala UI");
  expect(dimensions.bg).not.toBe(dimensions.fg);
  for (const theme of ["light", "dark"]) {
    await page
      .getByRole("switch", { name: "চেহারা", exact: true })
      .setChecked(theme === "dark");
    await expect(page.locator("html")).toHaveClass(
      theme === "dark" ? /dark/ : /^(?!.*dark).*$/,
    );
    const ratios = await page.evaluate(() => {
      const canvas = document.createElement("canvas"),
        context = canvas.getContext("2d")!;
      function luminance(color: string) {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map((value) => {
            const channel = value / 255;
            return channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      }
      return ["text-blue-800", "text-slate-700", "text-slate-600"].map(
        (name) => {
          const element = document.createElement("div");
          element.className = `bg-white ${name}`;
          document.body.append(element);
          const style = getComputedStyle(element),
            foreground = luminance(style.color),
            background = luminance(style.backgroundColor);
          element.remove();
          return (
            (Math.max(foreground, background) + 0.05) /
            (Math.min(foreground, background) + 0.05)
          );
        },
      );
    });
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});
