import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must contain at least 2 characters"),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must contain at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignupValues = z.infer<typeof signupSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
