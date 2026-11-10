# Milestone roadmap

Current approved scope: finish Milestone 05 Lessons 02–05, preserving Lesson 01. Student taking/autosave, authoritative scoring/expiry, explicit release, own history/performance and staff analytics are implemented. Verify isolated backend/browser regressions and both production builds; stop before Milestone 06. See [assessment walkthrough](quiz-assessments.md). Earlier scope notes below are historical.

Latest approved scope: Milestone 05 Lesson 01 quiz creation/management only. Stop before quiz-taking or results. Attempt-aware immutability/versioning must be reviewed before those later features. See [quiz lesson](quiz-management.md).

Latest approved scope: Milestone 04 Lesson 05 membership dashboard analytics/statistics. Stop before the next milestone. See [analytics lesson](membership-analytics.md).

Latest approved scope: Milestone 04 Lesson 04 approved-student member profile editing and completion. Stop before subsequent lessons. See [profile implementation](member-profile-management.md).

Latest approved lesson: Milestone 04 Lesson 03 approved-member directory/profiles and aggregate counts. Stop before subsequent lessons. See [directory implementation](member-directory.md).

Latest approved scope: Milestone 04 Lesson 02 admin membership approval/rejection and student outcome display. Stop before further lessons; resubmission, public directory publication and additional workflows remain unapproved. See [review lesson](membership-review.md).

Current approved lesson: Milestone 04 Lesson 01 student membership application and status only. Approval management, reapplication/editing, and later lessons require further approval. See [lesson implementation](membership-application.md).

Latest scope: Milestone 03 Lesson 05 authentication hardening and verification only. See [security review and remaining deployment work](auth-security.md). Stop before Milestone 04; no membership or quiz implementation is approved.

Latest approved checkpoint: D, frontend role-aware navigation and guarded dashboard placeholders. Stop after quality checks and browser verification; membership, quizzes, full dashboards, and later lessons require separate approval. See [Checkpoint D guide](role-dashboards.md). Earlier checkpoint notes below are historical.

Current scope: Milestone 03 Lesson 04 Checkpoint C. Implement server RBAC, strict custom roles, demonstration endpoints, and isolated security tests while preserving the existing dashboard. See [RBAC guide](rbac.md). No real roles are changed in this checkpoint. Checkpoint D and frontend role dashboards require separate approval. Checkpoint B tooling remains documented in admin-bootstrap.md; its recorded inspection counts are historical.

Current user-approved progress: Milestones 01 (foundation) and 02 (MongoDB Atlas/modular backend) complete; Milestone 03 Lesson 01 implements server-only Better Auth. See milestone-03-lesson-01.md for nine passing integration checks and the stop point. Subsequent frontend authentication, RBAC/admin provisioning and email workflows require further approval. Earlier milestone numbering below is the original phase-level roadmap.

Progress: Phase 1 planning is complete. The user's Phase 2 Milestone 01 (Project Foundation) is approved and implemented: independent apps, local health integration/CORS, bilingual foundation, environment examples, scripts and checks. No subsequent milestone is authorized. The numbered roadmap below remains a phase-level plan; Milestone 01 notes record the actual foundation scope. Full Bangla/English support is confirmed and accompanies future product features.

Phase 1 is documentation only. Each row is an approval boundary; completing one row does not authorize the next. Split rows further when they are too large for a teaching session.

