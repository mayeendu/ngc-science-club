import type { AssessmentRepository } from "./assessment.repository.js";
export function startAssessmentWorker(repository: AssessmentRepository) {
  let pending: Promise<void> | null = null;
  const timer = setInterval(() => {
    if (pending) return;
    pending = repository
      .expireDue()
      .catch(() => {
        console.error("Assessment expiry sweep failed.");
      })
      .finally(() => {
        pending = null;
      });
  }, 15_000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await pending;
  };
}
