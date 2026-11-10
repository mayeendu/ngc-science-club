import { z } from "zod";

export const memberQuerySchema = z.strictObject({
  search: z.string().trim().max(80).default(""),
  department: z.string().trim().min(1).max(100).optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const memberIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
export type MemberQuery = z.infer<typeof memberQuerySchema>;
export type PublicMember = {
  id: string;
  name: string;
  department: string;
  academicYear: string;
  membershipDate: string | null;
};
export type MemberList = {
  members: PublicMember[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
export type MemberStats = {
  totalMembers: number;
  departments: { department: string; count: number }[];
  academicYears: string[];
};
