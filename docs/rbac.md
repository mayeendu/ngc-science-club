# Checkpoint C: server role authorization

This checkpoint adds API authorization only. It does not promote accounts, migrate users, add dashboards, or add role assignment routes. Better Auth 1.7.18 and Express 5.3.0 were inspected before implementation.

## Files and responsibilities

```text
server/src/
  types/roles.ts                    Single-role type and runtime parser
  types/auth.ts                     Typed authenticated Express locals
  lib/auth-access.ts                Better Auth plugin permissions
  lib/auth.ts                       Existing authentication configuration
  lib/authorization-user.ts         Minimal authoritative MongoDB lookup
  middleware/require-auth.middleware.ts
  middleware/require-role.middleware.ts
  app.ts                           Route order and demonstration routes
server/tests/rbac.test.mjs          Isolated security and auth integration tests
client/playwright.rbac.config.ts    Dashboard regression test configuration
client/tests/dashboard-rbac.spec.ts Dashboard tests with mocked API responses
```

Authentication answers “Which account owns this valid session?” Authorization answers “May that account perform this action?” A valid session alone does not grant teacher or administrator access.

## Request flow

1. `requireAuth(auth)` asks Better Auth to verify the session with `disableCookieCache: true`. Expired sessions and inconsistent session/user IDs fail with 401. A private WeakMap stores verification for this request only, so repeated authentication middleware does not repeat session lookups. Request body, query, headers, and even forged locals cannot create this private context.
2. `requireRole("teacher", "admin")` requires that verified context. It queries MongoDB on the primary for the current account's role and ban flag, using only the verified user ID. No cross-request role cache is used. A role change is therefore effective on the next request even when the session predates the change.
3. Only an exact single `student`, `teacher`, or `admin` value is accepted. Missing, unknown, differently cased, whitespace-padded, array, and comma-separated roles fail with 403. Better Auth supports multiple roles, but this application deliberately does not. Legacy accounts without a role retain ordinary authentication but cannot pass a role guard; there is no automatic role migration.
4. A banned account fails authorization. A deleted account fails authentication with 401. Database/session lookup errors return a generic 500 and do not continue to the handler. Internal driver details are not returned or attached to the sanitized errors.

The current MongoDB adapter uses the `user` collection and BSON ObjectId `_id` values, exposed as strings in sessions. The lookup validates this representation before constructing an ObjectId and projects only `role` and `banned`. Revisit this mapping if adapter ID generation or collection naming changes. Existing connection utilities are reused; requests do not open extra clients.

Typed `res.locals` fits the existing Express architecture. Its user/session/role fields remain optional until middleware establishes them; handlers narrow optional values before use. No `any` or global request augmentation is needed.

## Better Auth permissions

The custom access control uses the installed plugin's `defaultStatements`. Student and teacher receive empty user/session management permissions. Admin retains `adminAc.statements`. Default signup remains student and the plugin's role field remains non-input, so a public signup body cannot assign privileges.

The existing `/api/auth/admin` prefix additionally requires a current, exact admin role before the Better Auth handler. This blocks stale, banned, and comma-separated roles from reaching plugin administrative APIs. Better Auth still performs its own session and permission checks internally. The ordinary application middleware avoids duplicated session checks; it does not disable the library's own checks.

The existing first-admin bootstrap remains a separate trusted CLI procedure. No role promotion endpoint is added here. Client-side permission helpers or hidden buttons are never an authorization boundary.

