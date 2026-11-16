import { expect, test, type Page } from "@playwright/test";
import type { AdminMembership } from "../src/lib/admin-membership-api";
import { adminApplicationSchema } from "../src/lib/admin-membership-api";
import { membershipFormSchema } from "../src/lib/validations/membership";
import {
  memberProfileSchema,
  type OwnMemberProfile,
} from "../src/lib/member-profile-api";

type Role = "student" | "teacher" | "admin";
const roles: Role[] = ["student", "teacher", "admin"];
const permitted: Record<Role, Role[]> = {
  student: roles,
  teacher: ["teacher", "admin"],
  admin: ["admin"],
};
const label = (role: string) => role[0].toUpperCase() + role.slice(1);

type Fixture = {
  role: unknown;
  guest?: boolean;
  unavailable?: boolean;
  apiStatus?: number;
  expiresAt?: string;
  application?: {
    status: "pending" | "approved" | "rejected";
    submittedAt: string;
    reviewedAt?: string;
    rejectionReason?: string;
  } | null;
  membershipFailure?: number;
  adminApplications?: AdminMembership[];
  adminFailure?: number;
  reviewFailure?: number;
  reviewRequests?: unknown[];
  profile?: OwnMemberProfile;
  profileFailure?: number;
  profileSaveFailure?: number;
  profileRequests?: unknown[];
};
async function mockAuth(page: Page, fixture: Fixture) {
  const headers = () => ({
    "access-control-allow-origin": new URL(page.url()).origin,
    "access-control-allow-credentials": "true",
  });
  await page.route("**/api/*/performance?**", (route) =>
    route.fulfill({
      status: 200,
      headers: headers(),
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        range: { from: "2026-01-01", to: "2026-12-31" },
        completed: 0,
        averagePercentage: 0,
        bestPercentage: 0,
        page: 1,
        quizzesHasNext: false,
        historyHasNext: false,
        rankingsHasNext: false,
        quizzes: [],
        timeline: [],
        history: [],
        rankings: [],
      }),
    }),
  );
  await page.route("**/api/admin/memberships**", (route) => {
    const url = new URL(route.request().url());
    const respond = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: headers(),
        body: JSON.stringify(body),
      });
    if (route.request().method() === "PATCH") {
      const body: unknown = route.request().postDataJSON();
      fixture.reviewRequests?.push(body);
      if (fixture.reviewFailure)
        return respond(fixture.reviewFailure, { success: false });
      const target = fixture.adminApplications?.find(
        (item) => item.id === url.pathname.split("/")[4],
      );
      if (!target || target.status !== "pending")
        return respond(409, { success: false });
      if (
        !body ||
        typeof body !== "object" ||
        !("decision" in body) ||
        (body.decision !== "approved" && body.decision !== "rejected")
      )
        return respond(400, { success: false });
      target.status = body.decision;
      target.reviewedAt = new Date().toISOString();
      if (
        body.decision === "rejected" &&
        "rejectionReason" in body &&
        typeof body.rejectionReason === "string"
      )
        target.rejectionReason = body.rejectionReason;
      fixture.application = {
        status: target.status,
        submittedAt: target.submittedAt,
        reviewedAt: target.reviewedAt,
        ...(target.rejectionReason
          ? { rejectionReason: target.rejectionReason }
          : {}),
      };
      return respond(200, { success: true, application: fixture.application });
    }
    if (fixture.adminFailure)
      return respond(fixture.adminFailure, { success: false });
    const status = url.searchParams.get("status") ?? "pending";
    const currentPage = Number(url.searchParams.get("page") ?? "1");
    const items = (fixture.adminApplications ?? []).filter(
      (item) => item.status === status,
    );
    return respond(200, {
      success: true,
      applications: items.slice((currentPage - 1) * 10, currentPage * 10),
      page: currentPage,
      hasNext: items.length > currentPage * 10,
    });
  });
  await page.route("**/api/membership-applications**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/me/profile")) {
      const patch = route.request().method() === "PATCH";
      const response = (status: number, body: unknown) =>
        route.fulfill({
          status,
          headers: headers(),
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (patch) fixture.profileRequests?.push(route.request().postDataJSON());
      const failure = patch
        ? (fixture.profileSaveFailure ?? fixture.profileFailure)
        : fixture.profileFailure;
      if (failure) return response(failure, { success: false });
      if (!fixture.profile && fixture.application?.status !== "approved")
        return response(403, { success: false });
      fixture.profile ??= {
        fullName: "Fictional Member",
        phone: "01712345678",
        department: "Science",
        academicYear: "2026-2027",
        studentId: "TEST-2026-01",
        status: "approved",
        membershipDate: "2026-11-01T10:00:00.000Z",
        completion: 100,
      };
      if (patch) {
        const input: unknown = route.request().postDataJSON();
        const parsed = memberProfileSchema.safeParse(input);
        if (!parsed.success) return response(400, { success: false });
        fixture.profile = {
          ...fixture.profile,
          ...parsed.data,
          completion: 100,
        };
      }
      return response(200, { success: true, profile: fixture.profile });
    }
    const submitting = route.request().method() === "POST";
    const status = fixture.membershipFailure ?? (submitting ? 201 : 200);
    if (submitting && status === 201)
      fixture.application = {
        status: "pending",
        submittedAt: new Date().toISOString(),
      };
    return route.fulfill({
      status,
      contentType: "application/json",
      headers: headers(),
      body: JSON.stringify({
        success: status < 400,
        application: fixture.application ?? null,
      }),
    });
  });
  await page.route("**/api/members/*", (route) => {
    const profile = fixture.profile;
    return route.fulfill({
      status: profile ? 200 : 404,
      headers: headers(),
      contentType: "application/json",
      body: JSON.stringify(
        profile
          ? {
              success: true,
              member: {
                id: "64b000000000000000000001",
                name: profile.fullName,
                department: profile.department,
                academicYear: profile.academicYear,
                membershipDate: profile.membershipDate,
              },
            }
          : { success: false },
      ),
    });
  });
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      status: fixture.unavailable ? 500 : 200,
      contentType: "application/json",
      headers: headers(),
      body: JSON.stringify(
        fixture.guest
          ? null
          : fixture.unavailable
            ? { message: "Unavailable" }
            : {
                user: {
                  id: "64b000000000000000000001",
                  name: "Fictional Learner",
                  email: "fixture@example.com",
                  emailVerified: true,
                  role: fixture.role,
                },
                session: {
                  id: "fixture-session",
                  userId: "64b000000000000000000001",
                  token: "fictional-test-only",
                  expiresAt:
                    fixture.expiresAt ??
                    new Date(Date.now() + 3600000).toISOString(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              },
      ),
    }),
  );
  await page.route("**/api/*/overview", (route) => {
    const target = new URL(route.request().url()).pathname.split(
      "/",
    )[2] as Role;
    const status =
      fixture.apiStatus ??
      (permitted[target].includes(fixture.role as Role) ? 200 : 403);
    return route.fulfill({
      status,
      headers: headers(),
      contentType: "application/json",
      body: JSON.stringify({
        success: status === 200,
        message: status === 200 ? "Access granted" : "Insufficient permissions",
      }),
    });
  });
  await page.route("**/api/auth/sign-out", (route) => {
    fixture.guest = true;
    return route.fulfill({
      status: 200,
      headers: headers(),
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}

for (const path of [
  "/dashboard",
  ...roles.map((role) => `/dashboard/${role}`),
]) {
  test(`guest is redirected from ${path}`, async ({ page }) => {
    await mockAuth(page, { role: null, guest: true });
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /Dashboard$/ })).toHaveCount(
      0,
    );
  });
}

