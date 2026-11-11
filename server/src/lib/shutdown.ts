import type { Server } from "node:http";
import process from "node:process";

export function createShutdown(
  server: Server,
  stopWorker: () => Promise<void>,
  closeDatabase: () => Promise<void>,
  { timeoutMs = 10000, exit = (code: number) => process.exit(code) } = {},
) {
  let pending: Promise<void> | undefined;
  let closingDatabase: Promise<void> | undefined;
  const close = () =>
    (closingDatabase ??= Promise.resolve().then(closeDatabase));
  return () => {
    if (pending) return pending;
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      exit(1);
    }, timeoutMs);
    deadline.unref();
    pending = Promise.all([
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
      Promise.resolve().then(stopWorker),
    ])
      .then(close)
      .then(() => {
        clearTimeout(deadline);
        exit(0);
      })
      .catch(() => {
        server.closeAllConnections();
        // Keep the deadline active if database cleanup itself stalls.
        return close()
          .catch(() => undefined)
          .then(() => {
            clearTimeout(deadline);
            exit(1);
          });
      });
    return pending;
  };
}
