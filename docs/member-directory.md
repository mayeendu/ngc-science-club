# Milestone 04, Lesson 03: approved member directory

Public `/members` and `/members/[id]` now read approved applications directly. The old separate `members` collection is no longer the source of the public count; the existing `/api/members/count` response shape stays unchanged. No application, role or database index is modified by this lesson.

## Public API contract

| Route                    | Behavior                                                                        |
| ------------------------ | ------------------------------------------------------------------------------- |
| GET `/api/members`       | Public approved list, name search, exact department/year filters and pagination |
| GET `/api/members/:id`   | Approved profile only; valid missing/pending/rejected IDs return the same 404   |
| GET `/api/members/count` | `{ success: true, totalMembers }`, counting approved applications only          |
| GET `/api/members/stats` | Global approved count, department/count pairs, available academic years         |

List parameters: `search` (trimmed, max 80 characters), `department` (1–100), `academicYear` (1–40), `page` (1–1000, default 1). Page size is 12. Unknown keys, nested filter objects, invalid IDs and malformed pages return 400. Search is literal case-insensitive substring matching: regex metacharacters are escaped. IDs use the existing 24-character lowercase account/application identifier as a stable public profile key; knowing an ID does not authorize access to private APIs.

Each public member is explicitly `{ id, name, department, academicYear, membershipDate }`. There is no email, phone, student ID, application/rejection reason, review metadata, separate user ID, password or session data. `membershipDate` comes from approval's `reviewedAt`, not the application date. Legacy approved documents without that date return null and display “Not recorded” rather than inventing a date. No legacy data is migrated.

Every repository operation includes approved status or an aggregation beginning with that match. Reads go to the primary; API/client requests use no-store and public browser requests omit credentials. MongoDB projections select public fields, followed by a second explicit response mapping. Profile queries require both ID and approved status, so knowledge of a pending application's ID does not reveal it. Statistics exclude all unapproved applications.

Approval and directory now use the same collection, avoiding stale copied profiles. New visits, Refresh directory, profile refresh/retry, and window focus reread status. There is no real-time push; an already-displayed page updates on its next refresh/focus. Search/list counts can change between requests while approvals happen; no cross-request snapshot is promised.

## Files and concepts

- Existing `server/src/modules/members/`: new query/ID schema; approved-only repository; list/profile/statistics controller/service/routes; compatible count endpoint.
- `server/src/app.ts`: reuses the member router with injectable repository for isolated tests.
- `client/src/lib/member-api.ts`: validated public DTOs, no-cookie/no-store fetch helpers, timeouts and date formatting.
- `client/src/components/members/`: shadcn member cards, filters, statistics, pagination, skeletons, empty/error states, profile UI.
- `client/src/app/members/`: list, dynamic profile, and route loading shell. Existing navbar already links to Members.
- `server/tests/member-directory.test.mjs`: privacy, status, literal search, filters, pagination, stats and error tests.
- `client/tests/members.spec.ts` and `playwright.members.config.ts`: isolated browser directory/profile coverage. No new dependencies.

The main lessons are public response allowlists, approval filtering in the database rather than React, safe parameter validation, and keeping counts/profiles tied to one source of truth. Client rendering never replaces API-level data protection.

## Commands and manual checks (PowerShell)

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:members
npm.cmd run test:membership
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:members
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

With both apps running, open `/members` while logged out. Check search, department/year filters, next/previous pages and profile links. Refresh a profile directly; verify only name, department, year and membership date appear. Pending/rejected IDs should show Member not found. With an authorized fictional application approved through the existing admin workflow, refresh Members and check its card and statistics. Do not change real applications just to test; automated tests use memory/mocked fixtures, no Atlas writes.

The list uses bounded skip/limit pagination and a stable name/ID sort. Before large-scale deployment, evaluate approved-status/sort indexes and Atlas Search if needed; substring search is intentionally simple and may scan records. No startup index writes, real-user publication operations, new review transitions or later-lesson features are added.

Verification (2026-11-11): both applications passed typecheck, lint and production build. Public API tests passed 7/7, membership submission/review regressions passed 14/14, and desktop/mobile directory browser tests passed 12/12. A browser error-state assertion initially also matched Next.js's route announcer; scoping it to the page fixed the test, and the full browser suite passed on rerun. Tests used memory/mocked fixtures and did not modify Atlas records. Whitespace checks passed and local environment files remain ignored.
