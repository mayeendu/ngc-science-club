import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import process from "node:process";
test("frontend production preflight enforces matching HTTPS origins and redacts input", () => {
  const env = {
    ...process.env,
    API_URL: "https://api.club.example.edu.bd",
    NEXT_PUBLIC_API_BASE_URL: "https://api.club.example.edu.bd",
    NEXT_PUBLIC_AUTH_URL: "https://api.club.example.edu.bd",
  };
  const run = (extra) =>
    spawnSync(process.execPath, ["scripts/check-production.mjs"], {
      encoding: "utf8",
      env: { ...env, ...extra },
    });
  assert.equal(run({}).status, 0);
  for (const extra of [
    { API_URL: "http://localhost:5000" },
    { NEXT_PUBLIC_AUTH_URL: "https://different.example" },
    { NEXT_PUBLIC_AUTH_URL: "https://PRIVATE_VALUE:secret@api.example" },
    { NEXT_PUBLIC_API_BASE_URL: "https://api.example/path" },
  ]) {
    const result = run(extra);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_VALUE|secret@/);
  }
});
