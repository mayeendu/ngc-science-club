import { test, expect } from "@playwright/test";
test("connected signup/login, membership, private feedback, role denial and logout", async ({
  page,
}) => {
  // Transport proxy only: requests reach the real Express/Better Auth handlers and
  // production repositories. Storage is a fictional in-memory adapter, never Atlas.
  await page.route("**/api/**", async (route) => {
    const source = new URL(route.request().url());
    const response = await route.fetch({
      url: `http://127.0.0.1:5102${source.pathname}${source.search}`,
    });
    await route.fulfill({ response });
  });
  const email = `fictional-${test.info().project.name}@example.com`;
  await page.goto("/signup");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Fictional Launch Student");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Fictional-Launch-Password!123");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Fictional-Launch-Password!123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await page.goto("/dashboard/student");
  await expect(
    page.getByRole("heading", { name: "Student Dashboard" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Apply for membership", exact: true })
    .click();
  await page.getByLabel("Full Name", { exact: true }).fill("Fictional Student");
  await page.getByLabel("Roll No.", { exact: true }).fill("TEST-01");
  await page.getByLabel("Section", { exact: true }).fill("Science 1");
  await page.getByLabel("Email", { exact: true }).fill("fictional@example.com");
  await page.getByLabel("Mobile No.", { exact: true }).fill("01712345678");
  await page.getByLabel("WhatsApp No.", { exact: true }).fill("01912345678");
  await page
    .getByLabel("Guide Teacher Name", { exact: true })
    .fill("Fictional Teacher");
  await page
    .getByLabel("Guide Teacher Subject", { exact: true })
    .fill("Physics");
  await page.getByLabel("SSC GPA", { exact: true }).fill("4.75");
  await page.getByLabel("Optional Subject", { exact: true }).fill("Chemistry");
  await page.getByLabel("Admission Goal", { exact: true }).fill("Engineering");
  await page.getByLabel("Half Yearly", { exact: true }).fill("");
  await page.getByLabel("Year Final", { exact: true }).fill("A+");
  await page.getByLabel("Pre-Test", { exact: true }).fill("");
  await page.getByLabel("Test", { exact: true }).fill("");
  await page
    .getByLabel("Present Address", { exact: true })
    .fill("Fictional campus address");
  await page.getByRole("button", { name: "Save member", exact: true }).click();
  await expect(
    page.getByText("Your application is awaiting admin approval.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Your application is awaiting admin approval.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/dashboard/student/feedback");
  await page
    .getByLabel("Subject", { exact: true })
    .fill("Fictional launch suggestion");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Please add another fictional science workshop.");
  await page
    .getByRole("button", { name: "Send feedback", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fictional launch suggestion" }),
  ).toBeVisible();
  const denied = await page.evaluate(
    async () =>
      (await fetch("/api/manage/quizzes", { credentials: "include" })).status,
  );
  expect(denied).toBe(403);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard/student");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Fictional-Launch-Password!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/dashboard/student");
  await expect(
    page.getByText("Your application is awaiting admin approval.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});
