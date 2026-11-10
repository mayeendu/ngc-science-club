# REST API proposal

Milestone 05 adds student GET `/api/student/assessments/quizzes`, GET `/quizzes/:id`, POST `/quizzes/:id/start`, PUT `/quizzes/:id/answers`, POST `/quizzes/:id/submit`, GET `/results` and GET `/performance`, all under `/api/student/assessments`. Staff GET `/api/manage/quiz-assessments/:id` and POST `/:id/close` / `/:id/release` enforce teacher ownership or admin access. All require sessions and current roles; student access additionally requires approved membership. Mutations require trusted Origin and strict allowlisted bodies. See [full assessment API contract](quiz-assessments.md). Earlier management-only scope notes are historical.

Milestone 05 Lesson 01 implements staff-only `/api/manage/quizzes`: list/detail/create, draft content PATCH, status PATCH, and versioned DELETE/archive. Ownership and expected status/version constrain writes. No public/student quiz or answer-key route exists. See [quiz API contract](quiz-management.md).

Milestone 04 Lesson 05 adds admin-only GET `/api/admin/membership-analytics` with paired ISO from/to dates, inclusive UTC days and a 731-day maximum. Returns backend-calculated KPIs, monthly counts, department counts, anonymous recent statuses/dates and equal-period trends. No private student fields or new mutations. See [analytics contract](membership-analytics.md).

Milestone 04 Lesson 04 adds GET/PATCH `/api/membership-applications/me/profile` for current students with approved membership. Identity comes only from the session. PATCH accepts four editable fields, requires trusted Origin and rejects protected/unknown fields; approved-state filtering applies inside the write. See [own-profile contract](member-profile-management.md).

Milestone 04 Lesson 03 implements public GET `/api/members`, `/api/members/stats`, and `/api/members/:id`; `/api/members/count` now counts approved applications. List query parameters are validated and response fields strictly projected; unapproved/missing profiles return 404. See [public API contract](member-directory.md).

Milestone 04 Lesson 02 adds GET `/api/admin/memberships` (status/page filters) and PATCH `/api/admin/memberships/:id/review` (pending-only decision), both admin-only. Reviews require trusted Origin and strict inputs, return 409 on unavailable/already-reviewed records, and save server reviewer/date. Student own-status responses now include optional review date/rejection reason. See [review API contract](membership-review.md).

Milestone 04 Lesson 01 adds student-only POST `/api/membership-applications` and GET `/api/membership-applications/me`. Submission requires exact trusted Origin, validates an explicit six-field schema, and assigns identity/status/date server-side. Duplicate account submissions return 409. GET exposes only own status/date or null. See [application contract](membership-application.md).

Milestone 03 Lesson 05: existing auth endpoints may return native HTTP 429 with `X-Retry-After` when limits are exceeded. API responses use private/no-store caching and security headers. No business endpoints are added. See [auth rate-limit contract](auth-security.md).

Checkpoint D consumes the existing three role overview endpoints from the browser, with credentialed no-store requests. No endpoints or response contracts change. Their HTTP 401/403 responses control frontend login/Access Denied states. See [dashboard integration](role-dashboards.md).

## Implemented through Checkpoint C

Public GET `/api/health` and `/api/members/count`, Better Auth `/api/auth/*`, and authenticated GET `/api/me` remain available. Demonstration GET `/api/student/overview` permits all three recognized roles; `/api/teacher/overview` permits teacher/admin; `/api/admin/overview` permits admin only. These unversioned demonstration endpoints use `{ success, message }` with 200/401/403; the proposed business API contract below is future work. `/api/auth/admin/*` requires a fresh exact admin role in addition to the plugin's checks. See [RBAC details](rbac.md). Older milestone notes below describe their historical scope.

Milestone 03 Lesson 01 implemented endpoints: GET /api/health, GET /api/members/count, and the Better Auth handler under /api/auth. Verified GET /api/auth/ok, GET /api/auth/get-session, POST /api/auth/sign-up/email, POST /api/auth/sign-in/email, and POST /api/auth/sign-out. Credentialed CORS trusts the exact configured client origin; auth mutation origin checks remain enabled. Better Auth responses use its own contract. Other auth/business endpoints below are planned until their corresponding lesson is implemented; no email transport, RBAC or frontend forms are configured yet.

Status: design contract pending approval. Business routes use /api/v1; Better Auth owns /api/auth. IDs are strings in JSON. All protected routes require a valid active session; privileged routes additionally read current role and ownership.

Milestone 01 implements only public GET /api/health on port 5000, returning HTTP 200 with { success: true, message: "NGC Science Club API is running!", timestamp: an ISO 8601 timestamp }. It has no database dependency and is not cached. Unknown routes return a JSON 404. The business/auth routes below are planned and do not exist yet. This unversioned foundation endpoint is separate from future liveness/readiness probes.

## Authentication

Use Better Auth's client and handler, not custom password endpoints. Planned handler operations include:

| Method/path under /api/auth                        | Purpose                                |
| -------------------------------------------------- | -------------------------------------- |
| POST /sign-up/email                                | Create account, forced student default |
| POST /sign-in/email                                | Email/password login                   |
| POST /sign-out                                     | End current session                    |
| GET /get-session                                   | Read current session                   |
| POST /send-verification-email; GET /verify-email   | Email ownership verification           |
| POST /request-password-reset; POST /reset-password | Recovery                               |

