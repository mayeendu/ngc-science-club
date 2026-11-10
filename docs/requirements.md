# Requirements and decisions

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
