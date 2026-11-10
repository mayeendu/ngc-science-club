# Milestone 03, Lesson 01: Better Auth server integration

## Scope and result

Server-only email/password authentication on Express 5.3.0, Better Auth 1.7.18 and @better-auth/mongo-adapter 1.7.18, using the existing MongoDB 7.8.0 driver/client/database. No frontend auth pages, RBAC, admin accounts, or custom JWT login were added. Email delivery, verification requirements and recovery workflows are later lessons; this development lesson allows login before email verification.

## Files and responsibilities

| File                                   | Responsibility                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| server/src/config/env.ts               | Zod validation for server settings, auth secret and public backend origin; redacts invalid values from failures  |
| server/src/config/db.ts                | Existing connection pool, now exposed through getMongoClient() for reuse                                         |
| server/src/lib/auth.ts                 | Creates Better Auth with the MongoDB adapter, password auth, explicit trusted origins and secure-cookie behavior |
| server/src/auth/auth.indexes.ts        | Idempotent indexes for default auth collection names; fails on duplicates/conflicts rather than deleting data    |
| server/src/app.ts                      | Application factory: CORS, raw auth handler, JSON parser, health/member routes and error handlers                |
| server/src/index.ts                    | Connects MongoDB, prepares indexes and auth, then starts HTTP; retains shutdown cleanup                          |
| server/scripts/create-auth-secret.mjs  | Generates a local cryptographic secret only if missing; never prints it or replaces a nonempty existing value    |
| server/tests/auth.integration.test.mjs | Real HTTP/Atlas tests in a uniquely named temporary database with fictional accounts; guarded cleanup            |
| server/.env.example                    | Documents public configuration and an intentionally blank secret                                                 |

`better-auth` owns hashing, auth endpoints and cookie sessions. `@better-auth/mongo-adapter` maps those operations to native MongoDB; it is not an additional database connection. Both are pinned exactly and recorded in package-lock.json. Existing Express, cors, dotenv, Zod and TypeScript packages are reused. Tests use Node 24's built-in runner, so no test dependency was installed.

## Initialization and middleware order

```text
Validate env → connectDB → ensureAuthIndexes → createAuth(existing Db/client)
             → initialize auth context → createApp(auth) → listen
```

Constructing auth after the connection avoids calling the guarded getDB() before it is ready. A single client supplies the pool and Atlas transactions for both authentication and application data.

```typescript
database: mongodbAdapter(database, { client, transaction: true }),
emailAndPassword: { enabled: true },
trustedOrigins: [env.CLIENT_URL, env.BETTER_AUTH_URL],
```

Atlas supports the transaction path used here. A standalone local mongod without a replica set does not; use Atlas or a development replica set for this configuration. Do not silently disable transactions to conceal a deployment mismatch. The factory retains Better Auth's database-backed sessions and default password hashing.

```typescript
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "100kb" }));
```

Express 5 requires a named wildcard. Better Auth reads the original request stream, so its handler must precede body parsers. CORS precedes both and allows the exact CLIENT_URL with credentials and GET/POST/OPTIONS. Application handlers follow; the existing health response is unchanged. The implemented member-count router was not mounted before this lesson; it is now available at /api/members/count.

Better Auth handles its own auth response/error shapes. Custom REST errors still use the existing Express error middleware.

## Configuration and secrets

| Setting            | Meaning                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| CLIENT_URL         | Exact trusted frontend origin, locally http://localhost:3000                                  |
| BETTER_AUTH_URL    | Public backend origin, locally http://localhost:5000; do not append /api/auth                 |
| BETTER_AUTH_SECRET | At least 32 characters, generated with cryptographic randomness; never a NEXT_PUBLIC variable |

Only HTTP(S) origins without credentials, paths, query strings or trailing slashes are accepted. Production requires HTTPS for frontend/backend configuration. Missing/short secrets fail startup and error output lists field names, not values. Character length is a validation minimum, not proof of entropy; the generator uses 48 random bytes. The current local secret was generated directly in the ignored .env; existing database credentials were preserved.

Origin and CSRF protections are explicitly enabled even under NODE_ENV=test because the installed library otherwise relaxes origin checking in tests. Auth cookies are HttpOnly, SameSite=Lax by default and Secure for HTTPS/production. Cross-site deployment on unrelated frontend/backend domains needs a later verified cookie/origin deployment design; changing CORS alone does not solve third-party cookie blocking. No cookies, tokens, passwords or database URI values are logged by this lesson's code/tests.

## MongoDB schema and indexes

The defaults use singular collections: user, session, account and verification. The adapter maps IDs to ObjectId internally and strings in auth responses. Credential hashes belong to account, not members or a second password collection. Do not apply application-member validators to these library-owned collections.

The MongoDB adapter does not require the SQL/ORM migration CLI. Inspection and tests of the pinned 1.7.18 packages showed lazy table-index handling but did not produce the core field-level email/token indexes. Therefore startup explicitly ensures:

