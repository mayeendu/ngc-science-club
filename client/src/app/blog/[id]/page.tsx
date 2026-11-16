"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { BlogPost } from "@/components/blog/blog-post";
import { useLanguage } from "@/components/i18n/language";
function Detail() {
  const { id } = useParams<{ id: string }>();
  return <BlogPost key={id} id={id} />;
}
export default function BlogDetailPage() {
  const bn = useLanguage() === "bn";
  return (
    <Suspense
      fallback={
        <p role="status">{bn ? "লেখা লোড হচ্ছে…" : "Loading blog post…"}</p>
      }
    >
      <Detail />
    </Suspense>
  );
}
