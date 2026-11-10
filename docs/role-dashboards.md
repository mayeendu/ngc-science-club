# Checkpoint D: role-aware navigation and dashboards

## Goal and permission policy

The frontend now sends signed-in accounts from `/dashboard` to their own role dashboard. Guests go to `/login`. Dashboard access follows the existing Express policy:

| Account | Student dashboard | Teacher dashboard | Admin dashboard |
| ------- | ----------------- | ----------------- | --------------- |
| Guest   | Login             | Login             | Login           |
| Student | Allowed           | Access Denied     | Access Denied   |
| Teacher | Allowed           | Allowed           | Access Denied   |
| Admin   | Allowed           | Allowed           | Allowed         |

Missing, unknown, and comma-separated roles receive no dashboard access. No users are promoted or migrated. Each dashboard is a welcome panel, role badge, and three explicitly future feature cards. There are no role-changing controls, membership workflows, quizzes, or administrative records.

## Files and concepts

```text
client/src/
  app/dashboard/page.tsx             Session-aware redirect
  app/dashboard/student/page.tsx     Student dashboard entry point
  app/dashboard/teacher/page.tsx     Teacher dashboard entry point
  app/dashboard/admin/page.tsx       Admin dashboard entry point
  components/auth/role-guard.tsx     Session check and Express API gate
  components/auth/access-state.tsx   Loading, retry, and 403 UI
  components/dashboard/role-dashboard.tsx
  components/layout/navbar.tsx       Permitted navigation and logout
  lib/roles.ts                      Strict parser, labels, route matrix
  lib/auth-client.ts                Existing Better Auth client, session refresh
client/tests/dashboard-rbac.spec.ts
client/playwright.rbac.config.ts
```

`useSession()` subscribes components to Better Auth's shared session state. The navbar only derives links from that server-provided session; localStorage, query parameters, and client headers are not role sources. Better Auth rechecks the session on window focus and at 60-second intervals. A stale role may briefly affect navigation, but it cannot authorize data: the Express check is authoritative.

`RoleGuard` first checks session loading/errors and the exact recognized role. It then calls the corresponding `/api/student/overview`, `/api/teacher/overview`, or `/api/admin/overview` with credentials and `cache: no-store`. Its children mount only after a valid success response. A backend 401 redirects to login; 403 shows Access Denied; other failures and invalid responses show a retry action. Requests time out after ten seconds. The check repeats on window focus. Cleanup cancels pending requests, and request sequencing prevents older responses from replacing newer checks.

The private guard is keyed by account, role, target dashboard, and session expiry. Changing these creates a new loading state rather than reusing an earlier success. The known session expiry also schedules a login redirect. Logout uses the existing Better Auth sign-out flow and reactive session updates.

Small route entry files reuse `RoleDashboard`, which uses existing shadcn Card components. Shared display text and permission mappings live in dedicated modules to prepare for later English/Bangla localization. Full translations are outside this checkpoint.

## Security boundary

The Next.js HTML/RSC response contains a loading shell, no personalized welcome message or protected records. The dashboard's children are client components with static placeholder descriptions; no server component fetches administrative data. The generic page response remains HTTP 200: “Access Denied (403)” describes its UI state, while Express supplies the actual HTTP 403. A true Next.js HTTP 403 page would need server-side cookie forwarding and authorization, which this checkpoint does not introduce.

Hiding links and guarding React components improve navigation; they cannot secure an API. Every future protected data request must still be authorized by Express. A role change in another session is caught by the next backend request or focus check; this is not real-time role broadcasting. Better Auth's management endpoints remain protected by Checkpoint C. No backend code or schema changes are needed here.

See [Better Auth session management](https://better-auth.com/docs/concepts/session-management) and [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication) for the distinction between session UX and authorization close to the data source.

## Commands and manual verification (PowerShell)

Start the existing backend and frontend in separate terminals:

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run dev
```

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\client'
npm.cmd run dev
```

Keep `NEXT_PUBLIC_AUTH_URL` pointed to the Express origin and `CLIENT_URL` pointed to the browser's origin. No new secrets or environment variables are required.

1. As a guest, directly open each dashboard URL; confirm login appears and no dashboard content flashes.
2. Sign in with an existing authorized test account. Open `/dashboard`; verify the account's own dashboard and the navbar links against the table.
3. Visit every dashboard directly and refresh. Allowed pages show a welcome panel; disallowed pages show 403 and Access Denied. Do not promote real users merely to test this.
4. Inspect the browser Network tab: the role overview request includes cookies, uses the correct Express route, and succeeds only with backend permission.
5. Stop Express, refresh a dashboard, and check the error/retry UI. Restart Express and retry.
6. Sign out, then visit a dashboard again. Confirm login and removal of role links.
7. Test at mobile width. Navbar wraps and cards become a single column.

Automated tests exercise all roles with mocked Better Auth and Express responses, so no live role changes or tokens are needed:

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\client'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:dashboard
Remove-Item Env:PLAYWRIGHT_CHANNEL
Set-Location ../server
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:rbac
```

Browser tests run on port 3100 against the production frontend and cover redirects, the full role matrix, direct visits, refreshes, invalid roles, forged localStorage, backend denials, revoked/expired sessions, retry, logout, focus revalidation, initial HTML, and mobile overflow. They do not establish live Atlas authentication; the backend isolated suite separately exercises the real Better Auth handler with memory fixtures.

## Verification results — 2026-11-10

- Client and server typecheck, lint, and production build passed.
- Dashboard browser suite: 54 passed across desktop/mobile Chromium using Edge.
- Existing signup browser regression suite: 10 passed using mocked authentication responses.
- Backend RBAC regression suite: 34 passed, including real Better Auth signup/login/session/logout with memory fixtures.
- Git whitespace checks passed, and server/client local environment files remain ignored.
- No new dependencies, backend changes, database writes, or real role changes were needed for Checkpoint D.
