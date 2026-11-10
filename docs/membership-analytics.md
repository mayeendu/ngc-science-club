# Milestone 04, Lesson 05: membership analytics

Admins can open `/dashboard/admin/analytics` from the existing admin dashboard. The page uses shadcn cards and Recharts 3.10.1 (verified compatible with installed React 19) for a monthly line chart and department bar chart. Recharts was not previously installed; it is the only new direct dependency, pinned with the client lockfile.

## API, dates and metric definitions

GET `/api/admin/membership-analytics?from=2026-01-01&to=2026-03-31` requires the existing Better Auth session and fresh admin role lookup. Guests receive 401; students/teachers/unknown roles receive 403. It is read-only and uses existing private/no-store response protection.

Both dates must be provided together as ISO calendar dates, or both omitted. Defaults span the first day of the month eleven months ago through today. Dates are UTC, inclusive at both calendar-day endpoints (MongoDB uses an exclusive next-day upper bound). The maximum range is 731 inclusive days, within years 2000–2100. Unknown keys, nested objects, invalid dates, reversed ranges, or oversized ranges return 400 before aggregation.

- KPI cohort: applications submitted in the selected range, categorized by their current pending/approved/rejected status. Approval rate is current approved / total applications, rounded to two decimal places; zero total yields 0%.
- Monthly applications: counts by UTC submission month. Monthly growth: currently approved members whose review/approval date falls in the selected range, grouped by UTC approval month. Missing months are filled with zero by the backend.
- Department distribution: currently approved members approved in the selected range, grouped by their current department. An application submitted before the range may still contribute to approval charts if approved during it; chart totals therefore need not equal the submitted-cohort approved KPI.
- Trend: current submission count versus the preceding equal-length UTC period. Growth percentage uses that previous count; no previous baseline produces null when current activity exists, or zero when both periods are empty. The frontend formats these results but does not compute statistics.
- Recent applications: latest five submissions in range, exposing only status and submission date. No names, account/application IDs, student IDs, contact data, application reasons, reviewer identities or rejection reasons are returned.

These are current-state analytics, not an immutable audit/history report. Later approval/status/profile-department changes affect subsequent requests. Missing legacy approval dates do not invent historical membership growth. No cumulative lifetime membership total or real-time push is implied.

## Aggregation and files

`server/src/modules/membership-analytics/analytics.schema.ts` validates dates and defines the response; `analytics.repository.ts` builds one bounded MongoDB aggregation with an early match/projection and facets for KPIs, monthly activity, departments, anonymous recent activity and previous-period volume. It reads the existing membershipApplications collection on the primary with a ten-second query timeout. Private fields are removed before facets, and results are mapped explicitly. It does not fetch whole student records or issue a query per chart/member. `analytics.routes.ts` reuses session/admin middleware; `server/src/app.ts` registers it with repository injection for isolated tests.

`client/src/lib/membership-analytics-api.ts` validates API responses and handles credentialed no-store requests/timeouts. `client/src/components/membership/membership-analytics.tsx` provides date controls, skeletons, error/retry, zero-activity state, KPI cards, responsive charts, anonymous recent summaries and accessible chart-data tables. `client/src/app/dashboard/admin/analytics/page.tsx` uses RoleGuard. The existing admin dashboard adds its navigation link. Aggregate student data is fetched only after backend authorization, never embedded in the initial Next.js HTML.

`server/tests/membership-analytics.test.mjs` exercises the actual pipeline through a small in-memory evaluator and mocked sessions, not a live MongoDB server. `client/tests/analytics.spec.ts` mocks API responses for desktop/mobile browser checks. No records, roles, database indexes or production configuration are changed by tests.

## Commands and manual checks (PowerShell)

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:analytics
npm.cmd run test:membership
npm.cmd run test:rbac
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:analytics
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

With both apps running, sign in as an existing authorized admin and follow Membership analytics. Change date filters, inspect KPI definitions and View chart data, and test an empty range. Compare records only through authorized admin tools; do not change real applications just to exercise charts. Guests should reach login; student/teacher direct visits should show Access Denied. Stop Express to check retry behavior. Refresh analytics after an authorized application review to reread current statistics.

Before high-volume deployment, assess indexes on submittedAt and status/reviewedAt using actual query plans. No index write is introduced automatically. The early date match and single aggregation reduce repeated scans, but do not promise an indexed query on existing deployments. Large department lists and historical reporting may need later product/performance work.

The runtime dependency audit still reports the previously documented six shadcn-tooling findings (two low, four moderate), with no Recharts entry. No breaking audit fix was applied. Recharts installation/compatibility was checked against [official installation guidance](https://recharts.github.io/en-US/guide/installation/) and its published peer dependencies.

Concepts learned: backend-owned metrics, explicit cohort/date definitions, MongoDB facets, zero-safe percentages, anonymous summaries, and chart/table presentation of the same trusted data. Stop after Lesson 05; no next milestone is implemented.

Verification: client/server typechecks, lint and production builds passed. Analytics API tests passed 8/8, membership/profile regressions 20/20, RBAC regressions 34/34 and desktop/mobile analytics browser checks 16/16. Tests used isolated evaluators/mocks, not live Atlas writes. Git whitespace checks passed; local environment files remain ignored.
