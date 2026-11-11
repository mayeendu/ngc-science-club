import express from "express";
import {
  createPerformanceRepository,
  type PerformanceRepository,
} from "./modules/performance/performance.repository.js";
import { createPerformanceRouter } from "./modules/performance/performance.routes.js";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import {
  createEventRepository,
  type EventRepository,
} from "./modules/events/event.repository.js";
import {
  createPublicEventRouter,
  createStudentEventRouter,
  createStaffEventRouter,
} from "./modules/events/event.routes.js";
import {
  createAssessmentRepository,
  type AssessmentRepository,
} from "./modules/assessments/assessment.repository.js";
import {
  createStudentAssessmentRouter,
  createStaffAssessmentRouter,
} from "./modules/assessments/assessment.routes.js";
import { createQuizRouter } from "./modules/quizzes/quiz.routes.js";
import {
  createQuizRepository,
  type QuizRepository,
} from "./modules/quizzes/quiz.repository.js";
import type { Auth } from "./lib/auth.js";

import { env } from "./config/env.js";
import { createMemberRouter } from "./modules/members/member.routes.js";
import type { MemberRepository } from "./modules/members/member.repository.js";
import { createAnalyticsRouter } from "./modules/membership-analytics/analytics.routes.js";
import {
  createAnalyticsRepository,
  type AnalyticsRepository,
} from "./modules/membership-analytics/analytics.repository.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requireAuth } from "./middleware/require-auth.middleware.js";
import { createRequireRole } from "./middleware/require-role.middleware.js";
import type { AuthorizationUserLookup } from "./lib/authorization-user.js";
import type { AuthHandler } from "./types/auth.js";
import { AUTH_IP_HEADER } from "./lib/auth-security.js";
import {
  createApplicationRouter,
  createAdminApplicationRouter,
} from "./modules/membership-applications/application.routes.js";
import {
  createApplicationRepository,
  type ApplicationRepository,
} from "./modules/membership-applications/application.repository.js";

export function createApp(
  auth: Auth,
  options: {
    lookupAuthorizationUser?: AuthorizationUserLookup;
    applicationRepository?: ApplicationRepository;
    memberRepository?: MemberRepository;
    analyticsRepository?: AnalyticsRepository;
    quizRepository?: QuizRepository;
    assessmentRepository?: AssessmentRepository;
    eventRepository?: EventRepository;
    performanceRepository?: PerformanceRepository;
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      // HSTS requires an approved HTTPS deployment policy; do not set it on localhost.
      strictTransportSecurity: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      frameguard: { action: "deny" },
    }),
  );
  app.use("/api", (req, res, next) => {
    // Keep auth responses/errors out of shared browser/proxy caches.
    res.setHeader("Cache-Control", "private, no-store");
    // Never use untrusted X-Forwarded-For, X-Real-IP, or this incoming header.
    // Proxy trust remains disabled until the actual deployment is reviewed.
    req.headers[AUTH_IP_HEADER] = req.socket.remoteAddress ?? "";
    next();
  });
  const authenticate = requireAuth(auth);
  const requireRole = createRequireRole(options.lookupAuthorizationUser);
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      exposedHeaders: ["X-Retry-After"],
    }),
  );

  // Enforce the app's single, current admin role before existing plugin admin APIs.
  // Better Auth still performs its own session and administrative permission checks.
  app.use("/api/auth/admin", authenticate, requireRole("admin"));

  // Register Better Auth BEFORE express.json()
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(
    "/api/manage/quizzes",
    createQuizRouter(
      authenticate,
      requireRole("teacher", "admin"),
      options.quizRepository ?? createQuizRepository(),
    ),
  );
  app.use(express.json());
  const performance =
    options.performanceRepository ?? createPerformanceRepository();
  app.use(
    "/api/student/performance",
    createPerformanceRouter(authenticate, requireRole("student"), performance),
  );
  app.use(
    "/api/manage/performance",
    createPerformanceRouter(
      authenticate,
      requireRole("teacher", "admin"),
      performance,
    ),
  );
  const events = options.eventRepository ?? createEventRepository();
  app.use("/api/events", createPublicEventRouter(events));
  app.use(
    "/api/student/events",
    createStudentEventRouter(authenticate, requireRole("student"), events),
  );
  app.use(
    "/api/manage/events",
    createStaffEventRouter(
      authenticate,
      requireRole("teacher", "admin"),
      events,
    ),
  );
  const assessments =
    options.assessmentRepository ?? createAssessmentRepository();
  app.use(
    "/api/student/assessments",
    createStudentAssessmentRouter(
      authenticate,
      requireRole("student"),
      assessments,
    ),
  );
  app.use(
    "/api/manage/quiz-assessments",
    createStaffAssessmentRouter(
      authenticate,
      requireRole("teacher", "admin"),
      assessments,
    ),
  );

  const profile: AuthHandler = (_req, res) => {
    const user = res.locals.user;
    if (!user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }
    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
  };
  app.get("/api/me", authenticate, profile);

  const overview: AuthHandler = (_req, res) => {
    res.status(200).json({ success: true, message: "Access granted" });
  };
  app.get(
    "/api/student/overview",
    authenticate,
    requireRole("student", "teacher", "admin"),
    overview,
  );
  app.get(
    "/api/teacher/overview",
    authenticate,
    requireRole("teacher", "admin"),
    overview,
  );
  app.get("/api/admin/overview", authenticate, requireRole("admin"), overview);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "NGC Science Club API is running!",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/members", createMemberRouter(options.memberRepository));
  app.use(
    "/api/admin/membership-analytics",
    createAnalyticsRouter(
      authenticate,
      requireRole("admin"),
      options.analyticsRepository ?? createAnalyticsRepository(),
    ),
  );
  const applicationRepository =
    options.applicationRepository ?? createApplicationRepository();
  app.use(
    "/api/admin/memberships",
    createAdminApplicationRouter(
      authenticate,
      requireRole("admin"),
      applicationRepository,
    ),
  );
  app.use(
    "/api/membership-applications",
    createApplicationRouter(
      authenticate,
      requireRole("student"),
      applicationRepository,
    ),
  );

  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}
