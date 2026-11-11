# Milestone 04, Lesson 01: student membership application

The student dashboard now shows membership application status and links to `/membership/apply`. Only current students can open the form or use its APIs. Teachers/admins may still visit the general student dashboard under the existing access matrix, but do not receive the application panel.

## Files and flow

- `server/src/modules/membership-applications/`: schema validates the six allowed fields; routes reuse `requireAuth` and fresh `requireRole("student")`; controllers use verified session identity; service validates input; repository stores and queries only that account's record.
- `server/src/app.ts`: mounts the module without changing existing public/auth routes.
- `client/src/lib/validations/membership.ts`: matching Zod form validation, connected to React Hook Form.
- `client/src/lib/membership-api.ts`: credentialed no-store requests, response validation, timeout and safe HTTP error messages.
- `client/src/components/membership/membership-application.tsx`: reusable status/form panel, loading/retry, notifications and duplicate recovery.
- `client/src/app/membership/apply/page.tsx`: student-only form page; RoleGuard now supports a narrower explicit role list.
- `client/src/components/dashboard/role-dashboard.tsx`: student status panel and updated placeholder label.
- `server/tests/membership.test.mjs` and `client/tests/dashboard-rbac.spec.ts`: isolated API/concurrency and browser coverage.

## API and storage

| Endpoint                              | Behavior                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST `/api/membership-applications`   | Current student + exact trusted Origin. Valid submission: 201; invalid fields: 400; unauthenticated: 401; disallowed role/origin: 403; duplicate: 409. |
| GET `/api/membership-applications/me` | Current student only. Returns 200 with own status/date, or `application: null` when absent.                                                            |

Success response: `{ success: true, application: { status: "pending", submittedAt: ISO_DATE } }`. No email, phone, reason, full name, account ID or other student's record is exposed by the status API. Authentication errors keep existing 401/403 contracts. POST rejects unknown fields, including client user IDs, roles, status and timestamps.

MongoDB collection `membershipApplications`: `_id` is the verified Better Auth account ID string; fullName, studentId, department, academicYear, phone and reason are validated strings; status is always server-assigned `pending`; submittedAt is a server Date. Roles remain in Better Auth, independent of club membership. No public member profile or approval is created.

The built-in unique `_id` index enforces one application per account, including concurrent requests, without a new index migration or startup write. The repository inserts directly and translates duplicate-key errors into 409; a pre-insert existence check alone would be unsafe. This lesson creates only pending records. Reapplication after rejection and approval transitions are deferred; future lessons can update the same account record with explicit transition rules. Student IDs are not globally unique until a college policy confirms their scope. No existing data is migrated or deleted.

Validation defaults: full name 2–100 characters; student ID 1–40 letters/numbers/slashes/underscores/hyphens (Unicode letters/digits supported); department 2–100; academic year 2–40; Bangladesh mobile number starting 013–019, optionally prefixed 88/+88; reason 20–1000 characters. All fields are trimmed. Department and year use free text until college choices are confirmed. Both client and server enforce the same checks; server validation remains authoritative.

## Verification and manual testing

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:membership
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:dashboard
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Start each application using its existing `npm.cmd run dev` command. Sign in as a student, open the student dashboard, follow Apply for membership, and submit fictional details. Confirm pending status after returning to the dashboard and refreshing. Reopening the form should show existing status instead of a second form. Guests should reach login; teachers/admins should receive Access Denied on the form. Stop the API to check retry feedback. Manual submission writes a real application to the configured database; automated tests instead use isolated in-memory fixtures and perform no Atlas writes.

The key concepts are server-owned identity, separate role/membership states, matching client/server validation, private response projections, and database-enforced concurrency safety. No admin approval, membership editing, resubmission, or later lesson is implemented.

Verification: both apps passed typecheck, lint and production build. All 8 isolated membership API tests and 34 RBAC regression tests passed. The browser suite initially passed 65/66 cases; the mobile submission assertion matched a hidden cached page as well as the visible page. After scoping it to the visible main landmark, both desktop/mobile submission flows passed on a targeted rerun (2/2). No product-code change was required for that test failure. Live read-only checks returned health 200 and unauthenticated membership status 401. No real applications or role changes were made during verification.


## Reference membership form update (2026-11-11)

The application at /membership/apply follows the supplied printed reference: teal header and section/admission bands, club logo, pale yellow inputs, two columns on larger screens and one column on phones. Native radio groups allow exactly one section, optional subject, residence and admission goal.

New details: SSC GPA (0-5, up to two decimals), SSC registration (6-20 digits), Science 1/2/3, guardian mobile, WhatsApp mobile, guide teacher, Math/Biology, College Hostel/Others, Medical/Engineering/University and typed signature. Class Roll maps to studentId; Session maps to academicYear. The form supplies Science as department and a standard application reason for compatibility. The server records the submission date; users cannot forge it. The signature is a typed name, not an uploaded or drawn signature.

New details are stored on the application and explicitly projected only for admin review. Public member responses and own status summaries do not expose these details. Existing applications remain readable without a migration; absent details display as unavailable. The API still accepts the original six-field contract for compatibility, but any supplied new field requires the complete new field set. The current client requires every reference field. Approval, duplicate-submission protection and four-field profile editing remain unchanged.

Affected areas: client membership component, validation, application page, admin review and Bangla dictionary; server application schema, validation service and private admin projection. No dependencies, live database writes, indexes, roles or deployment changes.

Manual check: sign in as a fictional student without an application; open /membership/apply; check mobile and desktop layout, empty/invalid inputs, one choice per group and submission. Confirm pending status and duplicate prevention. As admin, check private new details in review and verify an older application still loads.

Validation: both apps pass typecheck, lint and production build. All 179 database-disabled backend tests pass, including reference-form persistence/privacy and invalid/partial/forged-field cases. Eight targeted Playwright checks passed on desktop and mobile, including complete reference-form submission and access restrictions. Translation coverage check passes (693 statically discovered UI keys; dynamic reference field labels/options are also translated). No Atlas integration tests ran.

Browser runner limitation: all eight cases reported success, but the Playwright command remained open during teardown without a final summary. It was interrupted after the completed cases; the runner did not exit cleanly.


## Membership UI refinement (2026-11-11)

The membership component now uses the existing theme colors and brand hero, a rounded card, consistent 48px inputs, selectable option cards, and three numbered sections: student details, contact details, and preferences/signature. The submit footer explains the automatic date and typed signature. Mobile choices stack; desktop choices share rows. Focus, error, loading, disabled and selected states use the same visual language. English/Bangla section labels are included. Changes are local Tailwind utilities in the component; global CSS and server behavior are unchanged.

UI validation: client typecheck, lint, production build, translation coverage and both translation unit tests pass. Existing complete membership submission checks report success on desktop and mobile (6.0s/6.1s). Playwright again remained open after successful cases during teardown and was interrupted. No backend or live data changes were made for this visual refinement.
