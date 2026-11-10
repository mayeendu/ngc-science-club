import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { parse } from "dotenv";

// Run from server/ through npm. Keep secret material out of terminal output.
let content;
try {
  content = readFileSync(".env", "utf8");
} catch {
  throw new Error(
    "Create server/.env from .env.example before generating a secret.",
  );
}

const existing =
  process.env.BETTER_AUTH_SECRET || parse(content).BETTER_AUTH_SECRET;
if (existing) {
  if (existing.length < 32 || existing !== existing.trim()) {
    throw new Error(
      "An invalid auth secret already exists. It was not overwritten.",
    );
  }
  process.stdout.write("Existing auth secret preserved. No secret printed.\n");
} else {
  const setting = `BETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}`;
  const updated = /^\s*BETTER_AUTH_SECRET\s*=.*$/m.test(content)
    ? content.replace(/^\s*BETTER_AUTH_SECRET\s*=.*$/gm, setting)
    : `${content.trimEnd()}\n${setting}\n`;
  writeFileSync(".env", updated, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(
    "Auth secret generated in ignored .env. No secret printed.\n",
  );
}
