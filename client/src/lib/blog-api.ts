import { z } from "zod";

export const blogCategories = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
  "Environment",
  "General Science",
] as const;
export const blogFormSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  category: z.enum(blogCategories),
  body: z.string().trim().min(50).max(10000),
});
export type BlogInput = z.infer<typeof blogFormSchema>;
const summary = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{24}$/),
  title: z.string(),
  category: z.enum(blogCategories),
  excerpt: z.string(),
  authorName: z.string(),
  publishedAt: z.iso.datetime(),
});
const post = summary.extend({ body: z.string() });
export type MemberBlog = z.infer<typeof summary>;
export type MemberBlogPost = z.infer<typeof post>;
export class BlogApiError extends Error {
  constructor(public status: number) {
    super("Blog request failed");
  }
}
async function request(path: string, signal?: AbortSignal, input?: BlogInput) {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new Error("Blog API is not configured.");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/blog${path}`, {
    method: input ? "POST" : "GET",
    credentials: input || path === "/permission" ? "include" : "omit",
    cache: "no-store",
    headers: input ? { "Content-Type": "application/json" } : undefined,
    body: input ? JSON.stringify(input) : undefined,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new BlogApiError(response.status);
  return response.json() as Promise<unknown>;
}
export async function listMemberBlogs(page: number, signal: AbortSignal) {
  return z
    .object({
      success: z.literal(true),
      items: z.array(summary),
      page: z.number().int(),
      hasNext: z.boolean(),
    })
    .parse(await request(`?page=${page}`, signal));
}
export async function getMemberBlog(id: string, signal: AbortSignal) {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new BlogApiError(404);
  return z
    .object({ success: z.literal(true), post })
    .parse(await request(`/${id}`, signal)).post;
}
export async function blogPermission(signal: AbortSignal) {
  return z
    .object({ success: z.literal(true), canWrite: z.literal(true) })
    .parse(await request("/permission", signal));
}
export async function publishMemberBlog(input: BlogInput) {
  return z
    .object({ success: z.literal(true), post })
    .parse(await request("", undefined, blogFormSchema.parse(input))).post;
}
