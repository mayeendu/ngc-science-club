# Milestone 03, Lesson 05: authentication hardening

## Audit and implemented changes

Authentication continues to use Better Auth 1.7.18 sessions and the existing MongoDB adapter. No real users, sessions, indexes, secrets, roles, deployment settings, or data were changed by this lesson. All test writes are to fictional memory fixtures.

| Finding                                                       | Resolution                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Better Auth rate limits were disabled in development          | Explicit built-in limiting in every environment, with tighter email login/signup rules                        |
| Default forwarded IP headers can be supplied by clients       | Express overwrites a dedicated header from the socket; Better Auth reads only that header                     |
| Private JSON responses lacked cache protection                | API responses, including errors and throttled requests, use `Cache-Control: private, no-store`                |
| Missing standard response protections                         | Helmet 8.3.0 adds API security headers; Next.js adds compatible page headers and removes its framework header |
| Parser/driver errors may contain submitted values             | Application error logs contain status only; malformed JSON returns a safe 400 response                        |
| Auth URL allowed paths, URL credentials, or non-HTTP schemes  | Validate the exact HTTP(S) origin, matching the documented environment contract                               |
| Whitespace could satisfy secret minimum length                | Require at least 32 characters after trimming padding; generation must still use cryptographic randomness     |
| A late overview response could race a session expiry redirect | Expiration invalidates earlier request results; focus checks do not proceed with an expired snapshot          |

Important files:

- `server/src/lib/auth-security.ts`: shared internal header name and native Better Auth limiter policy.
- `server/src/lib/auth.ts`: applies that policy without replacing sessions, password hashing, origin validation, or the Admin plugin.
- `server/src/app.ts`: installs Helmet, cache protection, and server-owned IP handling before auth routes. Better Auth remains before `express.json()`.
- `server/src/config/env.ts`: validates secrets and exact origins without printing values.
- `server/src/middleware/error.middleware.ts`: safe response/log handling for unexpected and JSON parser errors.
- `server/src/index.ts`: startup failure logs omit raw connection errors that may contain private configuration.
- `server/tests/auth-security.test.mjs`: isolated real-handler tests for rate limits, cookies, signup field tampering, origin/callback rejection, logout replay, environment validation, and log redaction.
- `client/next.config.ts`: nosniff, frame denial, referrer policy, permissions policy, and disabled framework header.
- `client/src/components/auth/role-guard.tsx`: invalidates expired authorization requests.
- `client/tests/dashboard-rbac.spec.ts`: retains the role/access matrix and adds open-page expiry and initial response header checks.

## Rate limiting and IP trust

The installed Better Auth version supplies atomic in-process rate-limit consumption and normalized IPv6 handling. No custom limiter or custom JWT system is added.

