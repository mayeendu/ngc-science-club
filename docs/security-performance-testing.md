# Milestone 16 — Security, performance and testing

## Changes and reasoning

The Express authentication boundary now requires the exact configured client Origin on every auth mutation, before Better Auth handles the request. This also protects first-time signup without a cookie. Better Auth retains credential/session ownership, CSRF checks, callback URL validation and its existing auth-specific limiter. CORS response headers alone do not stop a mutation executing. Sources: [Express CORS](https://expressjs.com/en/resources/middleware/cors/) and [Better Auth security](https://better-auth.com/docs/reference/security).

Authentication cookies explicitly retain HttpOnly and SameSite=Lax; production requires HTTPS and Secure cookies. Host-only cookies and HTTPS Secure prefixes are tested. Proxy trust remains disabled; Express writes the authentication IP header from the socket and ignores spoofed forwarded headers. Cross-site production frontend/API domains need a separately approved cookie/topology decision; localhost checks do not prove production login.

The new bounded in-memory API limiter allows 600 requests/minute per socket address for normal business endpoints, with a separate shared 30/minute budget for reports/uploads. Query strings, casing and forwarded headers do not reset these buckets. Capacity is capped at 10,000 keys; exhaustion fails closed with 429 and Retry-After. Health/preflight and auth are exempt from this limiter; auth has its own limits. Multiple users behind one network or untrusted proxy share a budget. Distributed/account-aware controls require the eventual deployment topology and are not claimed here.

Existing Helmet/Next headers, private no-store API responses, strict Zod schemas, fresh stored-role RBAC, staff ownership, approved membership checks, explicit public projections, transactional attempts/registrations/certificates and upload validation are preserved and exercised by regression suites. No authorization is delegated to frontend guards. No secrets or environment files are added to Git; only `.env.example` templates are tracked.

Certificate pagination now performs two batched source validity queries instead of up to 24 per-row lookups, using primary reads and `_id` projections. MongoDB pool/idle/wait bounds and existing aggregation timeouts are retained/documented in [the index review](query-index-plan.md). Index candidates require review before any Atlas write; no production index changes were executed.

## Safe verification commands

Server `npm.cmd run test:isolated` discovers memory-only tests, excludes `*.integration.test.mjs`, sets `NGC_ISOLATED_TEST=1`, and disables both application MongoDB connection entry points. `npm.cmd run test:auth` now runs the real Better Auth flow against the memory adapter plus security regressions. The old Atlas suite requires explicit `RUN_ATLAS_AUTH_TESTS=1` and must only be run after user approval through `npm.cmd run test:atlas:auth`. Do not use a wildcard test command. Browser foundation checks use a database-disabled Express fixture at port 5101, never the real server startup. `npm.cmd run test:serve` is test tooling, not a production server command.

The four previously failing Atlas assertions were investigated: foreign-origin signup executed and contaminated later account counts, privileged role fields are rejected by Better Auth rather than accepted, and the old test expected no stored role despite the student default. The API check and legacy assertions are corrected. Equivalent signup/validation/hash/session/logout behavior passes with the production auth configuration and memory adapter. Atlas integration itself was not rerun, so live-driver behavior remains unverified.

Client `npm.cmd run test:isolated` runs mocked desktop/mobile UI suites; run `npm.cmd run test:i18n` separately for default-Bangla state, and `npm.cmd run test:e2e` for the isolated Express foundation. `PLAYWRIGHT_CHANNEL=msedge` is used locally. Both apps require typecheck, lint and build; server also checks bootstrap tooling types. Translation unit/coverage checks remain enabled. New tests cover role/origin denial, report cohorts/projections/exports, limiter resets/capacity/spoofing, database isolation, batched certificate validity, keyboard focus, themes, Bengali layout and PDF generation.

Final verification: both apps pass typecheck/lint/build; server tooling types pass. Backend memory-only suite: 173/173. Browser mocked regression: 242/242 with zero skips/flakes/failures, plus 6 language and 6 isolated-foundation checks (254 total). Translation unit tests: 2/2; 681 translated keys and no raw JSX labels. Formatting and Git whitespace checks pass. No Atlas integration was rerun.

## Dependency audit and limits

On 2026-11-11, both runtime (`npm audit --omit=dev`) audits report zero vulnerabilities. The unchanged shadcn 4.23.0 CLI moved to pinned development dependencies; the lockfile only reclassifies its existing dependency graph. Full development audits still report 10 moderate backend findings and 12 frontend findings (2 low, 10 moderate). These are unresolved build/tooling maintenance risks; no breaking forced downgrade was applied. Build installations must include dev dependencies because Tailwind imports the shadcn stylesheet. A runtime-only install is not a frontend build environment.

This milestone does not prove exhaustive penetration testing, load performance, malware scanning, screen-reader conformance, email verification/recovery delivery, distributed abuse protection or production cookie/CSP correctness. Real Atlas/GridFS transactions, staging load tests and deployment checks remain explicitly unverified. No live data, roles, indexes, credentials or infrastructure were modified by this milestone. Milestones 17–18 remain outside this request.

Manual checks: try foreign/missing/null Origin signup (403, no account), ordinary signup (student), student/teacher/admin private API access, forbidden ownership, pending membership, CSV and private downloads, and certificate revocation in fictional fixtures. After a 429 honor Retry-After. Never create live student records merely to test these paths.
