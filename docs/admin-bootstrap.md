# Milestone 03, Lesson 04, Checkpoint B: first administrator bootstrap

## Status and scope

Tooling is implemented; no live database writes or promotions were executed. On 2026-11-10, read-only inspection confirmed database `ngc_science_club`, Better Auth collection `user`, and BSON ObjectId values in `_id` (no separate `id` field). There were 3 users, 0 administrators, 2 users without a stored role, and 0 explicit verified students. No current account is eligible. These are observations, not hardcoded assumptions: rerun the read-only check before operating.

This checkpoint does not add role middleware, dashboards, membership approval, quiz management, a public bootstrap route, or Checkpoint C/D work. Existing authentication behavior is preserved.

## Why a standalone script

Installed Better Auth is 1.7.18 with its Admin plugin. The official create-admin CLI creates a new account and can mark its email verified. It does not implement the required promotion of one exact existing verified student with these ownership and transaction guards. The official set-role API requires an authenticated administrator, which does not solve first-admin provisioning. Neither command is used to bypass verification or existing credentials. See [Admin documentation](https://better-auth.com/docs/plugins/admin) and [CLI documentation](https://better-auth.com/docs/concepts/cli).

The inspected plugin defines `role` as a string with `input: false`. Ordinary signup uses the configured default `student` role. Its role-changing API can encode multiple roles as comma-separated strings. The bootstrap check conservatively recognizes admin tokens in strings and legacy arrays. It never overwrites teacher/admin/mixed roles. Input-role attempts against the actual plugin were rejected with HTTP 400 in memory-only tests.

Roles must be assigned on a trusted server because users can edit browser code and send arbitrary JSON, including hidden role fields. A signup form is not an authorization boundary.

## Important files

| File                                    | Purpose                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| server/scripts/bootstrap-admin.ts       | Offline entry point, check/dry-run/execute modes, account review, terminal checks and two confirmations |
| server/scripts/bootstrap-admin.core.ts  | Identity, explicit student role, verification, ownership, ban, existing-admin and one-time guards       |
| server/scripts/bootstrap-admin.store.ts | Existing MongoClient/Db integration, conditional update and transaction                                 |
| server/src/lib/auth-storage.ts          | Collection-name constant shared by auth and bootstrap; prevents drift                                   |
| server/src/lib/auth.ts                  | Same auth configuration, with an injectable adapter for memory-only security tests                      |
| server/tsconfig.scripts.json            | Typechecks scripts without adding operator tooling to the normal production build                       |
| server/tests/bootstrap-admin.test.mjs   | Fake-store and actual Better Auth memory-adapter tests; no MongoDB connection                           |

Bootstrap settings are deliberately validated only by the standalone script, not ordinary application startup. The normal environment validator and database connection utilities are reused. No dependency was installed for this checkpoint.

## Safety model

- Default invocation and `--check` are read-only and show only aggregate/schema information.
- `--dry-run` requires the exact ID/email, expected database and independent ownership record, and reviews only that selected account. It performs no writes.
- `--execute` additionally requires `BOOTSTRAP_ADMIN_ENABLED=true`, an interactive terminal and two exact phrases. There is no `--yes`, `--force`, HTTP handler or automatic startup invocation.
- A nonexistent user, wrong ID/email/database, duplicate email, unverified email, ban, role other than exactly `student`, or unexpected ID schema is refused. ObjectId and string IDs are compared according to their observed storage type, without guessing/coercing ID fields.
- Ownership review must be within 24 hours, not in the future, with a different reviewer's email and a reference to the independent approval record. These values are an operator attestation, not cryptographic proof that the reviewer exists. The operator must verify that record through a trusted college channel.
- A fixed unique marker `_id` in `systemState` serializes cooperating bootstrap runs. The marker and `$set: { role: "admin" }` commit together in a MongoDB transaction using snapshot reads and majority writes. A failed conditional update rolls back both. A completed marker permanently prevents reuse, even if all admins are later demoted.
- The transaction rechecks the current identity, role, email verification, ban and absence of another admin. It does not change timestamps, verification flags, passwords, sessions, account credentials, or other users. The marker records the target and ownership-review reference for audit.
- No transaction-unsupported fallback exists. Use Atlas transaction support and sufficient permissions. Do not use a standalone mongod without a replica set.
- The marker coordinates this tool, not arbitrary out-of-band database writers. Stop application workers/other role-changing tools during the maintenance window and restrict direct database access. Privileged manual database edits cannot be prevented by a CLI script.
- If commit outcome is uncertain, inspect the target role and marker before retrying. Do not delete the marker or rerun with weaker conditions.

### Existing accounts without roles

The 2 observed roleless users are not automatically updated or promoted. Missing/null/unknown roles remain unprivileged and are ineligible for bootstrap. Memory-adapter tests confirmed a roleless account cannot call administrative role assignment. Any future legacy-to-student migration needs its own explicit approval and must preserve existing teacher/admin roles. Do not add role-changing login hooks or run a bulk update as part of this checkpoint.

## Windows procedure

All commands below run in a trusted PowerShell terminal on the server machine. Do not use browser consoles to configure bootstrap, and never use NEXT_PUBLIC variables for it. Never paste passwords, MongoDB URIs, auth secrets, or session tokens into the approval conversation.

### 1. Read-only inspection

```powershell
Set-Location 'C:\PH_Web Development Projects\ngc-science-club\server'
npm.cmd run bootstrap:admin -- --check
```

Confirm the database/collection and whether an administrator or completed marker already exists. `--check` is allowed without bootstrap target settings. It never creates collections, indexes, markers or accounts.

In MongoDB Atlas, select the database reported by the check, then the shared auth collection `user`. Use a narrow filter for the intended exact email. In the observed schema, review `_id`, `email`, `role`, `emailVerified`, and `banned`; do not copy the entire document or visit account/session credential fields. If needed, filter an ObjectId in Atlas using Extended JSON:

```json
{ "_id": { "$oid": "COPY_THE_ACTUAL_24_CHARACTER_HEX_ID" } }
```

Copy the exact stored email and ID. Require exactly one matching account, `role: "student"`, `emailVerified: true`, and no active ban. The tool checks these again; observing them manually is not sufficient by itself.

### 2. Independent ownership review

An authorized college officer other than the intended account owner must independently confirm identity and account ownership through an established institutional contact, in person, or an existing approved verification workflow. Do not rely only on the address/name supplied in a new signup. Record the verifier, reference/ticket, and real verification time. Do not request the user's password or session token.

There are currently no verified students. Do not simply toggle `emailVerified` to make the script pass. Establish legitimate email verification and an explicit student role through the separately approved process first; this script will not perform that prerequisite migration.

### 3. Configure temporary server-only settings

Replace every placeholder using the reviewed record. The expected database value must match the new read-only inspection, not merely this example. Set verification time to the time the independent check actually occurred (the command below is appropriate only immediately after it).

```powershell
$env:BOOTSTRAP_ADMIN_ENABLED = 'false'
$env:BOOTSTRAP_ADMIN_EXPECTED_DB = 'ngc_science_club'
$env:BOOTSTRAP_ADMIN_USER_ID = 'COPY_EXACT_STORED_ID'
$env:BOOTSTRAP_ADMIN_EMAIL = 'EXACT_STORED_EMAIL'
$env:BOOTSTRAP_ADMIN_OWNER_REVIEWER_EMAIL = 'INDEPENDENT_REVIEWER_EMAIL'
$env:BOOTSTRAP_ADMIN_OWNER_REFERENCE = 'COLLEGE_APPROVAL_REFERENCE'
$env:BOOTSTRAP_ADMIN_OWNER_VERIFIED_AT = (Get-Date).ToUniversalTime().ToString('o')
npm.cmd run bootstrap:admin -- --dry-run
```

The review displays only the selected account's ID/email/name, role/verification and approval reference, never a complete database record or credentials. Confirm it identifies the intended administrator. Configuration and dry-run do not grant execution approval.

### 4. Pause for explicit write approval

Before any real write, request explicit approval for that exact reviewed account and database, stating that execution changes its role to admin and writes the one-time metadata marker. In this assisted workflow, do not run the following command until the user approves that concrete operation. No approval is inferred from this implementation task.

Stop competing role-changing processes and take the agreed maintenance window. Run only after approval:

```powershell
$env:BOOTSTRAP_ADMIN_ENABLED = 'true'
npm.cmd run bootstrap:admin -- --execute
```

The script reviews the account again and asks for both exact phrases:

```text
OWNERSHIP VERIFIED <exact email> BY <independent reviewer email>
PROMOTE <exact stored ID> <exact email>
```

Any mismatch aborts. Piped input/noninteractive jobs are refused. Confirmation prompts are outside transaction retries, and eligibility is checked again inside the transaction. Do not bypass the script by editing roles in Atlas or adding an `adminUserIds` backdoor.

### 5. Verify after an approved execution

Read the selected Atlas document again. Only its `role` should have changed to `admin`. Inspect the `systemState` record with `_id: "initial-admin-bootstrap-v1"`; it should identify the same target and review reference. Do not delete it.

```powershell
npm.cmd run bootstrap:admin -- --check
```

It should report an existing administrator and completed bootstrap. Sign the intended account out normally, then sign in again through the existing login page. In the authenticated browser, check only the role rather than printing the entire session:

```javascript
fetch("http://localhost:5000/api/auth/get-session", { credentials: "include" })
  .then((response) => response.json())
  .then((data) => console.log(data?.user?.role));
```

Expected role: `admin`. The bootstrap script itself never revokes or edits sessions or passwords. If fresh login is unsuccessful, stop and diagnose; do not run another promotion or modify credentials through bootstrap.

### 6. Cleanup and deployment

After successful verification, remove temporary process settings:

```powershell
Remove-Item Env:BOOTSTRAP_ADMIN_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_EXPECTED_DB -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_USER_ID -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_OWNER_REVIEWER_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_OWNER_REFERENCE -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_OWNER_VERIFIED_AT -ErrorAction SilentlyContinue
```

If any were stored in private .env or a secret manager, remove those entries there too, preserving MongoDB and Better Auth settings. Do not rotate the auth secret or reset passwords as bootstrap cleanup. Root .gitignore already excludes .env/.env.*; only empty/default bootstrap examples belong in Git.

Keep bootstrap tooling out of deployed application artifacts: normal `npm run build` emits only src/ into dist/, while the scripts typecheck emits nothing. Deploy the intended dist/ and package/lockfile artifacts without the operator scripts/tests; production-only installs also omit tsx. Do not wire bootstrap into startup, CI, migrations or install hooks. The one-time marker is permanent defense in depth.

No source files or Git history were deleted/changed as cleanup. Removing the script from the repository, deleting records, or changing history requires a separate explicit request/approval.

## Quality checks and limitations

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:scripts
npm.cmd run build
npm.cmd run lint
npm.cmd run test:bootstrap
```

Backend typecheck, script typecheck, build and lint passed. All 15 memory-only security tests passed: identity/ownership guards; ObjectId/string matching; wrong ID/email/nonexistent/duplicate users; unverified/banned/missing/teacher/mixed roles; existing admins and marker; disabled/noninteractive/bad confirmations; wrong DB/stale/future/self-attested evidence; role-only update; rollback; changed candidate; concurrent attempts; exact MongoDB update/transaction options; offline-only integration; and actual Better Auth signup/Admin endpoint protection.

The first memory signup test incorrectly expected injected roles to be ignored; the installed Admin plugin rejects those protected fields with HTTP 400. The corrected test verifies that behavior and separately verifies normal signup produces a student. Public admin creation and role assignment were rejected for anonymous/student/roleless sessions. There is no public bootstrap route.

The test suite does not connect to MongoDB. Its simulated transaction tests exercise the tool logic, not live Atlas commit behavior. The existing `test:auth` suite creates/deletes a temporary Atlas database and was deliberately not run because database writes require approval in this checkpoint. No live transaction, promotion, account creation, index creation, or data migration was executed. No secret or real personal account detail was printed during inspection; only aggregate metadata was shown.

Checkpoint B ends here. Live execution remains unapproved, and no verified student is currently eligible.
