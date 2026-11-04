<!-- evidence-type: analysis -->

# Ratification review — the design-consistency check on by default, and the dispatch bundle raise it needs — round 12

You are an independent reviewer for a change in the `event4u/agent-config` repository, branch `fix/design-consistency-false-alarms`.

subject: 191f6e3ceb0df66a27c2ffa7b24ded9227fcef9b50101e01fb3f868441f513d3

The ratification gate covers `src/config/hook-bundle-budget.json`, the byte ceiling of `dist/hooks/dispatch.js`, the bundle every hook event loads. The digest above covers it at revision `2cadd383f1`. This round is self-contained: it carries the whole change against `origin/main`, the evidence behind the default flip, and the activation conditions it was measured against.

## History

Every refusal named a real defect, fixed with a test seen red first where code changed; the round packets are committed beside this one. R1: `load()` outside the `try`. R2: size figures disagreed. R3: reverse trigger asserted, not operated (now a report, a procedure and step 3.9 due 2026-11-10). R4: rollback `enabled: false` stopped recording (now `shadow: true`). R5, R6: the role-map cache missed uncommitted primitives. R7: a stale figure. R8: a shadow row could not be classified later. R9: friction of condition 3 unmeasured. R10: the consistency-only path ran on any slot but `stop` (now `post_tool_use` by name); benefit of condition 3 unquantified (now an owner estimate of about 30 minutes per rework round, stated as an estimate).

- **Round 11 (2/2 refused)** named one blocker and three further points, all addressed. (a) Blocker: `--shadow-report` read the file and parsed every row inside one `try`, so a missing or unreadable file or one malformed row printed an empty window and exited 0. It now exits 1 and names the gap (no file, unreadable, or rejected rows listed by line, valid rows still counted; `--json` carries `evidence` and `rejected_lines`). (b) The recorded source line was its first 200 characters, which can miss a control late in a long JSX line; it is now a 200-character window around the control. (c) The p95 covered cache hits only. That exposed a real cost: the cache stamp held every dirty UI file, so the first write to each new file recomputed the map. The stamp now holds only files that define a primitive now or did at the last compute, and a mixed session is timed below. (d) The advisory ceiling was asserted, not shown; the dispatcher excerpt follows. Tests seen red first: five on the report and the context window (`tests/scripts/lint_design_consistency.test.ts`) and "a new feature file becoming dirty reuses the cached map" (`tests/hooks/design_consistency_default.test.ts`); "a primitive file losing its primitive still recomputes" was shown to fail with the primitive-file rule neutralised. Also: the branch merged `origin/main` (two other raises had landed), so the base and every size figure are re-measured on it.

## What the change does

1. **Default flip.** New key `hooks.design_consistency.enabled`, default `true`, read independently of `hooks.design_pass.enabled` (still `false`). On a `post_tool_use` write to a UI surface, a raw `<select>`, `<input>` or `<textarea>` written where the project already has its own component is delivered as one advisory line (exit 2, `severity: advisory`, never a block). The box-metrics rule only appends a local shadow row. The repository owner asked for the flip in the session, conditional on the measurement meeting the activation policy.
2. **Code placement.** The check ships as a conditional chunk (42,002 B, own ceiling 43,000, registered in this change), required only on a UI write. The dispatch bundle gains the switch, the consistency-only path, a call site in the full pass and the loader: measured 1,559,918 B against a base of 1,557,828 B (`origin/main` d3d5d8dbd4), +2,090 B, under a new ceiling of 1,560,010 B (base ceiling 1,557,900).

## The activation conditions (`docs/contracts/concern-activation-policy.md`, § Flip)

All four must hold: (1) the failure is real and observed in the shadow log; (2) false positives at most 1 % of legitimate operations; (3) cost avoided exceeds friction imposed; (4) at least 100 observations or two weeks, including the targeted shape. A reverse trigger is mandatory: above tolerance in any two-week window returns the concern to shadow.

## What to answer

1. Is the raise justified by what it pays for, and is the `raise_log` entry accurate and internally consistent?
2. Does the failure contract of the conditional chunk hold: a missing, unreadable or throwing chunk or loader costs the finding and never the hook event?
3. Is the default flip bounded as described (advisory only, independent of `design_pass`, off by explicit `enabled: false`, no effect on non-UI writes or on any slot other than `post_tool_use`), and does the evidence below meet the four conditions?
4. Do you approve the gated content?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## Scope of the diff

`git diff -U1 origin/main...2cadd383f1` for every source file under `src/`, to fit the 51,200-byte input ceiling. The tests and the bench script are on the branch and not shown; the new tests are named in the history above. Also omitted, and why: `docs/CLAIMS.md` and `docs/contracts/settings-classes.md` repeat the template wording and the counts; `dist/install/install.mjs` and `dist/agent-src/...control_roles.ts` are regenerated projections of files shown here; `docs/proof.md` and `internal/reports/exec-evidence-feasibility.json` are a regenerated proof page and a counter; the roadmap and the earlier round questions are records, not behaviour.

## The advisory ceiling, as the dispatcher enforces it

`src/scripts/hook_manifest.yaml` declares `design-pass` with `severity: advisory` and `fail_closed: false` on both of its bindings. `src/scripts/hooks/dispatch_hook.ts`, after a concern returns:

```ts
    // P0.2 severity ceiling: an advisory concern can never block, on any host.
    // This covers BOTH the concern emitting EXIT_BLOCK directly and the
    // fail_closed promotion above turning a crash into a block.
    if (rc === EXIT_BLOCK && _is_advisory(concern)) {
      process.stderr.write(/* ... downgraded to warn */);
      rc = EXIT_WARN;
    }
```

## Evidence for the default flip

# Design consistency — the retroactive shadow window

The reading behind step 3.8 of `road-to-a-control-that-matches-its-neighbours`:
turning the consistency check on by default. Aggregates only. The rows name
files and commits of two private consumer repositories, so they stay local;
the repositories are not named here.

