# Requirements and decisions

## Milestone 07 scope update

The user confirms Milestones 01–06 complete and requests sequential Milestones 07–18. Milestone 07 adds own released student scores/progress/history and teacher-owned cross-quiz comparisons/rankings with date/subject filters. Admins can inspect all released quiz data. Retain private event participation history and existing per-quiz reports. No public leaderboard; no unreleased score disclosure. See [performance analytics](performance-analytics.md) for definitions and limitations.

Milestone 06 approved: events and activities management only; stop before Milestone 07. Implemented defaults: categories activity/workshop/seminar/competition/achievement; HTTPS image URL (no uploads); Asia/Dhaka date/time entry stored as UTC; capacity 1–1000; approved current students register/cancel before start; teacher-owner/admin attendance after start. Content edits/archives require empty drafts; unpublish requires no active registrations and future start; only upcoming published events may be permanently cancelled. Achievements may be historical and do not accept registrations. Cancelled events retain their participant history. These operational defaults need college review before real use. See [event policies](events.md). Earlier scope notes are historical.

Milestone 05 Lessons 02–05 approved: complete quiz assessment system only. Implemented policy: one attempt per quiz/account, approved students only; server/database deadlines; persisted answers determine expired submissions; content locks on first attempt. Owner teacher/admin closes a quiz permanently before explicitly releasing scores/keys/explanations to its participants. Retakes, reopening, result reversal and Milestone 06 are excluded. These operational defaults should be reviewed with the college before real assessments. See [assessment decisions and limits](quiz-assessments.md). Older scope notes are historical.

Milestone 05 Lesson 01 approved: teacher/admin quiz CRUD with four-option single-correct MCQs, draft/published transitions, dynamic editor, confirmation and notifications. Teachers manage own quizzes; admins manage all. Server computes total marks. Unpublish before editing/archiving; version checks prevent stale updates. Taking/results and later lessons are excluded. See [quiz decisions](quiz-management.md).

Milestone 04 Lesson 05 approved: admin-only membership analytics, five KPIs, monthly/department charts, date filters, anonymous recent activity and previous-period trends. KPIs use submission-date cohorts; membership charts use approval dates. Calculations stay on the backend, and no student identifiers/details enter analytics responses. See [metric definitions](membership-analytics.md). Stop before the next milestone.

Milestone 04 Lesson 04 approved: approved-student own-profile page and GET/PATCH, editing fullName/phone/department/academicYear only. Student ID, role, approval and review metadata remain protected. Completion measures four saved fields; auth account name stays separate. No later lessons. See [profile management](member-profile-management.md).

Milestone 04 Lesson 03 approved: public approved-member cards/profiles with name, department, academic year and approval date, search/filter/pagination, counts and department statistics. Phone/email/student ID and application/review details remain private. No new approval transitions or later lessons. See [directory scope](member-directory.md).

Milestone 04 Lesson 02 approved: admin-only membership listing with status filters, confirmation before review, required rejection reasons, trusted reviewer/date and atomic pending-only decisions. Students can view their own outcome/reason. No role changes, resubmission, public listing, or later lesson. See [membership review](membership-review.md).

Milestone 04 Lesson 01 approved: student-only membership form, pending submission, private own-status lookup, duplicate protection and dashboard status. No admin approval yet. Proposed validation defaults use free-text department/year and Bangladesh mobile format; no global student-ID uniqueness is assumed. One record per account is retained; reapplication policy is deferred. See [lesson decisions](membership-application.md).

Milestone 03 Lesson 05 approved: audit and harden existing authentication/RBAC, add limits and headers, and verify isolated security regressions. No real role changes, deletion, deployment configuration changes, or Milestone 04 features. Local rate limits are per client address/path; distributed storage, shared-NAT policy, proxy trust, and production cookie topology require deployment review. See [security decisions](auth-security.md).

Checkpoint D approved: role-aware navbar and placeholder student/teacher/admin dashboards, with `/dashboard` redirecting to the account's own role. Dashboard access mirrors Checkpoint C's explicit permission matrix (teacher/admin may access the student page; admin may access the teacher page). Guests redirect to login; invalid roles and disallowed access show 403 UI. No role assignment or full business workflows are included. See [dashboard scope](role-dashboards.md).

Checkpoint C is approved: implement reusable server RBAC and three demonstration endpoints only. The application accepts exactly one student/teacher/admin role, rejects missing/unknown/multiple roles, and reads current role for every guarded request. Student and teacher have no Better Auth management permissions; default signup remains student. Testing must use isolated mocks and must not change real roles. No frontend role dashboards, role promotion endpoints, membership, quizzes, or Checkpoint D are approved. See [RBAC policy and testing](rbac.md). Previous checkpoint observations below describe their inspection time, not current account eligibility.

Checkpoint B approval: implement secure first-admin bootstrap tooling only. Exact existing ID/email, explicit student role, verified email, independent recent ownership confirmation, no existing admins, interactive confirmation and one-time transaction guard are required. No database writes may execute without explicit user approval. Missing-role accounts must remain unprivileged and must not be bulk-migrated or promoted. No Checkpoint C/D features, deletion or Git history changes are authorized. See admin-bootstrap.md for current eligibility findings and procedure.

Milestone 03 Lesson 01 authorization: integrate Better Auth email/password on the Express server with the existing MongoDB client/database, validated auth settings, trusted origins, credentialed CORS and auth endpoint tests. Preserve health/member count. Exclude frontend auth pages, RBAC, admins and custom JWT. This lesson allows unverified development-account login; production email verification/recovery policies remain later work. See milestone-03-lesson-01.md.

Status: Phase 1 planning complete; Phase 2 Milestone 01 approved. Research checked 2026-11-09. Unconfirmed policies remain proposals.

