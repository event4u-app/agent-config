<!-- evidence-type: analysis -->

# Ratification review — the design-consistency check on by default, and the dispatch bundle raise it needs — round 3

You are an independent reviewer for a change in the `event4u/agent-config` repository, branch `fix/design-consistency-false-alarms`.

subject: c5a8571b36dd2193a0536be40c97f1a0b6906cbf586a447c3de4cd60e571a88a

The ratification gate covers `src/config/hook-bundle-budget.json`, the byte ceiling of `dist/hooks/dispatch.js`, the bundle every hook event loads. The digest above covers it at revision `c17e7f3c81`. This round is self-contained: it carries the whole change against `origin/main`, the evidence behind the default flip, and the activation conditions it was measured against.

## History

- Round 1 split. The refusing seat named `load()` outside the `try` in `consistencyFor`, a template comment that read as if recording ran while disabled, and missing toolchain and baseline notes in the `raise_log`. All four were fixed; the loader fix has a test seen red first.
- Round 2 split. The refusing seat found the two size figures in the `raise_log` inconsistent (+1,882 B and +1,886 B) and the toolchain note unbounded, and asked for the cumulative diff in the packet. Since then the entry marks +1,882 B as the pre-round-1 reading and states that esbuild is locked at 0.28.1 in `package-lock.json`, the version CI installs for this gate. This packet carries the cumulative diff.

## What the change does

1. **Default flip.** New key `hooks.design_consistency.enabled`, default `true`, read independently of `hooks.design_pass.enabled` (still `false`). On a `post_tool_use` write to a UI surface, a raw `<select>`, `<input>` or `<textarea>` written where the project already has its own component is delivered as one advisory line (exit 2, `severity: advisory`, never a block). The box-metrics rule only appends a local shadow row. The repository owner asked for the flip in the session, conditional on the measurement meeting the activation policy.
2. **Code placement.** The check ships as a conditional chunk (36,545 B, own ceiling 40,000), required only on a UI write. The dispatch bundle gains the switch, the consistency-only path, a call site in the full pass and the loader: measured 1,558,555 B against a base of 1,556,669 B, under a new ceiling of 1,558,850 B.

## The activation conditions (`docs/contracts/concern-activation-policy.md`, § Flip)

All four must hold: (1) the failure is real and observed in the shadow log; (2) false positives at most 1 % of legitimate operations; (3) cost avoided exceeds friction imposed; (4) at least 100 observations or two weeks, including the targeted shape. A reverse trigger is mandatory: above tolerance in any two-week window returns the concern to shadow.

## What to answer

1. Is the raise justified by what it pays for, and is the `raise_log` entry accurate and internally consistent?
2. Does the failure contract of the conditional chunk hold: a missing, unreadable or throwing chunk or loader costs the finding and never the hook event?
3. Is the default flip bounded as described (advisory only, independent of `design_pass`, off by explicit `enabled: false`, no effect on non-UI writes or on the `stop` slot when `design_pass` is off), and does the evidence below meet the four conditions?
4. Do you approve the gated content?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## Scope of the diff

`git diff -U1 origin/main...c17e7f3c81` for every source file under `src/`, the hook test and the bench script, to fit the 51,200-byte input ceiling. The parser and `ui:audit` tests appear as a `--stat`. Also omitted, and why: `docs/CLAIMS.md` and `docs/contracts/settings-classes.md` repeat the template wording and the counts; `dist/install/install.mjs` and `dist/agent-src/...control_roles.ts` are regenerated projections of files shown here; `docs/proof.md` and `internal/reports/exec-evidence-feasibility.json` are a regenerated proof page and a counter; the roadmap and the earlier round questions are records, not behaviour.

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
3. **The economics favour it.** The check never blocks: a false positive costs
   one advisory line, while a missed raw control costs a review round. This is
   the failure the roadmap was opened for.
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
- **The reverse trigger applies from day one.** Per the activation policy:
  false positives above 1 % in any two-week window return the rule to shadow,
  and no fire in eight weeks is reviewed for removal.
