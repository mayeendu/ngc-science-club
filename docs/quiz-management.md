# Milestone 05, Lesson 01: science quiz management

Historical Lesson 01 notes follow. Lessons 02–05 now add attempts/results: quizzes with attempts cannot be unpublished, edited or archived; optional explanations are editable before locking. Published rows link to reports, close and release controls. See [current assessment guide](quiz-assessments.md).

Teachers/admins can open `/dashboard/teacher/quizzes` from their dashboards. Teachers see/manage only their own quizzes; admins manage all quizzes. This lesson adds creation, draft editing, publishing/unpublishing, status filtering, pagination and confirmed deletion. It does not add student quiz-taking or results.

## API and authorization

All routes below require Better Auth authentication and fresh teacher/admin role verification. Mutations require the exact trusted Origin. List/detail responses are private/no-store. Known foreign-owner IDs return the same 404 as missing/deleted quizzes; client roles/creator IDs cannot select another teacher's ownership.

| Route under `/api/manage/quizzes` | Behavior                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| GET `/`                           | Teacher-owned or admin-wide metadata list; optional status and page; ten rows/page |
| GET `/:id`                        | Authorized management detail, including answer keys                                |
| POST `/`                          | Create a server-owned draft with version 1                                         |
| PATCH `/:id`                      | Full content update of an owned draft, requiring current version                   |
| PATCH `/:id/status`               | `{ status: "draft" or "published", version }` transition                           |
| DELETE `/:id`                     | `{ version }`, archive an owned draft; returns 204                                 |

The ownership filter is part of each database read/write, not just a prior check. Updates additionally match version and expected status, then increment version atomically. This prevents lost updates or an edit racing publication. Missing/inaccessible records return 404; stale versions/wrong status return 409; invalid fields/IDs return 400; guests return 401; unauthorized roles/origins return 403.

The quiz router mounts after Better Auth but before the application's general JSON parser. Its parser runs after role checks and accepts at most 384 KiB, allowing bounded Unicode question content while leaving unrelated routes' body limits unchanged. No student/public quiz endpoint is created. List projections omit questions/answer keys; detail keys are only returned through the management guard. Future student APIs must use a separate answer-free projection.

## Data and validation

New `quizzes` documents contain server ObjectId, createdBy account ID, title, description, subject, durationMinutes, questions, calculated totalMarks/questionCount, status, version and server createdAt/updatedAt. Deletion adds deletedAt and hides the record from all management reads; it does not erase data or references. No migration, index write, real teacher role change or real test quiz is created automatically.

Defaults/limits: title 3–150 characters, description 10–2000, subject 2–100, duration 1–180 whole minutes, up to 50 questions. Every stored question has 5–1000 character text, exactly four distinct nonempty options of at most 300 characters, one correctOption index (0–3), and whole marks 1–100. Text is trimmed; option distinctness ignores case. Total marks are calculated by the server; client totalMarks/owner/timestamp fields are rejected.

Drafts may contain zero questions so metadata can be saved first, but partial invalid question content cannot be saved. Publishing requires at least one complete MCQ. Published quizzes cannot be edited/archived until unpublished. There are no attempts yet; before taking/results are implemented, active attempts and historical quiz/question versions must constrain editing/unpublishing. This lesson does not pretend to enforce attempt policies for a feature that does not exist.

## Files and frontend concepts

- `server/src/modules/quizzes/quiz.schema.ts`: strict input schemas and management DTO types.
- `quiz.repository.ts`: MongoDB CRUD, ownership scopes, explicit DTO mapping and version/state conditional writes.
- `quiz.service.ts`: input/publication validation; `quiz.routes.ts`: authentication, role/origin guards and handlers.
- `server/src/app.ts`: registers the management router and injectable repository for isolated tests.
- `client/src/lib/quiz-api.ts`: matching form schemas, typed API calls, timeout/error handling and versioned mutations.
- `client/src/components/quizzes/quiz-editor.tsx`: React Hook Form with useFieldArray for dynamic questions and useWatch for the displayed total; shadcn form controls label each option and its single correct answer.
- `quiz-management.tsx`: responsive scrollable table, draft/status filters, list/edit loading states, confirmations, notifications and conflict refresh.
- `client/src/app/dashboard/teacher/quizzes/page.tsx`: RoleGuard allowing teachers/admins. Dashboard links reuse existing layouts; the implemented teacher quiz placeholder is removed.
- `server/tests/quizzes.test.mjs` and `client/tests/quizzes.spec.ts`: isolated security/state and desktop/mobile editor tests.

On stale-version conflicts the UI returns to the refreshed list; unsaved stale edits are not automatically merged. Service failures leave the form available for retry. On 401 the user returns to login; on 403 the manager closes and shows Access Denied. No packages were added.

## Commands/manual testing (PowerShell)

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:quizzes
npm.cmd run test:rbac
npm.cmd run test:membership
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:quizzes
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

With both apps running, sign in as an existing authorized fictional teacher/admin and follow Manage science quizzes. Create a draft, add/remove MCQs, select exactly one answer per question, and check calculated marks. Save, confirm publish, verify editing/deletion are disabled, unpublish, edit, then confirm deletion. Use two tabs to verify a stale save cannot overwrite a newer version. Guests/students must not see questions or make management requests. Do not change real roles merely to test; manual CRUD changes the configured database, while automated suites use in-memory/mock records only.

Lessons: field arrays provide stable editor keys; validation runs on both ends; authorization belongs in database ownership filters; answer keys require management-only DTOs; version/status checks make state changes safe under concurrency. Stop after Lesson 01.

Verification: both applications passed typecheck, lint and production build. Quiz API/security tests passed 9/9; desktop/mobile quiz browser tests passed 12/12; RBAC regressions passed 34/34 and membership/profile regressions passed 20/20. Tests use in-memory MongoDB-shaped stores and mocked browser APIs, not live Atlas writes. Whitespace checks passed and local environment files remain ignored.
