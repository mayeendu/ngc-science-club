# Final project status — local launch preparation

Latest approved scope: finish Milestones 17–18 without deploying, publishing or changing production infrastructure. Milestones 01–16 were already implemented and locally verified. Milestone 17 adds production configuration/templates, offline environment preflights, database readiness, bounded graceful shutdown and an operations guide. Milestone 18 updates setup/admin/release documentation, checks local links and reruns critical workflow/security/UI regressions. Local verification is complete on Node 24.19.0. No new test, typecheck, lint or build failures remain.

## Final verification evidence

| Check                                                | Result                      |
| ---------------------------------------------------- | --------------------------- |
| Backend typecheck, tooling typecheck, lint, build    | Pass                        |
| Frontend typecheck, lint, production build           | Pass                        |
| Backend database-disabled regression suite           | 177 passed                  |
| Mocked desktop/mobile browser regressions            | 242 passed                  |
| Default-Bangla/English browser checks                | 6 passed                    |
| Isolated Express foundation browser checks           | 6 passed                    |
| Connected real-handler memory browser workflow       | 2 passed                    |
| Distinct browser checks across suites                | 256 passed                  |
| Client translation + production preflight unit tests | 3 passed                    |
| Translation coverage                                 | 681 keys, no raw JSX labels |
| Local documentation/literal route links              | Pass                        |
| Runtime dependency audits, both apps                 | 0 findings                  |
| Formatting and Git whitespace                        | Pass                        |

The connected login extension found an existing password-label association bug: FormControl wrapped a div instead of the actual input. The login form now associates its label/error attributes with the input. After that fix, the frontend typecheck/lint/build and connected login, bilingual and accessibility suites passed again. Broad mocked/foundation suites passed before this narrowly scoped form fix; no unrelated suites were repeated after it. Four focused accessibility cases overlap the 242 mocked cases and are not counted twice.

Deployment verification adds 4 backend readiness/lifecycle/environment tests and 1 frontend preflight test. Both use fictional values/injected dependencies, not real host credentials or Atlas. Commands and manual verification paths are in the setup/deployment guides. All final passing suites report zero skipped/flaky/unexpected cases; initial failures used to discover/fix the navigation assertion and login-label bug are not hidden as successful runs.

## What is implemented

Student signup/login/session/logout, fresh student/teacher/admin RBAC, membership applications/admin decisions/public approved directory, private member-profile editing, owned staff quizzes, transactional timed attempts/autosave/scoring/manual release, student/teacher analytics, published events/capacity registration/attendance, faculty profiles/assignments, private feedback/replies, announcements/in-app notifications, Bangla/English, private GridFS learning resources, achievements/gallery, attendance certificates/public verification, admin reports/CSV/browser PDF, themes and shared accessibility improvements.

New deployment files: `client/vercel.json`, frontend/backend `.env.production.example`, Node version markers, offline preflight scripts, `server/src/lib/shutdown.ts`, readiness route injection and deployment tests. No secrets are included. Production setup is documented, not provisioned.

New final-testing files: connected memory API/browser fixture and `playwright.launch.config.ts`, local documentation/navigation link checker, rewritten README, setup/admin guides and launch checklist. Memory-only connected browser tests send real HTTP through Express/Better Auth and the production membership/feedback repositories. A transport proxy sends API calls to a loopback-only fixture. They test signup, real sessions/login/logout, pending membership persistence, feedback history and backend role denial. They do not establish Atlas transactions, production DNS/TLS/cookies, capacity concurrency, email delivery or actual host behavior. Existing isolated backend and mocked UI suites exercise quiz/event/teacher/admin workflows, concurrency and privacy separately.

## Unresolved launch requirements

| Area                        | Remaining requirement                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting/domain approval     | No Vercel/backend project, staging deployment, custom domain or public launch has been approved/executed.                                                                                                                        |
| Real database/storage       | Atlas authentication, transaction/concurrency and GridFS smoke tests remain unverified; no indexes applied.                                                                                                                      |
| Production cookies/security | Validate same-site domains, TLS, exact origins, trusted ingress, distributed limits and production HSTS/CSP.                                                                                                                     |
| Accounts/email              | Establish legitimate verified admin ownership and an approved teacher-role workflow; email verification/recovery delivery is not configured. No teacher-provisioning UI exists.                                                  |
| Dependency maintenance      | Last full audits retain backend 10 moderate and frontend 12 findings (2 low, 10 moderate), confined to development/tooling graphs after CLI reclassification. Runtime audits were clean at Milestone 16; recheck before release. |
| Operations                  | Approve/test backup+GridFS restoration, rollback, worker/health monitoring and production-like load.                                                                                                                             |
| Accessibility/privacy       | Complete screen-reader/Safari/mobile/manual review and institution privacy/content-consent approval. Targeted automated checks are not certification.                                                                            |
| Resource/certificate limits | File checks are structural/type validation, not malware scanning. Certificates are printable browser PDFs, not digitally signed; public initials-only verification does not prove private full identity.                         |
| Version control             | This checkpoint packages Milestones 08–18. The user authorized commit/push; confirm the remote revision in Git before treating a checkout as synchronized.                                                                       |

The earlier four Atlas authentication test failures were investigated in Milestone 16 and corrected with equivalent real Better Auth memory tests. The live Atlas suite was not rerun. In the earlier Milestone 13 checkpoint a wildcard command accidentally ran a temporary Atlas authentication database test and its cleanup completed; new test guards prevent routine repetition. No live database writes or role/infrastructure changes are part of Milestones 17–18.

## Release decision

Local preparation does not authorize release. **Production launch remains blocked by the unchecked external items in [the launch checklist](launch-checklist.md).** A later approved staging deployment must supply the actual domains, secrets, account ownership and operational decisions, then verify critical flows against real infrastructure before a separate launch approval.

Continuation: review this status, [deployment guide](deployment-guide.md) and [checklist](launch-checklist.md); preserve local changes; resolve the concrete staging prerequisites and obtain approval before any live deployment, role/index writes or publishing. Do not repeat completed local work or run Atlas integration without approval.
