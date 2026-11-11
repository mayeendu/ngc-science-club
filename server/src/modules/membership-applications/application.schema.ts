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
export const applicationSchema = z.strictObject({
  ...applicationFormFields.partial().shape,
  fullName: z.string().trim().min(2).max(100),
  studentId: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[\p{L}\p{N}/_-]+$/u),
  department: z.string().trim().min(2).max(100),
  academicYear: z.string().trim().min(2).max(40),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  reason: z.string().trim().min(20).max(1000),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;
export const memberProfileFieldsSchema = applicationSchema.pick({
  fullName: true,
  phone: true,
  department: true,
  academicYear: true,
});
export const memberProfilePatchSchema = memberProfileFieldsSchema
  .partial()
  .refine(
    (input) => Object.keys(input).length > 0,
    "Provide at least one editable field.",
  );
export type MemberProfilePatch = z.infer<typeof memberProfilePatchSchema>;
export type OwnMemberProfile = {
  fullName: string;
  phone: string;
  department: string;
  academicYear: string;
  studentId: string;
  status: "approved";
  membershipDate: string | null;
  completion: number;
};
export type ApplicationSummary = {
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

export const applicationListSchema = z.strictObject({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const reviewSchema = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("approved") }),
  z.strictObject({
    decision: z.literal("rejected"),
    rejectionReason: z.string().trim().min(5).max(1000),
  }),
]);
export const applicationIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ApplicationListInput = z.infer<typeof applicationListSchema>;
export type AdminApplication = ApplicationInput &
  ApplicationSummary & { id: string };
export type ApplicationList = {
  applications: AdminApplication[];
  page: number;
  hasNext: boolean;
};
