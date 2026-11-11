import type { z } from "zod";
export class ClubApiError extends Error {
  constructor(public status: number) {
    super(
      status === 429
        ? "Too many requests. Please try again later."
        : status === 401
          ? "Your session expired. Sign in again."
          : status === 403
            ? "You do not have permission to perform this action."
            : status === 409
              ? "This record changed. Refresh before trying again."
              : status === 400
                ? "Check the form values and linked records."
                : status === 404
                  ? "Record not found."
                  : "Unable to connect. Please try again.",
    );
  }
}
export async function clubRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Club API is not configured.");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/${path}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ClubApiError(response.status);
  return schema.parse(await response.json());
}
export const clubJson = (method: string, input: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});