Reference: [official Better Auth Admin plugin documentation](https://better-auth.com/docs/plugins/admin), especially custom access control and role schema. [Session management documentation](https://better-auth.com/docs/concepts/session-management) describes bypassing cookie cache for fresh verification.

## Route contract

| GET route               | student | teacher | admin |
| ----------------------- | ------- | ------- | ----- |
| `/api/student/overview` | 200     | 200     | 200   |
| `/api/teacher/overview` | 403     | 200     | 200   |
| `/api/admin/overview`   | 403     | 403     | 200   |

Every route above returns 401 without a valid session. Responses are exactly:

```json
{ "success": false, "message": "Authentication required" }
```

```json
{ "success": false, "message": "Insufficient permissions" }
```

```json
{ "success": true, "message": "Access granted" }
```

There is no implicit admin bypass: each route explicitly lists allowed roles. Use `requireAuth(auth)` before `requireRole(...)`. Health and member count stay public; `/api/me` retains its safe id/name/email response. CORS now runs before `/api/me`, so credentialed frontend calls receive the configured origin headers. Better Auth remains mounted before `express.json()`.

## Automated checks (PowerShell)

From the repository root:

```powershell
Set-Location server
npm.cmd run typecheck
npm.cmd run typecheck:scripts
npm.cmd run lint
npm.cmd run build
npm.cmd run test:rbac
npm.cmd run test:bootstrap
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:dashboard
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

RBAC and bootstrap suites use fictional memory fixtures, not Atlas accounts. The dashboard suite mocks session and profile responses and uses the production frontend on port 3100. The older `test:auth` suite is excluded because it uses a database rather than isolated mocks.

## Manual API checks (PowerShell)

Start Express with `npm.cmd run dev` in `server/`. Use an existing authorized test account. Do not promote real accounts simply to run these checks.

```powershell
$api = 'http://localhost:5000'
Invoke-RestMethod "$api/api/health"
Invoke-RestMethod "$api/api/members/count"
# Expected: HTTP 401 (PowerShell reports non-success responses as errors).
try { Invoke-RestMethod "$api/api/admin/overview" }
catch { [int]$_.Exception.Response.StatusCode }

$email = Read-Host 'Existing test account email'
$securePassword = Read-Host 'Password' -AsSecureString
$loginBody = @{
  email = $email
  password = [Net.NetworkCredential]::new('', $securePassword).Password
} | ConvertTo-Json
try {
  $null = Invoke-RestMethod "$api/api/auth/sign-in/email" `
    -Method Post -ContentType 'application/json' -Body $loginBody `
    -Headers @{ Origin = 'http://localhost:3000' } -SessionVariable clubSession
} finally {
  Remove-Variable loginBody, securePassword -ErrorAction SilentlyContinue
}

# Expected 200 for every valid, recognized role.
Invoke-RestMethod "$api/api/student/overview" -WebSession $clubSession
# Expected according to the table; a forbidden request reports HTTP 403.
foreach ($path in 'teacher', 'admin') {
  try { Invoke-RestMethod "$api/api/$path/overview" -WebSession $clubSession }
  catch { [int]$_.Exception.Response.StatusCode }
}

$null = Invoke-RestMethod "$api/api/auth/sign-out" -Method Post `
  -ContentType 'application/json' -Body '{}' -WebSession $clubSession `
  -Headers @{ Origin = 'http://localhost:3000' }
Remove-Variable clubSession, email
# Expected 401 again after logout.
```

Do not print login responses, cookies, passwords, or tokens. PowerShell is useful for the HTTP contract but does not reproduce browser cookie/CORS enforcement; the browser regression suite covers the existing dashboard interaction using mocks.

## Verification results — 2026-11-10

- Server: typecheck, tooling typecheck, lint, and production build passed.
- Client: typecheck, lint, and production build passed. The sandboxed build initially could not fetch the existing Geist font; rerunning with network access passed without changing application code.
- RBAC suite: 34 passed. Bootstrap regression suite: 15 passed. All use mocks or memory fixtures.
- Dashboard browser suite: 6 passed across desktop/mobile Chromium using Edge. An initial test selector matched both the page alert and Next.js route announcer; narrowing the selector fixed the test without changing application behavior.
- Read-only checks against the running local server: health 200, member count 200, unauthenticated profile 401, and all three unauthenticated overview routes 401.
- Signup, login, session persistence, logout, and administrative restrictions were verified with the actual Better Auth handler and memory adapter. Privileged role changes were tested only on fictional memory fixtures, never on Atlas users. The browser dashboard checks mock API responses; they are not a live Atlas login test.

## Limits and next lessons

These endpoints demonstrate authorization and contain no dashboard data. Fresh reads reduce stale privileges but cannot make a later business write atomic with its authorization check. Future sensitive mutations need transaction/conditional-write checks, resource ownership rules, audit logging, and their own concurrency tests. Club membership approval remains separate from account role. No frontend role dashboards, teacher provisioning, membership approval, or quiz features are included.
