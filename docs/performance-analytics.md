Current checkpoint: see [development roadmap](development-roadmap.md). Continuation instructions below are historical and superseded by the latest Milestone 13 checkpoint.

# Milestone 07 — Student performance and analytics

Milestones 01–06 are complete per the user. This milestone adds read-only cross-quiz analytics while retaining existing quiz taking, result release, per-quiz reports, and event participation screens.

## Behavior and permissions

- `/dashboard/student/performance`: approved students see their own released scores, average/best percentages, monthly progress, comparisons and paginated score history. Links lead to all quiz attempts (including pending results) and event participation/attendance.
- `/dashboard/teacher/analytics`: teachers see comparisons and student rankings for quizzes they created. Admins may use the same page for all quizzes. Existing per-quiz reports remain available.
- `GET /api/student/performance` permits students only; `GET /api/manage/performance` permits teachers/admins only. Both reuse Better Auth session verification and fresh Express role lookup. Membership approval is independently checked for students.
- Query allowlist: optional `from`/`to` together (`YYYY-MM-DD`), optional exact `subject` (2–100 characters), and `page` (1–1000). Date limits reuse membership analytics: inclusive UTC days, 2000–2100, maximum 731 days, default last 12 calendar months through today.
- Cohort dates mean attempt submission dates. Only submitted attempts joined to published, unarchived, closed quizzes with a result release date qualify. Missing/invalid quiz references safely fail the join. Analytics never settles attempts or performs writes.
- Each attempt has equal weight in the percentage average, regardless of total marks. Rankings use each student's average rounded to two decimals; equal values share a rank with gaps. Attempt counts accompany averages because students may take different quizzes. Names use the latest attempt's membership-name snapshot within the filtered cohort; private account identifiers never leave the API.
- Summary and monthly progress cover the full filtered cohort. Comparison, score history and rankings use independent 20-row slices under the same page selector; `*HasNext` flags identify whether another slice exists. Monthly tables accompany charts for accessible reading. Months without attempts are omitted, not assigned zero scores.

## Implementation and lesson

`server/src/modules/performance/` owns strict query validation, the aggregation and response projections. `server/src/app.ts` mounts two role-protected routes. `client/src/lib/performance-api.ts` validates response shapes; the shared performance component handles filters, charts, tables, loading, empty, failure and permission states. Two App Router pages reuse `RoleGuard`, and the dashboard links expose them.

The key sequence is `$match` (student identity and dates), `$lookup` (release and teacher ownership), then `$facet` (summary, progress, comparisons, history and rankings). Every facet inherits the same authorized cohort. Database aggregation avoids loading all attempts into Node. `$rank` uses a single average sort key; a later stable ID sort orders ties for pagination, then removes IDs from the output. See the [official MongoDB rank documentation](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rank/).

No packages, collections, migrations, role changes, live data writes or deployments are introduced. Existing indexes are unchanged. Proposed future query indexes are `quizAttempts {userId:1,status:1,submittedAt:-1}` for own reporting and `{status:1,submittedAt:-1}` for staff cohorts. Measure with approved representative data and `explain` before applying any production indexes; the current query has a 10-second execution limit.

## Verification commands

Run from `server/`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:performance`, `npm.cmd run test:assessments`, `npm.cmd run test:quizzes`, `npm.cmd run test:events`, `npm.cmd run build`.

Run from `client/`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, then `$env:PLAYWRIGHT_CHANNEL = 'msedge'; npm.cmd run test:performance`. Browser tests use intercepted fictional API responses and never connect to Atlas. Backend tests evaluate the actual MongoDB pipeline against memory fixtures and exercise the Express API; they do not replace an approved real MongoDB staging check.

Manual review: sign in with an approved fictional student, open **My performance analytics**, filter by paired dates and subject, inspect score/monthly tables and follow event-history links. With a teacher, open **Student performance analytics** and compare with owned per-quiz reports. Confirm a student is denied the teacher page, an unapproved member is denied own analytics, and unreleased scores never appear. Do not create/release real quiz attempts solely for testing.

## Continuation

Milestone 07 is implemented and verified. Both apps passed typecheck, lint and production build. All 6 new backend analytics tests, 42 existing assessment/quiz/event regression tests, and 8 desktop/mobile performance browser tests passed. `git diff --check` passed. Initial browser failures were ambiguous selectors matching shared loading elements or the hidden Next.js announcer; the selectors were narrowed and the full suite passed. No pre-existing check failures remain in the checks run. Live MongoDB query execution/plan verification and college review of metric policies remain outside this isolated validation.

Checkpoint: Milestone 08 has not started. Continue sequentially with faculty mentors and admin-only faculty CRUD, public faculty directory/profiles and assigned teacher activities. Profile creation must never grant roles. Inspect existing user-role lookup and event ownership before deciding how to link faculty/assignments. Preserve all pre-existing uncommitted Milestone 06 files and Milestone 07 work. No live deployment or production infrastructure changes are authorized.

Continuation prompt: **Continue with Milestone 08 from docs/performance-analytics.md and docs/development-roadmap.md. Milestone 07 is verified; inspect existing architecture first, preserve the uncommitted Milestone 06/07 work, and keep all tests isolated. Follow the approved sequential Milestones 08–18 plan; never deploy or launch without explicit approval.**
