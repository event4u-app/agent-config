<!-- evidence-type: analysis -->

# Ratification review — the design-consistency check on by default, and the dispatch bundle raise it needs — round 13

You are an independent reviewer for a change in the `event4u/agent-config` repository, branch `fix/design-consistency-false-alarms`.

subject: ad982b7c50595bbc8c7b0c0f8e66fc3d982bcd8e9702951992f89a8ce94247d3

The ratification gate covers `src/config/hook-bundle-budget.json`, the byte ceiling of `dist/hooks/dispatch.js`, the bundle every hook event loads. The digest above covers it at revision `f29b37a221`. This round is self-contained: it carries the whole change against `origin/main`, the evidence behind the default flip, and the activation conditions it was measured against.

## History

Every refusal named a real defect, fixed with a test seen red first where code changed; the round packets are committed beside this one. R1: `load()` outside the `try`. R2: size figures disagreed. R3: reverse trigger asserted, not operated (now a report, a procedure and step 3.9 due 2026-11-10). R4: rollback `enabled: false` stopped recording (now `shadow: true`). R5, R6: the role-map cache missed uncommitted primitives. R7: a stale figure. R8: a shadow row could not be classified later. R9: friction of condition 3 unmeasured. R10: the consistency-only path ran on any slot but `stop` (now `post_tool_use` by name); benefit of condition 3 unquantified (now an owner estimate of about 30 minutes per rework round, stated as an estimate). R11: `--shadow-report` printed an empty window and exited 0 on a missing or unreadable file (now exits 1 naming the gap); the recorded source line could miss a control late in a long line (now a 200-character window around it); p95 covered cache hits only, which exposed a recompute on every newly dirty file (the stamp now holds only files that define a primitive); the advisory ceiling was asserted, not shown (excerpt below).

- **Round 12 (2/2 refused)** named three points, all addressed. (a) The report validated rows only syntactically: a row with a non-date `at`, a negative count, a firing row without its findings or a malformed finding was counted. Each is now rejected with its reason (`not a row`, `` `at` is not a date ``, `` `file` is missing ``, `` `raw_control` is not a count ``, `a finding is malformed`, `a firing row without its findings`), listed by line, and the report exits 1; `--json` carries `rejected`. (b) With two controls of one tag on a line, both findings got the context of the first; occurrences now carry their column and each finding its own window. (c) Whole-event latency was not measured. Measuring it found a defect older than this change: run through the real dispatcher, `design-pass` received the dispatcher envelope, read no `tool_input` at its top level and returned before any check, so neither the consistency check nor the rest of the pass had ever run in-process. Every earlier test had started the hook directly with the raw host payload. Fixed with a dispatcher test seen red first ("through the dispatcher", `tests/hooks/design_consistency_default.test.ts`); of 10 hooks that read `tool_input`, the other 9 already unwrapped the envelope. The consumer-repository evidence below is unaffected: it called the chunk directly. Tests seen red first for (a) and (b): the semantic-rejection and two-controls-per-line cases in `tests/scripts/lint_design_consistency.test.ts`.
- **Since round 12** the branch merged `origin/main` again (base `1a552b83c5`, 529 commits). Main had meanwhile landed the same envelope unwrap in `design_pass_hook.ts` independently, and the shared chunk loader as `loadChunkExport`; the merge keeps both and this change adds the two parts main does not carry, the root from `workspace_root` and an absolute `file_path` made relative to it (`writtenPath`), and calls `loadChunkExport` from its own loader behind a guarded specifier. Every size figure is re-measured on that base. Whole-event latency is reported below as measured, including that p95 sits around the 250 ms budget on this machine rather than clearly inside it; the repository owner was shown that cost (about +55 ms median per UI-write event) and chose to accept it and proceed.

## What the change does

