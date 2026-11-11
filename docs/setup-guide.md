# Local setup guide

Use Node 24.x and npm. One repository contains independent `client/` and `server/` apps and lockfiles. Local development ports are 3000/5000; browser tests reserve 3100, 5101 and 5102. Windows examples use npm.cmd to avoid PowerShell launcher policy problems. macOS/Linux can use npm/npx.

Install from the repository root:

```powershell
npm.cmd --prefix server ci
npm.cmd --prefix client ci --include=dev
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
if (!(Test-Path client/.env.local)) { Copy-Item client/.env.example client/.env.local }
```

Edit only your private environment files. Preserve existing values. The backend needs a private Atlas URI (or a local replica set), database name, exact local frontend/API origins, and an auth secret. `npm.cmd --prefix server run auth:secret` creates a missing local secret without printing it; it does not provision accounts. Do not commit `.env`, credentials, cookies or real student data. Plain standalone MongoDB cannot support the application's transaction workflows. MongoDB is unnecessary for the isolated test suites.

Frontend `.env.local`: `API_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_AUTH_URL` all point to `http://localhost:5000`. Only public origins belong in browser variables. Backend `.env`: `CLIENT_URL=http://localhost:3000`, `BETTER_AUTH_URL=http://localhost:5000`, `NODE_ENV=development`, `PORT=5000`, plus private MongoDB/auth values. Examples are documentation, not usable credentials. Production setup is separate in [deployment preparation](deployment-guide.md).

Start in separate terminals:

```powershell
npm.cmd --prefix server run dev
```

```powershell
npm.cmd --prefix client run dev
```

Visit `http://localhost:3000`. Bangla is the default; navigation language and appearance controls persist locally. `/api/health` checks the process; `/api/ready` checks database availability. New accounts are students. Membership approval and teacher/admin authorization are separate from account signup; never give yourself privileges by editing client requests.

## Verification without Atlas

Run the backend checks first because browser fixture APIs use its compiled output:

```powershell
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run typecheck:scripts
npm.cmd --prefix server run lint
npm.cmd --prefix server run build
npm.cmd --prefix server run test:isolated
npm.cmd --prefix client run check:i18n
npm.cmd --prefix client run check:links
npm.cmd --prefix client run test:translations
npm.cmd --prefix client run test:deployment
npm.cmd --prefix client run typecheck
npm.cmd --prefix client run lint
npm.cmd --prefix client run build
```

Then run browser suites sequentially (each reserves port 3100):

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd --prefix client run test:isolated
npm.cmd --prefix client run test:i18n
npm.cmd --prefix client run test:e2e
npm.cmd --prefix client run test:launch
```

Use Edge if installed, or omit the variable and install the project's pinned Playwright Chromium (`npx.cmd playwright install chromium` from client, requiring network approval when applicable). Do not start tests while another build or browser suite is using `.next`/port 3100. `test:e2e` starts a database-disabled Express fixture; `test:launch` uses a real Better Auth memory adapter and production membership/feedback repositories with fictional memory storage. Neither starts the production service or connects to Atlas. The complete backend runner excludes Atlas integration and disables database entry points. Never use a wildcard test command. Do not run `test:atlas:auth` or first-admin execution without explicit approval; the Atlas test writes a temporary database.

## Troubleshooting

- Environment failure: check required variable names, HTTPS in production and exact origins without paths/trailing slashes. Do not paste secret values into errors or screenshots.
- Database/transaction failure: check replica-set/Atlas support, credentials and approved network access; do not disable TLS or open all network addresses by default.
- Login works but session is absent: use consistent `localhost` instead of mixing `127.0.0.1`; match CORS/trusted origin; inspect cookie attributes. For production, verify same-site custom domains.
- A 403 after login: inspect actual stored role/membership/ownership through an approved admin review. Frontend session labels cannot override the backend.
- A 409: another update or version changed the record; refresh before editing. Quiz content freezes after the first attempt.
- A 429: wait for Retry-After. Do not rotate headers to bypass controls.
- Failed production build: include dev dependencies and set public API origins before build. Production preflight validates shape, not DNS/connectivity.

No setup command automatically changes roles, creates application indexes or deploys the platform.
