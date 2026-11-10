import { z } from "zod";

export const membershipSchema = z.strictObject({
  fullName: z.string().trim().min(2, "Enter at least 2 characters").max(100),
  studentId: z
    .string()
    .trim()
    .min(1, "Student ID is required")
    .max(40)
    .regex(/^[\p{L}\p{N}/_-]+$/u, "Use letters, numbers, /, _ or -"),
  department: z.string().trim().min(2, "Department is required").max(100),
  academicYear: z.string().trim().min(2, "Academic year is required").max(40),
  phone: z
    .string()
    .trim()
    .regex(
      /^(?:\+?88)?01[3-9]\d{8}$/,
      "Enter a Bangladesh mobile number, e.g. 01712345678",
    ),
  reason: z
    .string()
    .trim()
    .min(20, "Write at least 20 characters")
    .max(1000, "Use at most 1000 characters"),
});
export type MembershipValues = z.infer<typeof membershipSchema>;
