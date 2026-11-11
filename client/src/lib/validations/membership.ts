import { z } from "zod";

export const applicationFormFields = z.strictObject({
  sscGpa: z
    .string()
    .trim()
    .regex(/^(?:[0-4](?:\.\d{1,2})?|5(?:\.0{1,2})?)$/),
  sscRegistration: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/),
  section: z.enum(["Science 1", "Science 2", "Science 3"]),
  guardianPhone: z
    .string()
    .trim()
    .regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  whatsappPhone: z
    .string()
    .trim()
    .regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  guideTeacher: z.string().trim().min(2).max(100),
  optionalSubject: z.enum(["Math", "Biology"]),
  residence: z.enum(["College Hostel", "Others"]),
  admissionGoal: z.enum(["Medical", "Engineering", "University"]),
  signature: z.string().trim().min(2).max(100),
});
export const membershipSchema = z.strictObject({
  ...applicationFormFields.partial().shape,
  fullName: z.string().trim().min(2, "Enter at least 2 characters").max(100),
  studentId: z
    .string()
    .trim()
    .min(1, "Class roll is required")
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
export type MembershipValues = z.infer<typeof membershipFormSchema>;

export const membershipFormSchema = membershipSchema.extend(
  applicationFormFields.shape,
);