| Milestone                            | Goal and planned files                                                                                               | Evidence and manual review                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Requirements and architecture     | AGENTS.md, README.md, five docs; agree policies and boundaries                                                       | Review proposed data flows, permission matrix and open questions; no installs or app code                                                               |
| 2. Independent app setup             | client/ and server/ package/config files; strict TS, lint/format, minimal app entry points, .gitignore, .env.example | Verify compatible stable versions/engines, install lockfiles, run type/lint/build checks; start each app independently                                  |
| 3. Server and database foundation    | server config/db/middleware, readiness, index/validator scripts                                                      | Validate missing-env behavior, health/readiness and error redaction; connect to development Atlas; check graceful shutdown and unique constraints       |
| 4a. Basic authentication             | server/auth, client auth client/forms, proxy/origin config                                                           | Signup/login/session/logout, invalid credentials, cookie inspection and deployed-origin smoke test                                                      |
| 4b. Authorization and account safety | session/role middleware, verification/recovery, provisioning script, role administration service                     | Forged role fields denied; expired/revoked sessions denied; verified email flow; initial-admin concurrency and last-admin protection tests              |
| 5. Public UI and navigation          | public layouts, home, reusable UI, mobile menu, directory page shells                                                | Keyboard/mobile navigation, accessibility review, loading/error/empty states; use fictional fixtures while APIs are developed                           |
| 6a. Teachers and directories         | server teacher/member read modules; client public lists/details and admin teacher forms                              | CRUD/archiving and publication rules, search/filter/pagination, no private fields in public JSON; profile creation does not grant role                  |
| 6b. Member profile management        | member profile service and client form                                                                               | Owner-only edits, validation and consent withdrawal; fixtures supply approved members before application workflow                                       |
| 7. Membership workflow               | application form, review UI, membership state service/audit                                                          | Signup -> apply -> review -> directory; rejection/resubmission/suspension; concurrent review and field tampering tests                                  |
| 8a. Quiz authoring                   | draft authoring forms, server draft/publish modules                                                                  | Teacher ownership, schedule validation, immutable published questions and hidden answer-key tests                                                       |
| 8b. Quiz participation and results   | attempt API, quiz-taking page, persisted deadlines/finalizer, private results                                        | Duplicate start/submit tests, deadline manipulation, expired attempt finalization, deterministic scoring and result release; realistic concurrent users |
| 9. Dashboards and analytics          | role layouts, aggregate services, Recharts and accessible tables                                                     | Compare counts and averages with known fixtures; verify teacher scope and student privacy; empty-data behavior                                          |
| 10a. Release testing and security    | focused Vitest/Playwright suites, CI, deployment docs                                                                | Full role journeys, authorization regressions, dependency review, load checks and production configuration review                                       |
| 10b. Staging and launch              | hosting/origin configuration, mail, backups, monitoring, recovery runbook                                            | HTTPS/cookies/CORS/origin tests, email delivery, backup restore rehearsal, owner acceptance and explicit deployment approval                            |

## Sitemap

```text
/                             Public home
/members                      Public member directory
/members/[slug]               Public approved/consenting profile
/teachers                     Public teacher directory
/teachers/[slug]              Public published teacher profile
/login                        Login
/signup                       Signup
/verify-email                 Verification feedback
/forgot-password              Recovery request
/reset-password               Recovery form
/dashboard                    Session-aware role redirect
/dashboard/student            Student overview
/dashboard/student/membership Application and status
/dashboard/student/profile    Own member profile
/dashboard/student/results    Own attempt history
/dashboard/student/results/[attemptId] Released result
/quizzes                      Eligible student quiz list
/quizzes/[quizId]             Quiz instructions
/quizzes/[quizId]/attempt      Active own attempt
/dashboard/teacher            Teacher overview
/dashboard/teacher/quizzes    Owned quiz management
/dashboard/teacher/quizzes/new
/dashboard/teacher/quizzes/[quizId] Edit/view draft or published quiz
/dashboard/teacher/quizzes/[quizId]/results
/dashboard/teacher/analytics
/dashboard/admin              Admin overview
/dashboard/admin/memberships
/dashboard/admin/memberships/[id]
/dashboard/admin/teachers
/dashboard/admin/teachers/new
/dashboard/admin/teachers/[id]/edit
/dashboard/admin/users        Secure role management
/dashboard/admin/quizzes      All quiz management
/dashboard/admin/quizzes/new
/dashboard/admin/quizzes/[quizId]
/dashboard/admin/quizzes/[quizId]/results
/dashboard/admin/analytics
/dashboard/admin/audit-logs
```

Add privacy/contact content before collecting real data; exact content requires college approval. Teacher/admin quiz pages reuse feature components. App Router route groups organize layouts without changing public URLs. All protected pages receive appropriate loading, error and forbidden behavior; every underlying API remains independently protected.

## Teaching cycle for every implementation milestone

1. State the goal and explain the relevant concept.
2. List exact files and proposed changes before editing.
3. Implement only the authorized scope.
4. Explain a small important code excerpt and its role in the request flow.
5. Provide exact terminal commands and run appropriate checks; report actual results and limitations.
6. Provide a short manual test path, including a failure/permission case.
7. Summarize lessons and request approval for the next milestone.

## Phase 1 verification

Only Markdown planning files are created. Review links and repository status, inspect diffs, and check whitespace. There is no runnable app, so application tests/builds and UI manual tests are not applicable yet. Review scenario examples: unapproved student applies; admin approves without changing role; consenting member appears publicly; teacher creates a quiz but cannot edit another teacher's; students can read only their own released results.

Suggested read-only PowerShell commands:

```powershell
git status --short
Get-Content docs/requirements.md
Get-Content docs/architecture.md
git diff --check
```

## Approval gate

Phase 2 starts only after the user approves the plan/setup scope. Package installation, scaffolding, Atlas writes, credentials, and application implementation have not been performed in Phase 1.
