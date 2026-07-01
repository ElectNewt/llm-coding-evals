// Smoke test: grade the GLM-5.2 output the same way the published eval did (80/100) and check the export.
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
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(here, "rubric.js"), "utf8"), sandbox);
vm.runInContext(readFileSync(join(here, "app.js"), "utf8"), sandbox);

const md = readFileSync(join(repo, "2026.06/Evaluations/GLM-5.2/task1_code_review_evaluation.md"), "utf8");
const marker = md.indexOf("copy&paste LLM output:");
const start = md.indexOf("```", marker) + 3;
const end = md.indexOf("\n## Result", start);
const text = md.slice(start, end).replace(/\n```\s*$/, "");

vm.runInContext(`
  state.model = "GLM-5.2 test";
  state.task1.raw = ${JSON.stringify(text)};
  state.task1.findings = parseFindings(state.task1.raw).map(f => ({...f, map: null, points: null, note: ""}));
  // replicate the published grading: findings 1,2,3,5,6,7,8,9,10 identified, 4 & 11 missed
  const mapByIdx = { 5: 8, 3: 5, 4: 6, 7: 7, 8: 1, 6: 2, 9: 3, 2: 9, 11: 10 };
  // (index F# -> expected id). F2=static dict(#8) F4=try/catch(#5)... set explicitly below instead:
  state.task1.findings.forEach((f) => { f.map = null; });
  const assign = (i, id) => { const f = state.task1.findings[i]; f.map = id; f.points = findingDefaultPoints(f); };
  assign(1, 8);   // F2 static dictionary
  assign(3, 5);   // F4 cache+swallow -> try/catch swallows
  assign(4, 6);   // F5 publish-before / silent failure
  assign(2, 9);   // F3 cache key
  assign(6, 2);   // F7 always 200
  assign(7, 1);   // F8 input validation
  assign(8, 7);   // F9 rounding
  assign(9, 3);   // F10 cancellation token
  assign(11, 10); // F12 test validates nothing
  const r = computeTask1();
  console.log("subtotal:", r.subtotal, "(expected 80)");
  console.log("penalties:", r.penaltySubtotal, "(expected 0)");
  console.log("final:", r.final, "(expected 80)");

  // incorrect finding penalty (F6 is a Blocking-severity finding -> -8)
  const bad = state.task1.findings[5];
  bad.map = "incorrect"; bad.points = findingDefaultPoints(bad);
  if (bad.points !== -8) throw new Error("blocking incorrect penalty should be -8, got " + bad.points);
  console.log("incorrect blocking finding penalty:", bad.points, "(expected -8)");
  bad.map = null; bad.points = null;

  const out = exportTask1Md();
  if (!out.includes("Final score: **80/100**")) throw new Error("export final score wrong");
  if (!out.includes("| 8 | Static dictionary | 12 | 12 |")) throw new Error("export row wrong");
  console.log("task1 export OK, length", out.length);

  // task 2
  ["g1","g2","g3","b1","b2","b3"].forEach(id => state.task2.checks[id] = true);
  state.task2.penalty = -10;
  const r2 = computeTask2();
  console.log("task2 final:", r2.final, "(expected 10+30-10=30)");
  const out2 = exportTask2Md();
  if (!out2.includes("final result: **30/140**")) throw new Error("task2 export wrong");
  console.log("task2 export OK");
`, sandbox);
console.log("ALL OK");
