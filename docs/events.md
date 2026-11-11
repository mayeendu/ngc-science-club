# Milestone 06: events and activities

This milestone reuses existing authentication, fresh-role Express guards, MongoDB connection, strict TypeScript, shadcn components, React Hook Form/Zod and toast notifications. No dependencies or production settings are changed. Earlier quiz/membership features remain separate modules. No real records/roles were used in automated tests, and no live database migration/index write was executed.

## Pages and workflow

- `/events`: public responsive cards with upcoming/past/all dates and category filters, pagination, skeletons, retry and empty states.
- `/events/[id]`: public details, venue, date/time, capacity and optional image. Approved students can register or confirm cancellation. Guests receive a login link; other roles use management.
- `/dashboard/student/events`: own registered/cancelled events and attendance; no other member records.
- `/dashboard/teacher/events`: teacher-owned CRUD, status filters, statistics and category distribution. Admins may use this page to manage all events.
- `/dashboard/admin/events`: admin-only view of all event management and statistics.
- `/dashboard/teacher/events/[id]`: owner/admin participant list, counts and confirmed present/absent marking, with pagination.

Public navigation adds Events; dashboards link to management or My Events. Dates are entered as date and time in Asia/Dhaka (UTC+06:00), stored as a single UTC `startsAt` and displayed in Dhaka time. The API accepts ISO UTC dates, not separate ambiguous local strings.

Categories cover activities, workshops, seminars, competitions and achievements in one collection and form. Achievement entries can have past dates and display descriptions/images as a public record; they do not support registration. The capacity field is retained for a consistent content schema but has no registration meaning for achievements. No independent achievements CMS or upload service is added.

Images are optional HTTPS URLs, max 2048 characters, without embedded credentials. They render with Next Image `unoptimized` and `referrerPolicy="no-referrer"`; no server fetch/remote optimizer or upload is used. Only use an image you have permission to publish. Descriptions render as escaped text, not HTML.

## State and security rules

1. Staff creation always makes a draft; the server owns creator, status, counters, version and timestamps. Title 3–150, description 10–5000, venue 3–200, capacity integer 1–1000; other categories must have a future start. Publishing revalidates time against MongoDB time.
2. Content edits and archive/delete require a current-version empty draft. Delete is a soft archive, preserving history. A published event can become a draft only before start and with zero active registrations. Only an upcoming published event can become cancelled; cancellation is permanent.
3. Existing Better Auth verification and fresh server roles determine access. Teacher scope is `createdBy = session account`; admin scope includes all. Unknown/inaccessible event IDs return the same 404. Student registration additionally reads current approved membership. Role/creator/user IDs and attendance reviewer values supplied in bodies/headers cannot grant access.
4. Register/cancel requests accept only `{}`. The server derives the registration ID from event ID and session account ID. Repeated register/cancel is idempotent. Re-registering after cancellation replaces the same record and resets attendance to unmarked. Cancellation before start frees exactly one place; cancelled events retain prior registrations until individual cancellations.
5. A transaction writes the event gate first, using `$$NOW`, and then reads/changes the registration. Capacity reservation additionally uses atomic `registeredCount < capacity`; counter and registration commit or roll back together. Thus simultaneous last-place registration, cancellation, event state changes and retries cannot overbook or decrement twice. A unique natural `_id` independently prevents duplicate registrations. MongoDB's transaction API retries transient write conflicts; operations within a transaction run sequentially.
6. Registration/cancellation close at the exact server start timestamp. Attendance opens then, requires a published event and an active registration, and accepts only present/absent. Each update matches the registration version, preventing stale tabs from overwriting another review. The server stores markedBy/markedAt. Unmarked members are never automatically labeled absent.
7. Public event DTOs explicitly exclude creator, participants, membership/auth IDs and gate metadata. Staff participants include only registration ID, name, registration status/date, attendance and version—no contacts, student ID or credentials. Private pages use RoleGuard, but Express independently enforces every permission. Public detail remounts private registration state on account changes.

## API

| Prefix | Method/path | Input / result |
| --- | --- | --- |
| `/api/events` | GET `/` | `page` 1–1000, `period` upcoming/past/all, optional category; 12/page |
| same | GET `/:id` | Published/cancelled safe event; drafts/archives 404 |
| `/api/student/events` | GET `/` | Own registration/event history, 12/page |
| same | GET `/:id` | Own registration or null, plus safe event |
| same | POST `/:id/register` | Strict `{}`; reserve one place or return current registration |
| same | POST `/:id/cancel` | Strict `{}`; release reserved place before start |
| `/api/manage/events` | GET `/` | Scoped list, optional status and page, 12/page |
| same | GET `/stats` | Scoped counts, attendance and categories; no identifying details |
| same | POST `/` | Full content; server creates draft |
| same | PATCH `/:id` | Full content plus current version; empty draft only |
| same | PATCH `/:id/status` | `{status, version}` with valid transition |
| same | DELETE `/:id` | `{version}`; empty draft soft archive, HTTP 204 |
| same | GET `/:id/participants` | Scoped private rows, attendance totals, page of 20 |
| same | PATCH `/:id/attendance` | `{registrationId, attendance, version}` |

