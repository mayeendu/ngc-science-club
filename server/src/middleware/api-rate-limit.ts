import type { RequestHandler } from "express";
// Per-process protection. Socket addresses are trusted; forwarded headers are not.
// Distributed limiting belongs to the approved production topology.
export function createApiRateLimit({
  windowMs = 60000,
  max = 600,
  maxKeys = 10000,
  now = Date.now,
} = {}): RequestHandler {
  const buckets = new Map<string, { until: number; count: number }>();
  let sweepAt = 0;
  return (req, res, next) => {
    const path = req.path.toLowerCase();
    if (
      req.method === "OPTIONS" ||
      path === "/health" ||
      path === "/ready" ||
      path.startsWith("/auth/")
    ) {
      next();
      return;
    }
    const time = now();
    if (time >= sweepAt) {
      for (const [key, bucket] of buckets)
        if (bucket.until <= time) buckets.delete(key);
      sweepAt = time + windowMs;
    }
    const expensive =
      path.startsWith("/admin/reports") || path.endsWith("/file");
    const key = `${req.socket.remoteAddress ?? "unknown"}:${expensive ? "expensive" : "normal"}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= time) {
      if (!bucket && buckets.size >= maxKeys) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
        });
        return;
      }
      bucket = { until: time + windowMs, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > (expensive ? Math.min(max, 30) : max)) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((bucket.until - time) / 1000))),
      );
      res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
      return;
    }
    next();
  };
}