for (const account of roles) {
  test(`${account} dashboard redirect and navigation`, async ({ page }) => {
    await mockAuth(page, { role: account });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(new RegExp(`/dashboard/${account}$`));
    await expect(
      page.getByRole("heading", { name: `${label(account)} Dashboard` }),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    for (const target of roles) {
      await expect(
        nav.getByRole("link", {
          name: `${label(target)} Dashboard`,
          exact: true,
        }),
      ).toHaveCount(permitted[target].includes(account) ? 1 : 0);
    }
    await expect(
      page.getByText(`${label(account)} account`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Welcome, Fictional Learner!" }),
    ).toBeVisible();
    await expect(page.getByText("Coming later", { exact: true })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
  for (const target of roles) {
    test(`${account} direct visit and refresh of ${target} dashboard`, async ({
      page,
    }) => {
      await mockAuth(page, { role: account });
      for (const refresh of [false, true]) {
        if (refresh) await page.reload();
        else await page.goto(`/dashboard/${target}`);
        const allowed = permitted[target].includes(account);
        await expect(
          page.getByRole("heading", {
            name: allowed ? `${label(target)} Dashboard` : "Access Denied",
            exact: true,
          }),
        ).toBeVisible();
        if (!allowed) {
          await expect(page.getByText("403", { exact: true })).toBeVisible();
          await expect(
            page.getByRole("heading", { name: "Welcome, Fictional Learner!" }),
          ).toHaveCount(0);
        }
      }
    });
  }
}

for (const role of [null, "owner", "student,admin"]) {
  test(`invalid role ${role} fails closed despite forged browser storage`, async ({
    page,
  }) => {
    await mockAuth(page, { role });
    await page.addInitScript(() => localStorage.setItem("role", "admin"));
    await page.goto("/dashboard/admin");
    await expect(
      page.getByRole("heading", { name: "Access Denied", exact: true }),
    ).toBeVisible();
  });
}

test("API 403 overrides an apparently administrative session", async ({
  page,
}) => {
  await mockAuth(page, { role: "admin", apiStatus: 403 });
  await page.goto("/dashboard/admin");
  await expect(
    page.getByRole("heading", { name: "Access Denied", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard", exact: true }),
  ).toHaveCount(0);
});

test("revoked session API 401 redirects to login", async ({ page }) => {
  await mockAuth(page, { role: "admin", apiStatus: 401 });
  await page.goto("/dashboard/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("session verification error has a working retry", async ({ page }) => {
  const fixture: Fixture = { role: "student", unavailable: true };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/student");
  await expect(
    page.getByRole("heading", { name: "Unable to verify access" }),
  ).toBeVisible();
  fixture.unavailable = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Student Dashboard", exact: true }),
  ).toBeVisible();
});

test("overview API failure hides content and supports retry", async ({
  page,
}) => {
  const fixture: Fixture = { role: "teacher", apiStatus: 500 };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/teacher");
  await expect(
    page.getByRole("heading", { name: "Unable to verify access" }),
  ).toBeVisible();
  fixture.apiStatus = 200;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Teacher Dashboard", exact: true }),
  ).toBeVisible();
});

test("logout removes dashboard content and redirects", async ({ page }) => {
  await mockAuth(page, { role: "admin" });
  await page.goto("/dashboard/admin");
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Admin Dashboard", exact: true }),
  ).toHaveCount(0);
  await page.goto("/dashboard/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("already expired session is not rendered", async ({ page }) => {
  await mockAuth(page, {
    role: "student",
    expiresAt: new Date(Date.now() - 60000).toISOString(),
  });
  await page.goto("/dashboard/student");
  await expect(page).toHaveURL(/\/login$/);
});

test("focus rechecks permission after a role is revoked", async ({ page }) => {
  const fixture: Fixture = { role: "teacher" };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/teacher");
  await expect(
    page.getByRole("heading", { name: "Teacher Dashboard", exact: true }),
  ).toBeVisible();
  fixture.apiStatus = 403;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "Access Denied", exact: true }),
  ).toBeVisible();
});

test("initial HTML contains no personalized admin content", async ({
  request,
}) => {
  const response = await request.get("/dashboard/admin");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
  const html = await response.text();
  expect(html).not.toContain("Fictional Learner");
  expect(html).not.toContain("Club administration");
});

test("expiry while dashboard is open removes content and redirects", async ({
  page,
}) => {
  const now = new Date();
  await page.clock.install({ time: now });
  await mockAuth(page, {
    role: "teacher",
    expiresAt: new Date(now.getTime() + 30_000).toISOString(),
  });
  await page.goto("/dashboard/teacher");
  await expect(
    page.getByRole("heading", { name: "Teacher Dashboard", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(31_000);
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Teacher Dashboard", exact: true }),
  ).toHaveCount(0);
});

test("student can validate, submit once and see pending status on dashboard", async ({
  page,
}) => {
  const fixture: Fixture = { role: "student" };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/student");
  await page
    .getByRole("link", { name: "Apply for membership", exact: true })
    .click();
  await expect(page).toHaveURL(/\/membership\/apply$/);
  await page.getByRole("button", { name: "Save member", exact: true }).click();
  await expect(page.getByLabel("Roll No.", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
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
  const request = page.waitForRequest(
    (req) =>
      req.method() === "POST" &&
      req.url().endsWith("/api/membership-applications"),
  );
  await page.getByRole("button", { name: "Save member", exact: true }).click();
  const body = (await request).postDataJSON();
  expect(body).toMatchObject({
    studentId: "TEST-01",
    section: "Science 1",
    email: "fictional@example.com",
    phone: "01712345678",
    whatsappPhone: "01912345678",
    guideTeacher: "Fictional Teacher",
    guideTeacherSubject: "Physics",
    sscGpa: "4.75",
    optionalSubject: "Chemistry",
    admissionGoal: "Engineering",
    halfYearlyResult: "",
    yearFinalResult: "A+",
    preTestResult: "",
    testResult: "",
    presentAddress: "Fictional campus address",
  });
  expect(body).not.toHaveProperty("submittedAt");
  await expect(
    page
      .getByRole("main")
      .getByText("Application status: pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save member", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Back to student dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/student$/);
  await expect(
    page
      .getByRole("main")
      .getByText("Application status: pending", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("main")
      .getByText("Application status: pending", { exact: true }),
  ).toBeVisible();
});

for (const role of ["teacher", "admin"]) {
  test(`${role} can open membership form directly without protected requests`, async ({
    page,
  }) => {
    await mockAuth(page, { role });
    const membershipRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/membership-applications"))
        membershipRequests.push(request.url());
    });
    await page.goto("/membership/apply");
    await expect(page).toHaveURL(/\/membership\/apply$/);
    await expect(
      page.getByRole("heading", { name: "Access Denied", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save member", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Roll No.", { exact: true })).toBeVisible();
    expect(membershipRequests).toEqual([]);
  });
}

test("guest can open membership form before signing in", async ({ page }) => {
  await mockAuth(page, { role: null, guest: true });
  await page.goto("/membership/apply");
  await expect(page).toHaveURL(/\/membership\/apply$/);
  await expect(page.getByLabel("Roll No.", { exact: true })).toBeVisible();
});

test("Apply Membership menu opens the student application form", async ({
  page,
}) => {
  await mockAuth(page, { role: "student" });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Apply Membership", exact: true })
    .click();
  await expect(page).toHaveURL(/\/membership\/apply$/);
  await expect(page.getByLabel("Roll No.", { exact: true })).toBeVisible();
});

test("Apply Membership returns guests to the form after login", async ({
  page,
}) => {
  const fixture: Fixture = { role: "student", guest: true };
  await mockAuth(page, fixture);
  await page.route("**/api/auth/sign-in/email", async (route) => {
    fixture.guest = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({
        redirect: false,
        token: "fictional",
        user: {
          id: "64b000000000000000000001",
          name: "Fictional Student",
          email: "fictional@example.com",
          role: "student",
        },
      }),
    });
  });
  await page.goto("/membership/apply");
  await expect(page).toHaveURL(/\/membership\/apply$/);
  await expect(page.getByLabel("Roll No.", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Sign in to apply for membership", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?next=%2Fmembership%2Fapply$/);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("fictional@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Fictional-Password!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/membership\/apply$/);
  await expect(page.getByLabel("Roll No.", { exact: true })).toBeVisible();
});

for (const account of ["guest", ...roles]) {
  test(`${account} navbar has exact role menu and inline controls`, async ({
    page,
  }) => {
    await mockAuth(page, {
      role: account === "guest" ? null : account,
      guest: account === "guest",
    });
    const privateRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/notifications"))
        privateRequests.push(request.url());
    });
    await page.route("**/api/notifications**", (route) =>
      route.fulfill({
        headers: {
          "access-control-allow-origin": new URL(page.url()).origin,
          "access-control-allow-credentials": "true",
        },
        json: {
          success: true,
          items: [],
          page: 1,
          hasNext: false,
          unreadCount: 0,
        },
      }),
    );
    await page.goto("/");
    const nav = page.getByRole("navigation", {
      name: "Main navigation",
      exact: true,
    });
    if (account === "guest")
      await expect(
        nav.getByRole("link", { name: "Sign in", exact: true }),
      ).toBeVisible();
    else
      await expect(
        nav.getByText("Welcome Fictional Learner", { exact: true }),
      ).toBeVisible();
    const expected = [
      "/",
      "/",
      "/members",
      "/faculty",
      ...(account === "student"
        ? ["/membership/apply"]
        : account === "guest"
          ? []
          : ["/faculty/add"]),
      ...(account === "guest" ? [] : ["/dashboard/" + account]),
      "/events",
      "/blog",
      account === "guest" ? "/login" : "/dashboard/notifications",
      ...(account === "guest" ? ["/login", "/signup"] : []),
    ];
    expect(
      await nav
        .locator("a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual(expected);
    const bell = nav.getByRole("link", { name: /^Notifications/ });
    await expect(bell).toHaveText("");
    await expect(bell.locator("svg")).toBeVisible();
    const centers = await nav
      .locator('a, [role="group"], [role="switch"]')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return rect.y + rect.height / 2;
        }),
      );
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
    if (account === "guest") expect(privateRequests).toEqual([]);
  });
}

test("membership status failure can be retried without losing authentication", async ({
  page,
}) => {
  const fixture: Fixture = { role: "student", membershipFailure: 500 };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/student");
  await expect(
    page.getByRole("button", { name: "Retry membership status", exact: true }),
  ).toBeVisible();
  fixture.membershipFailure = undefined;
  await page
    .getByRole("button", { name: "Retry membership status", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Apply for membership", exact: true }),
  ).toBeVisible();
});

function pendingAdminApplication(): AdminMembership {
  return {
    id: "64b000000000000000000001",
    fullName: "Fictional Applicant",
    studentId: "TEST-2026-01",
    department: "Science",
    academicYear: "2026-2027",
    phone: "01712345678",
    reason: "I would like to explore science through experiments.",
    status: "pending",
    submittedAt: "2026-11-01T10:00:00.000Z",
  };
}

for (const role of ["student", "teacher"]) {
  test(`${role} cannot open membership management`, async ({ page }) => {
    await mockAuth(page, { role });
    await page.goto("/dashboard/admin/memberships");
    await expect(
      page.getByRole("heading", { name: "Access Denied", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Membership applications",
        exact: true,
      }),
    ).toHaveCount(0);
  });
}
test("guest cannot open membership management", async ({ page }) => {
  await mockAuth(page, { role: null, guest: true });
  await page.goto("/dashboard/admin/memberships");
  await expect(page).toHaveURL(/\/login$/);
});

test("admin confirms approval, filters results and student sees approved status", async ({
  page,
}) => {
  const fixture: Fixture = {
    role: "admin",
    adminApplications: [pendingAdminApplication()],
    reviewRequests: [],
  };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/admin");
  await page
    .locator(".dashboard-tool-grid")
    .getByRole("link", { name: "Manage membership applications", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fictional Applicant", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TEST-2026-01", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(fixture.reviewRequests).toHaveLength(0);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByText("No pending applications on this page.", { exact: true }),
  ).toBeVisible();
  expect(fixture.reviewRequests).toEqual([{ decision: "approved" }]);
  await page.getByLabel("Status", { exact: true }).selectOption("approved");
  await expect(
    page.getByRole("heading", { name: "Fictional Applicant", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
  fixture.role = "student";
  await page.goto("/dashboard/student");
  await expect(
    page
      .getByRole("main")
      .getByText("Application status: approved", { exact: true }),
  ).toBeVisible();
});

test("admin application response validates metadata without weakening submission rules", () => {
  const legacy = {
    ...pendingAdminApplication(),
    phone: "",
    reason: "Join science",
    residence: "With family",
    sscGpa: null,
    signature: "",
    department: null,
    academicYear: null,
  };
  const parsed = adminApplicationSchema.parse(legacy);
  expect(parsed.department).toBe("");
  expect(parsed.academicYear).toBe("");
  expect(parsed.sscGpa).toBeUndefined();
  expect(parsed.reason).toBe("Join science");
  expect(
    adminApplicationSchema.safeParse({ ...legacy, status: "invalid" }).success,
  ).toBe(false);
  expect(
    adminApplicationSchema.safeParse({ ...legacy, submittedAt: "bad-date" })
      .success,
  ).toBe(false);
  expect(
    adminApplicationSchema.safeParse({ ...legacy, phone: { injected: true } })
      .success,
  ).toBe(false);
  expect(membershipFormSchema.safeParse(legacy).success).toBe(false);
});

test("admin can load and approve stored applications with legacy form values", async ({
  page,
}) => {
  const legacy = {
    ...pendingAdminApplication(),
    department: null,
    academicYear: null,
    phone: "",
    reason: "Join science",
    sscGpa: null,
    signature: "",
    residence: "With family",
  } as unknown as AdminMembership;
  const fixture: Fixture = {
    role: "admin",
    adminApplications: [
      legacy,
      {
        ...pendingAdminApplication(),
        id: "64b000000000000000000002",
        fullName: "Fictional Current Applicant",
      },
    ],
    reviewRequests: [],
  };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/admin/memberships");
  await expect(
    page.getByRole("heading", { name: "Fictional Applicant", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Current Applicant",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Approve", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  expect(fixture.reviewRequests).toEqual([{ decision: "approved" }]);
  await page.getByLabel("Status", { exact: true }).selectOption("approved");
  await expect(
    page.getByRole("heading", { name: "Fictional Applicant", exact: true }),
  ).toBeVisible();
});

test("admin rejection requires a reason and student receives it", async ({
  page,
}) => {
  const fixture: Fixture = {
    role: "admin",
    adminApplications: [pendingAdminApplication()],
    reviewRequests: [],
  };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/admin/memberships");
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Confirm rejection", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Provide a rejection reason of 5\u20131000 characters.",
  );
  expect(fixture.reviewRequests).toHaveLength(0);
  await dialog
    .getByLabel("Rejection reason", { exact: true })
    .fill("Please correct the student details.");
  await dialog
    .getByRole("button", { name: "Confirm rejection", exact: true })
    .click();
  await expect(
    page.getByText("No pending applications on this page.", { exact: true }),
  ).toBeVisible();
  expect(fixture.reviewRequests).toEqual([
    {
      decision: "rejected",
      rejectionReason: "Please correct the student details.",
    },
  ]);
  await page.getByLabel("Status", { exact: true }).selectOption("rejected");
  await expect(
    page.getByText("Rejection reason: Please correct the student details.", {
      exact: true,
    }),
  ).toBeVisible();
  fixture.role = "student";
  await page.goto("/dashboard/student");
  await expect(
    page
      .getByRole("main")
      .getByText("Application status: rejected", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText("Rejection reason: Please correct the student details.", {
        exact: true,
      }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Refresh membership status", exact: true })
    .click();
  await expect(
    page
      .getByRole("main")
      .getByText("Application status: rejected", { exact: true }),
  ).toBeVisible();
});

test("stale review conflict refreshes the list and does not repeat the decision", async ({
  page,
}) => {
  const application = pendingAdminApplication();
  const fixture: Fixture = {
    role: "admin",
    adminApplications: [application],
    reviewRequests: [],
  };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/admin/memberships");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  application.status = "approved";
  fixture.reviewFailure = 409;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("No pending applications on this page.", { exact: true }),
  ).toBeVisible();
  expect(fixture.reviewRequests).toHaveLength(1);
});

test("admin list errors support refresh and backend 403 denies a stale admin session", async ({
  page,
}) => {
  const fixture: Fixture = { role: "admin", adminFailure: 500 };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/admin/memberships");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Unable to load or review applications." }),
  ).toBeVisible();
  fixture.adminFailure = undefined;
  await page
    .getByRole("button", { name: "Refresh applications", exact: true })
    .click();
  await expect(
    page.getByText("No pending applications on this page.", { exact: true }),
  ).toBeVisible();
  fixture.adminFailure = 403;
  await page
    .getByRole("button", { name: "Refresh applications", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Access Denied", exact: true }),
  ).toBeVisible();
});

test("approved student edits own profile and public profile remains synchronized and private", async ({
  page,
}) => {
  const fixture: Fixture = {
    role: "student",
    application: {
      status: "approved",
      submittedAt: "2026-11-01T10:00:00.000Z",
    },
    profileRequests: [],
  };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/student");
  await page
    .getByRole("link", { name: "Manage member profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/student\/profile$/);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Fictional Member",
  );
  await expect(page.getByText("TEST-2026-01", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "100");
  await page.getByLabel("Phone", { exact: true }).fill("bad");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  expect(fixture.profileRequests).toHaveLength(0);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Updated Fictional Member");
  await page.getByLabel("Phone", { exact: true }).fill("01912345678");
  await page.getByLabel("Department", { exact: true }).fill("Physics");
  await page.getByLabel("Academic year", { exact: true }).fill("2027-2028");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Member profile updated.", { exact: true }),
  ).toBeVisible();
  expect(fixture.profileRequests).toEqual([
    {
      fullName: "Updated Fictional Member",
      phone: "01912345678",
      department: "Physics",
      academicYear: "2027-2028",
    },
  ]);
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Updated Fictional Member",
  );
  await page
    .getByRole("link", { name: "View public profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Updated Fictional Member",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("01912345678");
  await expect(page.getByRole("main")).not.toContainText("TEST-2026-01");
});

for (const role of ["teacher", "admin"])
  test(`${role} cannot edit student member profile`, async ({ page }) => {
    await mockAuth(page, { role });
    await page.goto("/dashboard/student/profile");
    await expect(
      page.getByRole("heading", { name: "Access Denied", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save profile", exact: true }),
    ).toHaveCount(0);
  });

test("guest and unapproved student cannot edit member profile", async ({
  page,
}) => {
  const fixture: Fixture = { role: "student", guest: true };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/student/profile");
  await expect(page).toHaveURL(/\/login$/);
  fixture.guest = false;
  await page.goto("/dashboard/student/profile");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "An approved student membership is required",
  );
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toHaveCount(0);
});

test("member profile load and save errors support retry and preserve input", async ({
  page,
}) => {
  const fixture: Fixture = {
    role: "student",
    application: {
      status: "approved",
      submittedAt: "2026-11-01T10:00:00.000Z",
    },
    profileFailure: 500,
  };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/student/profile");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Unable to load your member profile.",
  );
  fixture.profileFailure = undefined;
  await page
    .getByRole("button", { name: "Retry profile", exact: true })
    .click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Fictional Member",
  );
  fixture.profileSaveFailure = 500;
  await page.getByLabel("Department", { exact: true }).fill("Physics");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText(
      "Unable to load or save your member profile. Please try again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Department", { exact: true })).toHaveValue(
    "Physics",
  );
  fixture.profileSaveFailure = undefined;
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Member profile updated.", { exact: true }),
  ).toBeVisible();
});

test("member editor shows legacy completion and hides form after membership revocation", async ({
  page,
}) => {
  const fixture: Fixture = {
    role: "student",
    profile: {
      fullName: "Fictional Member",
      phone: "",
      department: "Science",
      academicYear: "2026-2027",
      studentId: "TEST-2026-01",
      status: "approved",
      membershipDate: null,
      completion: 75,
    },
  };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/student/profile");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "75");
  await expect(page.getByText("Not recorded", { exact: true })).toBeVisible();
  await page.getByLabel("Phone", { exact: true }).fill("01912345678");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "100");
  fixture.profileSaveFailure = 403;
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "An approved student membership is required",
  );
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toHaveCount(0);
});

test("expired session while saving own profile redirects to login", async ({
  page,
}) => {
  const fixture: Fixture = {
    role: "student",
    application: {
      status: "approved",
      submittedAt: "2026-11-01T10:00:00.000Z",
    },
  };
  await mockAuth(page, fixture);
  await page.goto("/dashboard/student/profile");
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  fixture.profileSaveFailure = 401;
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

for (const role of roles) {
  test(`${role} reference dashboard has responsive navigation and real performance charts`, async ({
    page,
  }, testInfo) => {
    await mockAuth(page, { role });
    await page.route("**/api/*/performance?**", (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": new URL(page.url()).origin,
          "access-control-allow-credentials": "true",
        },
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          range: { from: "2026-01-01", to: "2026-12-31" },
          completed: 7,
          averagePercentage: 74.5,
          bestPercentage: 95,
          page: 1,
          quizzesHasNext: false,
          historyHasNext: false,
          rankingsHasNext: false,
          quizzes: [],
          timeline: [
            { month: "2026-01", completed: 2, averagePercentage: 65 },
            { month: "2026-02", completed: 3, averagePercentage: 80 },
            { month: "2026-03", completed: 2, averagePercentage: 78.5 },
          ],
          history: [],
          rankings: [],
        }),
      }),
    );
    await page.goto(`/dashboard/${role}`);
    await expect(
      page.getByRole("heading", {
        name: `${label(role)} Dashboard`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".dashboard-stat-grid")).toContainText("74.5%");
    await expect(page.locator(".dashboard-chart svg")).toHaveCount(2);
    await page.getByText("View data table", { exact: true }).click();
    await expect(page.locator(".dashboard-chart-table table")).toContainText(
      "2026-02",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (testInfo.project.name.startsWith("mobile")) {
      await page
        .getByRole("button", { name: "Main navigation", exact: true })
        .click();
      await expect(page.locator("#dashboard-sidebar")).toHaveClass(/is-open/);
      await page
        .locator("#dashboard-sidebar")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await expect(page.locator("#dashboard-sidebar")).not.toHaveClass(
        /is-open/,
      );
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`${role}-dashboard.png`),
      fullPage: true,
    });
  });
}

test("dashboard performance handles API failure, retry and empty released results", async ({
  page,
}) => {
  await mockAuth(page, { role: "student" });
  let fail = true;
  await page.route("**/api/*/performance?**", (route) =>
    route.fulfill({
      status: fail ? 500 : 200,
      headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      },
      contentType: "application/json",
      body: JSON.stringify(
        fail
          ? { success: false }
          : {
              success: true,
              range: { from: "2026-01-01", to: "2026-12-31" },
              completed: 0,
              averagePercentage: 0,
              bestPercentage: 0,
              page: 1,
              quizzesHasNext: false,
              historyHasNext: false,
              rankingsHasNext: false,
              quizzes: [],
              timeline: [],
              history: [],
              rankings: [],
            },
      ),
    }),
  );
  await page.goto("/dashboard/student");
  await expect(page.locator(".dashboard-progress")).toContainText(
    "Unable to load performance. Please retry.",
  );
  fail = false;
  await page
    .locator(".dashboard-progress")
    .getByRole("button", { name: "Retry", exact: true })
    .click();
  await expect(page.locator(".dashboard-progress")).toContainText(
    "No released results in this range.",
  );
  await expect(page.locator(".dashboard-chart svg")).toHaveCount(0);
});
