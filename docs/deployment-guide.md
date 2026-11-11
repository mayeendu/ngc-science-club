# Milestone 17 — Production deployment preparation

Preparation is local. No Vercel project, host service, domain, Atlas network rule/index, account role or production secret has been created or changed. Connecting a Git repository to hosting can trigger an immediate deploy; obtain approval before doing it. Do not run a deploy CLI or import a Blueprint as a documentation step.

## Topology and cookies

Use Next.js on Vercel and a long-running Node 24 Express web service, for example Render. The backend runs the 15-second quiz expiry worker, transactions and GridFS streaming; do not deploy it as a static site or an ephemeral frontend function. Choose a tier that stays running for scheduled expiry, and allow graceful termination. Lazy settlement still checks quiz deadlines during API operations, but it does not replace the expiry worker.

Keep the browser frontend and API on HTTPS subdomains of one institution-controlled site, for example `https://club.example.edu.bd` and `https://api.club.example.edu.bd`. These are fictional placeholders. The host-only API cookie remains HttpOnly, Secure in production, SameSite=Lax. Browser requests use credentials; Express CORS and auth mutation Origin must match the single frontend origin exactly. Broad cookie Domain attributes and wildcard CORS are unnecessary. Default `*.vercel.app` and `*.onrender.com` domains are cross-site; the current Lax policy will not provide normal credentialed cross-site fetch. Do not weaken cookie policy to work around an unreviewed topology. Review actual domains, redirects, TLS, Safari behavior and cookie delivery on staging.

Preview deployments must use a separately configured staging API/database and an explicitly trusted stable preview origin. Production accepts only its configured CLIENT_URL; arbitrary preview URLs are intentionally denied. Changing build-time public API origins requires a new frontend build. Keep frontend/API release versions compatible.

## Vercel settings (after approval)

| Setting          | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Root directory   | `client`                                             |
| Framework / Node | Next.js / 24.x                                       |
| Install          | `npm ci --include=dev`                               |
| Build            | `npm run check:production && npm run build`          |
| Output           | Framework default; do not set `out` or static export |
| Public domain    | Approved HTTPS frontend subdomain                    |

`client/vercel.json` records install/build settings without secrets. Development dependencies are required at build time (Tailwind/shadcn stylesheet/compiler); shadcn is not a runtime dependency. Set these three non-secret origins before building: `API_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_AUTH_URL`, all equal to the approved HTTPS API origin with no trailing slash or `/api/auth`. The preflight rejects mismatches, credentials and paths. Never put MongoDB URIs, auth secrets, account data or private storage keys in NEXT_PUBLIC variables or frontend environment settings. Next public values are embedded into the bundle.

## Express host settings (after approval)

| Setting        | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| Service / root | Node web service / `server`                                         |
| Node           | 24.x (`.node-version` and package engines)                          |
| Build          | `npm ci --include=dev && npm run build && npm run check:production` |
| Start          | `npm start` (`node dist/index.js`)                                  |
| Listening      | `0.0.0.0`, host-supplied `PORT` (Render commonly 10000)             |
| Health path    | `/api/ready`                                                        |

Set `NODE_ENV=production`, host `PORT`, exact HTTPS `CLIENT_URL`, exact API `BETTER_AUTH_URL`, private `MONGODB_URI`, `DB_NAME`, and a unique random `BETTER_AUTH_SECRET` of at least 32 non-padding characters. Provision secrets through the approved host secret store; do not paste values into commits, screenshots, support messages or logs. Keep the auth secret stable across compatible releases; rotation invalidates sessions and requires a separate plan. Leave `BOOTSTRAP_ADMIN_ENABLED=false` and other bootstrap identity fields unset in the running service. Production templates are `.env.production.example`; blanks are intentional and are not usable credentials. The preflight validates shape only, not DNS or permissions, and never connects to Atlas.

Proxy trust remains disabled. IP limits use socket addresses, so users behind the host proxy may share a budget. Before public traffic, review actual trusted ingress, header replacement and distributed limits with the hosting operator; never set `trust proxy=true` blindly. Backend API Helmet headers and frontend frame/referrer/permissions headers remain enabled. Production HSTS and a tested Next-compatible CSP require the approved HTTPS topology; this preparation does not silently change those policies.

## Atlas, storage and shutdown

Use an approved Atlas database/user with transaction support and the minimum required application database permissions. Restrict network access to the approved host egress/private network; do not open global access as a troubleshooting default. Never disable certificate/TLS checks. Back up the database and GridFS bucket together and rehearse restoration before launch. Resource files are private GridFS objects, not local disk uploads, so ephemeral host disks do not lose them. The current 5 MiB upload/body and document-structure checks do not constitute malware scanning.

Review existing auth uniqueness/expiry indexes using the original index helper and the [query index plan](query-index-plan.md). No helper is automatically invoked at startup; actual index writes require approval. Review index compatibility and duplicates before creating them. New accounts stay students; first-admin bootstrap and real teacher assignment are separately approved operations, not deployment side effects. See [admin operations](admin-guide.md).

`GET /api/health` reports process liveness without database access. `GET /api/ready` pings the connected MongoDB handle with a 2.5-second driver timeout and returns only `ready` (200) or `unavailable` (503), no credentials/topology. Readiness does not establish index correctness, worker health, email delivery or end-to-end authentication. Startup connects to MongoDB before accepting HTTP traffic. SIGTERM/SIGINT stop new HTTP traffic, close idle connections, wait for current requests and the expiry worker, then close MongoDB. Shutdown is idempotent and has a 10-second force-exit deadline. Configure the host grace period longer than that. HTTP connection draining does not cancel a database transaction already in progress; transaction guarantees still apply.

## Verification and rollback

Run both apps' typecheck/lint/build, server tooling typecheck, memory-only tests, client deployment preflight tests and final UI suites before requesting staging deployment. `server/tests/deployment.test.mjs` injects fake readiness/shutdown dependencies and fictional environment values; no real ping, credentials, roles or deploy calls. Production preflights must pass on the actual host configuration after approval. Health monitoring should use readiness; a 503 must block promotion. Avoid logging successful health requests at high volume.

After an approved staging deploy, verify login/logout/cookie replay, all three roles, membership decisions, quiz deadline/release, event capacity/attendance, GridFS upload/download and certificate verification with approved fictional staging fixtures. Inspect TLS, exact CORS, cookie flags, redirects, readiness on dependency failure and restart/drain behavior. Load tests and real database transaction smoke tests are not established by memory tests.

Retain the last known compatible frontend/backend release. If a release fails, stop promotion, restore those artifacts and their matching public origins/configuration, and check readiness/authentication. No schema migration is introduced here; never delete data or restore a backup over production as an automatic rollback. Secret rotation, data recovery, index writes and traffic/domain changes need their own approval.

Sources checked for this preparation: [Vercel monorepos](https://vercel.com/docs/monorepos), [Vercel environment variables](https://vercel.com/docs/environment-variables), [Render web services](https://render.com/docs/web-services), [Render health checks](https://render.com/docs/health-checks), [Better Auth cookies](https://better-auth.com/docs/concepts/cookies). Installed Next.js environment-variable documentation was also reviewed.

Local verification complete: both apps pass typecheck/lint/build; 4 deployment backend tests and 1 frontend preflight test pass within the final regression totals. No real hosting, DNS, database, account or deployment changes were made. See [final status](final-project-status.md).
