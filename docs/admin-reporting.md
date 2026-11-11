# Milestone 14 — Admin reporting

The admin dashboard links to `/dashboard/admin/reports`. Express enforces a fresh admin role for both `GET /api/admin/reports` and `GET /api/admin/reports/export.csv`; frontend guards only improve navigation. Query dates reuse the existing strict UTC range parser: supply both `from` and `to`, at most 731 days. Unknown query fields are rejected.

Five MongoDB aggregations use an initial date match and bounded facets for totals, current status distributions and monthly counts. Membership uses application submission dates, quizzes creation dates, events start dates, active attendance registrations registration dates, and feedback creation dates. These are cohorts with current statuses, not historical snapshots. Cancelled registrations and archived quizzes/events are excluded; cancelled events remain visible as a status. Attendance counts retained registrations even when a source event is later cancelled or archived, so these independent cohorts need not reconcile. Queries use a 10-second database timeout. No student names, identifiers, answers or feedback content leave these reports. CSV cells use fixed allowlisted labels and numeric counts. Totals include all cohort records even if legacy statuses are unrecognized; only recognized status labels are exposed.

The report has accessible numeric cards, a Recharts comparison, monthly table, date filters, loading/error/empty states, CSV download, and browser print/save-as-PDF. PDF is a browser export, not a server-generated signed document. Reports are uncached and show generation time; separate aggregate reads are not an atomic snapshot.

Changed areas: `server/src/modules/reports`, `server/src/app.ts`, generic memory-test aggregation helper; `client/src/components/reports`, the admin report route/dashboard link, dictionaries, package scripts, backend and Playwright tests/config.

Verification: both apps typecheck/lint/build; 3 isolated backend tests and 4 desktop/mobile browser checks pass. Commands: server `npm.cmd run test:reports`; client `npm.cmd run check:i18n`, `npm.cmd run test:reports` with `PLAYWRIGHT_CHANNEL=msedge`. The existing authentication integration failures remain assigned to Milestone 16. No Atlas records/indexes were changed. Suggested range indexes on each cohort date are documented for later approved application; no migration runs here.

Manual check: as an admin, choose a bounded date range, compare the status cards and monthly table, download CSV and use Print or save PDF. As a student/teacher, direct API access must return 403. An unauthenticated request must return 401. Invalid/extra dates must return 400. Tests use fictional fixtures only.

Lesson: aggregate and project on the server before data leaves the database; never send whole private records to a chart component.
