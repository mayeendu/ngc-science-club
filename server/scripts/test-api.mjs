import process from "node:process";
import { randomBytes } from "node:crypto";
const { Response } = globalThis;
Object.assign(process.env, {
  NODE_ENV: "test",
  NGC_ISOLATED_TEST: "1",
  PORT: process.env.E2E_SERVER_PORT ?? "5101",
  CLIENT_URL: `http://localhost:${process.env.E2E_CLIENT_PORT ?? "3100"}`,
  BETTER_AUTH_URL: `http://localhost:${process.env.E2E_SERVER_PORT ?? "5101"}`,
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:1",
  DB_NAME: "fictional_browser_api_only",
});
const { createApp } = await import("../dist/app.js");
const auth = {
  handler: async () =>
    new Response("null", { headers: { "Content-Type": "application/json" } }),
  api: { getSession: async () => null },
};
createApp(auth).listen(Number(process.env.PORT));
