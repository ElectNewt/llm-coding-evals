/* LLM Eval Grader — single-page, no build step, state in localStorage. */
"use strict";

const STORAGE_KEY = "llm-eval-grader-" + RUBRIC.version;

/* ============================== state ============================== */

const defaultState = () => ({
  model: "",
  activeTab: "task1",
  task1: {
    raw: "",
    findings: [], // {raw, header, severity, category, file, location, cause, impact, map, points, note}
    penalties: {
      T1: { pts: 0, note: "" },
      T2: { pts: 0, note: "" },
      other: { pts: 0, note: "" },
    },
  },
  task2: { checks: {}, penalty: 0, diff: "" },
});

let state = loadState();
let diffFiles = null;   // task 1 PR files: [{filename, patch, status}]
let t2Files = [];       // task 2 diff files: [{filename, patch, status, adds, dels}]
let modalFiles = null;  // whatever the diff modal is currently showing
let pasteMode = "findings"; // what the paste modal parses: "findings" | "diff"

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* corrupted state -> start fresh */ }
  return defaultState();
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ============================== utils ============================== */

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2600);
}

function sevClass(sev) {
  const s = (sev || "").toLowerCase();
  if (s.includes("block")) return "sev-blocking";
  if (s.includes("import")) return "sev-important";
  if (s.includes("minor") || s.includes("nit") || s.includes("low")) return "sev-minor";
  return "sev-other";
}
function sevNorm(sev) {
  const s = (sev || "").toLowerCase();
  if (s.includes("block")) return "blocking";
  if (s.includes("import")) return "important";
  if (s.includes("minor") || s.includes("nit") || s.includes("low")) return "minor";
  return "default";
}

/* ============================== parser ============================== */

const FIELD_DEFS = [
  ["severity", "severity"],
  ["category", "category"],
  ["file", "file(?:name)?(?:s)?(?:\\s+and\\s+extension)?(?:\\s*\\/\\s*extension)?"],
  ["location", "location"],
  ["cause", "(?:one[- ]?line\\s+)?root\\s*cause"],
  ["impact", "impact"],
];
const fieldRegexes = FIELD_DEFS.map(([key, pat]) => ({
  key,
  re: new RegExp("^\\s*(?:[-*>•]\\s*)*(?:\\*\\*|__)?\\s*(?:" + pat + ")\\s*(?:\\*\\*|__)?\\s*[:\\-–—]\\s*(.*)$", "i"),
}));
const anyFieldRe = new RegExp(
  "^\\s*(?:[-*>•]\\s*)*(?:\\*\\*|__)?\\s*(?:severity|category|file(?:name)?|location|(?:one[- ]?line\\s+)?root\\s*cause|impact)\\s*(?:\\*\\*|__)?\\s*[:\\-–—]", "i");
const sevLineRe = new RegExp("^\\s*(?:[-*>•]\\s*)*(?:\\*\\*|__)?\\s*severity\\b", "i");
const findingHeaderRe = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:finding|issue|bug)\b.{0,40}$|^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*\d{1,2}[.)]\s/i;

