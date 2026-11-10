import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

import { getDB } from "../config/db.js";
import { env } from "../config/env.js";
import { admin } from "better-auth/plugins";
import { AUTH_USER_COLLECTION } from "./auth-storage.js";
import { authAccessControl, authRoles } from "./auth-access.js";
import { AUTH_IP_HEADER, authRateLimit } from "./auth-security.js";

// The injectable adapter lets security tests run entirely in memory.
export function createAuthWithDatabase(
  database: ReturnType<typeof mongodbAdapter>,
) {
  return betterAuth({
    user: { modelName: AUTH_USER_COLLECTION },
    plugins: [
      admin({
        defaultRole: "student",
        adminRoles: ["admin"],
        ac: authAccessControl,
        roles: authRoles,
      }),
    ],

    database,

    secret: env.BETTER_AUTH_SECRET,

    baseURL: env.BETTER_AUTH_URL,

    basePath: "/api/auth",

    trustedOrigins: [env.CLIENT_URL],

    rateLimit: authRateLimit,
    advanced: { ipAddress: { ipAddressHeaders: [AUTH_IP_HEADER] } },

    emailAndPassword: {
      enabled: true,
    },
  });
}

export function createAuth() {
  return createAuthWithDatabase(mongodbAdapter(getDB()));
}

export type Auth = ReturnType<typeof createAuth>;
