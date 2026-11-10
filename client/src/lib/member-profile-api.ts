import { z } from "zod";
import { membershipSchema } from "./validations/membership";

export const memberProfileSchema = membershipSchema.pick({
  fullName: true,
  phone: true,
  department: true,
  academicYear: true,
});
export type MemberProfileValues = z.infer<typeof memberProfileSchema>;
const profileResponseSchema = z.object({
  success: z.literal(true),
  profile: z.strictObject({
    fullName: z.string(),
    phone: z.string(),
    department: z.string(),
    academicYear: z.string(),
    studentId: z.string(),
    status: z.literal("approved"),
    membershipDate: z.iso.datetime().nullable(),
    completion: z.number().int().min(0).max(100),
  }),
});
export type OwnMemberProfile = z.infer<typeof profileResponseSchema>["profile"];
export class MemberProfileError extends Error {
  constructor(public status: number) {
    super(
      status === 401
        ? "Your session expired. Please sign in again."
        : status === 403
          ? "An approved student membership is required."
          : "Unable to load or save your member profile. Please try again.",
    );
  }
}
export async function ownMemberProfile(
  values?: MemberProfileValues,
  signal?: AbortSignal,
) {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Member service is not configured.");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/membership-applications/me/profile`,
    {
      method: values ? "PATCH" : "GET",
      credentials: "include",
      cache: "no-store",
      headers: values ? { "Content-Type": "application/json" } : undefined,
      body: values
        ? JSON.stringify(memberProfileSchema.parse(values))
        : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new MemberProfileError(response.status);
  return profileResponseSchema.parse(await response.json()).profile;
}
