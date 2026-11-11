import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { URL } from "node:url";
import console from "node:console";
const files = readdirSync(new URL("../tests/", import.meta.url))
  .filter(
    (name) =>
      name.endsWith(".test.mjs") && !name.endsWith(".integration.test.mjs"),
  )
  .sort()
  .map((name) => `tests/${name}`);
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "--test-concurrency=1", ...files],
  {
    stdio: "inherit",
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, NGC_ISOLATED_TEST: "1", RUN_ATLAS_AUTH_TESTS: "0" },
  },
);
if (result.error) {
  console.error("Unable to start isolated tests.");
  process.exit(1);
}
process.exit(result.status ?? 1);
