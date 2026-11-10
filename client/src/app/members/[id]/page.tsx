"use client";
import { useParams } from "next/navigation";
import { MemberProfile } from "@/components/members/member-profile";
export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <MemberProfile key={id} id={id} />;
}
