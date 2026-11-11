# Dashboard visual refresh

Approved scope: apply the supplied education dashboard reference to the admin, teacher and student dashboards, preserving Science Club content and permissions. This is local UI work only.

## Design and affected files

The shared dashboard layout uses a white desktop sidebar, pale workspace, compact account toolbar, teal welcome banner, colorful shortcuts and white tool cards. A mobile menu replaces the fixed sidebar on narrow screens. Existing brand assets, theme selection, Bangla/English selection, notifications, logout and permitted dashboard switching remain available. Decorative science artwork uses Lucide icons and CSS.

- `client/src/app/dashboard/layout.tsx` wraps dashboard routes with `DashboardShell`.
- `client/src/components/dashboard/dashboard-shell.tsx` owns the sidebar, mobile menu and toolbar.
- `client/src/components/dashboard/dashboard-links.ts` defines role-specific navigation shared by the sidebar and overview cards.
- `client/src/components/dashboard/role-dashboard.tsx` renders role-specific welcome and tool sections, retaining the student membership component.
- `client/src/components/dashboard/dashboard-progress.tsx` reads the existing scoped performance API for summary metrics, area/bar charts and an accessible data table. It handles loading, failures, retry and no released results.
- `client/src/app/globals.css` scopes workspace styles to dashboard classes, including subpage cards, tables, dark mode, mobile layouts and print behavior.
- `Navbar` hides the public navigation within dashboard routes. Suspense boundaries around route-aware components allow Next.js prerendering.
- Translation dictionaries and dashboard browser checks cover the new UI.

One shared shell means improvements apply to every dashboard subpage. Role links support navigation; existing RoleGuard and Express authorization continue to decide access. No backend rules, endpoints, collections, indexes or roles change. Metrics use released results from the existing API; no sample metrics are shipped in the UI.

## Verification and manual review

Final results: normal Turbopack production build, frontend typecheck, lint, formatting and whitespace pass; 102 desktop/mobile dashboard browser checks pass; 2 translation unit tests pass; 678 extracted UI keys have translations with no raw JSX labels. Local link validation passes (133 documentation links and 41 literal navigation links). Desktop admin and mobile student screenshots were visually reviewed. Browser checks used `E2E_CLIENT_PORT=3200`; after all checks finished, the owned Next.js test server required manual process termination to finish Windows teardown, and Playwright exited successfully with `102 passed (2.8m)`.

Commands run from `client/`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run check:i18n
npm.cmd run test:translations
npm.cmd run check:links
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:dashboard
```

The default Turbopack build initially encountered cached native worker memory errors. A Webpack fallback compiled but screenshot review showed that it bypassed this project's Tailwind loader; it was not accepted as visual verification. After moving the stale Turbopack cache aside inside the ignored `.next/cache` directory, the normal Turbopack production build passed with font network access allowed. Route-aware navigation also received the required Suspense boundaries. No dependency or build configuration change was required.

Browser fixtures are fictional and mock authentication, role checks, membership and performance. Added checks cover each role's charts, accessible data table, mobile menu, overflow, screenshot capture and API failure/retry/empty data. Existing checks cover session expiry, role denial, logout and membership workflows. These do not verify live Atlas or production deployment.

Manual path: log in with an authorized development account, inspect its dashboard, open a tool card and verify the shared sidebar remains. Switch language/theme, resize to mobile and open/close the menu. Open performance reports and compare the released result aggregates. Try an unauthorized role URL and confirm Access Denied. Use keyboard navigation and review the chart table. Public pages retain their public navbar.

Lesson: a layout shares visual structure; a navigation configuration shares links; existing server APIs supply authoritative data. Styling should not introduce a second authorization or analytics system.
