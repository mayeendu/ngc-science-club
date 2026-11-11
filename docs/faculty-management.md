# Milestone 08 — Faculty mentors and management

Faculty profiles are content records, separate from Better Auth accounts. Creating, publishing, editing or archiving a profile never creates an account or changes a role. Existing active teacher accounts may be linked by an admin using their exact account ID. The admin may assign up to 50 distinct existing events to that profile. This milestone does not add teacher-role provisioning.

Public pages `/faculty` and `/faculty/[id]` show published, unarchived profiles: name, designation, department, specialization, optional HTTPS photo and biography. Public API projections exclude linked account IDs, assignments, versions and internal timestamps. The directory has exact department filtering and 12-row pagination.

`/dashboard/admin/faculty` supports admin-only create/edit/publish/archive, using strict Zod allowlists, a trusted mutation Origin and optimistic versions. Archive is a soft delete, unpublishes the profile and clears its assignments/account link. A confirmation dialog explains the effect. Failed/stale updates require refresh. Photo URLs follow the existing event-image policy; the browser loads them without a referrer and the server never fetches them. No file upload/storage dependency is introduced.

`/dashboard/teacher/activities` lists activity details explicitly assigned to the session account. A MongoDB aggregation begins with the session account filter, deduplicates event IDs, excludes archived events and returns only title, date, venue and status. Assignment authorizes those basic details, including drafts, but grants no event edit, attendance or participant access: existing ownership rules remain in force. A reassigned or archived profile no longer contributes assignments. Fresh Express RBAC denies students and revoked teachers. Admins can view assignments linked to their own session; faculty links themselves require teacher accounts.

API routes:

- `GET /api/faculty?page=1&department=Physics`, `GET /api/faculty/:id` — public.
- `GET/POST /api/admin/faculty`, `PUT/DELETE /api/admin/faculty/:id` — fresh admin role; mutation Origin required.
- `GET /api/teacher/activities?page=1` — fresh teacher/admin role, session identity only.

New collection: `facultyProfiles`; ObjectId `_id`, bounded profile fields, `published`, private optional `teacherAccountId`, private `assignedEventIds`, server timestamps, `version`, optional `deletedAt`. No live collection/index migration is performed. Lookups validate that linked accounts currently have the teacher role and are not banned; later account revocation is enforced by fresh route RBAC. The link does not reserve an account or prevent multiple mentor profiles; assignment aggregation deduplicates events across profiles. Proposed indexes are `{published:1,department:1,name:1}` and `{teacherAccountId:1}`; apply only after an approved query-plan review.

Important concept: a public profile describes a mentor; it is never a source of authorization. Backend session roles and resource ownership remain authoritative.

Files: `server/src/modules/faculty/`, `server/src/app.ts`, `client/src/lib/club-api.ts`, `client/src/lib/faculty-api.ts`, `client/src/components/faculty/`, four route pages, navigation/dashboard links, backend/browser tests and package test scripts.

Checks: both apps' typecheck, lint, build; server `npm.cmd run test:faculty`; client `$env:PLAYWRIGHT_CHANNEL='msedge'; npm.cmd run test:faculty`. Tests use fictional memory fixtures and intercepted browser responses; no real roles, profiles or events are written. Manual review: publish a fictional mentor, browse directory/profile, assign a fictional existing event to an existing fictional teacher, verify assigned activities, then archive and verify removal. A student must be denied management and assignments; a teacher must be denied faculty CRUD.

Verified: both apps passed typecheck, lint and production build; 4 backend fixture tests and 6 desktop/mobile browser tests passed. Browser checks caught an editor button missing its explicit submit type; fixed and rerun successfully. No live database writes or account-role changes. Proceeding to Milestone 09.
