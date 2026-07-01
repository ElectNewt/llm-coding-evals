# LLM Eval Grader

A single-page grading cockpit for running the evaluations on screen. No build step, no server — open `index.html` in a browser (double-click works).

Everything you previously did across three tools happens in one window:

| Pane | What it does |
|------|--------------|
| LLM findings | Paste the model's raw review output; it is split into one card per finding. Clicking a card (or its filename pill) opens the PR diff in a modal, scrolled to that file. |
| Scoreboard | The 11 expected findings with their full explanations, the traps, and penalties, with the score updating live. |

The diff is fetched from the GitHub API on first use and cached in the browser afterwards. **View PR diff** in the findings header opens it without jumping to a file.

## Workflow (Task 1 — code review)

1. Type the model name in the top bar.
2. Click **Paste output…** and paste the model's raw markdown response.
3. Click any finding card to open the diff modal at the file it talks about (Esc or click outside to close).
4. For each finding card, use the **map to** dropdown:
   - map it to one of the 11 expected findings (points auto-fill; use **½** for partial/vague, or type a custom value),
   - mark it **Incorrect** (penalty auto-set from the severity the model claimed: -8/-5/-2),
   - mark it **AI slop** (-10 full, ½ gives -5),
   - mark it **Trap T1** or **Trap T2** (sets the corresponding -20 penalty),
   - or **Neutral / duplicate** (0 — duplicates of an already-scored root cause).
5. T2 and "Other" penalties are set manually in the scoreboard.
6. Click **Export .md** (download) or **Copy .md** — it produces the exact grading-worksheet markdown used in `2026.06/Evaluations/<model>/`.

Duplicates mapped to the same expected finding score once only (the max of the mapped points), matching the rubric.

## Task 2 — feature implementation

The second tab is the checklist from the task template with live scoring (gate section is all-or-nothing, behaviour and bonus items are 10 points each).

The model's changes live in the Distribt working copy (`C:\repos\Distribt`). After the model finishes, grab the diff and paste it via **Paste diff…**:

```powershell
cd C:\repos\Distribt
git add -A -N          # registers new files so they show up in the diff
git diff HEAD | clip   # puts the full diff on the clipboard
```

- The right pane shows a GitHub-style tree of the changed files (A/M/D/R status, +/− line counts, per-directory grouping).
- Clicking a file opens the same diff modal as Task 1, filtered to that file, with C# highlighting.
- **Export .md** downloads both the worksheet markdown and `task2_feature_implementation.patch` (the raw diff), ready to drop into `2026.06/Evaluations/<model>/`.

## Notes

- State is saved in `localStorage`, so a refresh mid-stream loses nothing. **Reset** clears the grading for the current model; do that (or export first) before grading the next model.
- The rubric (expected findings, points, traps, task 2 checklist, prompts, PR coordinates) lives in `rubric.js`. When a new benchmark version ships, update that file only.
- `test-parser.mjs` and `test-scoring.mjs` are Node smoke tests (`node test-parser.mjs`) that run the parser and scoring against the already-published eval files — useful when tweaking the parser for a new model's output format.
