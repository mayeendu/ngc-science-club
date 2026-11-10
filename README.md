# NGC Science Club

Milestone 05 Lessons 02–05 add approved-student quizzes, timed attempts, autosave, server scoring, released results/performance and teacher/admin reports. See [assessment guide](docs/quiz-assessments.md) for routes, policies, testing and MongoDB requirements. Earlier milestone notes below describe their original scope.

Milestone 05 Lesson 01 adds teacher/admin quiz management at `/dashboard/teacher/quizzes`. See [quiz management notes](docs/quiz-management.md) for fields, permissions, state/version rules and checks.

Milestone 04 Lesson 05 adds admin `/dashboard/admin/analytics` with backend-calculated membership KPIs and charts. See [analytics notes](docs/membership-analytics.md) for date/cohort definitions, privacy and checks.

Milestone 04 Lesson 04 adds approved-student member profile management at `/dashboard/student/profile`. See [profile notes](docs/member-profile-management.md) for protected fields, synchronization and test commands.

Milestone 04 Lesson 03 adds public `/members` directory and individual profiles from approved applications. See [directory notes](docs/member-directory.md) for privacy rules, API parameters and test commands.

Milestone 04 Lesson 02 adds admin membership review at `/dashboard/admin/memberships`. See [review documentation](docs/membership-review.md) for confirmation, validation, concurrency rules and test commands.

Milestone 04 Lesson 01 adds the student membership application and private dashboard status. See [membership application notes](docs/membership-application.md) for endpoints, files, commands and manual checks. Admin approval is not implemented.

Milestone 03 Lesson 05 adds authentication rate limiting, security headers, safer error logging, environment validation, and isolated security tests. See [authentication hardening](docs/auth-security.md) for policies, commands, audit findings, and deployment limits.

Current checkpoint: [secure first-administrator bootstrap](docs/admin-bootstrap.md). Offline tooling is implemented and tested without live database writes. Do not execute promotion without explicit approval for the reviewed account. The read-only inspection currently found no administrator and no eligible verified student.

A planned Science Club management platform for Narsingdi Government College, Bangladesh.

Status: Milestones 01/02 completed; Milestone 03, Lesson 01 adds Better Auth server integration. The Next.js homepage still connects to Express health. Frontend authentication, RBAC, membership workflows and quizzes remain later lessons.

Subsequently approved: the client auth helper, validation schemas, global Toaster and /signup page. See [signup page notes](docs/signup-page.md) for implementation details and ten passing mocked browser checks. Login, RBAC and membership workflows remain future tasks.

## Better Auth server lesson

See [Lesson 01 notes](docs/milestone-03-lesson-01.md) for configuration, index setup, test results and manual checks. The backend requires BETTER_AUTH_URL and a private BETTER_AUTH_SECRET in addition to MongoDB settings. Run `npm.cmd --prefix server run auth:secret` to generate a missing local secret without printing it; existing secrets are preserved. Do not overwrite your configured .env with an example.

`npm.cmd --prefix server run test:auth` builds and tests email/password authentication using a temporary Atlas database and fictional accounts, then cleans it up. MongoDB access must permit that test database. Existing public endpoints are /api/health and /api/members/count; Better Auth runs under /api/auth.

## Planning documents

- [Requirements and open questions](docs/requirements.md)
- [Architecture and security](docs/architecture.md)
- [Database design](docs/database-design.md)
- [API design](docs/api-design.md)
- [Development roadmap](docs/development-roadmap.md)

## Requirements and structure

Use Node.js 24.x (verified: 24.19.0) and npm (verified: 12.2.1). Each app has its own package.json and lockfile. On Windows PowerShell use npm.cmd/npx.cmd if .ps1 execution is blocked; no execution-policy change is needed.

```text
client/src/app/          App Router pages, layout and styles
client/src/components/  Earlier bilingual foundation components (not the active homepage)
client/src/lib/         API request and translation dictionary
client/tests/           Playwright smoke checks
server/src/app.ts       Express routes and CORS
server/src/config/env.ts Validated environment configuration
server/src/config/db.ts  Database placeholder for a later milestone
server/src/middleware/   Not-found and centralized error handlers
server/src/modules/members/ Member module placeholders
server/src/utils/        Application error class
server/src/index.ts     Listener and shutdown
docs/                   Requirements, design and milestone notes
AGENTS.md               Project and mentoring conventions
```

## First-time setup

Run from the repository root. Preserve existing environment files if already configured.

