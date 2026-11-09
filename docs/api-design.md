# REST API proposal

Status: design contract pending approval. Business routes use /api/v1; Better Auth owns /api/auth. IDs are strings in JSON. All protected routes require a valid active session; privileged routes additionally read current role and ownership.

Milestone 01 implements only public GET /api/health, returning HTTP 200 with { status: "ok", service: "ngc-science-club-api", message: "NGC Science Club API is running." }. It has no database dependency. Unknown routes return a JSON 404. The business/auth routes below are planned and do not exist yet. This unversioned foundation endpoint is separate from future liveness/readiness probes.

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
