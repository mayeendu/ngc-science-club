const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function checkHealth(signal: AbortSignal): Promise<void> {
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
    !("status" in body) ||
    body.status !== "ok" ||
    !("service" in body) ||
    body.service !== "ngc-science-club-api"
  ) {
    throw new Error("The API returned an unexpected health response.");
  }
}
