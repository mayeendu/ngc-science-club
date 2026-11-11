# Milestone 15 — UI and accessibility

The shared navigation offers Light, Dark and System appearance, persisted in `ngc-theme`. System mode listens for OS appearance changes. Blocked storage falls back to memory; initial server markup uses system/default styling until hydration. English/Bangla selection remains independent. Bengali uses the existing system font stack and comfortable line height, without remote font dependencies for Bangla.

The root layout includes a keyboard skip link to a focusable content container. Shared CSS adds visible focus rings, form control heights, wrapping, table spacing, reduced-motion support and dark variants for existing status/background/text utility classes. Existing route guards, labels, error states and empty states remain in place. The homepage adds links to events, mentors, achievements and gallery; backend health remains a secondary status. App Router `loading.tsx` supplies a localized skeleton. Report print styles hide navigation/filter controls and keep table rows readable. No new packages.

Changed areas: shared layout/navbar, appearance and skeleton components, homepage, global styles, report content target, dictionaries and accessibility Playwright suite. Reviewed the installed Next.js accessibility/layout documentation; preserve its route announcer and real page headings.

Verification: both apps typecheck/lint/build; 4 new desktop/mobile checks pass for skip-link focus, saved appearance, system preference, Bengali font/layout and viewport width; 6 language regression checks pass; report checks cover CSV/PDF and admin guard. This is targeted accessibility verification, not a full assistive-technology certification. Screen-reader review and exhaustive component-by-component contrast testing remain manual launch checks.

Commands: client `npm.cmd run test:accessibility`, `npm.cmd run test:i18n`, `npm.cmd run check:i18n` with `PLAYWRIGHT_CHANNEL=msedge` for browser suites. Manual review: Tab from the address bar, activate the skip link, visit dashboards/forms in each theme and language, resize to 375px, zoom to 200%, and enable reduced motion. Confirm table overflow stays inside its scroll container and validation remains visible. No data writes, account changes or deployment changes.

Lesson: place shared navigation and accessibility behavior in the root layout so every page benefits consistently.
