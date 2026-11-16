import { test, expect, type Page } from "@playwright/test";
const profile = {
  id: "64b000000000000000000001",
  name: "Fictional Mentor",
  designation: "Lecturer",
  department: "Physics",
  specialization: "Optics",
  photo: "",
  bio: "Fictional biography for a college science mentor.",
};
async function mock(page: Page, role = "admin") {
  const headers = {
    "access-control-allow-origin": "http://localhost:3100",
    "access-control-allow-credentials": "true",
  };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers,
      json: {
        user: {
          id: profile.id,
          name: "Fictional Admin",
          email: "fixture@example.com",
          emailVerified: true,
          role,
        },
        session: {
          id: "fixture",
          userId: profile.id,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      },
    }),
  );
  await page.route("**/api/*/overview", (route) =>
    route.fulfill({
      headers,
      json: { success: true, message: "Access granted" },
    }),
  );
  await page.route("**/api/faculty**", (route) =>
    route.fulfill({
      headers,
      json: route.request().url().includes("/filters")
        ? {
            success: true,
            departments: ["Physics"],
            designations: ["Lecturer"],
          }
        : route.request().url().includes(profile.id)
          ? { success: true, profile }
          : { success: true, items: [profile], page: 1, hasNext: false },
    }),
  );
  await page.route("**/api/teacher/activities**", (route) =>
    route.fulfill({
      headers,
      json: {
        success: true,
        page: 1,
        hasNext: false,
        items: [
          {
            id: profile.id,
            title: "Fictional science seminar",
            venue: "College lab",
            startsAt: "2026-12-01T04:00:00Z",
            status: "published",
          },
        ],
      },
    }),
  );
  const managed = {
    ...profile,
    version: 1,
    published: true,
    teacherAccountId: "",
    assignedEventIds: [],
  };
  await page.route("**/api/admin/faculty**", (route) =>
    route.fulfill({
      headers,
      json:
        route.request().method() === "GET"
          ? { success: true, page: 1, hasNext: false, items: [managed] }
          : { success: true, profile: managed },
    }),
  );
}
test("public directory and faculty profile", async ({ page }) => {
  await mock(page);
  await page.goto("/faculty");
  await expect(
    page.getByRole("heading", { name: "Fictional Mentor" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View mentor profile" }).click();
  await expect(page.getByText(profile.bio)).toBeVisible();
});

test("department and designation dropdowns combine, reset, and search from a profile", async ({
  page,
}) => {
  await mock(page);
  const teachers = [
    profile,
    {
      ...profile,
      id: "64b000000000000000000002",
      name: "Fictional Professor",
      designation: "Professor",
    },
    {
      ...profile,
      id: "64b000000000000000000003",
      name: "Fictional Chemist",
      department: "Chemistry",
    },
  ];
  await page.route("**/api/faculty**", (route) => {
    const url = new URL(route.request().url());
    const headers = {
      "access-control-allow-origin": "http://localhost:3100",
      "access-control-allow-credentials": "true",
    };
    if (url.pathname.endsWith("/filters"))
      return route.fulfill({
        headers,
        json: {
          success: true,
          departments: ["Chemistry", "Physics"],
          designations: ["Lecturer", "Professor"],
        },
      });
    const found = teachers.find((item) => url.pathname.endsWith(item.id));
    if (found)
      return route.fulfill({
        headers,
        json: { success: true, profile: found },
      });
    const filtered = teachers.filter(
      (item) =>
        (!url.searchParams.get("department") ||
          item.department === url.searchParams.get("department")) &&
        (!url.searchParams.get("designation") ||
          item.designation === url.searchParams.get("designation")),
    );
    return route.fulfill({
      headers,
      json: { success: true, items: filtered, page: 1, hasNext: false },
    });
  });
  await page.goto("/faculty");
  const department = page.getByRole("combobox", {
    name: "Department",
    exact: true,
  });
  const designation = page.getByRole("combobox", {
    name: "Designation",
    exact: true,
  });
  await expect(department.locator("option")).toHaveText([
    "All departments",
    "Chemistry",
    "Physics",
  ]);
  await expect(designation.locator("option")).toHaveText([
    "All designations",
    "Lecturer",
    "Professor",
  ]);
  await department.selectOption("Physics");
  await designation.selectOption("Lecturer");
  await page
    .getByRole("button", { name: "Search teachers", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: profile.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fictional Professor", exact: true }),
  ).toHaveCount(0);
  await department.selectOption("Chemistry");
  await designation.selectOption("Professor");
  await page
    .getByRole("button", { name: "Search teachers", exact: true })
    .click();
  await expect(
    page.getByText("No faculty profiles found.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fictional Professor", exact: true }),
  ).toBeVisible();
  await page.goto("/faculty/" + profile.id);
  await expect(page.getByText(profile.bio, { exact: true })).toBeVisible();
  await department.selectOption("Chemistry");
  await page
    .getByRole("button", { name: "Search teachers", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fictional Chemist", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.getByText(profile.bio, { exact: true })).toBeVisible();
  await department.selectOption("Chemistry");
  await page
    .getByRole("button", { name: "Search teachers", exact: true })
    .click();
  await page
    .getByRole("link", { name: "View mentor profile", exact: true })
    .click();
  await expect(page).toHaveURL(/64b000000000000000000003$/);
  await expect(
    page.getByRole("heading", { name: "Faculty mentor profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fictional Chemist", exact: true }),
  ).toBeVisible();
});

test("teacher dropdown options can recover from a load failure", async ({
  page,
}) => {
  await mock(page);
  let fail = true;
  await page.route("**/api/faculty/filters", (route) =>
    route.fulfill({
      status: fail ? 500 : 200,
      headers: {
        "access-control-allow-origin": "http://localhost:3100",
        "access-control-allow-credentials": "true",
      },
      json: fail
        ? { success: false }
        : {
            success: true,
            departments: ["Physics"],
            designations: ["Lecturer"],
          },
    }),
  );
  await page.goto("/faculty");
  await expect(
    page.getByText("Unable to load teacher search options.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Department", exact: true }),
  ).toBeDisabled();
  fail = false;
  await page
    .getByRole("button", { name: "Retry teacher search options", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Department", exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole("combobox", { name: "Designation", exact: true })
      .locator("option"),
  ).toHaveText(["All designations", "Lecturer"]);
});
test("admin edits and confirms archival", async ({ page }) => {
  await mock(page);
  await page.goto("/dashboard/admin/faculty");
  await page.getByRole("button", { name: "Edit Fictional Mentor" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    profile.name,
  );
  await page
    .getByLabel("Biography")
    .fill("Updated fictional mentor biography.");
  await page.getByRole("button", { name: "Save faculty profile" }).click();
  await expect(
    page.getByRole("button", { name: "Save faculty profile" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Archive Fictional Mentor" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("assigned teacher activities and denied student management", async ({
  page,
}) => {
  await mock(page, "teacher");
  await page.goto("/dashboard/teacher/activities");
  await expect(
    page.getByRole("heading", { name: "Fictional science seminar" }),
  ).toBeVisible();
  await mock(page, "student");
  await page.goto("/dashboard/admin/faculty");
  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
});

for (const role of ["teacher", "admin"]) {
  test(`${role} adds teacher through navbar and sees saved directory entry`, async ({
    page,
  }) => {
    await mock(page, role);
    let saved: Record<string, string> | undefined;
    await page.route("**/api/manage/teachers", async (route) => {
      saved = route.request().postDataJSON();
      await route.fulfill({
        headers: {
          "access-control-allow-origin": "http://localhost:3100",
          "access-control-allow-credentials": "true",
        },
        json: { success: true, profile: { ...profile, ...saved } },
      });
    });
    await page.route("**/api/faculty**", (route) =>
      route.fulfill({
        headers: {
          "access-control-allow-origin": "http://localhost:3100",
          "access-control-allow-credentials": "true",
        },
        json: {
          success: true,
          items: saved ? [{ ...profile, ...saved }] : [],
          page: 1,
          hasNext: false,
        },
      }),
    );
    await page.goto("/");
    await page.getByRole("link", { name: "Add teacher", exact: true }).click();
    await expect(page).toHaveURL(/\/faculty\/add$/);
    await page
      .getByRole("button", { name: "Save teacher", exact: true })
      .click();
    await expect(page.getByLabel("Full Name", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    const values = {
      name: "Fictional New Teacher",
      designation: "Lecturer",
      department: "Chemistry",
      bcsBatch: "41st",
      email: "new-teacher@example.com",
      phone: "01712345678",
    };
    for (const [label, value] of Object.entries({
      "Full Name": values.name,
      Designation: values.designation,
      "Department / Subject Name": values.department,
      "BCS Batch": values.bcsBatch,
      Email: values.email,
      "Mobile No.": values.phone,
    }))
      await page.getByLabel(label, { exact: true }).fill(value);
    await page
      .getByRole("button", { name: "Save teacher", exact: true })
      .click();
    await expect(page).toHaveURL(/\/faculty$/);
    expect(saved).toEqual(values);
    await expect(
      page.getByRole("heading", { name: values.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("BCS Batch: 41st", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(values.email, { exact: true })).toHaveCount(0);
    await expect(page.getByText(values.phone, { exact: true })).toHaveCount(0);
  });
}

test("student cannot see add teacher link or open form", async ({ page }) => {
  await mock(page, "student");
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Add teacher", exact: true }),
  ).toHaveCount(0);
  await page.goto("/faculty/add");
  await expect(
    page.getByRole("heading", { name: "Access Denied", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save teacher", exact: true }),
  ).toHaveCount(0);
});

test("guest cannot see add teacher link and is sent to login", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers: {
        "access-control-allow-origin": "http://localhost:3100",
        "access-control-allow-credentials": "true",
      },
      json: null,
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Add teacher", exact: true }),
  ).toHaveCount(0);
  await page.goto("/faculty/add");
  await expect(page).toHaveURL(/\/login$/);
});

test("teacher form preserves values on API failure and cancel opens teachers", async ({
  page,
}) => {
  await mock(page, "teacher");
  await page.route("**/api/manage/teachers", (route) =>
    route.fulfill({
      status: 500,
      headers: {
        "access-control-allow-origin": "http://localhost:3100",
        "access-control-allow-credentials": "true",
      },
      json: { success: false },
    }),
  );
  await page.goto("/faculty/add");
  for (const [label, value] of Object.entries({
    "Full Name": "Fictional Teacher",
    Designation: "Lecturer",
    "Department / Subject Name": "Physics",
    "BCS Batch": "40th",
    Email: "fixture@example.com",
    "Mobile No.": "01712345678",
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Save teacher", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(
    "Fictional Teacher",
  );
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/faculty$/);
});
