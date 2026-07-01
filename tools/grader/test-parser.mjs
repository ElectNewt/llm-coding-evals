// Quick harness: run the parser in app.js against the real outputs stored in the eval markdown files.
// Usage: node test-parser.mjs
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import vm from "vm";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");

const sandbox = {
  console,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null },
  navigator: {},
  fetch: () => Promise.reject(new Error("no network in test")),
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(here, "rubric.js"), "utf8"), sandbox);
vm.runInContext(readFileSync(join(here, "app.js"), "utf8"), sandbox);

function extractLlmOutput(mdPath) {
  const md = readFileSync(mdPath, "utf8");
  const marker = md.indexOf("copy&paste LLM output:");
  const start = md.indexOf("```", marker) + 3;
  // the output itself may contain ``` so take everything up to the "## Result" heading, then trim the closing fence
  const end = md.indexOf("\n## Result", start);
  return md.slice(start, end).replace(/\n```\s*$/, "");
}

const cases = [
  ["GLM-5.2", "2026.06/Evaluations/GLM-5.2/task1_code_review_evaluation.md", 17],
  ["GPT-5_mini", "2026.06/Evaluations/GPT-5_mini/task1_code_review_evaluation.md", null],
  ["Composer-2.5", "2026.06/Evaluations/Composer-2.5/task1_code_review_evaluation.md", null],
  ["gpt-5.5", "2026.06/Evaluations/gpt-5.5/task1_code_review_evaluation.md", null],
  ["MAI-Code-1-Flash", "2026.06/Evaluations/MAI-Code-1-Flash/task1_code_review_evaluation.md", null],
];

for (const [name, rel] of cases) {
  const text = extractLlmOutput(join(repo, rel));
  const findings = vm.runInContext("parseFindings(" + JSON.stringify(text) + ")", sandbox);
  const parsed = findings.filter((f) => f.parsed);
  console.log(`\n=== ${name}: ${findings.length} blocks, ${parsed.length} with fields ===`);
  findings.forEach((f, i) => {
    console.log(
      `  F${i + 1} [${f.parsed ? "ok " : "RAW"}] sev=${(f.severity || "-").slice(0, 12).padEnd(12)} file=${(f.file || "-").slice(0, 45)}`
    );
  });
}
