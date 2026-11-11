import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
const keys = new Set(),
  raw = [];
const dictionary = JSON.parse(fs.readFileSync("src/lib/i18n/bn.json", "utf8"));
function extract(node) {
  if (ts.isStringLiteral(node)) keys.add(node.text);
  else if (ts.isConditionalExpression(node)) {
    extract(node.whenTrue);
    extract(node.whenFalse);
  }
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["ui", "i18n"].includes(entry.name)) walk(file);
    } else if (file.endsWith("tsx")) {
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node) {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(source) === "t" &&
          node.arguments[0]
        )
          extract(node.arguments[0]);
        if (
          ts.isStringLiteral(node) &&
          ts.isArrayLiteralExpression(node.parent) &&
          /^[A-Z][A-Za-z %()]+$/.test(node.text)
        )
          keys.add(node.text);
        if (
          ts.isJsxAttribute(node) &&
          node.name.getText(source) === "text" &&
          ts.isStringLiteral(node.initializer)
        )
          keys.add(node.initializer.text);
        if (
          ts.isJsxText(node) &&
          /[A-Za-z]{2}/.test(node.text) &&
          !node.text.trim().startsWith("/")
        )
          raw.push(`${file}: ${node.text.trim()}`);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}
walk("src/components");
walk("src/app");
const missing = [...keys].filter(
  (key) => /[A-Za-z]{2}/.test(key) && !dictionary[key],
);
fs.writeFileSync(
  "src/lib/i18n/keys.json",
  JSON.stringify([...keys].sort(), null, 2) + "\n",
);
if (missing.length || raw.length) {
  process.stderr.write(JSON.stringify({ missing, raw }, null, 2) + "\n");
  process.exitCode = 1;
} else
  process.stdout.write(`${keys.size} translated UI keys; no raw JSX labels.\n`);
