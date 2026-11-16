import { expect, test, type Page } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";
import type { PublicMember } from "../src/lib/member-api";
const members = (): PublicMember[] =>
  Array.from({ length: 16 }, (_, i) => ({
    id: (i + 1).toString(16).padStart(24, "0"),
    name: `Fictional Member ${String(i + 1).padStart(2, "0")}`,
    department: i % 2 ? "Physics" : "Chemistry",
    academicYear: i % 2 ? "2026-2027" : "2025-2026",
    membershipDate: "2026-11-01T10:00:00.000Z",
  }));
type Fixture = {
  members: PublicMember[];
  privateFields?: Record<string, { studentRoll: string; section: string }>;
  failure?: boolean;
  slow?: boolean;
};
async function mockDirectory(page: Page, fixture: Fixture) {
  const headers = () => ({
    "access-control-allow-origin": new URL(page.url()).origin,
    "access-control-allow-credentials": "true",
  });
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      status: 200,
      headers: headers(),
      contentType: "application/json",
      body: "null",
    }),
  );
  await page.route("**/api/members**", async (route) => {
    expect(route.request().headers().cookie).toBeUndefined();
    if (fixture.slow) await delay(300);
    const respond = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: headers(),
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (fixture.failure)
      return respond(500, { success: false, message: "Unavailable" });
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/members", "");
    if (path === "/stats")
      return respond(200, {
        success: true,
        totalMembers: fixture.members.length,
        departments: [...new Set(fixture.members.map((m) => m.department))]
          .sort()
          .map((department) => ({
            department,
            count: fixture.members.filter((m) => m.department === department)
              .length,
          })),
        academicYears: [
          ...new Set(fixture.members.map((m) => m.academicYear)),
        ].sort(),
      });
    if (path && path !== "/") {
      const member = fixture.members.find((m) => m.id === path.slice(1));
      return respond(
        member ? 200 : 404,
        member
          ? { success: true, member }
          : { success: false, message: "Member not found." },
      );
    }
    const query = url.searchParams;
    const current = Number(query.get("page") ?? 1);
    const filtered = fixture.members.filter(
      (m) =>
        (!query.get("studentRoll") ||
          fixture.privateFields?.[m.id]?.studentRoll ===
            query.get("studentRoll")) &&
        (!query.get("section") ||
          fixture.privateFields?.[m.id]?.section === query.get("section")) &&
        (!query.get("department") ||
          m.department === query.get("department")) &&
        (!query.get("academicYear") ||
          m.academicYear === query.get("academicYear")) &&
        m.name
          .toLowerCase()
          .includes((query.get("search") ?? "").toLowerCase()),
    );
    return respond(200, {
      success: true,
      members: filtered
        .slice((current - 1) * 12, current * 12)
        .map((member) => ({
          ...member,
          studentRoll: fixture.privateFields?.[member.id]?.studentRoll ?? null,
        })),
      pagination: {
        page: current,
        pageSize: 12,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / 12),
      },
    });
  });
}

