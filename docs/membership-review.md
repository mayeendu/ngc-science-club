# Milestone 04, Lesson 02: admin membership review

Admins can open `/dashboard/admin/memberships` from the admin dashboard. The page lists student details with submission dates, status filters, an empty/error/loading state and ten-item pages. Approve and Reject both open a native HTML confirmation dialog with keyboard/focus handling. Rejection requires a trimmed reason of 5–1000 characters. No package was added.

## APIs and safety

- GET `/api/admin/memberships?status=pending&page=1`: admin-only; status accepts pending/approved/rejected; page is 1–1000. Returns `{ success, applications, page, hasNext }`, ten applications at most. Responses explicitly allow only submitted student fields, application ID, status and relevant dates/rejection reason. The reviewer's ID is not exposed.
- PATCH `/api/admin/memberships/:id/review`: admin-only, exact trusted Origin required. Body is either `{ decision: "approved" }` or `{ decision: "rejected", rejectionReason: "..." }`. Unknown fields, client reviewer IDs/roles/timestamps, invalid IDs, decisions and reasons return 400. Missing sessions return 401; disallowed roles/origins return 403.
- Review uses a single MongoDB `findOneAndUpdate` conditioned on `{ _id, status: "pending" }`. The reviewer ID is taken from the verified session and review date is a server Date. Conflicting, repeated, already-final, or nonexistent applications return 409 without changing data. A read-then-update check would allow competing admins to overwrite each other; the condition belongs in the write.
- Only pending-to-approved/rejected transitions exist. No account role change, resubmission, editing, public member publication, or new admin privileges are added.

The existing collection gains optional `reviewerId: string`, `reviewedAt: Date`, and `rejectionReason: string` fields. Rejection stores its reason; approval removes any stale reason. Existing pending documents remain valid. No startup migration, extra index write, data deletion, or real review is executed by development tests. A status/submission-date index can be assessed before production volume grows; it is not created automatically here.

The student's existing own-status endpoint additionally returns optional review date and rejection reason, never reviewer identity or other applicants' details. Its panel supports Refresh membership status. Status also reloads on dashboard entry/refresh. This lesson does not introduce real-time notifications.

## Changed files

- Existing `server/src/modules/membership-applications/application.*.ts`: review/list Zod schemas, bounded repository queries, atomic review, controller and route handlers.
- `server/src/app.ts`: registers admin routes behind existing session and fresh role middleware.
- `client/src/lib/admin-membership-api.ts`: typed, validated credentialed API calls and safe conflict/error messages.
- `client/src/components/membership/admin-memberships.tsx` and `client/src/app/dashboard/admin/memberships/page.tsx`: management UI and RoleGuard.
- Existing membership API/panel: student decision details and manual status refresh.
- Admin dashboard: management link. Tests and project documents record the new scope.

Frontend guards improve navigation only. Express authorizes every list/review request using the current database role. Personal details are fetched only after authorization in the browser, not embedded in server-rendered HTML. React renders submitted names/reasons as text. API cache and CSRF protections from earlier lessons are retained.

## Commands and manual checks (PowerShell)

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:membership
npm.cmd run test:rbac
Set-Location ../client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:dashboard
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

With both apps running, sign in as an existing authorized admin and open Manage membership applications. Test each status filter, Cancel a confirmation, and review an authorized fictional test application. Check that the pending entry disappears and the reviewed filter shows the decision. A student should see the new status and rejection reason after Refresh membership status. Guest/student/teacher direct visits must not reveal the list. Reviewing an application writes its decision to the configured database; automated tests use memory fixtures and mocked browser responses, never real Atlas reviews.

Lessons: authorization must be checked on the server; audit metadata must come from trusted session/server time; a confirmation dialog protects admin intent; conditional writes protect state transitions under concurrency. Stop after Lesson 02.

Verification: client/server typecheck, lint and production build passed. Membership API tests passed 14/14; RBAC regressions passed 34/34. The desktop/mobile browser suite initially passed 78/80 cases; both rejection failures were a corrupted dash in a test expectation. After correcting the test string, the targeted desktop/mobile rejection rerun passed 2/2. Approval/cancel, filters, access denial, stale-review refresh, and student outcomes were covered using fictional fixtures. No real applications or roles were changed. Git whitespace checks passed and local environment files remain ignored.
