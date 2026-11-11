import assert from "node:assert/strict";
import { test } from "node:test";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import ts from "typescript";
const dictionary = JSON.parse(
  fs.readFileSync(new URL("../src/lib/i18n/bn.json", import.meta.url), "utf8"),
);
const source = fs
  .readFileSync(new URL("../src/lib/i18n/language.ts", import.meta.url), "utf8")
  .replace(
    'import dictionary from "./bn.json";',
    `const dictionary = ${JSON.stringify(dictionary)};`,
  );
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { translate, getLanguage } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
test("server language defaults to Bangla; unknown and prototype keys remain safe", () => {
  assert.equal(getLanguage(), "bn");
  assert.equal(translate("bn", "Home"), "হোম");
  assert.equal(translate("en", "Home"), "Home");
  for (const key of ["__proto__", "constructor", "toString", "unknown field"])
    assert.equal(translate("bn", key), key);
});
test("translation parameters preserve original names and error contexts use safe localized fallback", () => {
  assert.equal(
    translate("bn", "Issue certificate for {0}", ["Home"]),
    "Home-এর সনদ প্রদান করুন",
  );
  assert.match(translate("bn", "Unknown backend detail", [], true), /অনুরোধটি/);
  assert.equal(
    translate("en", "Unknown backend detail", [], true),
    "Unknown backend detail",
  );
});
