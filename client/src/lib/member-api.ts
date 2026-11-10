import { z } from "zod";

export const publicMemberSchema = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{24}$/),
  name: z.string(),
  department: z.string(),
  academicYear: z.string(),
  membershipDate: z.iso.datetime().nullable(),
});
const listSchema = z.object({
  success: z.literal(true),
  members: z.array(publicMemberSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
const statsSchema = z.object({
  success: z.literal(true),
  totalMembers: z.number().int(),
  departments: z.array(
    z.object({ department: z.string(), count: z.number().int() }),
  ),
  academicYears: z.array(z.string()),
});
export type PublicMember = z.infer<typeof publicMemberSchema>;
export type MemberList = z.infer<typeof listSchema>;
export type MemberStats = z.infer<typeof statsSchema>;
export class MemberApiError extends Error {
  constructor(public status: number) {
    super(
      status === 404
        ? "Member not found."
        : "Unable to load members. Please try again.",
    );
  }
}
async function request(path: string, signal: AbortSignal) {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_AUTH_URL ??
    "http://localhost:5000";
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/members${path}`,
    {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    },
  );
  if (!response.ok) throw new MemberApiError(response.status);
  const body: unknown = await response.json();
  return body;
}
export async function listMembers(
  query: {
    search: string;
    department: string;
    academicYear: string;
    page: number;
  },
  signal: AbortSignal,
) {
  const params = new URLSearchParams({
    search: query.search,
    page: String(query.page),
  });
  if (query.department) params.set("department", query.department);
  if (query.academicYear) params.set("academicYear", query.academicYear);
  return listSchema.parse(await request(`?${params}`, signal));
}
export async function memberStats(signal: AbortSignal) {
  return statsSchema.parse(await request("/stats", signal));
}
export async function memberProfile(id: string, signal: AbortSignal) {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new MemberApiError(404);
  return z
    .object({ success: z.literal(true), member: publicMemberSchema })
    .parse(await request(`/${id}`, signal)).member;
}
export function membershipDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Not recorded";
}
