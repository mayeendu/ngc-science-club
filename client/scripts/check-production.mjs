import process from "node:process";
import console from "node:console";
const { URL } = globalThis;
const names = ["API_URL", "NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_AUTH_URL"];
const values = names.map((name) => process.env[name]);
const valid =
  values.every((value) => {
    if (!value || !URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  }) && new Set(values).size === 1;
if (!valid) {
  console.error(
    "Set API_URL, NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_AUTH_URL to the same HTTPS backend origin, without paths, credentials or trailing slashes. Values were not printed.",
  );
  process.exitCode = 1;
} else
  console.log(
    "Frontend production origins are valid. Public variables are embedded at build time; verify same-site cookie topology separately.",
  );
