import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import console from "node:console";
import process from "node:process";
const root = fileURLToPath(new URL("../../", import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(directory, entry.name))
      : [resolve(directory, entry.name)],
  );
}
const errors = [];
const markdown = [
  resolve(root, "README.md"),
  ...files(resolve(root, "docs")).filter((file) => file.endsWith(".md")),
];
let links = 0;
for (const file of markdown) {
  for (const match of readFileSync(file, "utf8").matchAll(
    /\[[^\]]*\]\(([^)]+)\)/g,
  )) {
    const target = match[1].replace(/^<|>$/g, "").split("#")[0];
    if (!target || /^[a-z]+:/i.test(target) || target.startsWith("//"))
      continue;
    links++;
    if (!existsSync(resolve(dirname(file), target)))
      errors.push(`${relative(root, file)}: missing ${target}`);
  }
}
const app = resolve(root, "client/src/app");
const routes = new Set(
  files(app)
    .filter((file) => file.endsWith(`${sep}page.tsx`))
    .map(
      (file) =>
        "/" +
        relative(app, dirname(file))
          .split(sep)
          .filter((part) => part && !part.startsWith("("))
          .join("/"),
    ),
);
let hrefs = 0;
for (const file of files(resolve(root, "client/src")).filter((file) =>
  file.endsWith(".tsx"),
)) {
  for (const match of readFileSync(file, "utf8").matchAll(
    /href\s*=\s*["'](\/[^"']*)["']/g,
  )) {
    const path = match[1].split(/[?#]/)[0];
    hrefs++;
    if (!routes.has(path))
      errors.push(`${relative(root, file)}: missing page ${path}`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else
  console.log(
    `${links} local documentation links and ${hrefs} literal navigation links resolve. Dynamic URLs and external links still require workflow/manual checks.`,
  );
