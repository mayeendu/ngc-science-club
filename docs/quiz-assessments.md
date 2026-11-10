# Milestone 05: quiz assessment system

Lessons 02–05 extend existing quiz CRUD without new packages. Authentication identifies the account; fresh Express role checks authorize the action; the repository additionally checks approved membership or teacher ownership. Browser RoleGuard is only a usability guard. No real roles, quizzes, attempts, database migrations or indexes were changed while testing.

## Behavior and policies

- Approved current student accounts can list open published quizzes, read instructions and start once. Teachers/admins use management/report routes, not student taking routes.
- Start is idempotent. An attempt's unique `_id` combines quiz ID and session account ID. Repeating start preserves its deadline and saved answers. No retake endpoint exists.
- On first start, content becomes permanently immutable. Unpublishing/editing/archiving now includes atomic `hasAttempts != true` and no-closed-date predicates. This prevents later key/mark changes from corrupting history. Teachers may create a new quiz for another assessment.
- The countdown is a display based on server time. MongoDB `$$NOW` supplies start/deadline checks. Start, save, submit, close and release share a transactional quiz write gate, serializing conflicting operations. MongoDB's convenient transaction API retries transient conflicts; reads/writes within one transaction run sequentially.
- Autosave debounces selections by 600 ms and serializes requests. A revision compare-and-set rejects stale tabs with 409. Reload restores server answers; a conflicting tab must reload before continuing. Early submission sends the final answer batch; expiry sends `{}` and scores only persisted answers. Offline/unsaved changes after the deadline never count.
- A worker settles up to 100 due records each 15 seconds; read/save/submit/report also settle expired attempts. Delayed or stopped workers cannot permit late answers. Multiple workers are safe through the same gate/status checks. Restart catches up automatically.
- The owner teacher or an admin closes the quiz permanently, atomically stopping starts/saves and grading active attempts. Release requires closure and separate explicit confirmation. Before release students receive neither scores nor keys/explanations; afterwards only their own submitted attempt includes review. Release cannot be reversed. Staff may see authorized scores/statistics before student release.
- Student performance uses released, submitted attempts only: completed count, average/best percentage, per-subject averages and latest 50 chronological results. Staff averages use submitted scores only; participant count includes active attempts. Rankings use competition ranks (ties share rank) with stable ordering and 20-row pages. Question accuracy uses all submitted attempts as denominator; unanswered answers count as incorrect for accuracy.

## Important files

| File or folder | Purpose |
| --- | --- |
| `server/src/modules/assessments/assessment.schema.ts` | Strict IDs, bounded pages and answer input; explicit safe response types |
| `assessment.repository.ts` | Shared MongoDB transactions, membership/ownership checks, grading update pipelines, history and aggregations |
| `assessment.routes.ts` | Auth/RBAC wiring, trusted-origin checks and Zod parsing |
| `assessment.worker.ts` | Bounded expiry sweep, no overlapping local sweep, graceful shutdown |
| `server/src/app.ts`, `index.ts` | Register injectable routers and run/stop worker with backend lifecycle |
| `server/src/modules/quizzes/` | Optional explanations, permanent attempt lock and safe management metadata |
| `client/src/lib/assessment-api.ts` | Typed, credentialed, no-store API requests and Zod response checks |
| `client/src/components/quizzes/` | Student catalog, timed runner, own results/performance, staff report and existing editor/manager |
| `client/src/app/dashboard/student/quizzes/` | Catalog and dynamic attempt routes |
| `client/src/app/dashboard/student/results/` | Own history and performance |
| `client/src/app/dashboard/teacher/quizzes/[id]/results/` | Teacher/admin report and close/release dialogs |
| `server/tests/assessments.test.mjs`, `client/tests/assessments.spec.ts` | Fictional fixtures, API/security/timing/scoring tests and desktop/mobile browser flows |

Dynamic pages place `useParams()` behind Suspense so Next.js cache-enabled production prerendering has a loading boundary. The runner keeps unsaved answers in refs and visible answers in state; the clock offset is state because it affects rendering. Promises serialize autosaves, and revisions prevent delayed replies from overwriting newer server state.

The authenticated management JSON limit is now 1 MiB to fit 50 bounded Unicode questions with optional explanations; unrelated parsers keep their existing limits. Answer-save bodies remain small, bounded arrays.

## API contract

All paths below are private/no-store. IDs must be 24 lowercase hex characters; page is integer 1–1000; unknown query fields on lists/performance are rejected. Identity/role never comes from bodies/headers. Guests receive 401, insufficient role/membership 403, missing/foreign-owner quiz 404, stale revision/closed start/release-before-close 409, malformed body/ID/page 400. Errors hide internal database details.