test("public directory has responsive cards statistics pagination and profile navigation", async ({
  page,
}) => {
  await mockDirectory(page, { members: members() });
  await page.context().addCookies([
    {
      name: "fictional-cookie",
      value: "not-a-real-session",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/members");
  await expect(
    page.getByRole("heading", { name: "Meet our members", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("16 approved members", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Physics: 8", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /View profile of/ })).toHaveCount(
    12,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Next members", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /View profile of/ })).toHaveCount(
    4,
  );
  await page
    .getByRole("button", { name: "Previous members", exact: true })
    .click();
  await page
    .getByRole("link", {
      name: "View profile of Fictional Member 01",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fictional Member 01", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: "Chemistry" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Fictional Member 01", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Phone");
  await expect(page.getByRole("main")).not.toContainText("Student ID");
  await expect(page.getByRole("main")).not.toContainText("Reason for joining");
});

test("directory offers only roll section and academic year filters", async ({
  page,
}) => {
  await mockDirectory(page, { members: members() });
  await page.goto("/members");
  await expect(
    page.getByText("16 approved members", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Department", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Search by name", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Student Roll", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Section", { exact: true })).toBeVisible();
  await page
    .getByLabel("Academic year", { exact: true })
    .selectOption("2026-2027");
  await expect(
    page.getByText("8 matching members", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Student Roll", { exact: true }).fill("99999");
  await page
    .getByRole("button", { name: "Search members", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No members found", exact: true }),
  ).toBeVisible();
});

test("roll section and academic year combine, reset pagination and preserve private fields", async ({
  page,
}) => {
  const records = members();
  await mockDirectory(page, {
    members: records,
    privateFields: Object.fromEntries(
      records.map((member, index) => [
        member.id,
        {
          studentRoll: index < 3 ? "00123" : String(20000 + index),
          section: index % 2 ? "Science 2" : "Science 1",
        },
      ]),
    ),
  });
  await page.goto("/members");
  await page.getByRole("button", { name: "Next members", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page.getByLabel("Student Roll", { exact: true }).fill("00123");
  await page.getByLabel("Section", { exact: true }).fill("Science 1");
  await page
    .getByLabel("Academic year", { exact: true })
    .selectOption("2025-2026");
  const requested = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/members" &&
      url.searchParams.get("studentRoll") === "00123" &&
      url.searchParams.get("section") === "Science 1"
    );
  });
  await page
    .getByRole("button", { name: "Search members", exact: true })
    .click();
  const url = new URL((await requested).url());
  expect(url.searchParams.get("academicYear")).toBe("2025-2026");
  expect(url.searchParams.get("page")).toBe("1");
  expect(url.searchParams.has("search")).toBe(false);
  expect(url.searchParams.has("department")).toBe(false);
  await expect(
    page.getByText("2 matching members", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /View profile of/ })).toHaveCount(
    2,
  );
  const cards = page.locator("[data-slot=card]");
  await expect(cards).toContainText([
    "Student Roll: 00123",
    "Student Roll: 00123",
  ]);
  for (const card of await cards.all()) {
    await expect(card.locator("[data-slot=card-title] + p")).toHaveText(
      "Student Roll: 00123",
    );
    await expect(card).not.toContainText("Science 1");
  }
  await page.getByLabel("Section", { exact: true }).fill("Science 2");
  await page
    .getByRole("button", { name: "Search members", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No members found", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Student Roll", { exact: true }).fill("");
  await page.getByLabel("Section", { exact: true }).fill("");
  await page.getByLabel("Academic year", { exact: true }).selectOption("");
  await page
    .getByRole("button", { name: "Search members", exact: true })
    .click();
  await expect(
    page.getByText("16 matching members", { exact: true }),
  ).toBeVisible();
});

test("directory skeleton and service error support retry", async ({ page }) => {
  const fixture: Fixture = { members: members(), failure: true, slow: true };
  await mockDirectory(page, fixture);
  await page.goto("/members");
  await expect(
    page.getByRole("status", { name: "Loading members", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Unable to load members.",
  );
  fixture.failure = false;
  fixture.slow = false;
  await page
    .getByRole("button", { name: "Retry members", exact: true })
    .click();
  await expect(
    page.getByText("16 approved members", { exact: true }),
  ).toBeVisible();
});

test("unavailable profiles and invalid IDs show no member details", async ({
  page,
}) => {
  await mockDirectory(page, { members: [] });
  for (const id of ["000000000000000000000099", "invalid-id"]) {
    await page.goto(`/members/${id}`);
    await expect(
      page.getByRole("heading", { name: "Member not found", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Fictional Member/ }),
    ).toHaveCount(0);
  }
});

test("fresh directory and profile reads reflect changed approval visibility", async ({
  page,
}) => {
  const fixture: Fixture = { members: members() };
  await mockDirectory(page, fixture);
  await page.goto("/members");
  await expect(
    page.getByText("16 approved members", { exact: true }),
  ).toBeVisible();
  fixture.members = fixture.members.filter(
    (m) => m.id !== "000000000000000000000001",
  );
  await page
    .getByRole("button", { name: "Refresh directory", exact: true })
    .click();
  await expect(
    page.getByText("15 approved members", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "View profile of Fictional Member 01",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/members/000000000000000000000001");
  await expect(
    page.getByRole("heading", { name: "Member not found", exact: true }),
  ).toBeVisible();
});

test("profile service failures can be retried and legacy missing dates are explicit", async ({
  page,
}) => {
  const source = members();
  source[0].membershipDate = null;
  const fixture: Fixture = { members: source, failure: true };
  await mockDirectory(page, fixture);
  await page.goto(`/members/${source[0].id}`);
  await expect(
    page.getByRole("heading", { name: "Unable to load profile", exact: true }),
  ).toBeVisible();
  fixture.failure = false;
  await page
    .getByRole("button", { name: "Refresh profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: source[0].name, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not recorded", { exact: true })).toBeVisible();
});
