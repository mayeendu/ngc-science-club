# NGC Science Club project instructions

## Scope and teaching

- Build a Science Club platform for Narsingdi Government College, Bangladesh.
- Work in small, testable milestones. Explain the goal, concepts, affected files, approach, important code, commands, checks, manual testing, and lessons.
- Implement only the milestone approved by the user. Stop for approval before the next milestone.
- Phase 1 is planning only. Do not install packages, scaffold applications, or implement application code until Phase 2 is approved.
- Explain decisions in beginner-friendly language. Do not make unrelated changes.

## Architecture and conventions

- One repository, independent client/ (Next.js App Router) and server/ (Express REST API), plus docs/.
- Strict TypeScript; server uses ESM. Use the MongoDB Node.js driver, not Mongoose.
- Required frontend: React, Tailwind, shadcn/ui, React Hook Form, Zod, React Hot Toast, TanStack Query, Recharts, Lucide React. Introduce packages when needed.
- Better Auth owns credentials and sessions on Express. Do not build a parallel JWT login system.
- Verify official documentation and package compatibility before authentication integration or dependency selection; pin resolved versions with lockfiles.
- Business rules, database access, secrets, authorization, quiz scoring, and answer keys stay on the server.
- Roles are student, teacher, admin. New users are students. Membership status is a separate concept.
- Validate all server inputs; use field allowlists and explicit public response projections. Never trust client-supplied roles, user IDs, scores, or timestamps.
- Use reusable accessible components, responsive layouts, and loading/error/empty states. Prepare text for later English/Bangla localization.
- Use fictional development data. Never commit credentials, session tokens, or real student personal information.
- Use ESLint, Prettier, Vitest, and Playwright with checks appropriate to each milestone. Test authorization and concurrency where relevant.
- Maintain requirements, architecture, database design, API design, and development roadmap documents as decisions evolve.

## Decision status

Current authorization: finish Milestone 05 Lessons 02–05 only: approved-student quizzes, one transactional attempt per quiz/account, database-timed autosave/submission/scoring, close-then-manual result release, own history/performance and owned teacher/admin reports. Freeze content after first attempt; never expose keys/scores before authorized release. Use isolated tests; no real roles/attempt data changes or Milestone 06. Earlier scope notes are historical.

Current authorization: Milestone 05 Lesson 01 implements teacher/admin-owned quiz CRUD and draft/published transitions only. Teachers manage own quizzes; admins manage all. Compute total marks server-side, protect keys behind management APIs, require versioned updates, unpublish before edit/archive, and never build taking/results. Test only fictional memory fixtures; no real records, roles or migrations. Earlier scope notes are historical.

Current authorization: Milestone 04 Lesson 05 adds read-only admin membership analytics and charts only. Aggregate on the backend, validate bounded UTC dates, exclude student identifiers and personal details, reuse fresh admin RBAC. KPI cohorts use submission dates; membership growth/distribution use approval dates. No real writes, role changes, migrations or next milestone. Earlier scope notes are historical.

Current authorization: Milestone 04 Lesson 04 adds approved-student own-profile GET/PATCH and /dashboard/student/profile. Only member fullName, phone, department and academicYear are editable. Use session ID plus approved-state filtering; never change roles, student ID, approval/reviewer metadata. Keep phone private and public member projections unchanged. Completion measures four saved editable fields. No auth account name synchronization, migrations, real test writes or later lessons. Earlier scope notes are historical.

Current authorization: Milestone 04 Lesson 03 implements a public approved-member directory/profiles, validated search/filters, pagination, counts and department statistics. Read directly from approved membershipApplications with explicit public projections; never expose phone, email, student ID, reason, rejection/reviewer data. No new approval transitions, role changes, migrations or later lessons. Isolated tests only. Earlier scope notes are historical.

Current authorization: Milestone 04 Lesson 02 implements admin-only membership listing/filtering and pending-to-approved/rejected review, a confirmation dialog, required rejection reasons, server-owned reviewer/date, and student decision display. No account role changes, public-directory publication, resubmission, or later lessons. Test on isolated fictional records; do not review real applications automatically. Earlier scope notes are historical.

Current authorization: Milestone 04 Lesson 01 implements student-only membership application submission and own status, plus the Next.js form and dashboard status. Reuse authentication and fresh-role RBAC. No admin approval, role changes, or later lessons. Use isolated tests, not real student submissions. One membershipApplications document per account uses the account ID as its unique _id; no index migration or role write is required. Earlier scope notes are historical.

Current authorization: Milestone 03 Lesson 05 audits and hardens existing authentication, sessions and RBAC only, including rate limiting, headers and isolated security regression tests. No real role changes, data deletion, deployment security configuration changes, new business features or Milestone 04 work. Previous checkpoint scope notes below are historical.

Current authorization: Checkpoint D adds role-aware frontend navigation, dashboard routing, reusable RoleGuard, and placeholder dashboards only. Checkpoints A–C are complete per the user. Preserve Express RBAC; do not change real roles, add role assignment, membership approval, quizzes, or full dashboards. Stop after D verification. The earlier checkpoint scope notes below are historical.

Historical Checkpoint C scope: strict single-role Express RBAC for student/teacher/admin and three overview demonstration endpoints. Keep tests isolated; never change real roles/admins. Checkpoint B bootstrap remains a separate explicitly approved operation and must not be executed as part of frontend dashboard work.

Historical Checkpoint B scope (superseded by the Checkpoint C authorization above): secure first-admin bootstrap tooling. Do not execute database writes, including live test writes or promotion, without explicit user approval. Bootstrap is offline, one-time, and requires an exact existing verified student, independent ownership confirmation, and interactive confirmation. Do not delete files or alter Git history without approval.

Milestones 01 and 02 are complete per the user. Milestone 03, Lesson 01 (Better Auth server integration) is approved. Stop after server-only integration and verification; obtain approval before subsequent lessons. Frontend auth pages, RBAC, admin provisioning, and custom JWT authentication are excluded from this lesson.

Subsequent explicit approvals cover the client auth helper, Zod auth schemas, global Toaster and the signup page. Implement and verify signup only; login pages, RBAC and admin provisioning still require their own approval.

Confirmed: admin membership approval, full online science quizzes, Bangla and English, admin-only teacher creation, Next.js on Vercel, a separate Express server, MongoDB Atlas and Better Auth later, and one repository with independent client/server apps. Other defaults remain proposals. Record decisions in docs/requirements.md.

Use Node 24.x and independent app lockfiles. Use npm.cmd/npx.cmd if PowerShell blocks .ps1 launchers. Local ports are 3000/5000. The foundation endpoint is GET /api/health; versioned business APIs remain planned. Never place secrets in NEXT_PUBLIC variables.
