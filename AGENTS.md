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

Phase 2, Milestone 01 (Project Foundation) is approved. Stop after implementation and verification; obtain approval before the next milestone. MongoDB and authentication are excluded from Milestone 01.

Confirmed: admin membership approval, full online science quizzes, Bangla and English, admin-only teacher creation, Next.js on Vercel, a separate Express server, MongoDB Atlas and Better Auth later, and one repository with independent client/server apps. Other defaults remain proposals. Record decisions in docs/requirements.md.

Use Node 24.x and independent app lockfiles. Use npm.cmd/npx.cmd if PowerShell blocks .ps1 launchers. Local ports are 3000/4000. The foundation endpoint is GET /api/health; versioned business APIs remain planned. Never place secrets in NEXT_PUBLIC variables.