All IDs are validated lowercase 24-character ObjectIds. Mutations require the exact trusted frontend Origin; input schemas reject unknown body fields. Unauthenticated requests return 401, insufficient role/membership/origin 403, missing/foreign event 404, invalid data/date 400, full/closed/stale state 409. Errors hide database internals; API responses remain private/no-store. Public query schemas reject unknown filter fields. Student list identity cannot be selected by query/body.

Stats use all scoped non-archived events: total/draft/published/cancelled, sum of active registration records (including retained registrations for cancelled events), present and absent counts, and category distribution. Attendance rate is present / marked attendance, returning 0% with no marks. Participant reports exclude individually cancelled registrations. Statistics queries are read-only and may reflect slightly different moments during concurrent changes; registration/attendance correctness is transactional.

## Files and concepts

- `server/src/modules/events/event.schema.ts`: strict input rules and shared server types.
- `event.repository.ts`: ownership/public projections, transaction gate, capacity counter, registrations, attendance and aggregate statistics.
- `event.routes.ts`: auth/role/origin guards, request parsing, HTTP responses.
- `server/src/app.ts`: register public/student/staff routers with injectable repository for tests.
- `client/src/lib/event-api.ts`: typed requests, Zod response parsing, no-store credentials and safe errors/date formatting.
- `client/src/components/events/`: reusable cards, skeletons and accessible native confirmation dialog; public pages, RHF editor, staff tables/stats, attendance and own events.
- `client/src/app/events/` and `client/src/app/dashboard/{student,teacher,admin}/events/`: thin page entry points. Dynamic params are inside Suspense as required by this installed Next.js version.
- Navbar/dashboard components add entry links; docs, package test scripts and isolated backend/Playwright tests describe and verify the feature.

The important distinction: authentication answers who is calling; authorization checks role and event ownership; a database transaction ensures seat availability and the registration cannot disagree. Version checks prevent lost updates, while explicit DTOs prevent accidental exposure of student information.

## Database operations and limits

The existing Atlas replica set is required for transactions, as in quiz assessments. Existing quizzes/members are unchanged. `events` and `eventRegistrations` are new collections; their built-in `_id` indexes suffice for identity/duplicate correctness. No auto-run migrations or index creation is added. Recommended indexes for a separately approved deployment change: events `{createdBy:1,startsAt:1,_id:1}` and `{status:1,startsAt:1,_id:1}`, registrations `{userId:1,registeredAt:-1}` and `{eventId:1,status:1,registeredAt:1}`. Measure explain plans before finalizing indexes.

The per-event gate serializes contention for correctness; large simultaneous cohorts need load testing. No waitlist, bulk attendance, QR scanning, payments, calendar integration, uploads, email reminders or Milestone 07 work is included. Tests use Mongo-shaped in-memory fixtures, rollback/serialization and mocked browser APIs; they do not prove live Atlas query/transaction compatibility or deployment throughput. Use an isolated replica set with fictional accounts for end-to-end verification before real event use.

## PowerShell checks and manual testing

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:events
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:events
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Using an isolated development database: create/publish a future capacity-1 fictional event as a teacher; verify guest listings and filters. Have two approved fictional students try the last place simultaneously: only one succeeds. Repeat register, cancel twice, and re-register to check counters. Confirm My Events, switch accounts and verify privacy. A different teacher must receive 404 for participant/mutation APIs. Before start, attendance must return 409. At/after start, registration/cancellation must fail, while owner/admin can confirm present/absent; repeat a stale revision and check 409. Create a separate future event, cancel it, and confirm public/student cancellation notices and blocked registration/attendance. Publish a past achievement; filter past/achievement and confirm it cannot accept registrations. Do not manipulate real roles or real event dates to test these cases.

Stop after Milestone 06; do not start Milestone 07 without approval.

## Verification results

Both applications passed TypeScript, ESLint and production builds. Backend tests passed 137/137: 16 event tests plus 121 existing authentication/security/bootstrap/RBAC/membership/directory/analytics/quiz regressions. Desktop/mobile browser verification passed 156 checks across runs: 24 event-flow checks, two added expired-session checks, 12 quiz editor, 24 assessment and 94 dashboard/auth/membership/profile regressions. Browser suites ran sequentially with one Edge worker outside the Windows sandbox. Whitespace checks passed and local environment files remain ignored. No new dependency was installed. Live Atlas transaction/aggregation compatibility and production load were not tested.
