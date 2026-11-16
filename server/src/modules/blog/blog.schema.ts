import { z } from "zod";
export const blogContent = z.strictObject({
  title: z.string().trim().min(3).max(150),
  category: z.enum([
    "Physics",
    "Chemistry",
    "Mathematics",
    "Biology",
    "Environment",
    "General Science",
  ]),
  body: z.string().trim().min(50).max(10000),
});
export const blogPage = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const blogId = z.string().regex(/^[a-f0-9]{24}$/);
export type BlogInput = z.infer<typeof blogContent>;
export type BlogActor = {
  id: string;
  name: string;
  role: "student" | "teacher" | "admin";
};
export type BlogSummary = {
  id: string;
  title: string;
  category: BlogInput["category"];
  excerpt: string;
  authorName: string;
  publishedAt: string;
};
export type BlogPost = BlogSummary & { body: string };
