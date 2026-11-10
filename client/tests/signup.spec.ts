import { expect, test, type Page } from "@playwright/test";

const password = "Fictional-Test-Password123!";

async function fillSignup(page: Page) {
  await page
    .getByLabel("Full name", { exact: true })
    .fill("  Fictional Student  ");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("fictional-student@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
}

function responseHeaders(page: Page) {
  return {
    "access-control-allow-origin": new URL(page.url()).origin,
    "access-control-allow-credentials": "true",
  };
}

test("empty fields show accessible validation errors without an auth request", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/api/auth/sign-up/email", async (route) => {
    submissions++;
    await route.abort();
  });
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Join NGC Science Club" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Name must contain at least 2 characters"),
  ).toBeVisible();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(
    page.getByText("Password must contain at least 8 characters"),
  ).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toBeFocused();
  expect(submissions).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("password visibility and confirmation validation work", async ({
  page,
}) => {
  await page.goto("/signup");
  await fillSignup(page);
  const input = page.getByLabel("Password", { exact: true });
  await expect(input).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(input).toHaveAttribute("type", "text");
  await expect(input).toHaveValue(password);
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(input).toHaveAttribute("type", "password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Different-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Passwords do not match")).toBeVisible();
  await expect(
    page.getByLabel("Confirm password", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
});

test("signup sends only account fields, disables submit while pending and redirects", async ({
  page,
}) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/auth/**", async (route) => {
    if (!route.request().url().endsWith("/sign-up/email")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: responseHeaders(page),
        body: "null",
      });
      return;
    }
    payload = route.request().postDataJSON();
    await pending;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: responseHeaders(page),
      body: JSON.stringify({
        token: "fictional-test-token",
        user: {
          id: "fictional-user",
          name: "Fictional Student",
          email: "fictional-student@example.com",
          emailVerified: false,
        },
      }),
    });
  });
  await page.goto("/signup");
  await fillSignup(page);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  try {
    await expect(
      page.getByRole("button", { name: "Creating account..." }),
    ).toBeDisabled();
    expect(payload).toEqual({
      name: "Fictional Student",
      email: "fictional-student@example.com",
      password,
    });
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Account created successfully!")).toBeVisible();
});

test("server rejection shows feedback and permits retry", async ({ page }) => {
  await page.route("**/api/auth/sign-up/email", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      headers: responseHeaders(page),
      body: JSON.stringify({
        code: "USER_ALREADY_EXISTS",
        message: "Account already exists",
      }),
    });
  });
  await page.goto("/signup");
  await fillSignup(page);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Account already exists")).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
});

test("network failure shows feedback without redirecting", async ({ page }) => {
  await page.route("**/api/auth/sign-up/email", (route) => route.abort());
  await page.goto("/signup");
  await fillSignup(page);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).not.toBeEmpty();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/signup$/);
});
