"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient()],
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
  basePath: "/api/auth",
  sessionOptions: {
    refetchInterval: 60,
    refetchOnWindowFocus: true,
  },

  fetchOptions: {
    credentials: "include",
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