1. **Default flip.** New key `hooks.design_consistency.enabled`, default `true`, read independently of `hooks.design_pass.enabled` (still `false`). On a `post_tool_use` write to a UI surface, a raw `<select>`, `<input>` or `<textarea>` written where the project already has its own component is delivered as one advisory line (exit 2, `severity: advisory`, never a block). The box-metrics rule only appends a local shadow row. The repository owner asked for the flip in the session, conditional on the measurement meeting the activation policy.
2. **Code placement.** The check ships as a conditional chunk (42,974 B, own ceiling 45,000, registered in this change), required only on a UI write. The dispatch bundle gains the switch, the consistency-only path, a call site in the full pass, the root and path handling and the loader: measured 1,578,733 B against a base of 1,576,259 B (`origin/main` 1a552b83c5), +2,474 B, under a new ceiling of 1,579,000 B (base ceiling 1,578,600, which the change exceeds by 133 B).

## The activation conditions (`docs/contracts/concern-activation-policy.md`, § Flip)

All four must hold: (1) the failure is real and observed in the shadow log; (2) false positives at most 1 % of legitimate operations; (3) cost avoided exceeds friction imposed; (4) at least 100 observations or two weeks, including the targeted shape. A reverse trigger is mandatory: above tolerance in any two-week window returns the concern to shadow.

## What to answer

1. Is the raise justified by what it pays for, and is the `raise_log` entry accurate and internally consistent?
2. Does the failure contract of the conditional chunk hold: a missing, unreadable or throwing chunk or loader costs the finding and never the hook event?
3. Is the default flip bounded as described (advisory only, independent of `design_pass`, off by explicit `enabled: false`, no effect on non-UI writes or on any slot other than `post_tool_use`), and does the evidence below meet the four conditions?
4. Do you approve the gated content?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## Scope of the diff

`git diff -U0 origin/main...f29b37a221` for every source file under `src/`, to fit the 51,200-byte input ceiling. The tests and the bench script are on the branch and not shown; the new tests are named in the history above. Also omitted, and why: `docs/CLAIMS.md` and `docs/contracts/settings-classes.md` repeat the template wording and the counts; `dist/install/install.mjs` and `dist/agent-src/...control_roles.ts` are regenerated projections of files shown here; `docs/proof.md` and `internal/reports/exec-evidence-feasibility.json` are a regenerated proof page and a counter; the roadmap and the earlier round questions are records, not behaviour. Dropped this round to fit, with zero context lines throughout: the template copy of `control_roles.ts` (the same `column` change, held equal by `tests/scripts/control_roles_parity.test.ts`) and `src/config/agent-settings.template.yml` (the two keys with the wording of their schema descriptions, shown in `settings.ts`).

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

## First reading — the rule as it shipped in shadow

Over a wider file set (every edited markup file, including server templates
the hook never sees), the raw-control rule fired on 184 of 1,137 edits in A
(16.2 %) and on 47 of 1,144 in B (4.1 %). Every introduced finding was read by
hand. Five were the failure the rule exists for. The rest came from six
defects in the rule, not in the repositories:

1. A server template measured against a JSX component it cannot render.
2. Markup inside a comment or docblock read as an element.
3. A TypeScript type argument (`Meta<typeof Popover>`) read as an element.
4. A file input compared with the text-input primitive. A JSX arrow
   attribute (`=>`) also ended the tag before `type="file"` was read.
5. A primitive exported through an export list (`export { Textarea }`), or
   named `NativeSelect`, not recognised as the primitive.
6. A design handover prototype and an agent reference copy treated as
   product UI.

