import { expect, test, type Page, type Route } from "@playwright/test";
import type { ClubEvent } from "../src/lib/event-api";
const eventId = "64b000000000000000000001";
type Registration = {
  id: string;
  name: string;
  status: "registered" | "cancelled";
  attendance: "unmarked" | "present" | "absent";
  version: number;
  registeredAt: string;
};
async function fixture(
  page: Page,
  options: {
    role?: string;
    guest?: boolean;
    pending?: boolean;
    failure?: number;
    empty?: boolean;
    expired?: boolean;
  } = {},
) {
  const event: ClubEvent = {
    id: eventId,
    title: "Fictional astronomy workshop",
    description: "Learn about fictional stars and scientific observations.",
    category: "workshop",
    startsAt: "2035-06-01T04:00:00.000Z",
    venue: "Fictional college laboratory",
    capacity: 2,
    image: "",
    status: "published",
    version: 1,
    registeredCount: 0,
    createdAt: "2026-11-01T10:00:00.000Z",
  };
  const state: {
    events: ClubEvent[];
    registrations: Registration[];
    calls: { path: string; method: string; body: unknown }[];
    failure: number;
  } = {
    events: options.empty ? [] : [event],
    registrations: [],
    calls: [],
    failure: options.failure ?? 0,
  };
  const headers = () => ({
    "access-control-allow-origin": new URL(page.url()).origin,
    "access-control-allow-credentials": "true",
  });
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      headers: headers(),
      json: options.guest
        ? null
        : {
            user: {
              id: "fictional",
              name: "Fictional Learner",
              email: "fictional@example.com",
              role: options.role ?? "student",
            },
            session: {
              id: "fixture",
              userId: "fictional",
              token: "fictional-only",
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
    }),
  );
  await page.route("**/api/*/overview", (route) =>
    route.fulfill({
      status: options.expired ? 401 : 200,
      headers: headers(),
      json: { success: !options.expired, message: "Access granted" },
    }),
  );
  async function respond(route: Route) {
    const req = route.request(),
      url = new URL(req.url()),
      method = req.method(),
      path = url.pathname,
      body = method === "GET" ? undefined : req.postDataJSON();
    state.calls.push({ path, method, body });
    const send = (json: unknown, status = 200) =>
      route.fulfill({ status, headers: headers(), json });
    if (state.failure) return send({ success: false }, state.failure);
    if (path.startsWith("/api/student/") && options.pending)
      return send({ success: false }, 403);
    if (path === "/api/manage/events/stats")
      return send({
        success: true,
        total: state.events.length,
        published: state.events.filter((e) => e.status === "published").length,
        draft: state.events.filter((e) => e.status === "draft").length,
        cancelled: state.events.filter((e) => e.status === "cancelled").length,
        registrations: state.registrations.filter(
          (r) => r.status === "registered",
        ).length,
        present: state.registrations.filter((r) => r.attendance === "present")
          .length,
        absent: state.registrations.filter((r) => r.attendance === "absent")
          .length,
        categories: [{ category: "workshop", count: state.events.length }],
      });
    if (path === "/api/manage/events" && method === "POST") {
      const row = {
        ...event,
        ...body,
        id: "64b000000000000000000002",
        status: "draft",
        version: 1,
        registeredCount: 0,
      };
      state.events.push(row);
      return send({ success: true, event: row }, 201);
    }
    const match = state.events.find((e) => path.includes(e.id));
    if (path.endsWith("/participants") && match)
      return send({
        success: true,
        event: match,
        items: state.registrations.filter((r) => r.status === "registered"),
        counts: {
          registered: state.registrations.filter(
            (r) => r.status === "registered",
          ).length,
          present: state.registrations.filter((r) => r.attendance === "present")
            .length,
          absent: state.registrations.filter((r) => r.attendance === "absent")
            .length,
        },
        page: 1,
        hasNext: false,
      });
    if (path.endsWith("/attendance") && match) {
      const row = state.registrations.find((r) => r.id === body.registrationId);
      if (!row) return send({ success: false }, 409);
      row.attendance = body.attendance;
      row.version++;
      return send({ success: true, registration: row });
    }
    if (path.startsWith("/api/manage/events/") && match) {
      if (method === "DELETE") {
        state.events = state.events.filter((e) => e.id !== match.id);
        return route.fulfill({ status: 204, headers: headers() });
      }
      if (method === "PATCH") {
        Object.assign(match, body, { version: match.version + 1 });
        return send({ success: true, event: match });
      }
    }
    if (path === "/api/manage/events") {
      const status = url.searchParams.get("status");
      return send({
        success: true,
        events: state.events.filter((e) => !status || e.status === status),
        page: 1,
        hasNext: false,
      });
    }
    if (path === "/api/events") {
      const category = url.searchParams.get("category"),
        period = url.searchParams.get("period");
      return send({
        success: true,
        events: state.events.filter(
          (e) =>
            e.status !== "draft" &&
            (!category || category === e.category) &&
            (period === "all" ||
              (period === "past"
                ? Date.parse(e.startsAt) <= Date.now()
                : Date.parse(e.startsAt) > Date.now())),
        ),
        page: 1,
        hasNext: false,
      });
    }
    if (path === "/api/student/events")
      return send({
        success: true,
        items: state.registrations.map((registration) => ({
          event,
          registration,
        })),
        page: 1,
        hasNext: false,
      });
    if (match && path.startsWith("/api/student/")) {
      let registration = state.registrations[0] ?? null;
      if (path.endsWith("/register")) {
        registration = {
          id: `${eventId}:fictional`,
          name: "Fictional Learner",
          status: "registered",
          attendance: "unmarked",
          version: 1,
          registeredAt: new Date().toISOString(),
        };
        state.registrations = [registration];
        match.registeredCount = 1;
      }
      if (path.endsWith("/cancel") && registration) {
        registration.status = "cancelled";
        registration.version++;
        match.registeredCount = 0;
      }
      return send({ success: true, event: match, registration });
    }
    if (match) return send({ success: true, event: match });
    return send({ success: false }, 404);
  }
  await page.route("**/api/events**", respond);
  await page.route("**/api/student/events**", respond);
  await page.route("**/api/manage/events**", respond);
  return { event, state };
}
test("public catalog and details work for guests, including category and date filters", async ({
  page,
}) => {
  await fixture(page, { guest: true });
  await page.goto("/events");
  await expect(
    page.getByRole("heading", { name: "Fictional astronomy workshop" }),
  ).toBeVisible();
  await page.getByLabel("Event category").selectOption("seminar");
  await expect(page.getByText("No events match these filters.")).toBeVisible();
  await page.getByLabel("Event category").selectOption("workshop");
  await page.getByRole("link", { name: "View event", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional astronomy workshop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in to register" }),
  ).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(
    "fictional@example.com",
  );
});
test("approved student registers, refreshes and confirms cancellation", async ({
  page,
}) => {
  const { state } = await fixture(page);
  await page.goto(`/events/${eventId}`);
  await page.getByRole("button", { name: "Register for event" }).click();
  await expect(
    page.getByText("Registration: registered", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Registration: registered", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel registration", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.registrations[0].status).toBe("registered");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByText("Registration: cancelled", { exact: true }),
  ).toBeVisible();
  expect(
    state.calls
      .filter((c) => c.method === "POST")
      .every((c) => JSON.stringify(c.body) === "{}"),
  ).toBe(true);
});
test("unapproved member cannot register", async ({ page }) => {
  await fixture(page, { pending: true });
  await page.goto(`/events/${eventId}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Approved membership",
  );
  await expect(
    page.getByRole("button", { name: "Register for event" }),
  ).toHaveCount(0);
});
test("cancelled and full events cannot accept new registrations", async ({
  page,
}) => {
  const { event } = await fixture(page);
  event.registeredCount = event.capacity;
  await page.goto(`/events/${eventId}`);
  await expect(
    page.getByRole("button", { name: "Register for event" }),
  ).toBeDisabled();
  event.status = "cancelled";
  await page
    .getByRole("button", { name: "Refresh event", exact: true })
    .click();
  await expect(
    page.getByText("This event has been cancelled.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Register for event" }),
  ).toBeDisabled();
});
test("student my events shows registration and participation", async ({
  page,
}) => {
  const { state } = await fixture(page);
  state.registrations.push({
    id: "fixture-registration",
    name: "Fictional Learner",
    status: "registered",
    attendance: "present",
    version: 2,
    registeredAt: new Date().toISOString(),
  });
  await page.goto("/dashboard/student/events");
  await expect(
    page.getByText("Attendance: present", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Registration: registered", { exact: true }),
  ).toBeVisible();
});
test("teacher creates edits publishes unpublishes and archives an activity", async ({
  page,
}) => {
  const { state } = await fixture(page, { role: "teacher", empty: true });
  await page.goto("/dashboard/teacher/events");
  await page.getByRole("button", { name: "Create event", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Fictional seminar");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A fictional seminar for isolated browser testing.");
  await page.getByLabel("Category", { exact: true }).selectOption("seminar");
  await page.getByLabel("Date (Dhaka)", { exact: true }).fill("2035-06-01");
  await page.getByLabel("Time (Dhaka)", { exact: true }).fill("10:00");
  await page.getByLabel("Venue", { exact: true }).fill("Fictional hall");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Fictional seminar" });
  await expect(row).toBeVisible();
  expect(state.events[0].startsAt).toBe("2035-06-01T04:00:00.000Z");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Updated fictional seminar");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const updated = page
    .getByRole("row")
    .filter({ hasText: "Updated fictional seminar" });
  await updated.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    updated.getByRole("button", { name: "Edit", exact: true }),
  ).toBeDisabled();
  await updated.getByRole("button", { name: "Unpublish", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await updated.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("No events match this status.")).toBeVisible();
});
test("staff confirms attendance and sees updated counts", async ({ page }) => {
  const { event, state } = await fixture(page, { role: "teacher" });
  event.startsAt = "2020-01-01T04:00:00.000Z";
  state.registrations.push({
    id: "fixture-registration",
    name: "Fictional Member",
    status: "registered",
    attendance: "unmarked",
    version: 1,
    registeredAt: new Date().toISOString(),
  });
  await page.goto(`/dashboard/teacher/events/${eventId}`);
  const row = page.getByRole("row").filter({ hasText: "Fictional Member" });
  await row.getByRole("button", { name: "Present", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.registrations[0].attendance).toBe("unmarked");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Present", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Registered: 1 · Present: 1 · Absent: 0 · Unmarked: 0"),
  ).toBeVisible();
});
test("admin management displays statistics and cancellation confirmation", async ({
  page,
}) => {
  const { event } = await fixture(page, { role: "admin" });
  await page.goto("/dashboard/admin/events");
  await expect(
    page.getByRole("heading", { name: "Total events", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel event", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(event.status).toBe("published");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancel event", exact: true }),
  ).toBeDisabled();
});
test("student direct staff URL is denied", async ({ page }) => {
  await fixture(page);
  await page.goto(`/dashboard/teacher/events/${eventId}`);
  await expect(
    page.getByRole("heading", { name: /Access Denied/ }),
  ).toBeVisible();
});
test("teacher cannot open admin event dashboard", async ({ page }) => {
  await fixture(page, { role: "teacher" });
  await page.goto("/dashboard/admin/events");
  await expect(
    page.getByRole("heading", { name: /Access Denied/ }),
  ).toBeVisible();
});
test("guests redirect from protected my events", async ({ page }) => {
  await fixture(page, { guest: true });
  await page.goto("/dashboard/student/events");
  await expect(page).toHaveURL(/\/login$/);
});
test("expired sessions redirect from protected my events", async ({ page }) => {
  await fixture(page, { expired: true });
  await page.goto("/dashboard/student/events");
  await expect(page).toHaveURL(/\/login$/);
});
test("errors support retry and empty participation has a useful state", async ({
  page,
}) => {
  const { state } = await fixture(page, { failure: 500 });
  await page.goto("/events");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  state.failure = 0;
  await page
    .getByRole("button", { name: "Refresh events", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fictional astronomy workshop" }),
  ).toBeVisible();
  await page.goto("/dashboard/student/events");
  await expect(
    page.getByText("You have not registered for any events yet."),
  ).toBeVisible();
});
