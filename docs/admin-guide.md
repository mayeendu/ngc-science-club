# Admin and teacher operations

This guide describes current local features. All real account changes, index writes, deployments and production data operations need separate approval. Use fictional staging records for practice; never review real applications or issue certificates solely for testing.

## Accounts and access

Better Auth owns credentials and sessions. New public signups are students. Member approval is an independent status and does not grant teacher/admin roles. First-admin bootstrap is offline and requires an exact existing verified student, independent ownership review, a matching database and explicit execution approval; follow [the bootstrap guide](admin-bootstrap.md). Historical counts in that guide are not a current account inventory. Do not bypass missing email verification by toggling database fields. Verification/recovery delivery remains a launch prerequisite to resolve.

Faculty profiles are public content, not accounts. `/dashboard/admin/faculty` creates/edits/publishes/archives profiles and links an existing active teacher account by exact ID. This never grants a role. There is no application teacher-provisioning screen; real teacher roles must use a separately reviewed admin-only Better Auth administrative workflow. Public profile forms cannot create teachers. Revoking/banning a role is enforced by fresh backend lookups, not a cached dashboard label. Keep bootstrap variables disabled/unset on the production service.

## Membership

Students apply at `/membership/apply` and view their own pending/approved/rejected status. Admins review at `/dashboard/admin/memberships`, check the applicant details, and explicitly confirm approval/rejection. Rejection requires a useful reason. A reviewed application cannot be decided again; a conflict refreshes the list. Public member profiles show approved public fields only; phone/email/student ID/review details remain private. Approved students can edit the four permitted member-profile fields without changing roles or approval metadata.

## Quizzes

Teachers manage their own quizzes at `/dashboard/teacher/quizzes`; admins manage all. Draft complete questions, options, keys and marks, then publish deliberately. The server computes marks. Content freezes after the first attempt; never try to edit keys during active taking. Approved students receive one server-timed attempt with autosave. Close the quiz before explicitly releasing results; keys/scores remain private until authorized release. Review scoped reports at the teacher quiz report/performance screens. An assigned faculty activity does not authorize managing another teacher's quiz/event.

## Events and attendance

Teachers manage owned events at `/dashboard/teacher/events`; admins have `/dashboard/admin/events`. Publish date/venue/capacity after review. Approved students register/cancel before the server start time. Registrations use transactional capacity accounting. After the event starts, mark attendance on the scoped participant screen and refresh on version conflicts. Cancelled events remain publicly marked cancelled and reject new registrations. Do not change real attendance as a test. Assigned activity details appear at `/dashboard/teacher/activities`; assignment grants basic visibility, not participant or edit access.

## Feedback, announcements and resources

Students submit private feedback at `/dashboard/student/feedback`; staff use `/dashboard/teacher/feedback`. Only admins or the explicitly assigned teacher can manage a private thread. Admins assign an existing teacher account, reply and update status. Do not include passwords or unnecessary student details in replies. Announcements at `/dashboard/teacher/announcements` have explicit publish/archive controls and staff ownership. Notifications are user-specific source-derived records, not email/SMS delivery.

At `/dashboard/teacher/resources`, create a draft, attach a supported file (up to 5 MiB) or HTTPS external link, review, then publish. Students browse at `/dashboard/student/resources`; private downloads enforce approved membership. Files use GridFS and structural/type checks, not a malware scanner. Archive to remove access; do not delete storage objects directly. Inspect external URLs and document rights before publishing. Other teachers cannot manage your resources; admins can manage all.

## Achievements and certificates

Manage public achievement/gallery content at `/dashboard/teacher/showcase`. Only publish material approved for public use. Event-specific achievements remain on `/events`; they are not automatically copied. At `/dashboard/teacher/certificates`, choose an owned started published event and a registered participant marked present. Issue once; repeated issuance returns the same verification ID. Students view/print/save PDF at `/dashboard/student/certificates`.

Public `/certificates/verify` returns validity, event information and recipient initials only. It does not prove a full private identity; authorized college staff must compare the recipient record when needed. Attendance correction/cancellation/source archival can invalidate a certificate; explicit revocation is permanent. Confirm revocation carefully. Certificates are browser printable PDFs, not cryptographically signed credentials.

## Reports and maintenance

Admin `/dashboard/admin/reports` aggregates membership, quizzes, events, attendance and feedback. Choose a bounded UTC date range, review cohort definitions, then export CSV or browser PDF. Cohorts use different dates/current statuses; totals are not a historical audit ledger. There are no private student rows in exports. Membership analytics and scoped teacher performance remain available separately.

Before launch, review [the checklist](launch-checklist.md), [deployment guide](deployment-guide.md) and [index plan](query-index-plan.md). Back up MongoDB plus GridFS and rehearse recovery. Preserve auth secrets securely, monitor readiness/error/expiry-worker failures, and investigate unusual 403/409/429 patterns. Never share credentials through feedback or logs. Obtain approval before traffic changes, role grants, index application, secret rotation or restoring data. No guide instruction itself constitutes execution approval.