- **Two repositories, one owner.** Neither is a third-party corpus. A third
  repository would widen the sample, not change its kind.

## The cumulative diff

Tests of the parser and of `ui:audit` are listed by `--stat` only (they are on the branch); the end-to-end test of the default and of the failure contract is shown in full.

 tests/cli/uiAudit_control_roles.test.ts       | 16 ++++++
 tests/scripts/control_roles_parity.test.ts    |  6 ++
 tests/scripts/lint_design_consistency.test.ts | 80 +++++++++++++++++++++++++++
 3 files changed, 102 insertions(+)
```diff
diff --git a/internal/bench/design-consistency/run.ts b/internal/bench/design-consistency/run.ts
new file mode 100644
index 0000000000..6004997311
--- /dev/null
+++ b/internal/bench/design-consistency/run.ts
@@ -0,0 +1,125 @@
+#!/usr/bin/env node
+/**
+ * Retroactive shadow window for the consistency check
+ * (road-to-a-control-that-matches-its-neighbours 3.8).
+ *
+ * Replays every commit of a local repository that wrote a UI surface, as the
+ * `design-pass` hook would have seen each write: the role map is computed from
+ * the tree AT that commit, the written file is read AT that commit, and the
+ * findings are recorded at every candidate tolerance. It reads git objects
+ * only and writes nothing into the replayed repository.
+ *
+ * The rows name files and commits of the replayed repository, so they belong
+ * in a local, gitignored path: what is committed is the aggregate
+ * (`internal/bench/corpora/design-consistency-shadow-window.md`).
+ *
+ *   npx tsx internal/bench/design-consistency/run.ts <repo> <label> <out.jsonl> [since=6.months]
+ */
+import { execFileSync, spawn } from 'node:child_process';
+import fs from 'node:fs';
+
+import { buildArtefact } from '../../../src/cli/commands/uiAudit.js';
+import { isUiPath, isUiTreePath } from '../../../src/scripts/_lib/ui_surface.js';
+import { consistencyFindings, SHADOW_TOLERANCES_PX } from '../../../src/scripts/lint_design_consistency.js';
+
+const [repo, label, out, since = '6.months'] = process.argv.slice(2);
+if (!repo || !label || !out) {
+    process.stderr.write('usage: run.ts <repo> <label> <out.jsonl> [since]\n');
+    process.exit(1);
+}
+
+// The role map needs every UI file, `components.json` and the system-marker paths.
+const inScope = (f: string) => !/(^|\/)(node_modules|vendor)\//.test(f) && (isUiPath(f) || isUiTreePath(f) || /(^|\/)components\.json$/.test(f));
+const hookSees = (f: string) => isUiPath(f) || isUiTreePath(f);
+const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 1 << 30 }).toString();
+
+// One `cat-file --batch` process; every unique blob is read once.
+const cat = spawn('git', ['-C', repo, 'cat-file', '--batch'], { stdio: ['pipe', 'pipe', 'inherit'] });
+let buf = Buffer.alloc(0);
+const waiters: Array<() => void> = [];
+cat.stdout.on('data', (d: Buffer) => {
+    buf = Buffer.concat([buf, d]);
+    waiters.shift()?.();
+});
+const need = async (n: number) => {
+    while (buf.length < n) await new Promise<void>((r) => waiters.push(r));
+};
+const cache = new Map<string, string>();
+async function blob(id: string): Promise<string> {
+    const hit = cache.get(id);
+    if (hit !== undefined) return hit;
+    cat.stdin.write(`${id}\n`);
+    let nl = buf.indexOf(10);
+    while (nl < 0) {
+        await need(buf.length + 1);
+        nl = buf.indexOf(10);
+    }
+    const size = Number(buf.subarray(0, nl).toString().split(' ')[2]);
+    await need(nl + 1 + size + 1);
+    const text = buf.subarray(nl + 1, nl + 1 + size).toString('utf8');
+    buf = buf.subarray(nl + 1 + size + 1);
+    cache.set(id, text);
+    return text;
+}
+
+function tree(commit: string): Map<string, string> {
+    const m = new Map<string, string>();
+    for (const l of git('ls-tree', '-r', commit).split('\n')) {
+        const t = l.indexOf('\t');
+        if (t < 0) continue;
+        const [, type, id] = l.slice(0, t).split(' ');
+        const p = l.slice(t + 1);
+        if (type === 'blob' && inScope(p)) m.set(p, id!);
+    }
+    return m;
+}
+
+const commits: Array<{ sha: string; parent?: string; files: string[] }> = [];
+for (const l of git('log', `--since=${since}`, '--no-merges', '--format=@%H %P', '--name-only', '--diff-filter=AM').split('\n')) {
+    if (l.startsWith('@')) {
+        const [sha, parent] = l.slice(1).split(' ');
+        commits.push({ sha: sha!, parent, files: [] });
+    } else if (l && commits.length && hookSees(l)) commits.at(-1)!.files.push(l);
+}
+
+const key = (f: { rule: string; message: string }) => `${f.rule}|${f.message}`;
+const sink = fs.createWriteStream(out);
+let rows = 0;
+for (const c of commits.filter((x) => x.files.length > 0)) {
+    const t = tree(c.sha);
+    const pairs: Array<[string, string]> = [];
+    for (const [p, id] of t) pairs.push([p, await blob(id)]);
+    const roles = buildArtefact('.', pairs).control_roles;
+    const before = c.parent ? tree(c.parent) : new Map<string, string>();
+    for (const f of c.files) {
+        const id = t.get(f);
+        if (!id) continue;
+        const content = await blob(id);
+        const now = consistencyFindings(content, f, roles, 0);
+        const prev = consistencyFindings(before.get(f) ? await blob(before.get(f)!) : '', f, roles, 0).map(key);
+        const would_fire: Record<string, number> = {};
+        for (const tol of SHADOW_TOLERANCES_PX) would_fire[`tolerance_${tol}px`] = consistencyFindings(content, f, roles, tol).length;
+        sink.write(
+            `${JSON.stringify({
+                repo: label,
+                commit: c.sha.slice(0, 10),
+                file: f,
+                would_fire,
+                raw_control: now.filter((x) => x.rule === 'consistency-raw-control').length,
+                deviations_px: now.flatMap((x) => (x.deviation_px === undefined ? [] : [x.deviation_px])),
+                introduced: now
+                    .filter((x) => {
+                        const i = prev.indexOf(key(x));
+                        if (i < 0) return true;
+                        prev.splice(i, 1);
+                        return false;
+                    })
+                    .map((x) => ({ rule: x.rule, line: x.line, message: x.message })),
+            })}\n`,
+        );
+        rows++;
+    }
+}
+sink.end();
+cat.stdin.end();
+process.stderr.write(`${label}: ${rows} UI writes replayed\n`);
diff --git a/src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts b/src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts
index ac85af21f1..4ef5fb1ab4 100644
--- a/src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts
+++ b/src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts
@@ -42,3 +42,3 @@ export type ControlRole = (typeof CONTROL_ROLES)[number];
 const NAME: Record<ControlRole, string> = {
-    select: 'select|selectbox|listbox|native-select',
+    select: 'select|selectbox|listbox|native-?select',
     input: 'input|text-?field|text-?input',
@@ -78,5 +78,17 @@ const INPUT_TYPE_ROLE: Record<string, ControlRole> = {
 };
-const INPUT_TYPES_NOT_A_CONTROL = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
+// `file` is a control, but no role here has a primitive to compare it with.
+const INPUT_TYPES_NOT_A_CONTROL = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);
 
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
 
@@ -102,3 +114,4 @@ export function roleOfTag(tag: string, attrs: string): ControlRole | null {
     }
-    if (isNative && /\bpopover\b/i.test(attrs)) return 'popover';
+    // Case-sensitive on purpose: `Meta<typeof Popover>` is a type argument.
+    if (isNative && /(?:^|\s)popover(?=[\s=]|$)/.test(attrs)) return 'popover';
     return null;
@@ -109,3 +122,3 @@ export function rolesIn(text: string): Set<ControlRole> {
     const found = new Set<ControlRole>();
-    for (const m of text.matchAll(TAG_RE)) {
+    for (const m of blankComments(text).matchAll(TAG_RE)) {
         const role = roleOfTag(m[1]!, m[2] ?? '');
diff --git a/src/cli/commands/uiAudit.ts b/src/cli/commands/uiAudit.ts
index 289d9b331f..8fe547faad 100644
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
diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index 30ba5cc011..391193655a 100644
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -1351,2 +1351,16 @@ hooks:
 
+  # Control consistency on a UI write (road-to-a-control-that-matches-its-
+  # neighbours 3.8). Default-ON, and independent of design_pass above: it runs
+  # when that is off. A raw <select>, <input> or <textarea> written where the
+  # project already has its own Select / Input / Textarea is delivered as one
+  # advisory line naming the project's control; it never blocks. A file that
+  # cannot render the component (a server template, a handover prototype) is
+  # not measured. Turned on after a retroactive shadow window met all four
+  # conditions of docs/contracts/concern-activation-policy.md. The box-metrics
+  # half stays in shadow: while this is enabled, every UI write adds a row to
+  # agents/runtime/state/design-consistency-shadow.jsonl and nothing is shown.
+  # Disabled, nothing runs and nothing is recorded.
+  design_consistency:
+    enabled: true
+
   # PreToolUse UI-route nudge (road-to-frontend-skill-application Phase 4).
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f93d681efa..c61903f26a 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -6,3 +6,3 @@
     "review_by": "2027-10-01",
-    "max_bytes": 1556670,
+    "max_bytes": 1558850,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
@@ -102,2 +102,11 @@
             "what_would_have_caught_it": "Nothing earlier: the base sat 150 bytes under the ceiling, so any in-bundle consumer of a new state file would have tripped it."
+        },
+        {
+            "date": "2026-10-27",
+            "from": 1556670,
+            "to": 1558850,
+            "by": "agent, fix/design-consistency-false-alarms (road-to-a-control-that-matches-its-neighbours 3.8)",
+            "what_was_added": "The consistency check turned on by default inside the in-bundle `design-pass` concern: the `hooks.design_consistency` switch read with a default of on, a narrow consistency-only path for installs where the rest of the pass stays off, the call that adds its findings when the whole pass is on, and the loader of its conditional chunk. The check itself (`ui:audit`, the role parser, the rules and the shadow recorder) ships in `design_consistency.chunk.cjs`, required on a UI write alone. Measured 1,558,555 B with the change on a base of 1,556,669 B: +1,886 B (Node 26.7.0, esbuild 0.28.1, Darwin arm64). esbuild is locked at 0.28.1 in package-lock.json, which is the version CI installs for this gate, so the figure moves only with a lockfile change; a lockfile bump that moves it is caught by this same gate.",
+            "why_it_could_not_be_avoided": "Room was made first: the chunk-require logic of `svg_rules_loader` became one shared `chunkExport`, which both loaders call, taking the first measurement from +2,061 to +1,882 B; moving the loader call inside the failure boundary (ratification round 1) added the last 4 B, for the final +1,886 B above. Moving `design-pass` itself into a lazy chunk was considered and refused on the same trade the 2026-10-23 entry refused for `session-eol`: the concern is bound on every `post_tool_use`, so its body plus the slop registry would be required on every tool call of every install, against a switch that today returns in the bundle. What remains is the switch, the two call sites and the loader, which no chunk can carry because the concern that calls them is in the bundle. The base sat 1 byte under the ceiling: the 2026-10-25 entry above set 1,556,670 at its own round-1 reading, and later merges consumed all but that byte.",
+            "what_would_have_caught_it": "Nothing earlier: with 1 byte of headroom any change to an in-bundle concern trips the ceiling. Sized to this change plus about 300 bytes."
         }
@@ -117,2 +126,8 @@
         },
+        {
+            "entry": "src/scripts/_lib/design_consistency_pass.ts",
+            "max_bytes": 40000,
+            "registered_at": "2026-10-27",
+            "derivation": "Measured 36,545 bytes on 2026-10-27: the consistency check `design-pass` runs on a UI write (the `ui:audit` computation, the control-role parser, the two consistency rules and the shadow recorder). The ceiling is that reading plus about 9 %, rounded, with no growth queued: no further consistency rule is planned, and the box-metrics rule already ships in it. Required on a UI write alone, so no other dispatch parses it; the bundle carries only its loader and two call sites, the 2026-10-27 raise of `max_bytes`. A missing or mis-digested chunk costs the consistency finding, never the event (`design_consistency_loader.ts`)."
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
index 0000000000..ee8338abea
--- /dev/null
+++ b/src/scripts/_lib/design_consistency_pass.ts
@@ -0,0 +1,61 @@
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
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { ARTEFACT_REL, computeUiAudit, gitHead, type UiAuditArtefact } from '../../cli/commands/uiAudit.js';
+import { consistencyFindings, SHADOW_REL, shadowRecord } from '../lint_design_consistency.js';
+
+export interface ConsistencyNotice {
+    line: number;
+    message: string;
+}
+
+/**
+ * The role map, recomputed only when HEAD moved. A single edit does not move a
+ * project's canonical, and the content-digest staleness check `ui:audit` uses
+ * would recompute on every write.
+ */
+function roles(root: string): UiAuditArtefact['control_roles'] {
+    const out = path.join(root, ARTEFACT_REL);
+    const head = gitHead(root);
+    try {
+        const a = JSON.parse(fs.readFileSync(out, 'utf8')) as Partial<UiAuditArtefact>;
+        if (a.control_roles && head !== null && a.stamp?.head === head) return a.control_roles;
+    } catch {
+        // absent or unreadable: computed below
+    }
+    const fresh = computeUiAudit(root, root);
+    fs.mkdirSync(path.dirname(out), { recursive: true });
+    fs.writeFileSync(out, `${JSON.stringify(fresh, null, 2)}\n`);
+    return fresh.control_roles;
+}
+
+export function consistencyPass(root: string, file: string, content: string): ConsistencyNotice[] {
+    const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
+    const map = roles(root);
+    const shadow = path.join(root, SHADOW_REL);
+    fs.mkdirSync(path.dirname(shadow), { recursive: true });
+    // A live row is stamped with the wall clock on purpose; `asOf` would warn on every write.
+    fs.appendFileSync(shadow, `${JSON.stringify(shadowRecord(content, rel, map, new Date()))}\n`);
+    return consistencyFindings(content, rel, map)
+        .filter((f) => f.rule === 'consistency-raw-control')
+        .map((f) => ({ line: f.line, message: f.message }));
+}
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index af7419dac3..0b97dc5e18 100644
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
index ac732f7278..a48d2b6e36 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -95,2 +95,3 @@ import { loadDesignContext, scanFile } from '../lint_design_slop.js';
 import { readHookStdin } from './hook_stdin.js';
+import { loadConsistencyPass } from './design_consistency_loader.js';
 import { CHUNK_BASENAME, loadSvgScan } from './svg_rules_loader.js';
@@ -132,3 +133,3 @@ export interface PassResult {
 /** Minimal settings reader — mirrors design_slop_hook rather than adding a parser. */
-export function enabled(root: string, key = 'design_pass'): boolean {
+export function enabled(root: string, key = 'design_pass', fallback = false): boolean {
     let text: string;
@@ -137,3 +138,3 @@ export function enabled(root: string, key = 'design_pass'): boolean {
     } catch {
-        return false;
+        return fallback;
     }
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
@@ -628,3 +648,6 @@ function main(): number {
     const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
-    if (!enabled(root)) return EXIT_ALLOW;
+    // The consistency check ships ON (3.8); the rest of the pass ships OFF.
+    const pass = enabled(root);
+    const consistency = enabled(root, 'design_consistency', true);
+    if (!pass && !consistency) return EXIT_ALLOW;
 
@@ -639,2 +662,10 @@ function main(): number {
     }
+    if (!pass) {
+        const t = slot === 'stop' ? null : targetPath(payload);
+        const only = t && isUiSurface(t) ? consistencyFor(root, t) : [];
+        if (!only.length) return EXIT_ALLOW;
+        const r: PassResult = { slot, findings: only, blocked: [], audit_missing: [], verification: 'verified' };
+        process.stdout.write(`${JSON.stringify({ reason: render(r) })}\n`);
+        return EXIT_WARN;
+    }
 
@@ -676,2 +707,4 @@ function main(): number {
             }
+            // One shadow row per write: the stop pass re-reads the same files.
+            if (consistency && slot === 'post_tool_use' && isUiSurface(rel)) findings.push(...consistencyFor(root, rel));
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
index 79fee4d3fa..7a538f69bb 100644
--- a/src/scripts/lint_design_consistency.ts
+++ b/src/scripts/lint_design_consistency.ts
@@ -33,2 +33,3 @@ import { asOf } from './_lib/as_of.js';
 import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
+import { isHandoverShape } from './_lib/ui_surface.js';
 
@@ -106,2 +107,18 @@ export function loadControlRoles(artefactPath: string): ControlRoleMap | null {
 
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
@@ -116,2 +133,3 @@ export function consistencyFindings(
 ): ConsistencyFinding[] {
+    if (!isProductUi(relPath)) return [];
     const definesRole = new Set(
@@ -128,3 +146,3 @@ export function consistencyFindings(
         const entry = roles[o.role];
-        if (!entry || entry.canonical === null) continue;
+        if (!entry || entry.canonical === null || !canRender(relPath, entry.canonical)) continue;
 
diff --git a/src/server/schemas/settings.ts b/src/server/schemas/settings.ts
index 41c8f5fdb3..bcf90fb40b 100644
--- a/src/server/schemas/settings.ts
+++ b/src/server/schemas/settings.ts
@@ -483,2 +483,7 @@ export const settingsSchema = z.object({
         }).prefault({}),
+        design_consistency: z.object({
+            enabled: z.boolean().default(true).describe(
+                'Control consistency on a UI write (road-to-a-control-that-matches-its-neighbours 3.8). Default on, independent of design_pass. A raw select, input or textarea written where the project already has its own Select, Input or Textarea is delivered as one advisory line naming the project control; it never blocks. A file that cannot render the component (a server template, a handover prototype) is not measured. Turned on after a retroactive shadow window met all four conditions of the concern-activation policy. The box-metrics half stays in shadow: while this is enabled, every UI write adds a row to agents/runtime/state/design-consistency-shadow.jsonl and nothing is shown. Disabled, nothing runs and nothing is recorded.',
+            ),
+        }).prefault({}),
         ui_route_nudge: z.object({
diff --git a/tests/hooks/design_consistency_default.test.ts b/tests/hooks/design_consistency_default.test.ts
new file mode 100644
index 0000000000..958fce83d1
--- /dev/null
+++ b/tests/hooks/design_consistency_default.test.ts
@@ -0,0 +1,106 @@
+// road-to-a-control-that-matches-its-neighbours 3.8: the consistency check is
+// on without a setting, off with one, delivered as advisory context, and every
+// write it sees adds a shadow row. Run end to end, because the default lives in
+// `main` and a unit test of the parts cannot see whether it is wired.
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { afterEach, describe, expect, it } from 'vitest';
+
+import { consistencyFor } from '../../src/scripts/hooks/design_pass_hook.js';
+import { consistencySpecifier, CONSISTENCY_CHUNK } from '../../src/scripts/hooks/design_consistency_loader.js';
+
+const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
+const HOOK = path.join(REPO, 'src', 'scripts', 'hooks', 'design_pass_hook.ts');
+const SHADOW = path.join('agents', 'runtime', 'state', 'design-consistency-shadow.jsonl');
+
+let dir = '';
+afterEach(() => {
+    if (dir) fs.rmSync(dir, { recursive: true, force: true });
+    dir = '';
+});
+
+function project(settings?: string): string {
+    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-consistency-'));
+    const w = (rel: string, text: string) => {
+        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
+        fs.writeFileSync(path.join(dir, rel), text);
+    };
+    w('components/ui/select.tsx', 'export function Select(props) {\n  return <div {...props} />;\n}\n');
+    w('app/orders.tsx', 'export const O = () => <><Select name="a" /><Select name="b" /></>;\n');
+    w('app/filters.tsx', 'export const F = () => <select name="status"><option>Open</option></select>;\n');
+    w('app/clean.tsx', 'export const C = () => <Select name="c" />;\n');
+    if (settings !== undefined) w('.agent-settings.yml', settings);
+    return dir;
+}
+
+function run(root: string, file: string): { status: number | null; stdout: string } {
+    // cwd is the repository: from a bare temp dir `npx tsx` resolves nothing
+    // local and tries to install. The hook reads the project from the env.
+    const r = spawnSync('npx', ['tsx', HOOK], {
+        cwd: REPO,
+        env: { ...process.env, CLAUDE_PROJECT_DIR: root },
+        input: JSON.stringify({ tool_input: { file_path: file } }),
+        encoding: 'utf8',
+    });
+    return { status: r.status, stdout: r.stdout };
+}
+
+describe('the consistency check ships on', () => {
+    it('with no setting at all, a raw select beside the project Select is delivered', () => {
+        const root = project();
+        const r = run(root, 'app/filters.tsx');
+        expect(r.status).toBe(2);
+        expect(r.stdout).toContain('raw select');
+        expect(r.stdout).toContain("this project's select is Select");
+    });
+
+    it('a settings file that never names the key leaves it on', () => {
+        const root = project('hooks:\n  design_pass:\n    enabled: false\n');
+        expect(run(root, 'app/filters.tsx').status).toBe(2);
+    });
+
+    it('an explicit opt-out silences it', () => {
+        const root = project('hooks:\n  design_consistency:\n    enabled: false\n');
+        const r = run(root, 'app/filters.tsx');
+        expect(r.status).toBe(0);
+        expect(r.stdout).toBe('');
+    });
+
+    it('a clean write says nothing and still records a shadow row', () => {
+        const root = project();
+        expect(run(root, 'app/clean.tsx')).toEqual({ status: 0, stdout: '' });
+        const rows = fs.readFileSync(path.join(root, SHADOW), 'utf8').trim().split('\n');
+        expect(rows).toHaveLength(1);
+        expect(JSON.parse(rows[0]!)).toMatchObject({ file: 'app/clean.tsx', raw_control: 0 });
+    });
+
+    it('a non-UI write never loads the check', () => {
+        const root = project();
+        fs.writeFileSync(path.join(root, 'notes.md'), '<select>');
+        expect(run(root, 'notes.md')).toEqual({ status: 0, stdout: '' });
+        expect(fs.existsSync(path.join(root, SHADOW))).toBe(false);
+    });
+});
+
+describe('the chunk boundary', () => {
+    it('a missing chunk costs the finding, never the event', () => {
+        const root = project();
+        expect(consistencyFor(root, 'app/filters.tsx', () => null)).toEqual([]);
+        const throwing = () => {
+            throw new Error('loader broke');
+        };
+        expect(consistencyFor(root, 'app/filters.tsx', throwing)).toEqual([]);
+    });
+
+    it('bundled, the check is the sibling chunk; from source, the module', () => {
+        const self = 'file:///pkg/dist/hooks/dispatch.js';
+        expect(consistencySpecifier(self, true)).toBe(path.join('/pkg/dist/hooks', CONSISTENCY_CHUNK));
+        expect(consistencySpecifier('file:///pkg/src/scripts/hooks/design_consistency_loader.ts', false)).toBe(
+            path.join('/pkg/src/scripts/_lib', 'design_consistency_pass.ts'),
+        );
+    });
+});
```
