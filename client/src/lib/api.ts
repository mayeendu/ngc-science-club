export type HealthResponse = {
  success: true;
  message: string;
  timestamp: string;
};

export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const apiBaseUrl =
    (typeof window === "undefined" ? process.env.API_URL : undefined) ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:5000";
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/health`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw new Error("The API returned an unsuccessful health response.");
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("success" in body) ||
    body.success !== true ||
    !("message" in body) ||
    typeof body.message !== "string" ||
    !("timestamp" in body) ||
    typeof body.timestamp !== "string" ||
    !Number.isFinite(Date.parse(body.timestamp))
  ) {
    throw new Error("The API returned an unexpected health response.");
  }
  return { success: true, message: body.message, timestamp: body.timestamp };
}

export async function checkHealth(signal: AbortSignal): Promise<void> {
  await getHealth(signal);
}
