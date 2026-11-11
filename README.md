# NGC Science Club

Science Club management for Narsingdi Government College, Bangladesh. One repository contains an independent Next.js frontend and Express API, using TypeScript, MongoDB Atlas/GridFS and Better Auth.

Milestones 01–16 are locally implemented and verified. Milestones 17–18 deployment and launch preparation are now complete within the local scope. **The platform has not been deployed or launched.** See [final project status](docs/final-project-status.md) for current verification and unresolved release requirements. This checkpoint includes Milestones 08–18; see Git history for its revision. The user has authorized committing and pushing this checkpoint.

## Start here

- [Local setup and safe test commands](docs/setup-guide.md)
- [Admin and teacher guide](docs/admin-guide.md)
- [Production deployment preparation](docs/deployment-guide.md)
- [Launch checklist and approval boundaries](docs/launch-checklist.md)
- [Final project status](docs/final-project-status.md)
- [Development roadmap and historical checkpoints](docs/development-roadmap.md)

Use Node 24.x and independent npm lockfiles. Local development runs at frontend port 3000 and API port 5000. Preserve existing private environment files; examples contain placeholders, not usable credentials. Never put secrets in NEXT_PUBLIC variables. Production requires reviewed HTTPS same-site frontend/API domains and private host-managed backend credentials.

## Features

| Area                        | Behavior and guide                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and roles    | Better Auth credentials/sessions; students by default; fresh Express RBAC. [Security](docs/security-performance-testing.md)                                           |
| Membership                  | Student applications, admin decisions, approved public directory and private own-profile editing. [Membership](docs/membership-review.md)                             |
| Quizzes                     | Staff ownership, transactional timed attempts, autosave, server scoring, close/manual release and scoped reports. [Quizzes](docs/quiz-assessments.md)                 |
| Events                      | Published/cancelled events, capacity-safe registration, attendance and assignments. [Events](docs/events.md)                                                          |
| Analytics                   | Own student performance, scoped teacher comparisons and admin aggregate reports/exports. [Reports](docs/admin-reporting.md)                                           |
| Faculty                     | Public mentor profiles, admin CRUD and existing-teacher activity assignments; profiles never grant roles. [Faculty](docs/faculty-management.md)                       |
| Communication               | Private feedback, assigned staff replies, announcements and user-specific notification inbox. [Communication](docs/notifications-announcements.md)                    |
| Languages and accessibility | Default Bangla/English, persistent preference, light/dark/system mode, keyboard focus and responsive UI. [UI](docs/ui-accessibility.md)                               |
| Learning resources          | Category/search filters, private GridFS downloads, file validation and staff-owned publishing. [Library](docs/learning-resources.md)                                  |
| Showcase and certificates   | Public achievements/gallery, attendance-based printable certificates and initials-only public verification. [Certificates](docs/achievements-gallery-certificates.md) |

## Structure

```text
client/src/app/          Public pages and guarded App Router dashboards
client/src/components/  Shared UI, localization, theme and feature components
client/src/lib/         Browser API helpers, schemas and dictionaries
client/tests/           Mocked, connected-memory and foundation browser suites
server/src/modules/     Validated business APIs and MongoDB repositories
server/src/lib/         Better Auth, authorization and lifecycle helpers
server/src/config/      Private environment and database configuration
server/scripts/         Offline/admin tooling and isolated test fixtures
server/tests/           Memory-only security/workflow/concurrency tests
docs/                   Architecture, operations, milestones and release evidence
```

## Verify locally

From the repository root, install each app with `npm.cmd --prefix server ci` and `npm.cmd --prefix client ci --include=dev`. Follow [setup](docs/setup-guide.md) before starting real services. The isolated suites require no Atlas connection.

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
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd --prefix client run test:isolated
npm.cmd --prefix client run test:i18n
npm.cmd --prefix client run test:e2e
npm.cmd --prefix client run test:launch
```

Run browser commands sequentially; reserve ports 3100/5101/5102 and build the backend before fixture APIs. Use the Playwright Chromium option in the setup guide if Edge is unavailable. `test:isolated` disables application database connections and excludes Atlas integration. `test:auth` now uses memory, not Atlas. Never run wildcard backend tests. The explicit Atlas authentication test and first-admin execution write data and require separate approval.

`GET /api/health` reports liveness; `GET /api/ready` checks database readiness. Production preparation adds environment preflights, graceful shutdown and Vercel settings without creating hosting resources. No startup command applies application indexes or promotes an account.

## Known release limits

Live Atlas/GridFS transaction tests, staging cookie/DNS/TLS checks, index provisioning, production load/monitoring/recovery exercises, verified admin/teacher provisioning, email verification/recovery delivery, and exhaustive manual accessibility review remain external release requirements. Full development dependency audits retain documented findings even when runtime audits are clean. Notifications are in-app; certificates are browser printable PDFs, not digitally signed credentials. See [final status](docs/final-project-status.md) and [launch checklist](docs/launch-checklist.md).

## Design references

[Requirements](docs/requirements.md), [architecture](docs/architecture.md), [database design](docs/database-design.md), [API design](docs/api-design.md), [query/index plan](docs/query-index-plan.md), and [first-admin bootstrap](docs/admin-bootstrap.md). Historical milestone guides preserve their original scope and evidence; the roadmap and final status supersede old continuation instructions.
