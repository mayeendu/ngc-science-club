import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

import { getDB } from "../config/db.js";
import { env } from "../config/env.js";
import { admin } from "better-auth/plugins";

export function createAuth() {
  return betterAuth({
    plugins: [
      admin({
        defaultRole: "student",
        adminRoles: ["admin"],
      }),
    ],

    database: mongodbAdapter(getDB()),

    secret: env.BETTER_AUTH_SECRET,

    baseURL: env.BETTER_AUTH_URL,

    basePath: "/api/auth",

    trustedOrigins: [env.CLIENT_URL],

    emailAndPassword: {
      enabled: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