## The window

Six months of history of two consumer repositories, replayed with
`internal/bench/design-consistency/run.ts` on 2026-10-27. Every commit that
wrote a UI surface is replayed as the `design-pass` hook would have seen the
write: the role map from the tree at that commit, the written file at that
commit. This is a retroactive window, not a live one. The owner chose it
(2026-10-27) to reach the policy's sample floor in one session, and the live
recorder keeps the window open from here on.

| Repository | Shape | UI writes | Commits |
|---|---|---:|---:|
| A | server-rendered application with a React island | 250 | 143 |
| B | React monorepo with a component library | 1,315 | 215 |
| **Total** | | **1,565** | **358** |

## First reading

The rule as it shipped in shadow fired on 16.2 % and 4.1 % of edits over a wider file set. Five findings were real; the rest came from six rule defects, each now fixed with a test (listed in the committed evidence file).

## The four conditions

The same window, with the six defects fixed, against
`docs/contracts/concern-activation-policy.md`:

1. **The failure is real and observed.** Five writes in B carried a raw
   control beside the project's own: two `<textarea>` in a feature view
   (three writes of that file) and three `<input>` in a login form (two
   writes). All five are kept by the fixed rule.
2. **False positives at most 1 %.** Three writes of one Storybook story that
   builds a fake field from a raw `<input>`: 3 of 1,560 legitimate writes,
   **0.19 %**. Nothing fires in A.
