# Phase 2, Milestone 01: Project Foundation

## Goal and files

Create two runnable, independently built applications and prove browser-to-API communication. Root files provide ignore/format rules and project instructions. client/ contains App Router source, messages/API helpers, environment example, lint/TypeScript configuration, scripts/lockfile and browser checks. server/ contains an Express app, validated environment config, listener, environment example, lint/TypeScript configuration and scripts/lockfile. README.md contains exact setup and manual test commands. Planning docs record confirmed scope.

## Important packages

| Package                              | Purpose                                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| next                                 | App Router, development server and frontend production build   |
| react / react-dom                    | Components, state, effects and browser rendering               |
| typescript                           | Compile-time type checking; compiles backend into dist/        |
| tailwindcss / @tailwindcss/turbopack | Utility styles and scaffold's Tailwind build integration       |
| express                              | Backend HTTP routing/listener                                  |
| cors                                 | Browser cross-origin response headers for the allowed frontend |
| dotenv                               | Loads server-only .env configuration before config validation  |
| tsx                                  | Runs and watches backend TypeScript during development         |
| @types/*                             | Type declarations for libraries and runtime APIs               |
| eslint / eslint-config-next          | Code checks and Next.js/React-specific rules                   |
| @eslint/js / typescript-eslint       | Backend JavaScript and TypeScript lint rules                   |
| prettier                             | Consistent formatting                                          |
| @playwright/test                     | Browser smoke checks at desktop/mobile viewport sizes          |
| babel-plugin-react-compiler          | React Compiler enabled by the generated Next.js scaffold       |

The backend loads its environment file through dotenv in config/env.ts. Native browser fetch suffices for one health request; TanStack Query and other required feature packages will be added when needed. The generated client/AGENTS.md points agents at the installed Next.js documentation. No root package/workspace or extra orchestration package is needed.

## How the important code works

```typescript
app.get("/api/health", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "NGC Science Club API is running!",
    timestamp: new Date().toISOString(),
  });
});
```

Express matches a GET request and sends JSON with status 200. The actual handler also disables caching. app.ts defines behavior without opening a port; index.ts starts the listener. TypeScript's NodeNext mode uses .js import specifiers because the production files are JavaScript ES modules.

The active homepage is a Server Component. A nested BackendConnection component waits for an incoming request using connection(), then calls getHealth with a five-second timeout. Suspense provides a loading placeholder while the status streams into the static page shell. Request errors become a readable failure message; refresh retries the request. The API helper checks HTTP status and the actual JSON shape, including the timestamp, rather than asserting an unchecked type. API_URL configures the server-side destination; NEXT_PUBLIC_API_BASE_URL and the localhost default are fallbacks. The earlier interactive bilingual components/messages remain in the repository but are not currently rendered by page.tsx.

CORS permits http://localhost:3000 to read Express responses from port 5000. Wrong origins do not receive matching permission headers; this is a browser rule, not authentication. No database or authentication integration is active.

## Server structure update

Environment configuration now lives in config/env.ts. config/db.ts and modules/members/member.{routes,controller,service,repository}.ts are placeholders for later implementation. Routes will map URLs to controllers; controllers handle HTTP; services enforce business rules; repositories execute database queries.

not-found.middleware.ts forwards a 404 AppError; error.middleware.ts sends consistent JSON and hides unexpected server errors. app.ts registers routes first, then the not-found handler, then the error handler. Express recognizes error middleware by its four parameters. index.ts still owns startup and shutdown. Existing .env values were preserved and remain Git-ignored; no packages were installed by this restructuring.

Verification after restructuring: backend lint, typecheck and build passed. HTTP checks passed for /api/health, unknown routes, expected application errors, and redaction of unexpected error details. The generic error log during the deliberate failure test was expected.

## Verification evidence

- Client and server production builds passed.
- Production start commands were exercised by Playwright; all six checks passed against production output. Tests refuse to reuse existing servers, ensuring the compiled apps are verified.
- Client and server lint and strict TypeScript checks passed.
- Both development servers started on ports 3000/5000.
- Playwright: six checks passed using installed Microsoft Edge in desktop/mobile Chromium configurations. Tests cover the server-rendered live connection/reload/responsive width, health/404/CORS, and rejection of the old response format.
- Runtime dependency audits reported zero vulnerabilities in both apps. Full audits reported 8 moderate client and 10 moderate server development-tooling findings. No forced audit fixes were applied.
- Client uses ESLint 9.39.5 despite its deprecation notice because Next.js's bundled import/accessibility/React lint plugins reject ESLint 10. Server tooling supports ESLint 10.14.0. Revisit compatible upstream upgrades later.

On this Windows environment npm.ps1 is blocked, so commands use npm.cmd. The first sandboxed tsx launch failed on os.userInfo; the approved outside-sandbox run succeeded. This was a runner restriction, not an application dependency failure.

The sandbox also prevented Playwright from cleaning up its production-server child processes after passing assertions. The verified stuck test process tree was stopped, and the suite was rerun with approved process access: six passed, exit code 0, and normal server cleanup. No application workaround was added for runner permissions.

## What you learned

During the latest review, duplicate Express definitions were consolidated into app.ts, config/env.ts was aligned to PORT=5000 and CLIENT_URL, and the homepage/helper/tests were aligned to the success/message/timestamp contract. The client initially failed production prerendering because an uncached server fetch was outside Suspense. Keeping request-time fetching inside a Suspense child fixed that error without requiring the API during build. A React lint error was fixed by handling the fetch promise before constructing JSX.

The root .gitignore excludes .env and .env.* and allows example templates. The client's nested ignore file now also allows .env.*.example. Only environment templates are tracked; local environment files remain ignored. No packages were installed during this review, and the requested backend scripts and ES2022/NodeNext compiler settings were preserved.

An HTTP API is a contract between independent processes. A successful frontend build does not prove API reachability, so browser checks matter. Environment examples document configuration without committing secrets. Public Next.js variables are not secret storage. Type checking, linting, formatting, runtime validation, and browser tests catch different problems. Language dictionaries separate content from layout.

Stop here. MongoDB, Better Auth, and subsequent features need the next milestone's approval.