```powershell
npm.cmd --prefix client ci
npm.cmd --prefix server ci
Copy-Item client/.env.example client/.env.local
Copy-Item server/.env.example server/.env
```

Start the backend in terminal 1:

```powershell
cd server
npm.cmd run dev
```

Start the frontend in terminal 2:

```powershell
cd client
npm.cmd run dev
```

Open http://localhost:3000 and http://localhost:5000/api/health. Use localhost consistently; 127.0.0.1 is a different CORS origin. Stop each with Ctrl+C. Defaults work without environment files in this milestone.

## Environment variables

| App    | Variable                 | Default / purpose                                                           |
| ------ | ------------------------ | --------------------------------------------------------------------------- |
| Client | API_URL                  | http://localhost:5000; server-side API origin, with public/default fallback |
| Client | NEXT_PUBLIC_API_BASE_URL | http://localhost:5000; optional browser API origin                          |
| Server | PORT                     | 5000; integer from 1 to 65535                                               |
| Server | CLIENT_URL               | http://localhost:3000; exact frontend origin, no trailing slash             |

Next.js loads .env.local. The backend loads .env through dotenv in config/env.ts. NEXT_PUBLIC values are visible in browser code: never put secrets there. Restart after config changes; rebuild production client for API URL changes.

The active homepage calls Express from the Next.js server. API_URL takes priority there, then NEXT_PUBLIC_API_BASE_URL, then the localhost default. It validates the JSON response and streams the status inside Suspense; the static page shell builds without Express running. CORS is not required for this server-to-server call, but is configured and tested for future direct browser requests. CORS is not authentication. Cookies are not used yet. Production cookie/origin integration must be reviewed before Better Auth.

## Checks and production builds

Both apps provide dev, build, start, lint, typecheck, format, and format:check. dev watches source; build produces production output; start runs that output. Run from the repository root:

```powershell
npm.cmd --prefix server run lint
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run build
npm.cmd --prefix server run format:check
npm.cmd --prefix client run lint
npm.cmd --prefix client run typecheck
npm.cmd --prefix client run build
npm.cmd --prefix client run format:check
```

After building, stop development servers and run production servers in separate terminals:

```powershell
npm.cmd --prefix server run start
```

```powershell
npm.cmd --prefix client run start
```

## Browser checks

Build both apps first. Playwright starts production servers if none are running, and refuses to reuse existing servers, so it always tests the built code.

```powershell
cd client
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Alternatively, use an already-installed Microsoft Edge:

```powershell
$env:PLAYWRIGHT_CHANNEL = "msedge"
npm.cmd run test:e2e
```

Manual testing:

1. Open the homepage and wait for the connected status.
2. Check the page at narrow/mobile widths.
3. Stop Express and refresh the homepage. A readable failure appears within five seconds.
4. Restart Express and refresh the homepage; it shows the live API message again.
5. Inspect GET /api/health directly or run the automated CORS test. The homepage request runs on the Next.js server, so it does not appear as a browser-to-Express Network request.
6. Open http://localhost:5000/api/missing and confirm HTTP 404.

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

## Hosting and limits

Vercel project root is client. Express is a separate service whose host is not yet selected. For deployment use its HTTPS URL in NEXT_PUBLIC_API_BASE_URL and the exact frontend origin in CLIENT_URL. No deployment has been performed. Production same-origin routing and session cookies remain future integration work.

The health endpoint checks process availability, not database readiness. English/Bangla messages and the earlier foundation component remain available, but the active simplified homepage currently uses English. Full language support remains a confirmed requirement for subsequent UI milestones.

Runtime-only audits reported zero vulnerabilities. Full audits reported 8 moderate client and 10 moderate server development-tooling findings. Client ESLint 9 is retained because bundled Next.js plugins do not yet accept ESLint 10; server uses ESLint 10. Review compatible upstream fixes before launch rather than running npm audit fix --force.

See [Milestone 01 notes](docs/milestone-01.md) for package explanations and verification evidence.

## Milestone 03, Lesson 04, Checkpoint C

Checkpoint D now adds role-aware navbar links, `/dashboard` routing, three guarded placeholder dashboards, and desktop/mobile regression coverage. See the [dashboard guide](docs/role-dashboards.md) for files, commands, permissions, and security limitations. Express remains the authorization boundary.

Server role guards enforce exact student/teacher/admin permissions using verified Better Auth sessions and fresh MongoDB role reads. See [RBAC implementation and testing](docs/rbac.md) for the route matrix, file guide, commands, security policy, and limitations. No account roles are changed by this checkpoint.