3. **The economics favour it.** Friction and benefit, each measured where it
   can be:
   - *Latency on every UI write.* Timed on the shipped chunk (Darwin arm64).
     Cached map, 2026-10-27, n = 30: p50 111 ms and p95 118 ms, of which the
     porcelain status call is about 95 ms in this package's own tree and about
     25 ms in the larger consumer repository B. The map is recomputed only
     when HEAD moves or a dirty file gains, loses or changes a primitive
     (293 ms in this package's tree); a newly dirty feature file reuses it.
     Mixed session, 2026-10-29, every call timed: a scratch repository holding
     a copy of this package's `src/` and `docs/`, 20 new feature files with
     three edits each, one primitive change and one commit, n = 83: p50 40 ms,
     p95 44 ms, max 111 ms (the first call); the two recomputes took 94 and
     89 ms. Inside the 250 ms p95 budget of `src/config/hook-latency-budget.json`
     for a hook event. Non-UI writes never load the chunk.
   - *A false positive.* One advisory line of about 150 characters (about 40
     tokens), never a block: the concern is `severity: advisory`, which the
     dispatcher enforces as a ceiling. Its findings carry `design-pass`'s
     priority label P1; in that pass only a P0 can ever be reported as
     would-block, and only at `stop`, which this check does not run on.
     Three such lines in 1,560 legitimate writes.
   - *A missed raw control.* It is the failure this roadmap was opened for: a
     raw `<select>` reached review beside the project's own `Select`, and the
     correction was a further review and rework round. The owner of both
     repositories puts that round at **about 30 minutes** (owner estimate,
     2026-10-29; not timed). Five such writes were in the window.
   The trade, over the whole window of 1,565 UI writes: about 3 minutes of
   added hook latency (1,565 × 0.11 s) and about 120 tokens of false-positive
   noise, against up to five rework rounds of about 30 minutes each. The
   conservative bound assumes only one of the five would have reached review
   at all: 30 minutes saved against 3 minutes spent, a factor of ten. The
   benefit side rests on the owner's estimate, not a measurement. The
   reverse trigger below counts real findings in every window, and no fire
   in eight weeks opens a removal review, so a benefit that does not
   materialise live is caught on the same cadence as excess noise.
4. **The window is met.** 1,565 observations over six months, against a floor
   of 100 or two weeks, and the targeted shape is in it.

All four hold for **consistency-raw-control**, which ships on.

## What this does not establish

- **The box-metrics rule has no reading.** Not one comparison in 1,565 writes
  had a box metric on both sides. The static parser cannot read sizes that a
  component library sets through `cn()` or variants, so there is no legitimate
  distribution to derive a tolerance from. That rule stays in shadow. AC-2
  ("box deviation within the shadow tolerance") stays open until render-sourced
  metrics (`ui:render --interact`) produce a distribution.
- **0.19 % is in-sample.** The six fixes were found in this window and then
  measured on it, so the rate is an upper bound on what was seen rather than a
  forecast. The live recorder is the out-of-sample check: every UI write adds
  a row to `agents/runtime/state/design-consistency-shadow.jsonl`.
- **The reverse trigger is a manual control, not code.** A false positive
  needs a human reading, so no automated evaluator can apply the threshold.
  How it runs is stated below.
- **Two repositories, one owner.** Neither is a third-party corpus. A third
  repository would widen the sample, not change its kind.

## The reverse trigger

Per `docs/contracts/concern-activation-policy.md` § Reverse trigger, run as a
manual control because classifying a firing write as false takes a reading.

- **Owner.** The maintainer of this repository.
- **Cadence.** Every two weeks. The first review is due 2026-11-10 (step 3.9
  of `road-to-a-control-that-matches-its-neighbours`).
- **Reading.** In each project where the check runs, from the project root:
  `npx tsx <agent-config>/src/scripts/lint_design_consistency.ts --shadow-report --days 14`.
  It prints the UI writes in the window (the denominator) and then every
  firing write on its own: when, which file, the git HEAD it was made on, and
  per finding the line, the message and up to 200 characters of the source
  line around the control. It prints no rate, because it cannot tell a real
  finding from a false one. It exits 1 and says why when the evidence is not
  whole: no shadow file, an unreadable one, or rows it had to reject (listed
  by line, with the valid rows still counted). Such a window is read from
  those rows by hand before it is classified, never taken as clean.
- **Classification.** Read each firing write from what the row recorded, not
  from the file as it is now, and mark it real (a raw control beside the
  project's own) or false (anything else). The rate is false firing writes
  over all UI writes in the window.
- **Record.** One dated row in the roadmap's Decisions table: window,
  denominator, real, false, rate, outcome.
- **Rollback.** Above 1 %: set `hooks.design_consistency.shadow` to `true`
  in `src/config/agent-settings.template.yml` and as the default in
  `src/server/schemas/settings.ts`, in one PR. The rule then keeps running and
  recording on every UI write but delivers nothing, which is the shadow the
  policy returns it to, and the next window is measured the same way. An
  existing install does the same with `shadow: true` in its own
  `.agent-settings.yml`; `enabled: false` turns the check off entirely and
  stops the recording, so it is not the rollback. No fire in eight weeks
  opens a removal review instead.

## The cumulative diff

```diff
diff --git a/src/cli/commands/uiAudit.ts b/src/cli/commands/uiAudit.ts
index 289d9b331f..867691c4e0 100644
--- a/src/cli/commands/uiAudit.ts
+++ b/src/cli/commands/uiAudit.ts
@@ -344,3 +344,3 @@ export function inputsDigest(files: ReadonlyArray<readonly [string, string]>): s
 
-function gitHead(cwd: string): string | null {
+export function gitHead(cwd: string): string | null {
     try {
@@ -394,5 +394,12 @@ function readPairs(projectRoot: string, target: string): { pairs: Array<readonly
     for (const abs of absFiles) {
+        const rel = path.relative(projectRoot, abs).split(path.sep).join('/');
+        // Every other file is read by its path alone (system markers), so its
+        // text is never opened: a vendor tree made a full read cost seconds.
+        if (!(isUiPath(rel) || isUiTreePath(rel) || /(^|\/)(components\.json|DESIGN\.md|PRODUCT\.md)$/.test(rel))) {
+            pairs.push([rel, '']);
+            continue;
+        }
         try {
             if (fs.statSync(abs).size > 2_000_000) continue;
-            pairs.push([path.relative(projectRoot, abs).split(path.sep).join('/'), fs.readFileSync(abs, 'utf8')]);
+            pairs.push([rel, fs.readFileSync(abs, 'utf8')]);
         } catch {
@@ -445,4 +452,9 @@ export function renderedBoxMetrics(projectRoot: string): Partial<Record<ControlR
 /** Compute the artefact for `target` under `projectRoot`, stamped with git HEAD. */
-export function computeUiAudit(projectRoot: string, target: string): UiAuditArtefact {
+export function computeUiAudit(
+    projectRoot: string,
+    target: string,
+    onPairs?: (pairs: ReadonlyArray<readonly [string, string]>) => void,
+): UiAuditArtefact {
     const { pairs, unreadable } = readPairs(projectRoot, target);
+    onPairs?.(pairs);
     let artefact = buildArtefact(path.relative(projectRoot, target).split(path.sep).join('/') || '.', pairs);
diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index 30ba5cc011..69d9cded85 100644
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -1351,2 +1351,20 @@ hooks:
 
+  # Control consistency on a UI write (road-to-a-control-that-matches-its-
+  # neighbours 3.8). Default-ON, and independent of design_pass above: it runs
+  # when that is off. A raw <select>, <input> or <textarea> written where the
+  # project already has its own Select / Input / Textarea is delivered as one
+  # advisory line naming the project's control; it never blocks. A file that
+  # cannot render the component (a server template, a handover prototype) is
+  # not measured. Turned on after a retroactive shadow window met all four
+  # conditions of docs/contracts/concern-activation-policy.md. The second rule,
+  # box metrics, stays in shadow: its findings are only recorded, never shown.
+  # While this is enabled, every UI write adds a row to
+  # agents/runtime/state/design-consistency-shadow.jsonl.
+  # Disabled, nothing runs and nothing is recorded. shadow: true keeps the
+  # check running and recording but delivers nothing: the reverse trigger's
+  # rollback (internal/bench/corpora/design-consistency-shadow-window.md).
+  design_consistency:
+    enabled: true
+    shadow: false
+
   # PreToolUse UI-route nudge (road-to-frontend-skill-application Phase 4).
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 9fa01fce24..5a006bf674 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -6,3 +6,3 @@
     "review_by": "2027-10-01",
-    "max_bytes": 1557900,
+    "max_bytes": 1560010,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
@@ -119,2 +119,11 @@
             "why_it_could_not_be_avoided": "Room was made first and measured: the new patterns were merged into one alternation and the narrower `how many times (do|must|should) i` pattern, now subsumed, was removed (growth 1,274 B -> 1,128 B); the first-person precision fix the council asked for then added 50 B, for 1,178 B final. The detector runs in the `self-repair` concern on `user_prompt_submit`, which is inlined, not a lazy chunk; moving it into a chunk is a dispatcher change larger than this raise. The subject ships now because road-to-a-correction-that-is-heard AC-2 requires the record to name what a repeated correction was about. Re-based onto the 2026-10-28 intake-pass raise; ratified by AI council 2026-10-29 (agents/evidence/ratifications/hook-bundle-raise-20261029.md)."
+        },
+        {
+            "date": "2026-10-27",
+            "from": 1557900,
+            "to": 1560010,
+            "by": "agent, fix/design-consistency-false-alarms (road-to-a-control-that-matches-its-neighbours 3.8)",
+            "what_was_added": "The consistency check turned on by default inside the in-bundle `design-pass` concern: the `hooks.design_consistency` switch read with a default of on, a narrow consistency-only path for installs where the rest of the pass stays off, the call that adds its findings when the whole pass is on, the `shadow` switch that keeps it recording without delivering (the rollback of the activation policy's reverse trigger, asked for by ratification round 4), and the loader of its conditional chunk. The check itself (`ui:audit`, the role parser, the rules and the shadow recorder) ships in `design_consistency.chunk.cjs`, required on a UI write alone. Measured 1,559,918 B with the change on a base of 1,557,828 B (origin/main d3d5d8dbd4, re-based on 2026-10-29 onto the two raises above; first measured as 1,558,759 B on 1,556,669 B): +2,090 B either way (Node 26.7.0, esbuild 0.28.1, Darwin arm64). esbuild is locked at 0.28.1 in package-lock.json, which is the version CI installs for this gate, so the figure moves only with a lockfile change; a lockfile bump that moves it is caught by this same gate.",
+            "why_it_could_not_be_avoided": "Room was made first: the chunk-require logic of `svg_rules_loader` became one shared `chunkExport`, which both loaders call, taking the first measurement from +2,061 to +1,882 B; moving the loader call inside the failure boundary (ratification round 1) added 4 B, the `shadow` switch of round 4 added 169 B, and the explicit `post_tool_use` gate of round 10 added 35 B, for the final +2,090 B above. Moving `design-pass` itself into a lazy chunk was considered and refused on the same trade the 2026-10-23 entry refused for `session-eol`: the concern is bound on every `post_tool_use`, so its body plus the slop registry would be required on every tool call of every install, against a switch that today returns in the bundle. What remains is the switch, the two call sites and the loader, which no chunk can carry because the concern that calls them is in the bundle. The base sat 72 bytes under the ceiling after the 2026-10-29 raise above.",
+            "what_would_have_caught_it": "Nothing earlier: with 72 bytes of headroom any change to an in-bundle concern of this size trips the ceiling. Sized to the measured change plus 92 bytes, the margin the round-10 reading left; the round-4 `shadow` switch and the round-10 slot gate had spent 204 of the original 300."
         }
@@ -134,2 +143,8 @@
         },
+        {
+            "entry": "src/scripts/_lib/design_consistency_pass.ts",
+            "max_bytes": 43000,
+            "registered_at": "2026-10-27",
+            "derivation": "Measured 42,002 bytes on 2026-10-29: the consistency check `design-pass` runs on a UI write (the `ui:audit` computation, the control-role parser, the two consistency rules, the shadow recorder with the per-finding record ratification round 8 asked for, the uncommitted-primitive stamp of rounds 5 and 6, the shadow report's evidence check of round 11, which shares the module, and the primitive-file list that keeps a newly dirty feature file from forcing a recompute; 36,545 B before those rounds). The ceiling of 43,000 was set at 39,896 B plus about 8 % and leaves about 2 % now, with no growth queued: no further consistency rule is planned, and the box-metrics rule already ships in it. Required on a UI write alone, so no other dispatch parses it; the bundle carries only its loader and two call sites, the 2026-10-27 raise of `max_bytes`. A missing or mis-digested chunk costs the consistency finding, never the event (`design_consistency_loader.ts`)."
+        },
         {
diff --git a/src/scripts/_lib/control_roles.ts b/src/scripts/_lib/control_roles.ts
index fcbc20aea4..2290946333 100644
--- a/src/scripts/_lib/control_roles.ts
+++ b/src/scripts/_lib/control_roles.ts
@@ -34,3 +34,3 @@ export type ControlRole = (typeof CONTROL_ROLES)[number];
 const NAME: Record<ControlRole, string> = {
-    select: 'select|selectbox|listbox|native-select',
+    select: 'select|selectbox|listbox|native-?select',
     input: 'input|text-?field|text-?input',
@@ -70,3 +70,4 @@ const INPUT_TYPE_ROLE: Record<string, ControlRole> = {
 };
-const INPUT_TYPES_NOT_A_CONTROL = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
+// `file` is a control, but no role here has a primitive to compare it with.
+const INPUT_TYPES_NOT_A_CONTROL = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);
 
@@ -81,3 +82,14 @@ export interface Occurrence {
 
-const TAG_RE = /<([A-Za-z][\w:.-]*)([^<>]*?)\/?>/g;
+// `=>` is consumed whole: a JSX arrow attribute would otherwise end the tag
+// before a later `type="file"` is read.
+const TAG_RE = /<([A-Za-z][\w:.-]*)((?:=>|[^<>])*?)\/?>/g;
+
+/** Comments blanked, not removed: offsets and line numbers hold. */
+function blankComments(text: string): string {
+    const blank = (c: string) => c.replace(/[^\n]/g, ' ');
+    return text
+        .replace(/\/\*[^]*?\*\//g, blank)
+        .replace(/<!--[^]*?-->/g, blank)
+        .replace(/^[ \t]*\/\/.*$/gm, blank);
+}
 
@@ -114,3 +126,4 @@ export function roleOfTag(tag: string, attrs: string): ControlRole | null {
     }
-    if (isNative && /\bpopover\b/i.test(attrs)) return 'popover';
+    // Case-sensitive on purpose: `Meta<typeof Popover>` is a type argument.
+    if (isNative && /(?:^|\s)popover(?=[\s=]|$)/.test(attrs)) return 'popover';
     return null;
@@ -121,3 +134,3 @@ export function occurrences(text: string): Occurrence[] {
     const out: Occurrence[] = [];
-    for (const m of text.matchAll(TAG_RE)) {
+    for (const m of blankComments(text).matchAll(TAG_RE)) {
         const tag = m[1]!;
@@ -150,2 +163,9 @@ export function definedComponents(rel: string, text: string): string[] {
     for (const m of text.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/g)) out.push(m[1]!);
+    // `function Textarea(…) {…}` followed by `export { Textarea }`.
+    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
+        for (const part of m[1]!.split(',')) {
+            const name = part.trim().split(/\s+as\s+/).pop()!.trim();
+            if (/^[A-Z][A-Za-z0-9_]*$/.test(name)) out.push(name);
+        }
+    }
     return [...new Set(out)];
diff --git a/src/scripts/_lib/design_consistency_pass.ts b/src/scripts/_lib/design_consistency_pass.ts
new file mode 100644
index 0000000000..77b16feb84
--- /dev/null
+++ b/src/scripts/_lib/design_consistency_pass.ts
@@ -0,0 +1,141 @@
+/**
+ * The consistency check as the `design-pass` hook runs it on a UI write —
+ * road-to-a-control-that-matches-its-neighbours 3.8.
+ *
+ * Shipped as a conditional chunk (`hook_chunks.mjs`) and loaded only for a UI
+ * write, because the dispatch bundle every hook event parses has no room for
+ * `ui:audit` and the role parser (D11).
+ *
+ * Two postures in one call, per `docs/contracts/concern-activation-policy.md`:
+ *
+ *   consistency-raw-control      DELIVERED. A retroactive shadow window of
+ *                                1,565 UI writes met all four flip conditions
+ *                                (docs/CLAIMS.md `design-consistency-default-on`).
+ *   consistency-sibling-metrics  SHADOW. The same window read no box metric on
+ *                                either side of a single comparison, so it has
+ *                                no distribution to derive a tolerance from.
+ *
+ * Every call appends one shadow row, so the window keeps recording live.
+ */
+import { execFileSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { ARTEFACT_REL, computeUiAudit, gitHead, type UiAuditArtefact } from '../../cli/commands/uiAudit.js';
+import { consistencyFindings, SHADOW_REL, shadowRecord } from '../lint_design_consistency.js';
+import { definedComponents, roleOfTag } from './control_roles.js';
+import { isUiPath } from './ui_surface.js';
+
+export interface ConsistencyNotice {
+    line: number;
+    message: string;
+}
+
+const CACHE_REL = path.join('agents', 'runtime', 'state', 'design-consistency-roles.json');
+
+/**
+ * Every uncommitted UI file, with the control-role components it defines (an
+ * empty list included). Adding, removing or renaming a project primitive, and
+ * a file becoming dirty or clean, change it without moving HEAD. Null outside
+ * a git work tree.
+ */
+export function dirtyPrimitives(root: string): string[] | null {
+    let status: string;
+    try {
+        status = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
+            cwd: root,
+            encoding: 'utf8',
+            stdio: ['ignore', 'pipe', 'ignore'],
+        });
+    } catch {
+        return null;
+    }
+    const out: string[] = [];
+    const entries = status.split('\0');
+    for (let i = 0; i < entries.length; i++) {
+        const entry = entries[i]!;
+        // A rename or copy is followed by its source path, which carries no status.
+        if (/^[RC]/.test(entry)) i++;
+        const rel = entry.slice(3);
+        if (entry.length < 4 || !isUiPath(rel)) continue;
+        let text: string;
+        try {
+            text = fs.readFileSync(path.join(root, rel), 'utf8');
+        } catch {
+            out.push(`${rel}:removed`);
+            continue;
+        }
+        // Every dirty UI file enters, with an empty list too: a file that lost
+        // its last primitive must change the stamp as much as one that gained one.
+        out.push(`${rel}:${primitiveDefs(rel, text).join(',')}`);
+    }
+    return out.sort();
+}
+
+function primitiveDefs(rel: string, text: string): string[] {
+    return definedComponents(rel, text)
+        .filter((t) => roleOfTag(t, '') !== null)
+        .sort();
+}
+
+/**
+ * The cache key: HEAD plus the dirty files that define a primitive now or did
+ * when the map was last computed. A dirty file that never defined one cannot
+ * change which component a role resolves to except through usage drift, so it
+ * does not force a recompute.
+ */
+function stampOf(head: string | null, dirty: string[] | null, primitiveFiles: ReadonlySet<string>): string | null {
+    if (head === null || dirty === null) return null;
+    const kept = dirty.filter((e) => {
+        const i = e.lastIndexOf(':');
+        const defs = e.slice(i + 1);
+        return (defs !== '' && defs !== 'removed') || primitiveFiles.has(e.slice(0, i));
+    });
+    return `${head}|${kept.join(';')}`;
+}
+
+/**
+ * The role map, recomputed when HEAD moves or a dirty file gains, loses or
+ * changes a primitive. Not on every write: the content digest `ui:audit` uses
+ * would recompute on each one. The accepted bound is usage drift in
+ * uncommitted files — uses of an existing component that would shift which
+ * implementation is most used — which waits for the next stamp change.
+ */
+function roles(root: string, head: string | null): UiAuditArtefact['control_roles'] {
+    const cache = path.join(root, CACHE_REL);
+    const dirty = dirtyPrimitives(root);
+    try {
+        const c = JSON.parse(fs.readFileSync(cache, 'utf8')) as {
+            stamp?: string;
+            primitive_files?: string[];
+            control_roles?: UiAuditArtefact['control_roles'];
+        };
+        const stamp = stampOf(head, dirty, new Set(c.primitive_files ?? []));
+        if (stamp !== null && c.stamp === stamp && c.control_roles) return c.control_roles;
+    } catch {
+        // absent or unreadable: computed below
+    }
+    let primitiveFiles: string[] = [];
+    const fresh = computeUiAudit(root, root, (pairs) => {
+        primitiveFiles = pairs.filter(([rel, text]) => isUiPath(rel) && primitiveDefs(rel, text).length > 0).map(([rel]) => rel);
+    });
+    const stamp = stampOf(head, dirty, new Set(primitiveFiles));
+    fs.mkdirSync(path.dirname(cache), { recursive: true });
+    fs.writeFileSync(path.join(root, ARTEFACT_REL), `${JSON.stringify(fresh, null, 2)}\n`);
+    fs.writeFileSync(cache, `${JSON.stringify({ stamp, primitive_files: primitiveFiles, control_roles: fresh.control_roles })}\n`);
+    return fresh.control_roles;
+}
+
+export function consistencyPass(root: string, file: string, content: string): ConsistencyNotice[] {
+    const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
+    const head = gitHead(root);
+    const map = roles(root, head);
+    const shadow = path.join(root, SHADOW_REL);
+    fs.mkdirSync(path.dirname(shadow), { recursive: true });
+    // A live row is stamped with the wall clock on purpose; `asOf` would warn on every write.
+    const row = { ...shadowRecord(content, rel, map, new Date()), head };
+    fs.appendFileSync(shadow, `${JSON.stringify(row)}\n`);
+    return consistencyFindings(content, rel, map)
+        .filter((f) => f.rule === 'consistency-raw-control')
+        .map((f) => ({ line: f.line, message: f.message }));
+}
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 086ae575ac..3e980370a2 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -27,2 +27,7 @@ export const HOOK_CHUNKS = Object.freeze([
     Object.freeze({ entry: 'src/scripts/_lib/egress_engine.ts', outfile: 'dist/hooks/egress_engine.chunk.cjs' }),
+    // Required by `design-pass` on a UI write alone (`design_consistency_loader.ts`).
+    Object.freeze({
+        entry: 'src/scripts/_lib/design_consistency_pass.ts',
+        outfile: 'dist/hooks/design_consistency.chunk.cjs',
+    }),
     // `yaml` stays external here, alone among the chunks. Inlined it is
diff --git a/src/scripts/hooks/design_consistency_loader.ts b/src/scripts/hooks/design_consistency_loader.ts
new file mode 100644
index 0000000000..c6bf811620
--- /dev/null
+++ b/src/scripts/hooks/design_consistency_loader.ts
@@ -0,0 +1,28 @@
+/**
+ * Loads the consistency check (`_lib/design_consistency_pass.ts`) for a UI
+ * write — the conditional-chunk pattern of `svg_rules_loader.ts`, whose header
+ * carries the reasons: synchronous `require` because a concern is synchronous,
+ * a computed specifier so esbuild does not inline the module, the bundle's
+ * integrity check on the chunk, and null instead of a throw so a missing chunk
+ * costs the finding and never the dispatch.
+ */
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import type { ConsistencyNotice } from '../_lib/design_consistency_pass.js';
+import { chunkExport, isBundled } from './svg_rules_loader.js';
+
+export type ConsistencyPass = (root: string, file: string, content: string) => ConsistencyNotice[];
+
+export const CONSISTENCY_CHUNK = 'design_consistency.chunk.cjs';
+
+export function consistencySpecifier(selfUrl: string, bundled: boolean): string {
+    const self = fileURLToPath(selfUrl);
+    const dir = path.dirname(self);
+    if (bundled) return path.join(dir, CONSISTENCY_CHUNK);
+    return path.join(dir, '..', '_lib', `design_consistency_pass${self.endsWith('.ts') ? '.ts' : '.js'}`);
+}
+
+export function loadConsistencyPass(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): ConsistencyPass | null {
+    return chunkExport<ConsistencyPass>(consistencySpecifier(selfUrl, bundled), 'consistencyPass', selfUrl, bundled);
+}
diff --git a/src/scripts/hooks/design_pass_hook.ts b/src/scripts/hooks/design_pass_hook.ts
index ac732f7278..e0d564eb41 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -95,2 +95,3 @@ import { loadDesignContext, scanFile } from '../lint_design_slop.js';
 import { readHookStdin } from './hook_stdin.js';
+import { loadConsistencyPass } from './design_consistency_loader.js';
 import { CHUNK_BASENAME, loadSvgScan } from './svg_rules_loader.js';
@@ -132,3 +133,3 @@ export interface PassResult {
 /** Minimal settings reader — mirrors design_slop_hook rather than adding a parser. */
-export function enabled(root: string, key = 'design_pass'): boolean {
+export function enabled(root: string, key = 'design_pass', fallback = false, field = 'enabled'): boolean {
     let text: string;
@@ -137,3 +138,3 @@ export function enabled(root: string, key = 'design_pass'): boolean {
     } catch {
-        return false;
+        return fallback;
     }
@@ -156,3 +157,3 @@ export function enabled(root: string, key = 'design_pass'): boolean {
         if (inKey) {
-            const m4 = /^ {4}enabled\s*:\s*(\S+)/.exec(line);
+            const m4 = new RegExp(`^ {4}${field}\\s*:\\s*(\\S+)`).exec(line);
             if (m4) return /^(true|yes|on)$/i.test(m4[1]!);
@@ -160,3 +161,22 @@ export function enabled(root: string, key = 'design_pass'): boolean {
     }
-    return false;
+    return fallback;
+}
+
+/** Raw-control findings for one UI file, from the conditional chunk. */
+export function consistencyFor(root: string, rel: string, load = loadConsistencyPass): Finding[] {
+    try {
+        const run = load();
+        if (!run) return [];
+        const abs = path.resolve(root, rel);
+        return run(root, rel, fs.readFileSync(abs, 'utf-8')).map((n) => ({
+            file: rel,
+            severity: 'P1',
+            catalogId: 'consistency',
+            rule: 'consistency-raw-control',
+            line: n.line,
+            message: n.message,
+        }));
+    } catch {
+        return [];
+    }
 }
@@ -628,3 +648,8 @@ function main(): number {
     const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
-    if (!enabled(root)) return EXIT_ALLOW;
+    // The consistency check ships ON (3.8); the rest of the pass ships OFF.
+    const pass = enabled(root);
+    const consistency = enabled(root, 'design_consistency', true);
+    // The reverse trigger's rollback: still recorded, never delivered.
+    const shadow = enabled(root, 'design_consistency', false, 'shadow');
+    if (!pass && !consistency) return EXIT_ALLOW;
 
@@ -632,2 +657,4 @@ function main(): number {
     const slot: PassResult['slot'] = slotArg === 'stop' ? 'stop' : 'post_tool_use';
+    // The manifest binds the post pass without `--slot`; any other slot name is not a write.
+    const post = slotArg === undefined || slotArg === 'post_tool_use';
 
@@ -639,2 +666,10 @@ function main(): number {
     }
+    if (!pass) {
+        const t = post ? targetPath(payload) : null;
+        const only = t && isUiSurface(t) ? consistencyFor(root, t) : [];
+        if (!only.length || shadow) return EXIT_ALLOW;
+        const r: PassResult = { slot, findings: only, blocked: [], audit_missing: [], verification: 'verified' };
+        process.stdout.write(`${JSON.stringify({ reason: render(r) })}\n`);
+        return EXIT_WARN;
+    }
 
@@ -676,2 +711,7 @@ function main(): number {
             }
+            // One shadow row per write: the stop pass re-reads the same files.
+            if (consistency && post && isUiSurface(rel)) {
+                const c = consistencyFor(root, rel);
+                if (!shadow) findings.push(...c);
+            }
             for (const f of scanFile(content, rel, ctx)) {
diff --git a/src/scripts/hooks/svg_rules_loader.ts b/src/scripts/hooks/svg_rules_loader.ts
index 836d728faf..1811d0b949 100644
--- a/src/scripts/hooks/svg_rules_loader.ts
+++ b/src/scripts/hooks/svg_rules_loader.ts
@@ -115,3 +115,14 @@ export function loadSvgScanUncached(
     try {
-        const specifier = rulesSpecifier(selfUrl, bundled);
+        return chunkExport<SvgScan>(rulesSpecifier(selfUrl, bundled), 'scanSvg', selfUrl, bundled);
+    } catch {
+        return null;
+    }
+}
+
+/**
+ * One function export of a chunk, or null. Shared by every conditional-chunk
+ * loader so the dispatch bundle carries this once.
+ */
+export function chunkExport<T>(specifier: string, name: string, selfUrl: string, bundled: boolean): T | null {
+    try {
         // The chunk runs inside the dispatch process, so it gets the bundle's
@@ -120,6 +131,4 @@ export function loadSvgScanUncached(
         if (bundled && verifyBundle(specifier).state === 'mismatch') return null;
-        const req = createRequire(selfUrl);
-        const mod = req(specifier) as Record<string, unknown>;
-        const scan = mod['scanSvg'];
-        return typeof scan === 'function' ? (scan as SvgScan) : null;
+        const fn = (createRequire(selfUrl)(specifier) as Record<string, unknown>)[name];
+        return typeof fn === 'function' ? (fn as T) : null;
     } catch {
diff --git a/src/scripts/lint_design_consistency.ts b/src/scripts/lint_design_consistency.ts
index 79fee4d3fa..778483be73 100644
--- a/src/scripts/lint_design_consistency.ts
+++ b/src/scripts/lint_design_consistency.ts
@@ -21,3 +21,4 @@
  *
- * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error. It runs in
+ * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error, and for
+ * --shadow-report also when the evidence is missing or incomplete. It runs in
  * shadow (road-to-a-control-that-matches-its-neighbours 3.3) until the
@@ -28,2 +29,3 @@
  *   npx tsx lint_design_consistency.ts --dir <ui src> --shadow   (records, prints nothing)
+ *   npx tsx lint_design_consistency.ts --shadow-report [--days 14] [--json]   (the reverse trigger's reading)
  */
@@ -33,2 +35,3 @@ import { asOf } from './_lib/as_of.js';
 import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
+import { isHandoverShape } from './_lib/ui_surface.js';
 
@@ -53,2 +56,11 @@ export const SHADOW_TOLERANCES_PX = [0, 2, 4] as const;
 
+/** What fired on a write, kept so it can be classified after the file has moved on. */
+export interface ShadowFinding {
+    rule: ConsistencyFinding['rule'];
+    line: number;
+    message: string;
+    /** The source line, trimmed, at most 200 characters around the control. */
+    context: string;
+}
+
 export interface ShadowRecord {
@@ -59,2 +71,5 @@ export interface ShadowRecord {
     deviations_px: number[];
+    findings?: ShadowFinding[];
+    /** The git HEAD the write was made on, when the caller knows it. */
+    head?: string | null;
 }
@@ -68,2 +83,4 @@ export function shadowRecord(content: string, relPath: string, roles: ControlRol
     }
+    const lines = content.split('\n');
+    const raw = all.filter((f) => f.rule === 'consistency-raw-control');
     return {
@@ -72,4 +89,59 @@ export function shadowRecord(content: string, relPath: string, roles: ControlRol
         would_fire,
-        raw_control: all.filter((f) => f.rule === 'consistency-raw-control').length,
+        raw_control: raw.length,
         deviations_px: all.flatMap((f) => (f.deviation_px === undefined ? [] : [f.deviation_px])),
+        findings: raw.map((f) => ({
+            rule: f.rule,
+            line: f.line,
+            message: f.message,
+            context: around((lines[f.line - 1] ?? '').trim(), f.message),
+        })),
+    };
+}
+
+/** A window of the line that keeps the control itself, however deep it sits. */
+function around(line: string, message: string): string {
+    if (line.length <= 200) return line;
+    const tag = /^raw (\w+)/.exec(message)?.[1];
+    const at = tag ? line.toLowerCase().indexOf(`<${tag}`) : -1;
+    const start = at < 0 ? 0 : Math.max(0, Math.min(at - 60, line.length - 200));
+    return line.slice(start, start + 200);
+}
+
+export interface ShadowWindow {
+    since: string;
+    days: number;
+    writes: number;
+    firing: number;
+    files: Array<{ file: string; firing_writes: number }>;
+    /** Every firing write in the window, one entry each, for classification. */
+    firings: Array<{ at: string; file: string; head: string | null; findings: ShadowFinding[] }>;
+}
+
+/**
+ * The live rows of the last `days`, as the reverse trigger reads them
+ * (`internal/bench/corpora/design-consistency-shadow-window.md` § The reverse
+ * trigger). Counts only: whether a firing write is a false positive is a
+ * human classification, so this never prints a rate.
+ */
+export function shadowWindow(rows: readonly ShadowRecord[], now: Date, days = 14): ShadowWindow {
+    const since = new Date(now.getTime() - days * 86_400_000);
+    const files = new Map<string, number>();
+    const firings: ShadowWindow['firings'] = [];
+    let writes = 0;
+    for (const r of rows) {
+        const at = Date.parse(r.at);
+        if (Number.isNaN(at) || at < since.getTime() || at > now.getTime()) continue;
+        writes++;
+        if (r.raw_control > 0) {
+            files.set(r.file, (files.get(r.file) ?? 0) + 1);
+            firings.push({ at: r.at, file: r.file, head: r.head ?? null, findings: r.findings ?? [] });
+        }
+    }
+    return {
+        since: since.toISOString(),
+        days,
+        writes,
+        firing: firings.length,
+        files: [...files].sort((a, b) => b[1] - a[1]).map(([file, firing_writes]) => ({ file, firing_writes })),
+        firings,
     };
@@ -79,2 +151,51 @@ export type ControlRoleMap = Partial<Record<ControlRole, RoleEntry>>;
 
+function isShadowRecord(v: unknown): v is ShadowRecord {
+    const r = v as Partial<ShadowRecord> | null;
+    return typeof r === 'object' && r !== null && typeof r.at === 'string' && typeof r.file === 'string' && typeof r.raw_control === 'number';
+}
+
+/**
+ * The reverse trigger's reading of one shadow file. Missing, unreadable or
+ * partly malformed evidence exits 1 and says so, so it can never be read as a
+ * clean window; valid rows beside a rejected one still count.
+ */
+export function shadowReport(file: string, now: Date, days: number, json: boolean): { out: string; code: number } {
+    let text: string;
+    try {
+        text = fs.readFileSync(file, 'utf8');
+    } catch (exc) {
+        const missing = (exc as NodeJS.ErrnoException).code === 'ENOENT';
+        const why = missing ? `no shadow file at ${file}: nothing was recorded, so there is no window to read` : `shadow file unreadable at ${file}: ${(exc as Error).message}`;
+        return { out: json ? `${JSON.stringify({ evidence: missing ? 'none' : 'unreadable', file, reason: why }, null, 2)}\n` : `${why}\n`, code: 1 };
+    }
+    const rows: ShadowRecord[] = [];
+    const rejected: number[] = [];
+    text.split('\n').forEach((l, i) => {
+        if (l.trim() === '') return;
+        try {
+            const v: unknown = JSON.parse(l);
+            if (isShadowRecord(v)) rows.push(v);
+            else rejected.push(i + 1);
+        } catch {
+            rejected.push(i + 1);
+        }
+    });
+    const w = shadowWindow(rows, now, days);
+    const code = rejected.length > 0 ? 1 : 0;
+    if (json) {
+        const evidence = code === 0 ? 'complete' : 'incomplete';
+        return { out: `${JSON.stringify({ ...w, evidence, rejected_lines: rejected }, null, 2)}\n`, code };
+    }
+    let out = `design-consistency shadow, ${w.days} days since ${w.since}: ${w.writes} UI write(s), ${w.firing} firing.\n`;
+    if (rejected.length > 0) {
+        out += `${rejected.length} row(s) rejected: lines ${rejected.join(', ')} — the window is incomplete; read those rows before classifying.\n`;
+    }
+    for (const f of w.firings) {
+        out += `  ${f.at}  ${f.file}${f.head ? `  @${f.head.slice(0, 10)}` : ''}\n`;
+        for (const x of f.findings) out += `      L${x.line}  ${x.message}\n      | ${x.context}\n`;
+    }
+    out += 'Classify each firing write as real or false; false / writes above 1 % returns the rule to shadow.\n';
+    return { out, code };
+}
+
 export interface ConsistencyFinding {
@@ -106,2 +227,18 @@ export function loadControlRoles(artefactPath: string): ControlRoleMap | null {
 
+/**
+ * Whether a file of this kind can render the canonical at all. A server
+ * template cannot use a JSX `Select`, nor a `.tsx` file a Blade `x-select`;
+ * measuring one against the other is a false alarm on every edit to it.
+ */
+export function canRender(relPath: string, canonical: string): boolean {
+    if (canonical.startsWith('native:')) return true;
+    if (canonical.startsWith('x-') || canonical.includes(':')) return /\.blade\.php$/i.test(relPath);
+    return /\.(jsx|tsx|vue|svelte|astro|mdx)$/i.test(relPath);
+}
+
+/** A design handover or an agent's reference copy is not the product's UI. */
+function isProductUi(relPath: string): boolean {
+    return !isHandoverShape(relPath) && !/(^|\/)agents\//.test(relPath.replace(/\\/g, '/'));
+}
+
 /**
@@ -116,2 +253,3 @@ export function consistencyFindings(
 ): ConsistencyFinding[] {
+    if (!isProductUi(relPath)) return [];
     const definesRole = new Set(
@@ -128,3 +266,3 @@ export function consistencyFindings(
         const entry = roles[o.role];
-        if (!entry || entry.canonical === null) continue;
+        if (!entry || entry.canonical === null || !canRender(relPath, entry.canonical)) continue;
 
@@ -196,2 +334,7 @@ export function main(args: string[]): number {
     const json = args.includes('--json');
+    if (args.includes('--shadow-report')) {
+        const r = shadowReport(path.resolve(SHADOW_REL), asOf(), Number(arg(args, '--days') ?? '14'), json);
+        process.stdout.write(r.out);
+        return r.code;
+    }
     const dir = path.resolve(arg(args, '--dir') ?? 'src');
```
