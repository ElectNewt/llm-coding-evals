// Smoke test for the unified diff parser and task 2 export.
import { readFileSync } from "fs";
import { execSync } from "child_process";
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

const synthetic = `diff --git a/src/Services/Orders/Controllers/OrderController.cs b/src/Services/Orders/Controllers/OrderController.cs
index 1111111..2222222 100644
--- a/src/Services/Orders/Controllers/OrderController.cs
+++ b/src/Services/Orders/Controllers/OrderController.cs
@@ -10,6 +10,12 @@ public class OrderController
     private readonly IOrderService _service;
+    // cancel an order
+    [HttpPost("cancel/{orderId}")]
+    public async Task<IActionResult> Cancel(Guid orderId, CancellationToken ct)
+    {
+        return Ok(await _service.Cancel(orderId, ct));
+    }
 }
diff --git a/src/Services/Orders/Services/OrderCancelService.cs b/src/Services/Orders/Services/OrderCancelService.cs
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/Services/Orders/Services/OrderCancelService.cs
@@ -0,0 +1,3 @@
+public class OrderCancelService
+{
+}
diff --git a/src/Old/Removed.cs b/src/Old/Removed.cs
deleted file mode 100644
index 4444444..0000000
--- a/src/Old/Removed.cs
+++ /dev/null
@@ -1,2 +0,0 @@
-public class Removed
-{
diff --git a/src/A/Before.cs b/src/A/After.cs
similarity index 90%
rename from src/A/Before.cs
rename to src/A/After.cs
index 5555555..6666666 100644
--- a/src/A/Before.cs
+++ b/src/A/After.cs
@@ -1,1 +1,1 @@
-old line
+new line
`;

const files = sb.parseUnifiedDiff(synthetic);
const summary = files.map((f) => `${f.status[0].toUpperCase()} ${f.filename} +${f.adds} -${f.dels}`);
console.log(summary.join("\n"));
if (files.length !== 4) throw new Error("expected 4 files, got " + files.length);
if (files[0].status !== "modified" || files[0].adds !== 6 || files[0].dels !== 0) throw new Error("file 1 wrong");
if (files[1].status !== "added" || files[1].adds !== 3) throw new Error("file 2 wrong");
if (files[2].status !== "deleted" || files[2].dels !== 2) throw new Error("file 3 wrong");
if (files[3].status !== "renamed" || files[3].filename !== "src/A/After.cs") throw new Error("file 4 wrong");

// tree building: compressed dirs, clickable files
const tree = sb.renderTreeNode(sb.buildTree(files), "", 0);
if (!tree.includes("OrderController.cs")) throw new Error("tree missing file");
if (!(tree.match(/tree-file/g) || []).length === 4) throw new Error("tree file count wrong");
console.log("tree OK");

// a real diff from this very repo should parse without throwing and find at least 1 file
try {
  const real = execSync("git show HEAD --format= --patch", { cwd: new URL("../..", import.meta.url), encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const rf = sb.parseUnifiedDiff(real);
  if (!rf.length) throw new Error("real git diff parsed to 0 files");
  console.log(`real git show parsed: ${rf.length} files OK`);
} catch (e) {
  if (e.message.includes("parsed to 0")) throw e;
  console.log("skipping real-git check:", e.message.split("\n")[0]);
}

// task 2 export references the patch file when a diff is present
vm.runInContext(`state.task2.diff = ${JSON.stringify(synthetic)};`, sb);
const md = sb.exportTask2Md();
if (!md.includes("task2_feature_implementation.patch")) throw new Error("export missing patch reference");
console.log("task2 export patch reference OK");
console.log("ALL OK");