Confirm exact operations, payloads and redirect validation against the pinned Better Auth version before implementation. Use supported auth APIs for password/profile changes; do not expose internal database documents or replace library response shapes. Rate-limit login, signup, reset and verification sends; avoid account-enumerating recovery messages.

## Business endpoints

All paths below start with /api/v1.

| Method and path                              | Access and behavior                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET /health/live; GET /health/ready          | Minimal process/database readiness; no secrets or infrastructure details                                          |
| GET /members; GET /members/:slug             | Public: approved, consenting profiles only                                                                        |
| GET /teachers; GET /teachers/:slug           | Public: published, unarchived profiles only                                                                       |
| GET /me                                      | Current account and permissions, safe fields                                                                      |
| GET /me/membership                           | Student's application/member state, including private decision feedback                                           |
| POST /me/membership                          | Student: first application or allowed resubmission; verified email required                                       |
| PATCH /me/member-profile                     | Approved student: allowlisted own public fields and consent; never status or role                                 |
| GET /admin/memberships                       | Admin: paginated applications filtered by state                                                                   |
| GET /admin/memberships/:id                   | Admin: private application details                                                                                |
| PATCH /admin/memberships/:id/status          | Admin: approve/reject/suspend/reinstate with expected version and reason                                          |
| GET /admin/teachers; GET /admin/teachers/:id | Admin: private teacher management views, including drafts                                                         |
| POST /admin/teachers                         | Admin: create a teacher profile; no automatic role assignment                                                     |
| PATCH /admin/teachers/:id                    | Admin: update, publish or link a teacher profile                                                                  |
| DELETE /admin/teachers/:id                   | Admin: archive profile; does not remove account role implicitly                                                   |
| GET /admin/users                             | Admin: bounded search for account/role management; minimal fields                                                 |
| PATCH /admin/users/:id/role                  | Admin + recent authentication: validated role change, reason, last-admin protection, audit and session revocation |
| GET /quizzes; GET /quizzes/:id               | Approved students: available quiz metadata; no answer keys                                                        |
| POST /quizzes/:id/attempts                   | Approved student: start or return existing own attempt                                                            |
| GET /me/attempts; GET /me/attempts/:id       | Student: own history, current attempt/questions or released result; ownership checked                             |
| PUT /me/attempts/:id/answers                 | Student owner: replace validated answer set before deadline, using expected version                               |
| POST /me/attempts/:id/submit                 | Student owner: atomic, retry-safe finalization                                                                    |
| GET /manage/quizzes; GET /manage/quizzes/:id | Teacher: own; admin: all; separate management DTO                                                                 |
| POST /manage/quizzes                         | Teacher/admin: create owned draft                                                                                 |
| PATCH /manage/quizzes/:id                    | Teacher owner/admin: edit draft using expected version                                                            |
| POST /manage/quizzes/:id/publish             | Teacher owner/admin: validate and publish draft                                                                   |
| POST /manage/quizzes/:id/close               | Teacher owner/admin: close early; finalize attempts under documented deadline policy                              |
| DELETE /manage/quizzes/:id                   | Teacher owner/admin: archive; preserve referenced attempts                                                        |
| GET /manage/quizzes/:id/results              | Teacher owner/admin: authorized paginated results                                                                 |
| GET /me/analytics                            | Student: own released performance                                                                                 |
| GET /manage/analytics                        | Teacher: own quiz aggregates; admin: all quizzes                                                                  |
| GET /admin/analytics                         | Admin: club totals, membership states, quiz participation                                                         |
| GET /admin/audit-logs                        | Admin: sanitized paginated security/management history                                                            |

Early closure sets the effective deadline to the close time and prevents further answer saves. Its service transaction/conditional writes must account for concurrent submissions. Defer early-close functionality if it cannot be verified within the quiz milestone; automatic scheduled close remains required.

Dashboards compose existing authorized endpoints; a URL containing admin or manage never grants permission. No events REST API in MVP.

## Contract conventions

- Application success: { data: ... }; list success: { data: [...], pagination: { page, limit, total, totalPages } }. Better Auth keeps its own contract.
- Error: { error: { code, message, fieldErrors? }, requestId }. Do not return stack traces, Mongo errors, tokens, or sensitive records.
- Status codes: 200 reads/updates, 201 creation, 204 archive when no body; 400 malformed input, 401 missing/expired session, 403 disallowed action, 404 absent/hidden record, 409 duplicate or stale transition, 429 rate limit, 500 unexpected error. Use one validation convention consistently.
- Pagination defaults page=1, limit=12, maximum 50; validate search length, IDs, dates, enums and sort allowlists. Include _id as stable sort tie-breaker. Return empty lists successfully.
- Parse explicit fields; never spread arbitrary request bodies into Mongo updates or pass unvalidated client filter objects to the database.
- Mutation requests use JSON and trusted origins. No side effects in custom GET routes.
- Private responses use Cache-Control: no-store. Public directory caches must invalidate promptly after approval, suspension or consent withdrawal; start uncached for simplicity.
- Bound request size and question/answer arrays. Do not log passwords, cookies, verification links or whole request bodies.

API examples and executable integration tests will be added only with the corresponding approved implementation milestone.
