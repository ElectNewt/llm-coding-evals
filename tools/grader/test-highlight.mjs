// Smoke test for the C# highlighter.
import { readFileSync } from "fs";
import vm from "vm";

const sb = {
  console,
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null },
  navigator: {},
};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(readFileSync(new URL("./rubric.js", import.meta.url), "utf8"), sb);
vm.runInContext(readFileSync(new URL("./app.js", import.meta.url), "utf8"), sb);

const cases = [
  'if (previous == request.Price) return true; // cached "test"',
  'decimal finalPrice = request.Price * (100 - request.DiscountPercentage) / 100;',
  'private static readonly Dictionary<int, decimal> LastPublishedPrice = new();',
  '[HttpPut("updateprice/{id}")]',
  'var x = "a <b> & c";',
];
for (const line of cases) {
  const html = sb.highlightCs(line);
  console.log(html);
  if (html.includes("<b>")) throw new Error("unescaped HTML leaked");
}

// verify escaping: raw < > & inside code must come out escaped except our span tags
const out = sb.highlightCs('List<string> a = b < c && d > e; // <script>');
if (/<(?!\/?span)[a-z]/.test(out)) throw new Error("unescaped tag: " + out);
console.log("escape check OK");

// renderPatch picks the highlighter only for .cs files
const patch = "@@ -1,2 +1,3 @@\n context\n+var total = 42; // new\n-old line";
const cs = sb.renderPatch(patch, "Foo.cs");
const other = sb.renderPatch(patch, "Foo.csproj");
if (!cs.includes("tok-kw")) throw new Error("cs file not highlighted");
if (other.includes("tok-kw")) throw new Error("non-cs file was highlighted");
console.log("renderPatch language pick OK");
console.log("ALL OK");