| Collection   | Indexes                                      |
| ------------ | -------------------------------------------- |
| user         | Unique email                                 |
| session      | Unique token; userId lookup; expiresAt TTL   |
| account      | userId lookup; unique providerId + accountId |
| verification | identifier lookup; expiresAt TTL             |

MongoDB also creates its normal unique _id index. createIndex/createIndexes are idempotent for matching definitions. Existing duplicates, incompatible indexes or insufficient Atlas permissions stop startup: investigate them rather than dropping data or indexes automatically. Keep this setup aligned with auth collection/field names and recheck it on Better Auth upgrades. TTL cleanup is asynchronous; Better Auth checks session expiration independently, so deletion timing is not authorization.

No `auth migrate` or `auth generate` command was run. No existing user data was transformed. Verification's collection may initially be empty because this lesson does not send verification emails.

## Commands

From server/ on a new checkout, preserve an existing .env and configure MongoDB privately:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd ci
npm.cmd run auth:secret
npm.cmd run typecheck
npm.cmd run build
npm.cmd run lint
npm.cmd run format:check
npm.cmd run test:auth
npm.cmd run dev
```

test:auth automatically builds first. It requires Atlas access allowing creation and removal of a temporary database named ngc_auth_test_<random suffix>. It uses an ephemeral HTTP port, generated test credentials and example.com email, and removes only the exact guarded test database afterward. The normal application database is not used for test account writes. The shorter random database name accommodates the Atlas shared-tier naming constraint encountered during verification.

## Verification and manual checks

Nine integration checks passed:

1. Missing/short secrets and malformed/unsafe auth URLs are rejected.
2. Health, member count, auth readiness and anonymous-session endpoints respond correctly.
3. Credentialed POST preflight succeeds for the configured client; an untrusted signup origin receives 403.
4. Invalid signup creates no account.
5. Signup receives raw JSON, creates an HttpOnly cookie, stores a hash and ignores a client-supplied role; it creates no member record.
6. Cookie session retrieval works; duplicate signup creates no second user.
7. Wrong password returns 401; correct login establishes a session.
8. Logout revokes the session; replay of the previous cookie returns no session.
9. Unique, relationship and expiry indexes exist; the application reuses the same Db object.

Backend lint, TypeScript, formatting and production build passed. Runtime dependency audit reported zero vulnerabilities; existing development-tooling audit findings remain. A separate temporary-file check verified the secret helper generates a sufficiently long secret, preserves other configuration, prints no secret and leaves the generated file unchanged on rerun. The normal running server also returned HTTP 200 for health, member count, auth readiness and anonymous session checks. Temporary test databases were cleaned up after both failed and successful test runs.

Initial failures exposed the long test-database-name issue, a throwing URL refinement, test-mode origin defaults and missing core indexes. These were corrected and the complete integration suite rerun successfully. A test command initially ran against stale build output after lint stopped the build; pretest:auth now always compiles before tests. The lint exception in setup deliberately omits raw MongoDB error causes to keep private connection details out of failure output.

For manual read-only checks:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5000/api/members/count
Invoke-RestMethod http://localhost:5000/api/auth/ok
Invoke-RestMethod http://localhost:5000/api/auth/get-session
```

Auth readiness returns { ok: true }; an anonymous session returns null with HTTP 200. In a cookie-aware API client, POST JSON to /api/auth/sign-up/email using fictional name/email/password and Origin: http://localhost:3000. Retrieve /get-session using its cookie jar, POST /sign-out, then confirm /get-session returns null. Repeat with /sign-in/email. Keep real credentials out of shared screenshots and source files. These manual writes create records in the configured development database; the automated suite is preferable for isolated verification.

## Official references checked

- [Express integration](https://better-auth.com/docs/integrations/express): ESM, wildcard route and parser order.
- [MongoDB adapter](https://better-auth.com/docs/adapters/mongo): adapter initialization, client/transaction configuration and MongoDB migration distinction.
- [Email/password](https://better-auth.com/docs/authentication/email-password): supported signup/login operations.
- [Installation](https://better-auth.com/docs/installation): secret and base URL requirements.
- [Cookies](https://better-auth.com/docs/concepts/cookies) and [security](https://better-auth.com/docs/reference/security): sessions and origin protections.
- Installed @better-auth/mongo-adapter/dist/index.mjs and @better-auth/core/dist/db/database-index.mjs: version-specific index behavior verified in Atlas.

## What you learned and stop point

Authentication is a server component of the existing REST application, not a separate password/JWT system. Middleware order affects request streams. CORS controls browser response access; trusted origins/CSRF checks protect cookie-based mutations. MongoDB transactions, unique indexes and runtime validation solve different problems. Integration tests verify these boundaries beyond a successful TypeScript build.

Stop after Lesson 01. Frontend forms, role permissions, admins, email delivery and other auth features need subsequent approval.
