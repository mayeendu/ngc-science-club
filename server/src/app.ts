import express from "express";
import { getDB } from "./config/db.js";
import { createApiRateLimit } from "./middleware/api-rate-limit.js";
import {
  createReportRepository,
  type ReportRepository,
} from "./modules/reports/report.repository.js";
import { createReportRouter } from "./modules/reports/report.routes.js";
import {
  createShowcaseRepository,
  type ShowcaseRepository,
} from "./modules/showcase/showcase.repository.js";
import {
  createCertificateRepository,
  type CertificateRepository,
} from "./modules/certificates/certificate.repository.js";
import {
  createPublicShowcaseRouter,
  createManageShowcaseRouter,
  createPublicCertificateRouter,
  createCertificateRouter,
} from "./modules/showcase/showcase.routes.js";
import {
  createResourceRepository,
  type ResourceRepository,
} from "./modules/resources/resource.repository.js";
import { createResourceRouter } from "./modules/resources/resource.routes.js";
import {
  createAnnouncementRepository,
  type AnnouncementRepository,
} from "./modules/communication/announcement.repository.js";
import {
  createNotificationRepository,
  type NotificationRepository,
} from "./modules/communication/notification.repository.js";
import {
  createPublicAnnouncementRouter,
  createManageAnnouncementRouter,
  createNotificationRouter,
} from "./modules/communication/communication.routes.js";
import {
  createFeedbackRepository,
  type FeedbackRepository,
} from "./modules/feedback/feedback.repository.js";
import { createFeedbackRouter } from "./modules/feedback/feedback.routes.js";
import {
  createFacultyRepository,
  type FacultyRepository,
} from "./modules/faculty/faculty.repository.js";
import {
  createPublicFacultyRouter,
  createAdminFacultyRouter,
  createTeacherActivityRouter,
} from "./modules/faculty/faculty.routes.js";
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
    facultyRepository?: FacultyRepository;
    feedbackRepository?: FeedbackRepository;
    announcementRepository?: AnnouncementRepository;
    notificationRepository?: NotificationRepository;
    resourceRepository?: ResourceRepository;
    showcaseRepository?: ShowcaseRepository;
    certificateRepository?: CertificateRepository;
    reportRepository?: ReportRepository;
    readiness?: () => Promise<void>;
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
      exposedHeaders: ["X-Retry-After", "Retry-After", "Content-Disposition"],
    }),
  );
  app.use("/api", createApiRateLimit());
  // CORS controls browser response access, not whether a mutation executes.
  // Enforce exact trusted origins even for first signup without a session cookie.
  app.use("/api/auth", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("Origin") !== env.CLIENT_URL
    ) {
      res
        .status(403)
        .json({ success: false, message: "Untrusted request origin" });
      return;
    }
    next();
  });

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
  app.use(
    "/api/admin/reports",
    createReportRouter(
      authenticate,
      requireRole("admin"),
      options.reportRepository ?? createReportRepository(),
    ),
  );
  const showcase = options.showcaseRepository ?? createShowcaseRepository();
  app.use("/api/showcase", createPublicShowcaseRouter(showcase));
  app.use(
    "/api/manage/showcase",
    createManageShowcaseRouter(
      authenticate,
      requireRole("teacher", "admin"),
      showcase,
    ),
  );
  const certificates =
    options.certificateRepository ?? createCertificateRepository();
  app.use("/api/certificates", createPublicCertificateRouter(certificates));
  app.use(
    "/api/own/certificates",
    createCertificateRouter(
      authenticate,
      requireRole("student", "teacher", "admin"),
      certificates,
    ),
  );
  app.use(
    "/api/manage/certificates",
    createCertificateRouter(
      authenticate,
      requireRole("teacher", "admin"),
      certificates,
      true,
    ),
  );
  const resources = options.resourceRepository ?? createResourceRepository();
  app.use(
    "/api/resources",
    createResourceRouter(
      authenticate,
      requireRole("student", "teacher", "admin"),
      resources,
    ),
  );
  app.use(
    "/api/manage/resources",
    createResourceRouter(
      authenticate,
      requireRole("teacher", "admin"),
      resources,
      true,
    ),
  );
  const announcements =
    options.announcementRepository ?? createAnnouncementRepository();
  app.use("/api/announcements", createPublicAnnouncementRouter(announcements));
  app.use(
    "/api/manage/announcements",
    createManageAnnouncementRouter(
      authenticate,
      requireRole("teacher", "admin"),
      announcements,
    ),
  );
  app.use(
    "/api/notifications",
    createNotificationRouter(
      authenticate,
      requireRole("student", "teacher", "admin"),
      options.notificationRepository ?? createNotificationRepository(),
    ),
  );
  const feedback = options.feedbackRepository ?? createFeedbackRepository();
  app.use(
    "/api/feedback",
    createFeedbackRouter(
      authenticate,
      requireRole("student", "teacher", "admin"),
      feedback,
    ),
  );
  app.use(
    "/api/manage/feedback",
    createFeedbackRouter(
      authenticate,
      requireRole("teacher", "admin"),
      feedback,
      true,
      requireRole("admin"),
    ),
  );
  const faculty = options.facultyRepository ?? createFacultyRepository();
  app.use("/api/faculty", createPublicFacultyRouter(faculty));
  app.use(
    "/api/admin/faculty",
    createAdminFacultyRouter(authenticate, requireRole("admin"), faculty),
  );
  app.use(
    "/api/teacher/activities",
    createTeacherActivityRouter(
      authenticate,
      requireRole("teacher", "admin"),
      faculty,
    ),
  );
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
  app.get("/api/ready", async (_req, res) => {
    try {
      await (
        options.readiness ??
        (async () => {
          await getDB().command({ ping: 1 }, { timeoutMS: 2500 });
        })
      )();
      res.status(200).json({ success: true, status: "ready" });
    } catch {
      res.status(503).json({ success: false, status: "unavailable" });
    }
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