function parseFindings(text) {
  let t = text.trim();
  // strip a wrapping code fence if the whole thing was pasted fenced
  t = t.replace(/^```[a-zA-Z]*\r?\n/, "").replace(/\r?\n```\s*$/, "");
  const lines = t.split(/\r?\n/);

  // 1) split into blocks on separator lines (--, ---, ***, ___)
  let blocks = [];
  let cur = [];
  for (const line of lines) {
    if (/^\s*(?:[-—]{2,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(cur.join("\n"));
      cur = [];
    } else {
      cur.push(line);
    }
  }
  blocks.push(cur.join("\n"));
  blocks = blocks.map((b) => b.trim()).filter(Boolean);

  // 2) blocks that contain several "Severity:" lines get split further
  const split = [];
  for (const b of blocks) {
    const ls = b.split("\n");
    const sevIdx = [];
    ls.forEach((l, i) => { if (sevLineRe.test(l)) sevIdx.push(i); });
    if (sevIdx.length <= 1) { split.push(b); continue; }
    const starts = sevIdx.map((i) =>
      (i > 0 && findingHeaderRe.test(ls[i - 1]) && !anyFieldRe.test(ls[i - 1])) ? i - 1 : i);
    if (starts[0] > 0) split.push(ls.slice(0, starts[0]).join("\n"));
    for (let k = 0; k < starts.length; k++) {
      split.push(ls.slice(starts[k], k + 1 < starts.length ? starts[k + 1] : ls.length).join("\n"));
    }
  }

  // 3) extract fields per block
  const findings = [];
  for (const b of split.map((x) => x.trim()).filter(Boolean)) {
    const ls = b.split("\n");
    const f = { raw: b, header: "", severity: "", category: "", file: "", location: "", cause: "", impact: "" };
    let currentKey = null;
    let sawField = false;
    for (const line of ls) {
      let matched = false;
      for (const { key, re } of fieldRegexes) {
        const m = line.match(re);
        if (m) {
          f[key] = m[1].trim();
          currentKey = key;
          sawField = true;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const clean = line.trim();
        if (!clean) { currentKey = null; continue; }
        if (currentKey) f[currentKey] += " " + clean;
        else if (!sawField) f.header += (f.header ? " " : "") + clean;
      }
    }
    f.parsed = sawField;
    findings.push(f);
  }
  return findings;
}

/* ============================== unified diff parser (task 2) ============================== */

function parseUnifiedDiff(text) {
  const files = [];
  let cur = null;
  let inHunks = false;
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^diff --git (?:"?a\/(.+?)"?) (?:"?b\/(.+?)"?)$/);
    if (head) {
      cur = { filename: head[2], status: "modified", adds: 0, dels: 0, lines: [] };
      files.push(cur);
      inHunks = false;
      continue;
    }
    if (!cur) continue;
    if (!inHunks) {
      if (/^new file mode/.test(line)) cur.status = "added";
      else if (/^deleted file mode/.test(line)) cur.status = "deleted";
      else if (/^rename from /.test(line)) cur.status = "renamed";
      else if (/^rename to (.+)$/.test(line)) cur.filename = line.slice(10);
      else if (/^Binary files /.test(line)) cur.binary = true;
      else if (/^@@/.test(line)) { inHunks = true; cur.lines.push(line); }
      continue;
    }
    cur.lines.push(line);
    if (line[0] === "+") cur.adds++;
    else if (line[0] === "-") cur.dels++;
  }
  return files
    .map((f) => ({ filename: f.filename, status: f.status, adds: f.adds, dels: f.dels, binary: f.binary, patch: f.lines.join("\n") }))
    .filter((f) => f.patch || f.binary);
}

/* ============================== grading model ============================== */

function findingDefaultPoints(f) {
  if (typeof f.map === "number") {
    const exp = RUBRIC.task1.expected.find((e) => e.id === f.map);
    return exp ? exp.points : 0;
  }
  if (f.map === "incorrect") {
    const p = RUBRIC.task1.incorrectPenalty;
    return p[sevNorm(f.severity)] ?? p.default;
  }
  if (f.map === "slop") return RUBRIC.task1.slopPenalty;
  return 0;
}

function computeTask1() {
  const t1 = state.task1;
  const perExpected = {}; // id -> {awarded, findings: [idx]}
  let findingPenalties = 0;
  const penaltyDetails = [];

  t1.findings.forEach((f, idx) => {
    if (typeof f.map === "number") {
      const cur = perExpected[f.map] || { awarded: 0, findings: [], notes: [] };
      cur.awarded = Math.max(cur.awarded, f.points ?? 0);
      cur.findings.push(idx + 1);
      if (f.note) cur.notes.push(f.note);
      perExpected[f.map] = cur;
    } else if (f.map === "incorrect" || f.map === "slop") {
      const pts = f.points ?? 0;
      findingPenalties += pts;
      penaltyDetails.push({ finding: idx + 1, pts, note: f.note || f.header || (f.cause || "").slice(0, 60) });
    }
  });

  const subtotal = RUBRIC.task1.expected.reduce((acc, e) => acc + (perExpected[e.id]?.awarded ?? 0), 0);
  const trapTotal = (t1.penalties.T1.pts || 0) + (t1.penalties.T2.pts || 0) + (t1.penalties.other.pts || 0);
  const penaltySubtotal = trapTotal + findingPenalties;
  const final = subtotal + penaltySubtotal;
  return { perExpected, subtotal, findingPenalties, penaltyDetails, penaltySubtotal, final };
}

function computeTask2() {
  const t2 = RUBRIC.task2;
  const c = state.task2.checks;
  const gateOk = t2.gate.items.every((i) => c[i.id]);
  const gatePts = gateOk ? t2.gate.points : 0;
  const behPts = t2.behaviour.items.reduce((a, i) => a + (c[i.id] ? t2.behaviour.pointsEach : 0), 0);
  const bonusPts = t2.bonus.items.reduce((a, i) => a + (c[i.id] ? t2.bonus.pointsEach : 0), 0);
  const penalty = Number(state.task2.penalty) || 0;
  return { gateOk, gatePts, behPts, bonusPts, penalty, final: gatePts + behPts + bonusPts + penalty };
}

/* ============================== render: findings ============================== */

function mapLabel(map) {
  if (typeof map === "number") {
    const e = RUBRIC.task1.expected.find((x) => x.id === map);
    return `#${map} ${e.short}`;
  }
  if (map === "T1") return "Trap T1";
  if (map === "T2") return "Trap T2";
  if (map === "incorrect") return "Incorrect";
  if (map === "slop") return "Slop";
  if (map === "ignore") return "Ignored";
  return "";
}

function renderFindings() {
  const list = $("#findings-list");
  const fs = state.task1.findings;
  $("#finding-count").textContent = fs.length ? `(${fs.length})` : "";

  if (!fs.length) {
    list.innerHTML = `<div class="empty-hint"><p>Paste the model's review output to begin.</p>
      <button id="btn-paste-2" class="primary">Paste output…</button></div>`;
    $("#btn-paste-2").addEventListener("click", () => openPasteModal("findings"));
    return;
  }

  list.innerHTML = fs.map((f, i) => {
    const graded = f.map !== null && f.map !== undefined;
    const gradeClass = !graded ? "" :
      typeof f.map === "number" ? "graded matched" :
      f.map === "ignore" ? "graded ignored" : "graded rejected";
    const isTrap = f.map === "T1" || f.map === "T2";
    const ptsChip = graded && f.map !== "ignore" && !isTrap
      ? `<span class="chip grade ${((f.points ?? 0) < 0) ? "neg" : ""}">${f.points > 0 ? "+" : ""}${f.points ?? 0} pts · ${esc(mapLabel(f.map))}</span>`
      : graded ? `<span class="chip grade ${isTrap ? "neg" : ""}">${esc(mapLabel(f.map))}</span>` : "";

    const fields = f.parsed ? `
      ${f.header ? `<div class="fc-field"><b>Hdr</b>${esc(f.header)}</div>` : ""}
      ${f.category ? `<div class="fc-field"><b>Cat</b>${esc(f.category)}</div>` : ""}
      ${f.location ? `<div class="fc-field"><b>Loc</b>${esc(f.location)}</div>` : ""}
      ${f.cause ? `<div class="fc-field"><b>Cause</b>${esc(f.cause)}</div>` : ""}
      ${f.impact ? `<div class="fc-field"><b>Impact</b>${esc(f.impact)}</div>` : ""}`
      : `<div class="fc-raw">${esc(f.raw)}</div>`;

    const expectedOpts = RUBRIC.task1.expected.map((e) =>
      `<option value="${e.id}" ${f.map === e.id ? "selected" : ""}>#${e.id} ${esc(e.short)} (+${e.points})</option>`).join("");

    return `<div class="finding-card ${sevClass(f.severity)} ${gradeClass}" data-idx="${i}">
      <div class="fc-top">
        <span class="fc-num">F${i + 1}</span>
        ${f.severity ? `<span class="chip ${sevClass(f.severity)}">${esc(f.severity.split(/[\s(/]/)[0])}</span>` : ""}
        ${f.file ? `<span class="fc-file" data-file="${esc(f.file)}">${esc(f.file)}</span>` : ""}
        ${ptsChip}
      </div>
      ${fields}
      <div class="fc-grade">
        <select class="map-select" data-idx="${i}">
          <option value="">— map to —</option>
          <optgroup label="Expected findings">${expectedOpts}</optgroup>
          <optgroup label="Negative">
            <option value="incorrect" ${f.map === "incorrect" ? "selected" : ""}>Incorrect finding (penalty)</option>
            <option value="slop" ${f.map === "slop" ? "selected" : ""}>AI slop (-10, ½ = -5)</option>
            <option value="T1" ${f.map === "T1" ? "selected" : ""}>Trap T1: duplicated event (-20)</option>
            <option value="T2" ${f.map === "T2" ? "selected" : ""}>Trap T2: bug-validating test (-20)</option>
          </optgroup>
          <option value="ignore" ${f.map === "ignore" ? "selected" : ""}>Neutral / duplicate (0)</option>
        </select>
        ${graded && f.map !== "ignore" && !isTrap ? `
          <button class="pts-btn full" data-idx="${i}">Full</button>
          <button class="pts-btn half" data-idx="${i}">½</button>
          <input type="number" class="pts-input" data-idx="${i}" value="${f.points ?? 0}" step="1">
        ` : ""}
        <input type="text" class="fc-note" data-idx="${i}" placeholder="note (goes to the export)" value="${esc(f.note || "")}">
      </div>
    </div>`;
  }).join("");

  // wire events
  list.querySelectorAll(".map-select").forEach((el) => el.addEventListener("change", (e) => {
    const f = state.task1.findings[+e.target.dataset.idx];
    const v = e.target.value;
    f.map = v === "" ? null : (isNaN(+v) ? v : +v);
    f.points = findingDefaultPoints(f);
    if (f.map === "T1" || f.map === "T2") {
      const trap = RUBRIC.task1.traps.find((t) => t.id === f.map);
      state.task1.penalties[f.map].pts = trap.points;
      if (!state.task1.penalties[f.map].note) state.task1.penalties[f.map].note = `Finding F${+e.target.dataset.idx + 1}`;
    }
    saveState(); renderFindings(); renderScoreboard();
  }));
  list.querySelectorAll(".pts-btn.full").forEach((el) => el.addEventListener("click", (e) => {
    const f = state.task1.findings[+e.target.dataset.idx];
    f.points = findingDefaultPoints(f);
    saveState(); renderFindings(); renderScoreboard();
  }));
  list.querySelectorAll(".pts-btn.half").forEach((el) => el.addEventListener("click", (e) => {
    const f = state.task1.findings[+e.target.dataset.idx];
    f.points = Math.round(findingDefaultPoints(f) / 2 * 10) / 10;
    saveState(); renderFindings(); renderScoreboard();
  }));
  list.querySelectorAll(".pts-input").forEach((el) => el.addEventListener("change", (e) => {
    const f = state.task1.findings[+e.target.dataset.idx];
    f.points = Number(e.target.value) || 0;
    saveState(); renderFindings(); renderScoreboard();
  }));
  list.querySelectorAll(".fc-note").forEach((el) => el.addEventListener("change", (e) => {
    state.task1.findings[+e.target.dataset.idx].note = e.target.value;
    saveState(); renderScoreboard();
  }));
  list.querySelectorAll(".fc-file").forEach((el) => el.addEventListener("click", (e) => {
    e.stopPropagation();
    openDiffModal(e.target.dataset.file);
  }));
  // clicking anywhere on a card (except its grading controls) opens the diff at that file
  list.querySelectorAll(".finding-card").forEach((el) => el.addEventListener("click", (e) => {
    if (e.target.closest(".fc-grade, select, input, button")) return;
    if (window.getSelection().toString()) return; // user is selecting text to read it aloud
    const f = state.task1.findings[+el.dataset.idx];
    openDiffModal(f.file || f.location || "");
  }));
}

/* ============================== render: scoreboard ============================== */

function renderScoreboard() {
  const r = computeTask1();
  const sb = $("#scoreboard");
  const t1 = state.task1;

  const rows = RUBRIC.task1.expected.map((e) => {
    const hit = r.perExpected[e.id];
    const awarded = hit?.awarded ?? 0;
    const cls = !hit ? "" : awarded >= e.points ? "hit" : "partial";
    const src = hit ? ` <span class="sb-src">(F${hit.findings.join(", F")})</span>` : "";
    return `<div class="sb-row ${cls}">
      <span class="sb-id">${e.id}</span>
      <span class="sb-desc">
        <span class="sb-title">${esc(e.short)}</span>${src}
        <span class="sb-where">${esc(e.where)}</span>
        <span class="sb-detail">${esc(e.detail)}</span>
      </span>
      <span class="sb-pts ${awarded > 0 ? "pos" : ""}">${awarded}<span class="max"> / ${e.points}</span></span>
    </div>`;
  }).join("");

  const trapRow = (key, trap) => {
    const p = t1.penalties[key];
    return `<div class="sb-row ${p.pts < 0 ? "trap-hit" : ""}">
      <span class="sb-id">${trap.id}</span>
      <span class="sb-desc">
        <span class="sb-title">${esc(trap.short)}</span>
        <span class="sb-detail">${esc(trap.detail)}</span>
        <input type="text" class="fc-note pen-note" data-pen="${key}" placeholder="note" value="${esc(p.note)}">
      </span>
      <span class="sb-pts"><input type="number" class="pts-input pen-pts" data-pen="${key}" value="${p.pts}" step="1" max="0" min="${trap.points}"></span>
    </div>`;
  };

  const findingPenRows = r.penaltyDetails.map((d) =>
    `<div class="sb-row trap-hit">
      <span class="sb-id">F${d.finding}</span>
      <span class="sb-desc">${esc(d.note || "incorrect finding")}</span>
      <span class="sb-pts">${d.pts}</span>
    </div>`).join("");

  sb.innerHTML = `
    <div class="sb-section-title">Expected findings</div>
    ${rows}
    <div class="sb-section-title">Traps &amp; manual penalties</div>
    ${trapRow("T1", RUBRIC.task1.traps[0])}
    ${trapRow("T2", RUBRIC.task1.traps[1])}
    <div class="sb-row ${t1.penalties.other.pts < 0 ? "trap-hit" : ""}">
      <span class="sb-id">Oth</span>
      <span class="sb-desc">
        <span class="sb-title">Other / random AI stuff</span>
        <input type="text" class="fc-note pen-note" data-pen="other" placeholder="note" value="${esc(t1.penalties.other.note)}">
      </span>
      <span class="sb-pts"><input type="number" class="pts-input pen-pts" data-pen="other" value="${t1.penalties.other.pts}" step="1" max="0"></span>
    </div>
    ${findingPenRows ? `<div class="sb-section-title">Incorrect findings</div>${findingPenRows}` : ""}
    <div class="sb-totals">
      <div class="row"><span>Subtotal</span><span>${r.subtotal} / ${RUBRIC.task1.maxScore}</span></div>
      <div class="row"><span>Penalties</span><span class="${r.penaltySubtotal < 0 ? "neg" : ""}">${r.penaltySubtotal}</span></div>
      <div class="row final"><span>Final</span><span>${r.final} / ${RUBRIC.task1.maxScore}</span></div>
    </div>`;

  sb.querySelectorAll(".pen-pts").forEach((el) => el.addEventListener("change", (e) => {
    t1.penalties[e.target.dataset.pen].pts = Number(e.target.value) || 0;
    saveState(); renderScoreboard();
  }));
  sb.querySelectorAll(".pen-note").forEach((el) => el.addEventListener("change", (e) => {
    t1.penalties[e.target.dataset.pen].note = e.target.value;
    saveState();
  }));

  updateBadge();
}

function updateBadge() {
  const badge = $("#score-badge");
  if (state.activeTab === "task1") {
    badge.textContent = `${computeTask1().final} / ${RUBRIC.task1.maxScore}`;
  } else {
    badge.textContent = `${computeTask2().final} / ${RUBRIC.task2.maxScore}`;
  }
}

/* ============================== diff ============================== */

async function loadDiff() {
  if (diffFiles) return true;
  const { owner, repo, number } = RUBRIC.pr;
  const cacheKey = `${STORAGE_KEY}-diff`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    diffFiles = JSON.parse(cached);
    return true;
  }
  toast("Fetching PR diff from GitHub…");
  try {
    const files = [];
    for (let page = 1; page <= 3; page++) {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`,
        { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const batch = await res.json();
      files.push(...batch);
      if (batch.length < 100) break;
    }
    diffFiles = files.map((f) => ({ filename: f.filename, patch: f.patch || "", status: f.status }));
    try { localStorage.setItem(cacheKey, JSON.stringify(diffFiles)); } catch (e) { /* too big for storage: skip cache */ }
    toast(`Loaded ${diffFiles.length} files`);
    return true;
  } catch (err) {
    toast("Diff fetch failed: " + err.message);
    return false;
  }
}

/* --- tiny C# highlighter (no external deps, works offline) --- */
const CS_KEYWORDS = new Set(("abstract as base bool break byte case catch char checked class const continue decimal default " +
  "delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int " +
  "interface internal is lock long namespace new null object operator out override params private protected public " +
  "readonly record ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try " +
  "typeof uint ulong unchecked unsafe ushort using var virtual void volatile while async await when where yield get set init " +
  "nameof global partial required scoped").split(" "));
const csTokenRe = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d[\d_]*(?:\.\d+)?[mMdDfFuUlL]{0,2}\b)|(\[[A-Za-z_][\w.]*(?:\(.*?\))?\])|([A-Za-z_]\w*)/gm;

function highlightCs(line) {
  let out = "";
  let last = 0;
  for (const m of line.matchAll(csTokenRe)) {
    out += esc(line.slice(last, m.index));
    const [full, comment, str, num, attr, ident] = m;
    if (comment) out += `<span class="tok-comment">${esc(comment)}</span>`;
    else if (str) out += `<span class="tok-str">${esc(str)}</span>`;
    else if (num) out += `<span class="tok-num">${esc(num)}</span>`;
    else if (attr) out += `<span class="tok-attr">${esc(attr)}</span>`;
    else if (ident) {
      const cls = CS_KEYWORDS.has(ident) ? "tok-kw" : /^[A-Z]/.test(ident) ? "tok-type" : null;
      out += cls ? `<span class="${cls}">${esc(ident)}</span>` : esc(ident);
    } else out += esc(full);
    last = m.index + full.length;
  }
  return out + esc(line.slice(last));
}

function renderPatch(patch, filename) {
  if (!patch) return `<div class="diff-code"><div class="diff-line ctx"><span class="ln"></span><span class="lc">(no textual diff)</span></div></div>`;
  const isCs = /\.cs$/i.test(filename || "");
  const hl = (s) => (isCs ? highlightCs(s) : esc(s));
  const out = [];
  let newLn = 0;
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
    if (hunk) {
      newLn = +hunk[1];
      out.push(`<div class="diff-line hunk">${esc(line)}</div>`);
      continue;
    }
    const c = line[0];
    const content = hl(line.slice(1));
    if (c === "+") {
      out.push(`<div class="diff-line add"><span class="ln">${newLn}</span><span class="lc">${content}</span></div>`);
      newLn++;
    } else if (c === "-") {
      out.push(`<div class="diff-line del"><span class="ln"></span><span class="lc">${content}</span></div>`);
    } else {
      out.push(`<div class="diff-line ctx"><span class="ln">${newLn}</span><span class="lc">${content}</span></div>`);
      newLn++;
    }
  }
  return `<div class="diff-code">${out.join("")}</div>`;
}

function renderDiff(files) {
  modalFiles = files;
  const view = $("#diff-view");
  view.innerHTML = files.map((f, i) =>
    `<div class="diff-file" id="diff-file-${i}" data-name="${esc(f.filename)}">
      <div class="diff-file-header">${esc(f.filename)} <span class="muted">(${esc(f.status)})</span></div>
      ${renderPatch(f.patch, f.filename)}
    </div>`).join("");

  const sel = $("#diff-file-select");
  sel.innerHTML = `<option value="all">All files</option>` +
    files.map((f, i) => `<option value="${i}">${esc(f.filename.split("/").pop())}</option>`).join("");
}

/* show a single file in the modal, or all of them */
function setDiffFilter(idx) {
  modalFiles.forEach((_, i) => {
    document.getElementById("diff-file-" + i).style.display =
      (idx === null || idx === i) ? "" : "none";
  });
  $("#diff-file-select").value = idx === null ? "all" : String(idx);
  $("#diff-view").scrollTop = 0;
}

async function openDiffModal(fileHint) {
  const ok = await loadDiff();
  if (!ok) return;
  renderDiff(diffFiles);
  $("#diff-pr-label").textContent = `PR #${RUBRIC.pr.number} ${RUBRIC.pr.owner}/${RUBRIC.pr.repo}`;
  $("#diff-modal").classList.remove("hidden");
  const idx = fileHint ? findDiffFile(fileHint) : null;
  if (fileHint && idx === null) toast("File not found in diff: " + fileHint);
  setDiffFilter(idx);
}

function openT2DiffModal(idx) {
  if (!t2Files.length) { toast("Paste the diff first"); return; }
  renderDiff(t2Files);
  $("#diff-pr-label").textContent = "Distribt working tree";
  $("#diff-modal").classList.remove("hidden");
  setDiffFilter(idx ?? null);
}

function closeDiffModal() {
  $("#diff-modal").classList.add("hidden");
}

function findDiffFile(nameHint) {
  const hint = (nameHint || "").toLowerCase();
  // the LLM "file" field may contain several names or extra prose; match any known basename
  let idx = modalFiles.findIndex((f) => hint.includes(f.filename.split("/").pop().toLowerCase()));
  if (idx < 0) idx = modalFiles.findIndex((f) => f.filename.toLowerCase().includes(hint.split(/[\s,/+]+/)[0]));
  return idx < 0 ? null : idx;
}

/* ============================== task 2: change tree ============================== */

const STATUS_LETTER = { added: "A", modified: "M", deleted: "D", renamed: "R" };

function buildTree(files) {
  const root = { dirs: new Map(), files: [] };
  files.forEach((f, idx) => {
    const parts = f.filename.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { dirs: new Map(), files: [] });
      node = node.dirs.get(parts[i]);
    }
    node.files.push({ ...f, idx, name: parts[parts.length - 1] });
  });
  return root;
}

function renderTreeNode(node, name, depth) {
  // compress single-child directory chains like GitHub does (a/b/c)
  let label = name;
  while (node.files.length === 0 && node.dirs.size === 1) {
    const [childName, child] = node.dirs.entries().next().value;
    label = label ? label + "/" + childName : childName;
    node = child;
  }
  let html = "";
  if (label) {
    html += `<div class="tree-dir" style="padding-left:${depth * 16}px">${esc(label)}/</div>`;
    depth++;
  }
  for (const [dirName, child] of [...node.dirs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    html += renderTreeNode(child, dirName, depth);
  }
  for (const f of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) {
    html += `<div class="tree-file" data-idx="${f.idx}" style="padding-left:${depth * 16}px" title="${esc(f.filename)}">
      <span class="tree-status st-${f.status}">${STATUS_LETTER[f.status] || "M"}</span>
      <span class="tree-name">${esc(f.name)}</span>
      <span class="tree-counts">${f.binary ? "bin" : `<span class="c-add">+${f.adds}</span> <span class="c-del">−${f.dels}</span>`}</span>
    </div>`;
  }
  return html;
}

function renderChangesTree() {
  const box = $("#changes-tree");
  $("#t2-file-count").textContent = t2Files.length ? `(${t2Files.length})` : "";
  if (!t2Files.length) {
    box.innerHTML = `<div class="empty-hint">
      <p>Paste the model's diff to see the change tree.<br><span class="muted">In C:\\repos\\Distribt: <code>git add -A -N; git diff HEAD | clip</code> (includes new files, then puts it on the clipboard)</span></p>
      <button id="btn-paste-diff-2" class="primary">Paste diff…</button>
    </div>`;
    $("#btn-paste-diff-2").addEventListener("click", () => openPasteModal("diff"));
    return;
  }
  const adds = t2Files.reduce((a, f) => a + f.adds, 0);
  const dels = t2Files.reduce((a, f) => a + f.dels, 0);
  box.innerHTML = `
    <div class="tree-summary">${t2Files.length} files changed
      <span class="c-add">+${adds}</span> <span class="c-del">−${dels}</span></div>
    <div class="tree">${renderTreeNode(buildTree(t2Files), "", 0)}</div>`;
  box.querySelectorAll(".tree-file").forEach((el) =>
    el.addEventListener("click", () => openT2DiffModal(+el.dataset.idx)));
}

/* ============================== task 2 ============================== */

function renderChecklist() {
  const t2 = RUBRIC.task2;
  const c = state.task2.checks;
  const r = computeTask2();

  const item = (i, section) => `
    <div class="cl-item ${c[i.id] ? "checked" : ""}">
      <input type="checkbox" id="cb-${i.id}" data-id="${i.id}" ${c[i.id] ? "checked" : ""}>
      <label for="cb-${i.id}">${esc(i.label)}${i.hint ? `<span class="hint">${esc(i.hint)}</span>` : ""}</label>
    </div>`;

  $("#checklist").innerHTML = `
    <div class="cl-section">
      <h3>${esc(t2.gate.title)} <span class="pts">${r.gateOk ? t2.gate.points : 0} / ${t2.gate.points} — all or nothing</span></h3>
      ${t2.gate.items.map(item).join("")}
    </div>
    <div class="cl-section">
      <h3>${esc(t2.behaviour.title)} <span class="pts">${r.behPts} / ${t2.behaviour.items.length * t2.behaviour.pointsEach} — ${t2.behaviour.pointsEach} each</span></h3>
      ${t2.behaviour.items.map(item).join("")}
    </div>
    <div class="cl-section">
      <h3>${esc(t2.bonus.title)} <span class="pts">${r.bonusPts} pts — ${t2.bonus.pointsEach} each</span></h3>
      ${t2.bonus.items.map(item).join("")}
    </div>
    <div class="cl-section">
      <h3>${esc(t2.penalty.title)} <span class="pts">${esc(t2.penalty.label)}</span></h3>
      <div class="cl-penalty">
        <input type="number" id="t2-penalty" value="${state.task2.penalty}" step="5" max="0" min="${t2.penalty.max}">
        <span class="muted">points deducted (negative)</span>
      </div>
    </div>
    <div class="sb-totals">
      <div class="row"><span>Gate</span><span>${r.gatePts}</span></div>
      <div class="row"><span>Behaviour</span><span>${r.behPts}</span></div>
      <div class="row"><span>Bonus</span><span>${r.bonusPts}</span></div>
      <div class="row"><span>Penalty</span><span class="${r.penalty < 0 ? "neg" : ""}">${r.penalty}</span></div>
      <div class="row final"><span>Final</span><span>${r.final} / ${t2.maxScore}</span></div>
    </div>`;

  document.querySelectorAll("#checklist input[type=checkbox]").forEach((el) =>
    el.addEventListener("change", (e) => {
      state.task2.checks[e.target.dataset.id] = e.target.checked;
      saveState(); renderChecklist(); updateBadge();
    }));
  $("#t2-penalty").addEventListener("change", (e) => {
    state.task2.penalty = Number(e.target.value) || 0;
    saveState(); renderChecklist(); updateBadge();
  });
}

/* ============================== export ============================== */

function exportTask1Md() {
  const r = computeTask1();
  const t1 = state.task1;
  const model = state.model || "[model]";

  const resultRows = RUBRIC.task1.expected.map((e) => {
    const hit = r.perExpected[e.id];
    const notes = hit ? [hit.notes.join("; "), hit.findings.length ? `from finding ${hit.findings.map((n) => "F" + n).join(", ")}` : ""].filter(Boolean).join(" — ") : "";
    return `| ${e.id} | ${e.short} | ${e.points} | ${hit?.awarded ?? 0} | ${notes} |`;
  }).join("\n");

  const penRows = [
    `| T1 | ${RUBRIC.task1.traps[0].short} | ${t1.penalties.T1.pts || 0} | ${t1.penalties.T1.note} |`,
    `| T2 | ${RUBRIC.task1.traps[1].short} | ${t1.penalties.T2.pts || 0} | ${t1.penalties.T2.note} |`,
    `| Other | any random AI thing | ${t1.penalties.other.pts || 0} | ${t1.penalties.other.note} |`,
    ...r.penaltyDetails.map((d) => `| Incorrect (F${d.finding}) | ${d.note || "incorrect finding"} | ${d.pts} |  |`),
  ].join("\n");

  return `# Code review for ${model}


- PR link: ${RUBRIC.pr.link}
- Date evaluated: ${new Date().toISOString().slice(0, 10)}
- Version evaluated: ${RUBRIC.version}

## LLM Interaction
### Prompt
\`\`\`
${RUBRIC.task1.prompt}
\`\`\`

### copy&paste LLM output:
\`\`\`
${t1.raw.trim()}
\`\`\`

## Result

| Expected finding # | Description | Max points | Awarded points | Notes |
|--------------------|-------------|-----------:|---------------:|-------|
${resultRows}

Subtotal: **${r.subtotal}/${RUBRIC.task1.maxScore}**

### Penalties

| Penalty reason | Description | Points deducted | Notes |
|----------------|-------------|----------------:|-------|
${penRows}

Penalty subtotal: **${r.penaltySubtotal}**



Final score: **${r.final}/${RUBRIC.task1.maxScore}**


## Cost (optional)
- time
- Tokens
 - Input
 - output
- monetary
`;
}

function exportTask2Md() {
  const t2 = RUBRIC.task2;
  const c = state.task2.checks;
  const r = computeTask2();
  const model = state.model || "[model]";
  const box = (id) => (c[id] ? "[x]" : "[ ]");

  return `# Feature implementation evaluation — ${model}

Add a feature in the Distribt project


## Prompt

\`\`\`
${t2.prompt}
\`\`\`

### LLM output

${state.task2.diff ? "The full change set is in [task2_feature_implementation.patch](./task2_feature_implementation.patch)." : "```\n```"}

## Does not break anything - all 3 are needed - 10 points
${t2.gate.items.map((i) => `- ${box(i.id)} ${i.label}`).join("\n")}

${r.gatePts} Points

## Behaviour - Implementation - (10 points each)
${t2.behaviour.items.map((i) => `- ${box(i.id)} ${i.label}${i.hint ? `\n - ${i.hint}` : ""}`).join("\n")}

${r.behPts} POINTS

## Bonus points - (10 points each)
${t2.bonus.items.map((i) => `- ${box(i.id)} ${i.label}`).join("\n")}

${r.bonusPts} Points

## Penalties - 10 points
- Random AI slop

${r.penalty} Points

final result: **${r.final}/${t2.maxScore}**
`;
}

function currentExport() {
  return state.activeTab === "task1"
    ? { md: exportTask1Md(), name: "task1_code_review_evaluation.md" }
    : { md: exportTask2Md(), name: "task2_feature_implementation.md" };
}

function downloadFile(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadExport() {
  const { md, name } = currentExport();
  const files = [{ name, content: md }];
  if (state.activeTab === "task2" && state.task2.diff.trim()) {
    files.push({ name: "task2_feature_implementation.patch", content: state.task2.diff });
  }
  for (const f of files) downloadFile(f.name, f.content, "text/plain");
  toast(`Downloaded ${files.map((f) => f.name).join(" + ")} — move to 2026.06/Evaluations/${state.model || "<model>"}/`);
}

async function copyExport() {
  const { md } = currentExport();
  try {
    await navigator.clipboard.writeText(md);
  } catch (e) {
    // clipboard API unavailable on file:// — fall back to a hidden textarea
    const ta = document.createElement("textarea");
    ta.value = md;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast("Markdown copied to clipboard");
}

/* ============================== paste modal ============================== */

function openPasteModal(mode) {
  pasteMode = mode || "findings";
  if (pasteMode === "diff") {
    $("#paste-title").textContent = "Paste the diff";
    $("#paste-desc").textContent = "Output of git diff run in C:\\repos\\Distribt after the model finished.";
    $("#paste-area").value = state.task2.diff || "";
  } else {
    $("#paste-title").textContent = "Paste LLM output";
    $("#paste-desc").textContent = "The raw markdown the model returned. It will be split into finding cards.";
    $("#paste-area").value = state.task1.raw || "";
  }
  $("#paste-modal").classList.remove("hidden");
  $("#paste-area").focus();
}
function closePasteModal() {
  $("#paste-modal").classList.add("hidden");
}
function doParse() {
  const text = $("#paste-area").value;
  if (!text.trim()) { toast("Nothing to parse"); return; }
  if (pasteMode === "diff") {
    const files = parseUnifiedDiff(text);
    if (!files.length) { toast("That doesn't look like git diff output (no 'diff --git' headers)"); return; }
    state.task2.diff = text;
    t2Files = files;
    saveState();
    closePasteModal();
    renderChangesTree();
    toast(`Parsed ${files.length} changed files`);
    return;
  }
  state.task1.raw = text;
  state.task1.findings = parseFindings(text).map((f) => ({ ...f, map: null, points: null, note: "" }));
  saveState();
  closePasteModal();
  renderFindings();
  renderScoreboard();
  toast(`Parsed ${state.task1.findings.length} blocks`);
}

/* ============================== tabs / init ============================== */

function switchTab(tab) {
  state.activeTab = tab;
  saveState();
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll("main.task").forEach((m) => m.classList.toggle("active", m.id === tab));
  updateBadge();
}

function resetCurrent() {
  if (!confirm("Clear all grading for the current model (both tasks)?")) return;
  const model = state.model;
  state = defaultState();
  state.model = model;
  saveState();
  init();
  toast("Grading cleared");
}

function init() {
  $("#rubric-version").textContent = RUBRIC.version;
  $("#model-name").value = state.model;
  renderFindings();
  renderScoreboard();
  renderChecklist();
  t2Files = state.task2.diff ? parseUnifiedDiff(state.task2.diff) : [];
  renderChangesTree();
  switchTab(state.activeTab);
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  $("#model-name").addEventListener("input", (e) => { state.model = e.target.value; saveState(); });
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  $("#btn-paste").addEventListener("click", () => openPasteModal("findings"));
  $("#btn-paste-diff").addEventListener("click", () => openPasteModal("diff"));
  $("#btn-parse").addEventListener("click", doParse);
  $("#btn-cancel-paste").addEventListener("click", closePasteModal);
  $("#btn-view-diff").addEventListener("click", () => openDiffModal());
  $("#btn-close-diff").addEventListener("click", closeDiffModal);
  $("#diff-modal").addEventListener("click", (e) => { if (e.target.id === "diff-modal") closeDiffModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDiffModal(); closePasteModal(); } });
  $("#diff-file-select").addEventListener("change", (e) => {
    setDiffFilter(e.target.value === "all" ? null : +e.target.value);
  });
  $("#btn-export").addEventListener("click", downloadExport);
  $("#btn-copy").addEventListener("click", copyExport);
  $("#btn-reset").addEventListener("click", resetCurrent);
});
