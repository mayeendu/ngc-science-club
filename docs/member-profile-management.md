# Milestone 04, Lesson 04: member profile management

Approved students can open `/dashboard/student/profile` using Manage member profile in their dashboard membership panel. The page displays personal membership fields, read-only student ID, approved status, joining date and saved-profile completion. React Hook Form, the existing shadcn form controls, Zod and toast handle editing without new dependencies.

## API and security

GET and PATCH `/api/membership-applications/me/profile` use the existing verified session and fresh student role guard. Both database operations also require `{ _id: sessionUserId, status: "approved" }`. Missing/pending/rejected memberships receive 403; missing/expired sessions receive 401. Teacher/admin accounts cannot use this student-only endpoint. A query/header/body cannot select another account.

PATCH accepts one or more of `fullName`, `phone`, `department`, `academicYear`. It rejects empty input, invalid values and all unknown fields (including user ID, roles, approval status, student ID, reason, reviewer/date and profileUpdatedAt). Validation reuses the application field schemas. The UI submits those four fields only. Exact trusted Origin is required for the mutation.

MongoDB updates the four allowlisted fields plus a server-owned `profileUpdatedAt`. The update itself includes the approved-state condition, preventing a write after approval has been removed. Joining date and review metadata are never overwritten. There is no schema migration, extra index, role modification or automatic edit of real records. Concurrent valid edits use last-write-wins; collaborative editing/version conflict UX is outside this lesson.

The response contains only fullName, phone, department, academicYear, studentId, approved status, membershipDate and completion. Reasons, reviewer identity, email, auth records and other applications are not returned. Completion is 25 points for each valid saved editable field; existing valid approved records normally start at 100%. Legacy missing values render empty fields, and a missing joining date remains null/Not recorded rather than inventing a date.

The public directory already reads the same approved application document, so name/department/year changes appear on its next fetch or refresh without copying data. Phone remains private through the unchanged public projections. Member name is independent of Better Auth's account name: the navbar's account display name is not modified by this feature. No password, session, role or auth user record is updated.

## Files

- Existing `server/src/modules/membership-applications/application.*.ts`: reusable four-field schema, approved-only own-profile repository, service/controller and routes.
- `client/src/lib/member-profile-api.ts`: form validation, typed private responses and safe HTTP errors.
- `client/src/components/membership/member-profile-editor.tsx`: loading/retry, completion, personal details, edit form and notifications; blocked saves clear the form on 401/403.
- `client/src/app/dashboard/student/profile/page.tsx`: existing RoleGuard restricted to students.
- Membership panel: approved-only profile link. Dashboard removes the now-implemented profile placeholder.
- Existing membership API tests and dashboard browser tests extend ownership, approval, field protection, public synchronization and expiration coverage.

## Commands and manual testing (PowerShell)

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:membership
npm.cmd run test:members
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:dashboard
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

Start both apps with the existing dev commands. Sign in as an authorized approved fictional student, open Manage member profile, edit the four fields and save. Refresh and verify persistence; View public profile should show the updated public fields and no phone/student ID. Confirm the joining date/student ID stayed unchanged. A pending/rejected student should see the approved-membership message without an edit form; a guest should reach login. Stop the API to check retry/error handling. Manual saves write to the configured database; automated tests use isolated memory/mocked records, not real Atlas accounts.

Main lessons: authentication supplies identity; authorization and membership state both constrain the write; Zod field allowlists prevent mass assignment; private and public profile projections differ; completion measures saved data rather than changing privileges. Stop after Lesson 04.

Verification (2026-11-11): both apps passed typecheck, lint and production build. Membership/profile API tests passed 20/20, public-directory API regressions passed 7/7, and dashboard/profile browser tests passed 94/94 across desktop/mobile Chromium using Edge. Coverage includes protected-field injection, ownership, revoked approval, completion, public synchronization, load/save failures and expired sessions. All records were fictional memory/mocked fixtures; no real Atlas profiles or roles changed. Git whitespace checks passed and local environment files remain ignored.
