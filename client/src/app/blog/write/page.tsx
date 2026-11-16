import type { Metadata } from "next";
import { WriteBlog } from "@/components/blog/write-blog";
export const metadata: Metadata = { title: "Write Blog | NGC Science Club" };
export default function WriteBlogPage() {
  return <WriteBlog />;
}