Each class now has a synthetic test in the shape of what fired, with a
positive control (`tests/scripts/lint_design_consistency.test.ts`).

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
     89 ms. Whole `post_tool_use` events, 2026-10-29, the shipped dispatch
     bundle spawned as the latency bench spawns it, the same kind of session
     (15 new files with two edits each and one primitive change, n = 47), the
     check on against the same session with it off, two runs on a laptop
     under other load: on p50 138 / 192 ms, p95 211 / 283 ms; off p50 100 /
     82 ms, p95 120 / 93 ms. In a cold process the check costs about 55 ms
     (porcelain status about 33 ms, `rev-parse` about 9 ms); the tail is the
     first UI write after HEAD moves, which recomputes the map. So the p95
     sits around the 250 ms budget of `src/config/hook-latency-budget.json`
     for a hook event on this machine, not clearly inside it; that budget is
     enforced on CI runners for a synthetic Read, which a UI write is not.
     Non-UI writes never load the chunk.
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
@@ -345 +345 @@ export function inputsDigest(files: ReadonlyArray<readonly [string, string]>): s
-function gitHead(cwd: string): string | null {
+export function gitHead(cwd: string): string | null {
@@ -394,0 +395,7 @@ function readPairs(projectRoot: string, target: string): { pairs: Array<readonly
+        const rel = path.relative(projectRoot, abs).split(path.sep).join('/');
+        // Every other file is read by its path alone (system markers), so its
+        // text is never opened: a vendor tree made a full read cost seconds.
+        if (!(isUiPath(rel) || isUiTreePath(rel) || /(^|\/)(components\.json|DESIGN\.md|PRODUCT\.md)$/.test(rel))) {
+            pairs.push([rel, '']);
+            continue;
+        }
@@ -397 +404 @@ function readPairs(projectRoot: string, target: string): { pairs: Array<readonly
-            pairs.push([path.relative(projectRoot, abs).split(path.sep).join('/'), fs.readFileSync(abs, 'utf8')]);
+            pairs.push([rel, fs.readFileSync(abs, 'utf8')]);
@@ -446 +453,5 @@ export function renderedBoxMetrics(projectRoot: string): Partial<Record<ControlR
-export function computeUiAudit(projectRoot: string, target: string): UiAuditArtefact {
+export function computeUiAudit(
+    projectRoot: string,
+    target: string,
+    onPairs?: (pairs: ReadonlyArray<readonly [string, string]>) => void,
+): UiAuditArtefact {
@@ -447,0 +459 @@ export function computeUiAudit(projectRoot: string, target: string): UiAuditArte
+    onPairs?.(pairs);
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 9010525d22..34919c424b 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -7 +7 @@
-    "max_bytes": 1578600,
+    "max_bytes": 1579000,
@@ -165,0 +166,9 @@
+        },
+        {
+            "date": "2026-10-27",
+            "from": 1578600,
+            "to": 1579000,
+            "by": "agent, fix/design-consistency-false-alarms (road-to-a-control-that-matches-its-neighbours 3.8)",
+            "what_was_added": "The consistency check turned on by default inside the in-bundle `design-pass` concern: the `hooks.design_consistency` switch read with a default of on, a narrow consistency-only path for installs where the rest of the pass stays off, the call that adds its findings when the whole pass is on, the `shadow` switch that keeps it recording without delivering (the rollback of the activation policy's reverse trigger, asked for by ratification round 4), and the loader of its conditional chunk. The check itself (`ui:audit`, the role parser, the rules and the shadow recorder) ships in `design_consistency.chunk.cjs`, required on a UI write alone. Measured 1,578,733 B with the change on a base of 1,576,259 B (origin/main 1a552b83c5, re-based on 2026-11-03 onto the raises above, both readings by this gate in clean worktrees): +2,474 B (Node 26.7.0, esbuild 0.28.1, Darwin arm64). esbuild is locked at 0.28.1 in package-lock.json, which is the version CI installs for this gate, so the figure moves only with a lockfile change; a lockfile bump that moves it is caught by this same gate.",
+            "why_it_could_not_be_avoided": "Room was made first: the chunk-require logic of `svg_rules_loader` became one shared function, which both loaders call (since 2026-11-03 the `loadChunkExport` origin/main extracted for the same purpose), taking the first measurement from +2,061 to +1,882 B; moving the loader call inside the failure boundary (ratification round 1) added 4 B, the `shadow` switch of round 4 added 169 B, the explicit `post_tool_use` gate of round 10 added 35 B, and reading the dispatcher envelope added 300 B (2,390 B on the 2026-10-29 base). That last fix was found when round 12 asked for whole-event latency: run through the real dispatcher, `design-pass` received the envelope, read no `tool_input` at its top level, and returned before any check. origin/main has since unwrapped the envelope in the same function independently; this change keeps that call and adds the two parts it does not carry, the root from `workspace_root` and an absolute `file_path` made relative to it (`writtenPath`), plus a guarded specifier in the consistency loader, for the +2,474 B above. Moving `design-pass` itself into a lazy chunk was considered and refused on the same trade the 2026-10-23 entry refused for `session-eol`: the concern is bound on every `post_tool_use`, so its body plus the slop registry would be required on every tool call of every install, against a switch that today returns in the bundle. What remains is the switch, the two call sites and the loader, which no chunk can carry because the concern that calls them is in the bundle. origin/main itself sits 2,341 bytes under its 1,578,600 ceiling, which this change exceeds by 133 bytes.",
+            "what_would_have_caught_it": "Nothing earlier: the base headroom is smaller than the change. Sized to the measurement plus 267 bytes of rebuild jitter."
@@ -180,0 +190,6 @@
+        {
+            "entry": "src/scripts/_lib/design_consistency_pass.ts",
+            "max_bytes": 45000,
+            "registered_at": "2026-10-27",
+            "derivation": "Measured 42,974 bytes on 2026-10-29: the consistency check `design-pass` runs on a UI write (the `ui:audit` computation, the control-role parser, the two consistency rules, the shadow recorder with the per-finding record ratification round 8 asked for, the uncommitted-primitive stamp of rounds 5 and 6, the shadow report's evidence check and row validation of rounds 11 and 12, which share the module, and the primitive-file list that keeps a newly dirty feature file from forcing a recompute; 36,545 B before those rounds). RAISED from 43,000 (39,896 B plus about 8 %) to 45,000, about 5 % over this reading, because the 43,000 ceiling had 26 B left: the chunk carries the linter module whole, its CLI included, since the module's own entry point keeps `main` reachable. Splitting the rules from the CLI would take that back out and is left for a later change. No growth is queued: no further consistency rule is planned, and the box-metrics rule already ships in it. Required on a UI write alone, so no other dispatch parses it; the bundle carries only its loader and two call sites, the 2026-10-27 raise of `max_bytes`. A missing or mis-digested chunk costs the consistency finding, never the event (`design_consistency_loader.ts`)."
+        },
diff --git a/src/scripts/_lib/control_roles.ts b/src/scripts/_lib/control_roles.ts
index fcbc20aea4..9019ba290f 100644
--- a/src/scripts/_lib/control_roles.ts
+++ b/src/scripts/_lib/control_roles.ts
@@ -35 +35 @@ const NAME: Record<ControlRole, string> = {
-    select: 'select|selectbox|listbox|native-select',
+    select: 'select|selectbox|listbox|native-?select',
@@ -71 +71,2 @@ const INPUT_TYPE_ROLE: Record<string, ControlRole> = {
-const INPUT_TYPES_NOT_A_CONTROL = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
+// `file` is a control, but no role here has a primitive to compare it with.
+const INPUT_TYPES_NOT_A_CONTROL = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);
@@ -77,0 +79,2 @@ export interface Occurrence {
+    /** Offset of the tag's `<` within its line. */
+    column: number;
@@ -82 +85,12 @@ export interface Occurrence {
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
@@ -115 +129,2 @@ export function roleOfTag(tag: string, attrs: string): ControlRole | null {
-    if (isNative && /\bpopover\b/i.test(attrs)) return 'popover';
+    // Case-sensitive on purpose: `Meta<typeof Popover>` is a type argument.
+    if (isNative && /(?:^|\s)popover(?=[\s=]|$)/.test(attrs)) return 'popover';
@@ -122 +137 @@ export function occurrences(text: string): Occurrence[] {
-    for (const m of text.matchAll(TAG_RE)) {
+    for (const m of blankComments(text).matchAll(TAG_RE)) {
@@ -127,0 +143 @@ export function occurrences(text: string): Occurrence[] {
+        const at = m.index ?? 0;
@@ -131 +147,2 @@ export function occurrences(text: string): Occurrence[] {
-            line: lineOf(text, m.index ?? 0),
+            line: lineOf(text, at),
+            column: at - text.lastIndexOf('\n', at - 1) - 1,
@@ -150,0 +168,7 @@ export function definedComponents(rel: string, text: string): string[] {
+    // `function Textarea(…) {…}` followed by `export { Textarea }`.
+    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
+        for (const part of m[1]!.split(',')) {
+            const name = part.trim().split(/\s+as\s+/).pop()!.trim();
+            if (/^[A-Z][A-Za-z0-9_]*$/.test(name)) out.push(name);
+        }
+    }
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
@@ -27,0 +28,5 @@ export const HOOK_CHUNKS = Object.freeze([
+    // Required by `design-pass` on a UI write alone (`design_consistency_loader.ts`).
+    Object.freeze({
+        entry: 'src/scripts/_lib/design_consistency_pass.ts',
+        outfile: 'dist/hooks/design_consistency.chunk.cjs',
+    }),
diff --git a/src/scripts/hooks/design_consistency_loader.ts b/src/scripts/hooks/design_consistency_loader.ts
new file mode 100644
index 0000000000..3ecf1723ec
--- /dev/null
+++ b/src/scripts/hooks/design_consistency_loader.ts
@@ -0,0 +1,34 @@
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
+import { isBundled, loadChunkExport } from './svg_rules_loader.js';
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
+    let specifier: string;
+    try {
+        specifier = consistencySpecifier(selfUrl, bundled);
+    } catch {
+        return null;
+    }
+    return loadChunkExport<ConsistencyPass>(selfUrl, specifier, 'consistencyPass', bundled);
+}
diff --git a/src/scripts/hooks/design_pass_hook.ts b/src/scripts/hooks/design_pass_hook.ts
index dea23b5204..8428fe38f1 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -96,0 +97 @@ import { readHookStdin } from './hook_stdin.js';
+import { loadConsistencyPass } from './design_consistency_loader.js';
@@ -134 +135 @@ export interface PassResult {
-export function enabled(root: string, key = 'design_pass'): boolean {
+export function enabled(root: string, key = 'design_pass', fallback = false, field = 'enabled'): boolean {
@@ -139 +140 @@ export function enabled(root: string, key = 'design_pass'): boolean {
-        return false;
+        return fallback;
@@ -158 +159 @@ export function enabled(root: string, key = 'design_pass'): boolean {
-            const m4 = /^ {4}enabled\s*:\s*(\S+)/.exec(line);
+            const m4 = new RegExp(`^ {4}${field}\\s*:\\s*(\\S+)`).exec(line);
@@ -162 +163,20 @@ export function enabled(root: string, key = 'design_pass'): boolean {
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
@@ -601,0 +622,8 @@ export function targetPath(payload: unknown): string | null {
+/** The written path relative to the project root; null when absent or outside it. */
+export function writtenPath(root: string, payload: unknown): string | null {
+    const t = targetPath(payload);
+    if (!t || !path.isAbsolute(t)) return t;
+    const rel = path.relative(root, t).split(path.sep).join('/');
+    return rel === '' || rel.startsWith('../') || path.isAbsolute(rel) ? null : rel;
+}
+
@@ -629,2 +657,11 @@ function main(): number {
-    const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
-    if (!enabled(root)) return EXIT_ALLOW;
+    // In-process the dispatcher hands an envelope; a direct run hands the host
+    // payload. Both carry the write in `payload`, and only the envelope the root.
+    const [envelope, payload] = unwrap(readHookStdin(), 'claude');
+    const ws = envelope['workspace_root'];
+    const root = typeof ws === 'string' && ws ? ws : (process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd());
+    // The consistency check ships ON (3.8); the rest of the pass ships OFF.
+    const pass = enabled(root);
+    const consistency = enabled(root, 'design_consistency', true);
+    // The reverse trigger's rollback: still recorded, never delivered.
+    const shadow = enabled(root, 'design_consistency', false, 'shadow');
+    if (!pass && !consistency) return EXIT_ALLOW;
@@ -634,5 +671,11 @@ function main(): number {
-
-    // Dispatched in-process, stdin is the dispatcher's envelope with the host
-    // payload under `payload`; a direct run gets the host payload itself.
-    // Unparsable stdin yields {}, which names no target: not a block.
-    const [, payload] = unwrap(readHookStdin(), 'claude');
+    // The manifest binds the post pass without `--slot`; any other slot name is not a write.
+    const post = slotArg === undefined || slotArg === 'post_tool_use';
+
+    if (!pass) {
+        const t = post ? writtenPath(root, payload) : null;
+        const only = t && isUiSurface(t) ? consistencyFor(root, t) : [];
+        if (!only.length || shadow) return EXIT_ALLOW;
+        const r: PassResult = { slot, findings: only, blocked: [], audit_missing: [], verification: 'verified' };
+        process.stdout.write(`${JSON.stringify({ reason: render(r) })}\n`);
+        return EXIT_WARN;
+    }
@@ -645 +688 @@ function main(): number {
-        const t = targetPath(payload);
+        const t = writtenPath(root, payload);
@@ -675,0 +719,5 @@ function main(): number {
+            // One shadow row per write: the stop pass re-reads the same files.
+            if (consistency && post && isUiSurface(rel)) {
+                const c = consistencyFor(root, rel);
+                if (!shadow) findings.push(...c);
+            }
diff --git a/src/scripts/lint_design_consistency.ts b/src/scripts/lint_design_consistency.ts
index 79fee4d3fa..cf24f56c26 100644
--- a/src/scripts/lint_design_consistency.ts
+++ b/src/scripts/lint_design_consistency.ts
@@ -22 +22,2 @@
- * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error. It runs in
+ * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error, and for
+ * --shadow-report also when the evidence is missing or incomplete. It runs in
@@ -28,0 +30 @@
+ *   npx tsx lint_design_consistency.ts --shadow-report [--days 14] [--json]   (the reverse trigger's reading)
@@ -33,0 +36 @@ import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
+import { isHandoverShape } from './_lib/ui_surface.js';
@@ -53,0 +57,9 @@ export const SHADOW_TOLERANCES_PX = [0, 2, 4] as const;
+/** What fired on a write, kept so it can be classified after the file has moved on. */
+export interface ShadowFinding {
+    rule: ConsistencyFinding['rule'];
+    line: number;
+    message: string;
+    /** The source line, trimmed, at most 200 characters around the control. */
+    context: string;
+}
+
@@ -59,0 +72,3 @@ export interface ShadowRecord {
+    findings?: ShadowFinding[];
+    /** The git HEAD the write was made on, when the caller knows it. */
+    head?: string | null;
@@ -68,0 +84,2 @@ export function shadowRecord(content: string, relPath: string, roles: ControlRol
+    const lines = content.split('\n');
+    const raw = all.filter((f) => f.rule === 'consistency-raw-control');
@@ -73 +90 @@ export function shadowRecord(content: string, relPath: string, roles: ControlRol
-        raw_control: all.filter((f) => f.rule === 'consistency-raw-control').length,
+        raw_control: raw.length,
@@ -74,0 +92,54 @@ export function shadowRecord(content: string, relPath: string, roles: ControlRol
+        findings: raw.map((f) => ({
+            rule: f.rule,
+            line: f.line,
+            message: f.message,
+            context: around(lines[f.line - 1] ?? '', f.column),
+        })),
+    };
+}
+
+/** At most 200 characters of the line, around this finding's own control. */
+function around(line: string, column: number | undefined): string {
+    if (line.trim().length <= 200) return line.trim();
+    const at = column ?? line.length - line.trimStart().length;
+    const start = Math.max(0, Math.min(at - 60, line.length - 200));
+    return line.slice(start, start + 200).trim();
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
@@ -79,0 +151,67 @@ export type ControlRoleMap = Partial<Record<ControlRole, RoleEntry>>;
+/** Why a parsed row cannot be read as evidence, or null when it can. */
+function rowDefect(v: unknown): string | null {
+    if (typeof v !== 'object' || v === null) return 'not a row';
+    const r = v as Partial<ShadowRecord>;
+    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return '`at` is not a date';
+    if (typeof r.file !== 'string' || r.file === '') return '`file` is missing';
+    if (typeof r.raw_control !== 'number' || !Number.isInteger(r.raw_control) || r.raw_control < 0) return '`raw_control` is not a count';
+    if (r.findings !== undefined) {
+        if (!Array.isArray(r.findings)) return 'a finding is malformed';
+        const ok = (f: unknown) => {
+            const x = f as Partial<ShadowFinding> | null;
+            return typeof x === 'object' && x !== null && typeof x.rule === 'string' && Number.isInteger(x.line) && typeof x.message === 'string' && typeof x.context === 'string';
+        };
+        if (!r.findings.every(ok)) return 'a finding is malformed';
+    }
+    if (r.raw_control > 0 && (r.findings?.length ?? 0) !== r.raw_control) return 'a firing row without its findings';
+    return null;
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
+    const rejected: Array<{ line: number; reason: string }> = [];
+    text.split('\n').forEach((l, i) => {
+        if (l.trim() === '') return;
+        let v: unknown;
+        try {
+            v = JSON.parse(l);
+        } catch {
+            rejected.push({ line: i + 1, reason: 'not JSON' });
+            return;
+        }
+        const defect = rowDefect(v);
+        if (defect === null) rows.push(v as ShadowRecord);
+        else rejected.push({ line: i + 1, reason: defect });
+    });
+    const w = shadowWindow(rows, now, days);
+    const code = rejected.length > 0 ? 1 : 0;
+    if (json) {
+        const evidence = code === 0 ? 'complete' : 'incomplete';
+        return { out: `${JSON.stringify({ ...w, evidence, rejected_lines: rejected.map((x) => x.line), rejected }, null, 2)}\n`, code };
+    }
+    let out = `design-consistency shadow, ${w.days} days since ${w.since}: ${w.writes} UI write(s), ${w.firing} firing.\n`;
+    if (rejected.length > 0) {
+        out += `${rejected.length} row(s) rejected — the window is incomplete; read those rows before classifying:\n`;
+        for (const x of rejected) out += `  line ${x.line}: ${x.reason}\n`;
+    }
+    for (const f of w.firings) {
+        out += `  ${f.at}  ${f.file}${f.head ? `  @${f.head.slice(0, 10)}` : ''}\n`;
+        for (const x of f.findings) out += `      L${x.line}  ${x.message}\n      | ${x.context}\n`;
+    }
+    out += 'Classify each firing write as real or false; false / writes above 1 % returns the rule to shadow.\n';
+    return { out, code };
+}
+
@@ -86,0 +225,2 @@ export interface ConsistencyFinding {
+    /** Offset of the control's `<` within its line. */
+    column?: number;
@@ -106,0 +247,16 @@ export function loadControlRoles(artefactPath: string): ControlRoleMap | null {
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
@@ -116,0 +273 @@ export function consistencyFindings(
+    if (!isProductUi(relPath)) return [];
@@ -129 +286 @@ export function consistencyFindings(
-        if (!entry || entry.canonical === null) continue;
+        if (!entry || entry.canonical === null || !canRender(relPath, entry.canonical)) continue;
@@ -136,0 +294 @@ export function consistencyFindings(
+                column: o.column,
@@ -196,0 +355,5 @@ export function main(args: string[]): number {
+    if (args.includes('--shadow-report')) {
+        const r = shadowReport(path.resolve(SHADOW_REL), asOf(), Number(arg(args, '--days') ?? '14'), json);
+        process.stdout.write(r.out);
+        return r.code;
+    }
diff --git a/src/server/schemas/settings.ts b/src/server/schemas/settings.ts
index afd785a6db..dac82a4cbb 100644
--- a/src/server/schemas/settings.ts
+++ b/src/server/schemas/settings.ts
@@ -482,0 +483,8 @@ export const settingsSchema = z.object({
+        }).prefault({}),
+        design_consistency: z.object({
+            enabled: z.boolean().default(true).describe(
+                'Control consistency on a UI write (road-to-a-control-that-matches-its-neighbours 3.8). Default on, independent of design_pass. A raw select, input or textarea written where the project already has its own Select, Input or Textarea is delivered as one advisory line naming the project control; it never blocks. A file that cannot render the component (a server template, a handover prototype) is not measured. Turned on after a retroactive shadow window met all four conditions of the concern-activation policy. The box-metrics half stays in shadow: while this is enabled, every UI write adds a row to agents/runtime/state/design-consistency-shadow.jsonl and nothing is shown. Disabled, nothing runs and nothing is recorded.',
+            ),
+            shadow: z.boolean().default(false).describe(
+                'With design_consistency enabled, true keeps the check running and recording to the shadow log but delivers no finding. The rollback of the activation policy reverse trigger: the rule returns to measurable shadow rather than off.',
+            ),
```