| Prefix | Method and suffix | Response/action |
| --- | --- | --- |
| `/api/student/assessments` | GET `/quizzes?page=1` | Open published metadata, 12/page; no questions/keys |
| same | GET `/quizzes/:id` | Instructions and own current attempt; safe questions only after starting |
| same | POST `/quizzes/:id/start` body `{}` | Start once or return existing state |
| same | PUT `/quizzes/:id/answers` | `{ revision, answers: [null, 0, 1, 2, 3, ...] }`; exact question count, max 50 |
| same | POST `/quizzes/:id/submit` | `{}` finalizes saved answers, or `{ revision, answers }` final batch before expiry |
| same | GET `/results?page=1` | Own history, 20/page, unreleased scores null |
| same | GET `/performance` | Released own aggregates; no other students |
| `/api/manage/quiz-assessments` | GET `/:id?page=1` | Owned/admin report, names/scores/rankings and question statistics |
| same | POST `/:id/close` body `{}` | Permanently close and settle all active attempts |
| same | POST `/:id/release` body `{}` | Require closed state, expose own results to participants |

Scores, timers, user IDs, reviewer IDs and roles supplied as extra body fields are rejected. Student DTOs explicitly project safe fields. Staff reports include participant names, not emails, phone numbers, student IDs or auth records. Correct answers remain only in frozen server quiz content until authorized own review release. MongoDB update pipelines calculate marks from those keys, not client values.

## MongoDB requirements and operational limits

Use Atlas or another replica set supporting multi-document transactions. MongoDB 5.3+ is required for `$setWindowFields` inside transactions; prefer your supported current Atlas version. References: [Node driver transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/) and [window aggregation compatibility](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setwindowfields/). The existing MongoClient/database are reused. A standalone local mongod cannot support this implementation. No schema migration is required for existing Lesson 01 quizzes; new fields are optional and new attempts use MongoDB's built-in unique `_id` index.

Before scaling, provision and measure these non-unique indexes in a separately approved deployment/database change: `quizAttempts {userId:1,startedAt:-1,_id:1}`, `{status:1,deadlineAt:1}`, `{quizId:1,status:1,score:-1}`, and `quizzes {status:1,createdAt:-1,_id:1}` with an appropriate active/open partial filter. No commands create indexes automatically. The per-quiz gate prioritizes consistency and can be a bottleneck for large simultaneous cohorts; load testing and query explain plans remain deployment work. Closing very large cohorts in one transaction can exceed runtime/transaction limits; this implementation targets college-club scale.

Automated backend tests use a Mongo-shaped in-memory transaction fixture and expression evaluator; browser tests mock HTTP APIs. They do not prove live Atlas transaction/aggregation compatibility or production throughput. Verify a fictional end-to-end assessment on an isolated replica-set database before real assessment use. Do not run legacy live-database integration commands against real data. No timer, browser storage or client role is a security boundary.

## PowerShell checks and manual walkthrough

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:assessments
npm.cmd run test:quizzes
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:assessments -- --workers=1
npm.cmd run test:quizzes -- --workers=1
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

In an isolated development database, use an existing fictional teacher to create/publish a one-minute quiz with explanations. Use an approved fictional student to open Student Dashboard → Science quizzes, review instructions, start, select answers, navigate and refresh after saving. Open a second tab to check revision conflicts. Let time expire or submit manually; scores/keys must remain withheld. Teacher Quiz management → Results shows participants, rankings and question statistics; confirm Close, then separately confirm Release. Refresh the student's attempt and history to see their score/review/performance. A second student must not access the first student's answers, and a different teacher must get 404 for the report. Guests, pending members and forged role/score fields must fail. These manual actions write to the configured database; use fictional isolated data only.

Learning: authentication identifies a user, authorization scopes their data, transactions protect cross-document state, revisions protect concurrent edits, database deadlines defeat altered browser timers, and explicit DTOs prevent accidental answer-key leakage. Stop before Milestone 06.

## Verification results

Both applications passed TypeScript, lint and production builds. Backend assessment tests passed 17/17, quiz CRUD 9/9, and existing auth/security/bootstrap/RBAC/membership/directory/analytics regressions passed 95/95 (121 total across runs). Browser assessment tests passed 24/24, quiz editor 12/12 and dashboard/auth/membership/profile regressions 94/94 (130 desktop/mobile checks). A Next.js build error was fixed by adding Suspense around dynamic params; a React lint error was fixed by keeping rendered clock offset in state. Initial browser runs inside the Windows sandbox exhausted memory; final suites passed sequentially with one worker outside the sandbox. A test selector was narrowed to the main content to avoid matching Next.js's route announcer. Live Atlas transaction/aggregation behavior and production load were not tested. No packages, real records, roles or deployment settings were changed.
