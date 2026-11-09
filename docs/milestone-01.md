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
| tsx                                  | Runs and watches backend TypeScript during development         |
| @types/*                             | Type declarations for libraries and runtime APIs               |
| eslint / eslint-config-next          | Code checks and Next.js/React-specific rules                   |
| @eslint/js / typescript-eslint       | Backend JavaScript and TypeScript lint rules                   |
| prettier                             | Consistent formatting                                          |
| @playwright/test                     | Browser smoke checks at desktop/mobile viewport sizes          |
| babel-plugin-react-compiler          | React Compiler enabled by the generated Next.js scaffold       |

The backend loads its environment file through dotenv in config.ts. Native browser fetch suffices for one health request; TanStack Query and other required feature packages will be added when needed. The generated client/AGENTS.md points agents at the installed Next.js documentation. No root package/workspace or extra orchestration package is needed.

## How the important code works

```typescript
app.get("/api/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "ngc-science-club-api",
    message: "NGC Science Club API is running.",
  });
});
```

Express matches a GET request and sends JSON with status 200. The actual handler also disables caching. app.ts defines behavior without opening a port; index.ts starts the listener. TypeScript's NodeNext mode uses .js import specifiers because the production files are JavaScript ES modules.

The frontend's useEffect starts a health fetch after mounting. useState stores connection/language state and rerenders the interface when it changes. A five-second AbortController timeout prevents indefinite waiting, and effect cleanup cancels work when the component unmounts. The API helper checks both HTTP status and the JSON shape; a TypeScript type alone cannot validate network data. Retry starts a new request. English/Bangla text comes from one dictionary, and document language updates for assistive technology. Language choice is not persisted yet.

CORS permits http://localhost:3000 to read Express responses from port 4000. Wrong origins do not receive matching permission headers; this is a browser rule, not authentication. No database or auth dependencies are installed.

## Verification evidence

- Client and server production builds passed.
- Production start commands were exercised by Playwright with development servers stopped; all six browser/API checks also passed against production output.
- Client and server lint and strict TypeScript checks passed.
- Both development servers started on ports 3000/4000.
- Playwright: six checks passed using installed Microsoft Edge in desktop/mobile Chromium configurations. Tests cover live connection and languages, failure/retry, and health/404/CORS.
- Runtime dependency audits reported zero vulnerabilities in both apps. Full audits reported 8 moderate client and 10 moderate server development-tooling findings. No forced audit fixes were applied.
- Client uses ESLint 9.39.5 despite its deprecation notice because Next.js's bundled import/accessibility/React lint plugins reject ESLint 10. Server tooling supports ESLint 10.14.0. Revisit compatible upstream upgrades later.

On this Windows environment npm.ps1 is blocked, so commands use npm.cmd. The first sandboxed tsx launch failed on os.userInfo; the approved outside-sandbox run succeeded. This was a runner restriction, not an application dependency failure.

The sandbox also prevented Playwright from cleaning up its production-server child processes after passing assertions. The verified stuck test process tree was stopped, and the suite was rerun with approved process access: six passed, exit code 0, and normal server cleanup. No application workaround was added for runner permissions.

## What you learned

An HTTP API is a contract between independent processes. A successful frontend build does not prove API reachability, so browser checks matter. Environment examples document configuration without committing secrets. Public Next.js variables are not secret storage. Type checking, linting, formatting, runtime validation, and browser tests catch different problems. Language dictionaries separate content from layout.

Stop here. MongoDB, Better Auth, and subsequent features need the next milestone's approval.
