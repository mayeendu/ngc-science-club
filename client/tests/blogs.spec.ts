import { test, expect, type Page } from "@playwright/test";
import type { MemberBlogPost } from "../src/lib/blog-api";
type Fixture = {
  role: "student" | "teacher" | "admin";
  guest?: boolean;
  permission?: number;
  publishFailure?: number;
  requests: unknown[];
  posts: MemberBlogPost[];
};
const body =
  "A fictional student experiment uses simple materials and records careful observations.\n\n<script>window.blogInjected = true</script>";
async function mockBlog(page: Page, state: Fixture) {
  const headers = {
    "access-control-allow-origin": `http://localhost:${process.env.E2E_CLIENT_PORT ?? "3100"}`,
    "access-control-allow-credentials": "true",
  };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers,
      json: state.guest
        ? null
        : {
            user: {
              id: "64b000000000000000000001",
              name: "Fictional Member",
              email: "fictional@example.com",
              emailVerified: true,
              role: state.role,
            },
            session: {
              id: "fictional-session",
              userId: "64b000000000000000000001",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
    }),
  );
  await page.route("**/api/announcements?**", (route) =>
    route.fulfill({
      headers,
      json: { success: true, items: [], page: 1, hasNext: false },
    }),
  );
  await page.route("**/api/notifications**", (route) =>
    route.fulfill({
      headers,
      json: {
        success: true,
        items: [],
        unreadCount: 0,
        page: 1,
        hasNext: false,
      },
    }),
  );
  await page.route("**/api/blog**", (route) => {
    const url = new URL(route.request().url());
    const response = (status: number, json: unknown) =>
      route.fulfill({ status, headers, json });
    if (url.pathname.endsWith("/permission"))
      return response(
        state.permission ?? 200,
        (state.permission ?? 200) === 200
          ? { success: true, canWrite: true }
          : { success: false },
      );
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      state.requests.push(input);
      if (state.publishFailure)
        return response(state.publishFailure, { success: false });
      const post: MemberBlogPost = {
        ...input,
        id: "64c000000000000000000001",
        excerpt: input.body.slice(0, 180),
        authorName: "Fictional Approved Member",
        publishedAt: "2026-11-16T12:00:00.000Z",
      };
      state.posts.unshift(post);
      return response(201, { success: true, post });
    }
    const id = url.pathname.split("/")[3];
    if (id) {
      const post = state.posts.find((post) => post.id === id);
      return response(
        post ? 200 : 404,
        post ? { success: true, post } : { success: false },
      );
    }
    const pageNumber = Number(url.searchParams.get("page") ?? 1);
    return response(200, {
      success: true,
      items: state.posts
        .slice((pageNumber - 1) * 12, pageNumber * 12)
        .map((post) => ({
          id: post.id,
          title: post.title,
          category: post.category,
          excerpt: post.excerpt,
          authorName: post.authorName,
          publishedAt: post.publishedAt,
        })),
      page: pageNumber,
      hasNext: state.posts.length > pageNumber * 12,
    });
  });
}
for (const role of ["student", "teacher", "admin"] as const) {
  test(`${role} can write publish and read a blog through the public Blog page`, async ({
    page,
  }) => {
    const state: Fixture = { role, requests: [], posts: [] };
    await mockBlog(page, state);
    await page.goto("/blog");
    await page.getByRole("link", { name: "Write Blog", exact: true }).click();
    await expect(page).toHaveURL(/\/blog\/write$/);
    await page
      .getByRole("button", { name: "Publish blog", exact: true })
      .click();
    await expect(
      page.getByText("Title must contain 3–150 characters.", { exact: true }),
    ).toBeVisible();
    expect(state.requests).toHaveLength(0);
    await page
      .getByLabel("Title", { exact: true })
      .fill("Fictional science observations");
    await page.getByLabel("Category", { exact: true }).selectOption("Physics");
    await page.getByLabel("Your article", { exact: true }).fill(body);
    await page
      .getByRole("button", { name: "Publish blog", exact: true })
      .click();
    await expect(page).toHaveURL(/\/blog\/64c000000000000000000001$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fictional science observations",
    );
    await expect(page.getByRole("article").getByRole("img")).toHaveAttribute(
      "src",
      /innovation-bd\.jpg/,
    );
    await expect(page.getByRole("article")).toContainText(
      "Fictional Approved Member",
    );
    await expect(page.getByRole("article")).toContainText(
      "<script>window.blogInjected = true</script>",
    );
    expect(await page.evaluate(() => "blogInjected" in window)).toBe(false);
    expect(state.requests).toEqual([
      { title: "Fictional science observations", category: "Physics", body },
    ]);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fictional science observations",
    );
    await page
      .getByRole("link", { name: "Back to all blogs", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        level: 3,
        name: "Fictional science observations",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
test("guests see sign-in and unapproved students cannot open the writing form", async ({
  page,
}) => {
  const state: Fixture = {
    role: "student",
    guest: true,
    permission: 403,
    requests: [],
    posts: [],
  };
  await mockBlog(page, state);
  await page.goto("/blog/write");
  await expect(
    page.getByRole("link", { name: "Sign in to write a blog", exact: true }),
  ).toHaveAttribute("href", "/login?next=/blog/write");
  await expect(page.getByLabel("Your article", { exact: true })).toHaveCount(0);
  state.guest = false;
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Approved membership required",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "View membership application",
      exact: true,
    }),
  ).toHaveAttribute("href", "/membership/apply");
  expect(state.requests).toHaveLength(0);
});
test("failed publishing preserves text and reports stale membership without publishing", async ({
  page,
}) => {
  const state: Fixture = {
    role: "student",
    publishFailure: 500,
    requests: [],
    posts: [],
  };
  await mockBlog(page, state);
  await page.goto("/blog/write");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Fictional saved writing");
  await page.getByLabel("Your article", { exact: true }).fill(body);
  await page.getByRole("button", { name: "Publish blog", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your text is still here",
  );
  await expect(page.getByLabel("Your article", { exact: true })).toHaveValue(
    body,
  );
  state.publishFailure = 403;
  await page.getByRole("button", { name: "Publish blog", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your membership or permissions changed",
  );
  expect(state.posts).toHaveLength(0);
});
test("writing form supports Bangla and unavailable articles fail clearly", async ({
  page,
}) => {
  const state: Fixture = { role: "student", requests: [], posts: [] };
  await mockBlog(page, state);
  await page.goto("/blog/write");
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "ব্লগ লিখুন",
  );
  await expect(page.getByLabel("আপনার লেখা", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ব্লগ প্রকাশ করুন", exact: true }),
  ).toBeVisible();
  await page.goto("/blog/000000000000000000000099");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "লেখাটি পাওয়া যায়নি",
  );
});
