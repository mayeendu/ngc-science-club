# NGC Science Club

A planned Science Club management platform for Narsingdi Government College, Bangladesh.

Status: Phase 2, Milestone 01 foundation implemented. A bilingual Next.js homepage connects to a separate Express health endpoint. Database, authentication, membership workflows and quizzes follow in later milestones.

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
client/src/components/  Bilingual foundation and API status UI
client/src/lib/         API request and translation dictionary
client/tests/           Playwright smoke checks
server/src/app.ts       Express routes and CORS
server/src/config.ts    Validated environment configuration
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

Open http://localhost:3000 and http://localhost:4000/api/health. Use localhost consistently; 127.0.0.1 is a different CORS origin. Stop each with Ctrl+C. Defaults work without environment files in this milestone.

## Environment variables

| App    | Variable                 | Default / purpose                                               |
| ------ | ------------------------ | --------------------------------------------------------------- |
| Client | NEXT_PUBLIC_API_BASE_URL | http://localhost:4000; public API origin                        |
| Server | PORT                     | 4000; integer from 1 to 65535                                   |
| Server | CLIENT_ORIGIN            | http://localhost:3000; exact frontend origin, no trailing slash |

Next.js loads .env.local. The backend loads .env through dotenv in config.ts. NEXT_PUBLIC values are visible in browser code: never put secrets there. Restart after config changes; rebuild production client for API URL changes.

The browser calls Express directly. CORS lets the configured frontend read the response; it is not authentication and does not block non-browser clients. Cookies are not used yet. Production cookie/origin integration must be reviewed before Better Auth.

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

Build both apps first. Playwright starts production servers if none are running, or reuses existing servers outside CI.

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
2. Switch to বাংলা and back; check mobile width and keyboard focus.
3. Stop Express and select Check again. A readable failure appears within five seconds.
4. Restart Express and select Check again; it recovers without a page reload.
5. Inspect GET /api/health in browser Network tools: HTTP 200 and Access-Control-Allow-Origin: http://localhost:3000.
6. Open http://localhost:4000/api/missing and confirm HTTP 404.

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

## Hosting and limits

Vercel project root is client. Express is a separate service whose host is not yet selected. For deployment use its HTTPS URL in NEXT_PUBLIC_API_BASE_URL and the exact frontend origin in CLIENT_ORIGIN. No deployment has been performed. Production same-origin routing and session cookies remain future integration work.

The health endpoint checks process availability, not database readiness. Translation currently covers the foundation page; persistent language selection and multilingual routing/content follow with later features.

Runtime-only audits reported zero vulnerabilities. Full audits reported 8 moderate client and 10 moderate server development-tooling findings. Client ESLint 9 is retained because bundled Next.js plugins do not yet accept ESLint 10; server uses ESLint 10. Review compatible upstream fixes before launch rather than running npm audit fix --force.

See [Milestone 01 notes](docs/milestone-01.md) for package explanations and verification evidence.
