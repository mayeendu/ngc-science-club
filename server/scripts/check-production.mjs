import process from "node:process";
import console from "node:console";
// Environment parsing only: no database connection, index setup, or credential output.
try {
  const { env } = await import("../dist/config/env.js");
  if (
    env.NODE_ENV !== "production" ||
    !/^mongodb(?:\+srv)?:\/\/\S+$/.test(env.MONGODB_URI)
  )
    throw new Error("Invalid production configuration");
  console.log(
    "Production environment shape is valid. DNS, cookies, credentials and Atlas connectivity still require approved staging verification.",
  );
} catch {
  console.error(
    "Production environment check failed. Set NODE_ENV=production, HTTPS origins, MongoDB URI/database and a private auth secret. Values were not printed.",
  );
  process.exitCode = 1;
}
