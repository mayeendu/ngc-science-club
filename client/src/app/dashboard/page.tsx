"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { dashboardPath, parseRole } from "@/lib/roles";
import {
  AccessDenied,
  AccessError,
  AccessLoading,
} from "@/components/auth/access-state";
export default function DashboardPage() {
  const { data, isPending, error, refetch } = useSession();
  const router = useRouter();
  const role = parseRole(data?.user.role);
  useEffect(() => {
    if (isPending || error) return;
    if (!data) router.replace("/login");
    else if (role) router.replace(dashboardPath(role));
  }, [data, role, isPending, error, router]);
  if (error) return <AccessError retry={() => void refetch()} />;
  if (!isPending && data && !role) return <AccessDenied />;
  return <AccessLoading />;
}
