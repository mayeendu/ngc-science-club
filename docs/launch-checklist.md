# Launch checklist — Milestones 17–18

Status: local implementation/verification can be completed without approving a public release. This checklist is not deployment approval. Unchecked external items block a production launch.

## Local evidence

- [x] Independent Node 24 client/server lockfiles; production templates contain no credentials.
- [x] Vercel root/build settings and long-running Express host instructions documented.
- [x] Offline production environment preflights; DB readiness and bounded shutdown tests.
- [x] Existing student/teacher/admin authorization, ownership, membership and answer-key privacy regressions.
- [x] UI flows for membership, quizzes/results, events/attendance, feedback, resources, reports and certificates.
- [x] Default Bangla, English preference, theme persistence, keyboard focus, mobile layout and targeted contrast tests.
- [x] Setup/admin guides and local route/documentation link checker.

Final commands/counts and any failures are recorded in [final project status](final-project-status.md). Mocked UI and memory repositories are local evidence, not live MongoDB/deployment proof.

## Approval-required staging and operations

- [ ] Approve host/service/domain creation and a fictional staging database/fixtures.
- [ ] Review same-site custom domains, DNS/TLS, exact CORS/trusted origin and public build-time API URLs.
- [ ] Review trusted proxy ingress and account/distributed abuse controls under actual host networking.
- [ ] Provision private least-privilege Atlas credentials/network access; confirm transaction support.
- [ ] Review existing uniqueness/expiry/query indexes; approve and verify any necessary index writes.
- [ ] Resolve email verification/recovery delivery and legitimately provision reviewed admin/teacher accounts.
- [ ] Rehearse browser signup/login/logout/revocation and all three roles against actual staging cookies.
- [ ] Exercise real concurrent quiz attempts/scoring/deadlines/release and event capacity/attendance on staging.
- [ ] Verify GridFS upload/download, ownership, missing files and certificate issuance/verification/revocation.
- [ ] Confirm readiness outage/recovery, worker execution, restart/drain, log redaction and monitoring alerts.
- [ ] Rehearse database/GridFS backup and restoration plus compatible frontend/backend rollback.
- [ ] Perform production-like load, Safari/mobile browser and screen-reader/manual accessibility review.
- [ ] Review production HSTS/CSP, privacy/content consent, resource rights and file-scanning requirements.
- [ ] Resolve or formally accept documented development dependency findings before build/release.

## Final release approval

- [ ] Record a reviewed Git commit and approved frontend/backend release artifacts (local changes currently uncommitted).
- [ ] Confirm all staging evidence and accountable operator sign-off; record unresolved issues explicitly.
- [ ] Obtain explicit approval to deploy/promote production and modify traffic/domain settings.
- [ ] Obtain explicit approval to publish/launch; verify rollback/incident contact and monitoring coverage.

Do not infer these approvals from a request to prepare milestones. Stop at a documented local checkpoint if domains, credentials, ownership evidence or operator decisions are missing.