## Confirmed requirements

- Admin approval is required for membership; teachers are added only by admins.
- Full online science quizzes and Bangla/English support are required.
- Next.js will use Vercel; Express is a separate backend; one Git repository contains independent client/server apps.
- MongoDB Atlas and Better Auth are for later milestones.
- Milestone 01 implements only the foundation, local CORS, GET /api/health and homepage integration.

## Purpose and scope

Provide a public academic website, account authentication, membership applications and approval, public member and teacher profiles, role-specific dashboards, quizzes, private results, and administrative reporting.

Use Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, React Hook Form, Zod, React Hot Toast, TanStack Query, Recharts, and Lucide React for the client. Use Node.js, Express, TypeScript, MongoDB Atlas/native driver, Better Auth, and Zod for the server. Development uses Git, ESLint, Prettier, Vitest, and Playwright.

## Proposed release scope

The MVP contains all three roles, public home/directories/details, email/password authentication, verification and recovery before public launch, membership applications and admin decisions, teacher management, basic single-answer MCQ quizzes, private results, dashboards, and basic aggregate analytics. Search, filters, pagination, accessibility, responsive navigation, and error/loading/empty states are part of the MVP.

Later enhancements: Google sign-in, question banks, multiple quiz formats, retakes, certificates, rankings with consent, rich analytics/exports, event registration, notifications, membership renewal, and online payments. Events have an initial data design but no MVP management interface. If delivery time is limited, release membership management first as a pilot, then add quizzes before calling the full MVP complete. Bangla/English is required for product features, not an optional enhancement.

## Proposed defaults needing confirmation

- Public signup; email verification required before applications or quiz participation. College eligibility is checked manually by an admin during membership review.
- One exclusive account role: student, teacher, or admin. Admins have teacher-management capabilities. A role never grants club membership automatically.
- Only approved student members may take quizzes. Teachers manage only quizzes they created; admins manage all quizzes.
- Admins alone decide membership applications and publish teacher profiles.
- Membership states: pending, approved, rejected, suspended. No application record means not applied. Rejected applicants may resubmit; suspension requires admin reinstatement.
- Public member listing requires approval and explicit directory consent. Contacts, roll numbers, application notes, and quiz results are private by default.
- Collect name, department/program, academic session, college roll, short motivation, and consent. Phone is optional; no national ID, birth date, or identity-document upload in the MVP.
- Single-answer MCQs; one attempt per student per quiz, no negative marking; time and publication windows are checked by the server. Results release after the quiz closes.
- Teacher directory entries may exist without a login; creating a profile does not grant a role. Linking an account and assigning teacher permissions are admin-only actions.
- Bangla and English are required; foundation messages are centralized and translated now. Dates will be stored in UTC and displayed in Asia/Dhaka. No fee collection or uploads in the proposed first release; use approved static assets/placeholders.
- Initial sizing assumption: 2,000 accounts, 200 simultaneous quiz participants. Validate actual capacity with load tests rather than treating this as a guarantee.
- Target WCAG 2.2 AA design and keyboard usability; automated checks alone do not establish conformance.

## Permissions

| Capability                          | Visitor | Student         | Teacher          | Admin                    |
| ----------------------------------- | ------- | --------------- | ---------------- | ------------------------ |
| Read published public pages         | Yes     | Yes             | Yes              | Yes                      |
| Manage own account                  | No      | Yes             | Yes              | Yes                      |
| Apply / view own membership         | No      | Yes             | No               | Review all               |
| Edit own member profile             | No      | Approved only   | No               | Moderate all             |
| Take quiz / read own results        | No      | Approved only   | No               | No impersonated attempts |
| Create/manage quiz                  | No      | No              | Own only         | All                      |
| Read quiz participants/results      | No      | Own only        | Own quizzes only | All                      |
| Membership decisions                | No      | No              | No               | Yes                      |
| Teacher profile and role management | No      | No              | No               | Yes                      |
| Analytics                           | No      | Own performance | Own quizzes      | Club-wide                |

All permissions are enforced in Express, including resource ownership. A student cannot read another student's result by changing an ID. Teacher result views expose only necessary participant information. Frontend route guards are for navigation, not security.

## Acceptance criteria

- A signup cannot assign a privileged role, even with forged fields.
- An anonymous request receives 401 on protected resources; an authenticated disallowed request receives 403 (or 404 for hidden resources).
- Membership approval does not change account role; only approved and consenting members appear publicly.
- Teacher profile creation does not create credentials or grant privileges.
- Quiz participant responses never expose answer keys before the permitted release.
- Concurrent start/submit/review requests cannot create duplicate attempts or contradictory decisions.
- Member and teacher directories provide validated search/filter/pagination and safe public fields.
- Every protected workflow has success, denied, invalid-input, empty, and failure checks as applicable.

## Questions before implementation

1. Who is eligible: current students only, alumni, or students outside the college? How should college affiliation be verified?
2. Are membership fees, annual renewal, or an expiration date required?
3. Who approves membership? Should designated teachers be able to approve, or only admins?
4. Which fields can appear in public profiles? Is opt-in public listing acceptable? May under-18 students participate, and who approves the privacy policy?
5. Should quizzes be restricted to approved members? Confirm attempts, time limits, negative marking, and result-release rules.
6. Can teachers see only their own quiz results? Should they edit their own directory profiles, with or without admin review?
7. Is English-first acceptable? Do you have an approved logo, college colors, content, and fictional sample profiles?
8. What are the hosting budget, custom-domain availability, email provider, expected participation, and target date?
9. Who will own the initial admin account and production services? What retention periods apply to rejected applications, results, and audit logs?

No answers are assumed to authorize implementation. Resolve policy questions before their dependent milestone; hosting/origin and auth email decisions are needed before authentication deployment.