| Endpoint                  | Per-IP rule                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/api/auth/sign-in/email` | 5 requests / 60 seconds                                                                                |
| `/api/auth/sign-up/email` | 5 requests / 60 seconds                                                                                |
| `/api/auth/sign-out`      | 20 requests / 60 seconds                                                                               |
| Other auth paths          | Existing native baseline of 100 / 10 seconds, with the plugin's tighter special rules where applicable |

Counts include unsuccessful and successful requests. Limits are per path, not one combined auth quota. The native HTTP 429 response includes `X-Retry-After`; CORS exposes it to the frontend. The normal Better Auth error message can be displayed by the existing forms. Health and custom read-only overview routes are outside the auth limiter. Native server-side `auth.api` calls do not pass through HTTP rate limiting.

The HTTP application sets `x-ngc-client-ip` from `req.socket.remoteAddress`, replacing incoming values. Incoming `X-Forwarded-For` and `X-Real-IP` do not control this limiter. Express proxy trust remains unchanged/disabled. Behind a reverse proxy, users will share its address and quota until deployment topology is reviewed and an explicit trusted proxy policy is approved. Never set `trust proxy: true` or trust arbitrary forwarding headers to fix this.

Storage is process-local memory: counters reset on restart and are not shared across replicas. This is suitable for current local/single-process verification, not a distributed abuse defense. Before scaling, approve an atomic shared store or edge limiter and review limits for college NAT/shared-network traffic. This lesson does not add Redis or database-backed counters, migrations, or network services.

## Cookies, origins, and roles

The audit verified the existing cookie policy rather than changing it: HttpOnly, SameSite=Lax, host-only, path `/`, and Secure with the `__Secure-` prefix when the configured auth origin is HTTPS. Production environment validation requires HTTPS for both origins. Local HTTP development continues to work. Tests inspect actual HTTP signup cookies and simulate the HTTPS cookie builder; they do not claim a deployed production browser test.

Credentialed CORS uses the exact `CLIENT_URL`, never a wildcard. A foreign site cannot read credentialed responses; CORS itself is not authorization or a substitute for CSRF protection. Better Auth's existing origin and Fetch Metadata protections remain enabled, and foreign-origin mutations and untrusted callback URLs are rejected by the actual handler in memory-only tests. Native clients without Origin are deliberately supported by Better Auth. All current custom protected routes are read-only; future mutations need origin/CSRF checks of their own.

Signup defaults to student. The Admin plugin rejects submitted roles. Core verification and plugin ban fields are ignored when non-input: tests verify that spoofed values do not make users verified, privileged, or banned. No frontend role assignment or parallel credential fields are introduced. Student and teacher have no Admin plugin management rights. The plugin admin prefix and custom protected endpoints continue using the current primary MongoDB role lookup from Checkpoint C.

Cookie cache remains disabled by default; Express session verification explicitly bypasses it. Role authorization reads the current account, not a stale client/session role. Frontend links may lag a role change until session refresh, but Express independently denies every disallowed data request. The browser suite checks direct URLs, refreshes, backend overrides, role tampering, logout, and expiry.

API CSP applies to API responses only. The Next.js app uses inline hydration scripts, so an untested strict frontend CSP is not added. HSTS is not enabled by this change: deployment HTTPS, proxy trust, cookie domain/SameSite choices, and HSTS require a reviewed hosting topology and approval. In particular, Vercel and an API on unrelated registrable domains need a deliberate same-site routing/cookie plan; do not silently switch to SameSite=None.

## Commands (PowerShell)

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run typecheck:scripts
npm.cmd run lint
npm.cmd run build
npm.cmd run test:security
npm.cmd run test:rbac
npm.cmd run test:bootstrap
npm.cmd audit --omit=dev
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:dashboard
npm.cmd run test:signup -- --workers=2
Remove-Item Env:PLAYWRIGHT_CHANNEL
npm.cmd audit --omit=dev
```

Do not use the legacy `test:auth` suite for this lesson: it creates/drops a database. The new security suite uses the real Better Auth handler plus its memory adapter, fake isolated clock windows, and a local ephemeral Express server. Concurrent login bursts verify that spoofing multiple IP headers cannot evade limits. No network access to Atlas is needed for tests.

For a read-only manual header check while Express is running:

```powershell
$response = Invoke-WebRequest -UseBasicParsing http://localhost:5000/api/health
$response.Headers['Cache-Control']
$response.Headers['X-Content-Type-Options']
$response.Headers['X-Frame-Options']
```

Use the isolated suite to exercise throttling instead of repeatedly submitting real students' credentials. Existing dashboard manual procedures are in [role-dashboards.md](role-dashboards.md).

## Dependency findings and deployment limits

Verification on 2026-11-10: client/server typechecks, lint and production builds passed; tooling typecheck passed; authentication security tests 11/11, RBAC tests 34/34, bootstrap tests 15/15, dashboard browser tests 56/56, and signup browser tests 10/10 passed. Browser checks used desktop/mobile Chromium through Edge and mocked API accounts. The suites do not establish live Atlas production authentication. Git whitespace checks passed and local environment files remain ignored.

The backend runtime audit reported zero findings. The frontend `--omit=dev` audit reported six findings (two low, four moderate) traced to the declared shadcn CLI dependency chain: deepmerge, minimatch, registry, and ts-morph. npm proposes a breaking downgrade of shadcn to 1.0.0; this was not applied. The full server install audit also reports ten moderate development-tool findings. These remain unresolved dependency maintenance items; this lesson does not claim a vulnerability-free dependency tree.

The existing database index helper is not executed by startup. Unique email/account/session indexes and any deployment index provisioning still require a separate read-only review and explicit approval before database writes. This lesson deliberately adds no index writes or migrations. Email verification delivery, account recovery, distributed/account-specific abuse controls, security event monitoring, frontend CSP, production transport/cookie topology, and deployment validation remain future security work, not implemented business features.

References: [Better Auth rate limits](https://better-auth.com/docs/concepts/rate-limit), [Better Auth security](https://better-auth.com/docs/reference/security), and [Express security recommendations](https://expressjs.com/en/advanced/best-practice-security/).
