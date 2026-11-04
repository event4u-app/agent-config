<!-- evidence-type: analysis -->

# Ratification review — the design-consistency check on by default, and the dispatch bundle raise it needs — round 16

You are an independent reviewer for a change in the `event4u/agent-config` repository, branch `fix/design-consistency-false-alarms`.

subject: ab0eefa7aed5255fe256ff660476af829137fb1973d65566fae183ce8fc832b9

The ratification gate covers `src/config/hook-bundle-budget.json`, the byte ceiling of `dist/hooks/dispatch.js`, the bundle every hook event loads. The digest above covers it at revision `a0e51a1593`. This round is self-contained: it carries the whole change against `origin/main`, the evidence behind the default flip, and the activation conditions it was measured against.

## History

Every refusal named a real defect, fixed with a test seen red first where code changed; the round packets are committed beside this one. R1: `load()` outside the `try`. R2: size figures disagreed. R3: reverse trigger asserted, not operated (now a report, a procedure and step 3.9 due 2026-11-10). R4: rollback `enabled: false` stopped recording (now `shadow: true`). R5, R6: the role-map cache missed uncommitted primitives. R7: a stale figure. R8: a shadow row could not be classified later. R9: friction of condition 3 unmeasured. R10: the consistency-only path ran on any slot but `stop` (now `post_tool_use` by name); benefit of condition 3 unquantified (now an owner estimate of about 30 minutes per rework round, stated as an estimate). R11: a missing or unreadable shadow file read as an empty window (now exit 1); a late control could fall outside the recorded line (now a window around it); p95 covered cache hits only, exposing a recompute per newly dirty file (now only primitive files stamp); the advisory ceiling was not shown (excerpt below).

- **R12**: rows validated only syntactically (now each rejected with its reason); two controls on a line shared one context (now per column); whole-event latency unmeasured, which found that `design-pass` read no `tool_input` from the dispatcher envelope and so had never run in-process (fixed, dispatcher test seen red first; the consumer evidence called the chunk directly). **R13**: a relative `file_path` such as `../other/Form.tsx` escaped the root (every path is now resolved against the root, then tested); an empty window reported `complete` (now exit 1, `evidence: empty`); the raise entry overstated the lockfile's role. **R14**: `canRender` inferred renderability from the extension alone, so a `.vue` file could be measured against a React `Select` (now per-canonical `families`); unknown rule names and non-positive lines in shadow rows (now rejected); wording on headroom and owner-accepted latency.
- **Round 15 (split: ratified / refused)** The refusing seat named two points, both addressed. (a) `families` came from uses as well as definitions, so a same-named component in another family made that family measurable. They now come from the files that define the canonical only; a canonical the project does not define (a library component) is not measured, and since a single-file component has no export to find, `.vue`, `.svelte` and `.astro` files are defined by their file name. (b) Families could go stale because a use never moves the cache stamp; with definitions only, every input to `families` is a primitive file, which the stamp already tracks. Four tests seen red first; a usage-only edit in another family is pinned as unmeasured. Both replays rerun: identical. The deferred coverage limit of the live recorder is now stated under "What this does not establish".
- **Since round 12** the branch merged `origin/main` (base `1a552b83c5`), which had landed the same envelope unwrap and `loadChunkExport`; this change adds the `workspace_root` root, path containment and a guarded loader specifier. Latency below is as measured, p95 around the 250 ms budget; the owner was shown the cost (about +55 ms median per UI write) and accepted it.

## What the change does

1. **Default flip.** New key `hooks.design_consistency.enabled`, default `true`, read independently of `hooks.design_pass.enabled` (still `false`). On a `post_tool_use` write to a UI surface, a raw `<select>`, `<input>` or `<textarea>` written where the project already has its own component is delivered as one advisory line (exit 2, `severity: advisory`, never a block). The box-metrics rule only appends a local shadow row. The repository owner asked for the flip in the session, conditional on the measurement meeting the activation policy.
2. **Code placement.** The check ships as a conditional chunk (44,022 B, own ceiling 45,000, registered in this change), required only on a UI write. The dispatch bundle gains the switch, the consistency-only path, a call site in the full pass, the root and path handling and the loader: measured 1,578,733 B against a base of 1,576,259 B (`origin/main` 1a552b83c5), +2,474 B, under a new ceiling of 1,579,000 B (base ceiling 1,578,600, which the change exceeds by 133 B).

## The activation conditions (`docs/contracts/concern-activation-policy.md`, § Flip)

All four must hold: (1) the failure is real and observed in the shadow log; (2) false positives at most 1 % of legitimate operations; (3) cost avoided exceeds friction imposed; (4) at least 100 observations or two weeks, including the targeted shape. A reverse trigger is mandatory: above tolerance in any two-week window returns the concern to shadow.

## What to answer

1. Is the raise justified by what it pays for, and is the `raise_log` entry accurate and internally consistent?
2. Does the failure contract of the conditional chunk hold: a missing, unreadable or throwing chunk or loader costs the finding and never the hook event?
3. Is the default flip bounded as described (advisory only, independent of `design_pass`, off by explicit `enabled: false`, no effect on non-UI writes or on any slot other than `post_tool_use`), and does the evidence below meet the four conditions?
4. Do you approve the gated content?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## Scope of the diff

`git diff -U0 origin/main...a0e51a1593` for every source file under `src/`, to fit the 51,200-byte input ceiling. The tests and the bench script are on the branch and not shown; the new tests are named in the history above. Also omitted, and why: `docs/CLAIMS.md` and `docs/contracts/settings-classes.md` repeat the template wording and the counts; `dist/install/install.mjs` and `dist/agent-src/...control_roles.ts` are regenerated projections of files shown here; `docs/proof.md` and `internal/reports/exec-evidence-feasibility.json` are a regenerated proof page and a counter; the roadmap and the earlier round questions are records, not behaviour. Dropped to fit, with zero context lines: the template copy of `control_roles.ts` (the same `column` change, held equal by `tests/scripts/control_roles_parity.test.ts`) and `src/config/agent-settings.template.yml` (the two keys with the wording of their schema descriptions, shown in `settings.ts`), `src/scripts/hook_chunks.mjs` (one line registering the chunk), `src/cli/commands/uiAudit.ts` (an optional callback that hands the scanned pairs to the cache, and `--shadow-report` delegating to `shadowReport`), and `src/server/schemas/settings.ts` (the two keys, `enabled` default `true` and `shadow` default `false`, which the hook diff reads).

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

(Abridged in this packet; the committed file lists them.) The six: a server template measured against a JSX component; markup in a comment; a TypeScript type argument; a file input compared with the text input, and an arrow attribute ending a tag early; a primitive exported through an export list or named `NativeSelect`; a handover prototype or agent reference copy treated as product UI.

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
     This is owner-accepted latency (2026-11-03), not a demonstrated pass of
     that budget. Non-UI writes never load the chunk.
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

## Second reading, 2026-11-03 — after the family boundary

Ratification round 14 found that the rule inferred which files can render a
canonical from the file extension alone, so a `.vue` file in a mixed repository
could be measured against a React `Select`. The role map now records the file
families (`jsx`, `vue`, `svelte`, `astro`, `blade`) of the files that define
each canonical (round 15: definitions only, since a same-named use in another
family may be another component; a single-file component is defined by its
file name). A file outside them is not measured, nor is a canonical the
project does not define (a library component), and a map without families is
not trusted. The window was replayed again with an explicit bound (2026-04-27
to 2026-10-27) on each repository's current HEAD, with the family check, with
it disabled, and with definition-only families:

- A: 262 writes in 147 commits, nothing fires. B: 1,443 writes in 239 commits,
  six firing writes, identical in all three replays. Both
  repositories are single-family, so the check removes nothing here; its
  effect is on mixed repositories, which this window does not contain.
- The counts differ from the first reading (1,565 writes) because B's HEAD is
  now another branch: the three `<textarea>` writes are not on it, and two new
  firing writes are. Of the six: two writes of the login form are real (three
  raw `<input>`), three writes of the Storybook story are false as before, and
  one raw `<input>` in a list molecule of the component library, used as a
  compact position field, is counted false as the worst case. False: at most
  4 of 1,703 legitimate writes, **0.23 %**. Conditions 1, 2 and 4 still hold
  on this reading.

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
- **The live recorder cannot prove its own coverage.** A row is written only
  after the role map is computed, and a failure in the check is swallowed so
  the hook event survives. The report catches a missing file, an empty window
  and unreadable rows, not a write that left no row. Mixed-framework
  repositories and library-only canonicals are also outside this window: the
  first is guarded by families, the second is not measured at all.
- **Two repositories, one owner.** Neither is a third-party corpus. A third
  repository would widen the sample, not change its kind.

## The reverse trigger

(Abridged in this packet; unchanged since round 4, the committed file carries the procedure.) A manual control, owner the maintainer, every two weeks, first review 2026-11-10 (step 3.9). Reading: `lint_design_consistency.ts --shadow-report --days 14` in each project, which lists every firing write with its recorded context and exits 1 on missing, unreadable, empty or rejected evidence. Each firing write is classified real or false from the row; the rate is false over all UI writes; one dated row is recorded per review. Above 1 %: `hooks.design_consistency.shadow` defaults to `true` in one PR (still recording, nothing delivered); `enabled: false` is not the rollback because it stops recording. No fire in eight weeks opens a removal review.

## The cumulative diff

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 9010525d22..4078a7d141 100644
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
+            "what_was_added": "The consistency check turned on by default inside the in-bundle `design-pass` concern: the `hooks.design_consistency` switch read with a default of on, a narrow consistency-only path for installs where the rest of the pass stays off, the call that adds its findings when the whole pass is on, the `shadow` switch that keeps it recording without delivering (the rollback of the activation policy's reverse trigger, asked for by ratification round 4), and the loader of its conditional chunk. The check itself (`ui:audit`, the role parser, the rules and the shadow recorder) ships in `design_consistency.chunk.cjs`, required on a UI write alone. Measured 1,578,733 B with the change on a base of 1,576,259 B (origin/main 1a552b83c5, re-based on 2026-11-03 onto the raises above, both readings by this gate): +2,474 B (Node 26.7.0, esbuild 0.28.1, Darwin arm64). esbuild is locked at 0.28.1 in package-lock.json, which is the version CI installs for this gate, so the toolchain cannot move the figure between this reading and CI without a lockfile change; source changes move it as well, and any growth past the ceiling is caught by this same gate.",
+            "why_it_could_not_be_avoided": "Room was made first: the chunk-require logic of `svg_rules_loader` became one shared function, which both loaders call (since 2026-11-03 the `loadChunkExport` origin/main extracted for the same purpose), taking the first measurement from +2,061 to +1,882 B; moving the loader call inside the failure boundary (ratification round 1) added 4 B, the `shadow` switch of round 4 added 169 B, the explicit `post_tool_use` gate of round 10 added 35 B, and reading the dispatcher envelope added 300 B (2,390 B on the 2026-10-29 base). That last fix was found when round 12 asked for whole-event latency: run through the real dispatcher, `design-pass` received the envelope, read no `tool_input` at its top level, and returned before any check. origin/main has since unwrapped the envelope in the same function independently; this change keeps that call and adds the two parts it does not carry, the root from `workspace_root` and an absolute `file_path` made relative to it (`writtenPath`), plus a guarded specifier in the consistency loader, for the +2,474 B above. Moving `design-pass` itself into a lazy chunk was considered and refused on the same trade the 2026-10-23 entry refused for `session-eol`: the concern is bound on every `post_tool_use`, so its body plus the slop registry would be required on every tool call of every install, against a switch that today returns in the bundle. What remains is the switch, the two call sites and the loader, which no chunk can carry because the concern that calls them is in the bundle. origin/main itself sits 2,341 bytes under its 1,578,600 ceiling, which this change exceeds by 133 bytes.",
+            "what_would_have_caught_it": "Nothing earlier: the base headroom is smaller than the change. Sized to the measurement plus 267 bytes of headroom; rebuild variability was not measured."
@@ -180,0 +190,6 @@
+        {
+            "entry": "src/scripts/_lib/design_consistency_pass.ts",
+            "max_bytes": 45000,
+            "registered_at": "2026-10-27",
+            "derivation": "Measured 44,022 bytes on 2026-11-03: the consistency check `design-pass` runs on a UI write (the `ui:audit` computation, the control-role parser, the two consistency rules, the shadow recorder with the per-finding record ratification round 8 asked for, the uncommitted-primitive stamp of rounds 5 and 6, the shadow report's evidence check, row validation and empty-window verdict of rounds 11 to 14, which share the module, the file families that bind a canonical to the file kinds that define it (rounds 14 and 15), and the primitive-file list that keeps a newly dirty feature file from forcing a recompute; 36,545 B before those rounds). RAISED from 43,000 (39,896 B plus about 8 %) to 45,000, about 2 % over this reading, because the 43,000 ceiling had 26 B left: the chunk carries the linter module whole, its CLI included, since the module's own entry point keeps `main` reachable. Splitting the rules from the CLI would take that back out and is left for a later change. No growth is queued: no further consistency rule is planned, and the box-metrics rule already ships in it. Required on a UI write alone, so no other dispatch parses it; the bundle carries only its loader and two call sites, the 2026-10-27 raise of `max_bytes`. A missing or mis-digested chunk costs the consistency finding, never the event (`design_consistency_loader.ts`)."
+        },
diff --git a/src/scripts/_lib/control_roles.ts b/src/scripts/_lib/control_roles.ts
index fcbc20aea4..2576c1491c 100644
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
@@ -146,0 +164,3 @@ export function definedComponents(rel: string, text: string): string[] {
+    // A single-file component is named by its file.
+    const sfc = /(?:^|\/)([A-Z][A-Za-z0-9_]*)\.(?:vue|svelte|astro)$/.exec(rel);
+    if (sfc) out.push(sfc[1]!);
@@ -150,0 +171,7 @@ export function definedComponents(rel: string, text: string): string[] {
+    // `function Textarea(…) {…}` followed by `export { Textarea }`.
+    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
+        for (const part of m[1]!.split(',')) {
+            const name = part.trim().split(/\s+as\s+/).pop()!.trim();
+            if (/^[A-Z][A-Za-z0-9_]*$/.test(name)) out.push(name);
+        }
+    }
@@ -213,0 +241,2 @@ export interface RoleEntry {
+    /** File families of the files that define the canonical: where it can be rendered. */
+    families?: string[];
@@ -218,0 +248,8 @@ export interface RoleEntry {
+/** The component family a file renders with, or null for a kind no canonical binds. */
+export function fileFamily(rel: string): string | null {
+    if (/\.blade\.php$/i.test(rel)) return 'blade';
+    const ext = /\.(jsx|tsx|mdx|vue|svelte|astro)$/i.exec(rel)?.[1]?.toLowerCase();
+    if (ext === undefined) return null;
+    return ext === 'tsx' || ext === 'mdx' ? 'jsx' : ext;
+}
+
@@ -230 +267,7 @@ export function buildControlRoles(
-    for (const [rel, text] of files) for (const c of definedComponents(rel, text)) defs.set(c, rel);
+    const defFamilies = new Map<string, Set<string>>(); // component tag -> families of every defining file
+    for (const [rel, text] of files)
+        for (const c of definedComponents(rel, text)) {
+            defs.set(c, rel);
+            const f = fileFamily(rel);
+            if (f !== null) defFamilies.set(c, (defFamilies.get(c) ?? new Set()).add(f));
+        }
@@ -282,0 +326,2 @@ export function buildControlRoles(
+        // From definitions only: a same-named use in another family may be another component.
+        else entry.families = [...(defFamilies.get(canonical) ?? [])].sort();
diff --git a/src/scripts/_lib/design_consistency_pass.ts b/src/scripts/_lib/design_consistency_pass.ts
new file mode 100644
index 0000000000..4f880cca29
--- /dev/null
+++ b/src/scripts/_lib/design_consistency_pass.ts
@@ -0,0 +1,143 @@
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
+        // A map written before `families` existed would silence every finding.
+        const current = c.control_roles && Object.values(c.control_roles).every((e) => !e || e.canonical === null || e.families);
+        if (stamp !== null && c.stamp === stamp && current) return c.control_roles;
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
index dea23b5204..f45477834b 100644
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
+    if (!t) return null;
+    const rel = path.relative(root, path.resolve(root, t)).split(path.sep).join('/');
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
index 79fee4d3fa..892d705c28 100644
--- a/src/scripts/lint_design_consistency.ts
+++ b/src/scripts/lint_design_consistency.ts
@@ -22 +22,2 @@
- * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error. It runs in
+ * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error, and for
+ * --shadow-report also when the evidence is missing, empty or incomplete. It runs in
@@ -28,0 +30 @@
+ *   npx tsx lint_design_consistency.ts --shadow-report [--days 14] [--json]   (the reverse trigger's reading)
@@ -33,0 +36 @@ import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
+import { isHandoverShape } from './_lib/ui_surface.js';
@@ -37,0 +41 @@ import {
+    fileFamily,
@@ -53,0 +58,9 @@ export const SHADOW_TOLERANCES_PX = [0, 2, 4] as const;
+/** What fired on a write, kept so it can be classified after the file has moved on. */
+export interface ShadowFinding {
+    rule: ConsistencyFinding['rule'];
+    line: number;
+    message: string;
+    /** The source line, trimmed, at most 200 characters around the control. */
+    context: string;
+}
+
@@ -59,0 +73,3 @@ export interface ShadowRecord {
+    findings?: ShadowFinding[];
+    /** The git HEAD the write was made on, when the caller knows it. */
+    head?: string | null;
@@ -68,0 +85,2 @@ export function shadowRecord(content: string, relPath: string, roles: ControlRol
+    const lines = content.split('\n');
+    const raw = all.filter((f) => f.rule === 'consistency-raw-control');
@@ -73 +91 @@ export function shadowRecord(content: string, relPath: string, roles: ControlRol
-        raw_control: all.filter((f) => f.rule === 'consistency-raw-control').length,
+        raw_control: raw.length,
@@ -74,0 +93,54 @@ export function shadowRecord(content: string, relPath: string, roles: ControlRol
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
@@ -79,0 +152,72 @@ export type ControlRoleMap = Partial<Record<ControlRole, RoleEntry>>;
+/** Why a parsed row cannot be read as evidence, or null when it can. */
+const SHADOW_RULES: ReadonlySet<string> = new Set<ConsistencyFinding['rule']>(['consistency-raw-control', 'consistency-sibling-metrics']);
+
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
+            return typeof x === 'object' && x !== null && SHADOW_RULES.has(x.rule as string) && Number.isInteger(x.line) && (x.line as number) > 0 && typeof x.message === 'string' && typeof x.context === 'string';
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
+    // No write in the window proves the parser, not the recording: never a clean window.
+    const empty = w.writes === 0;
+    const code = rejected.length > 0 || empty ? 1 : 0;
+    if (json) {
+        const evidence = rejected.length > 0 ? 'incomplete' : empty ? 'empty' : 'complete';
+        return { out: `${JSON.stringify({ ...w, evidence, rejected_lines: rejected.map((x) => x.line), rejected }, null, 2)}\n`, code };
+    }
+    let out = `design-consistency shadow, ${w.days} days since ${w.since}: ${w.writes} UI write(s), ${w.firing} firing.\n`;
+    if (empty) out += 'no UI write recorded in the window: no observations, which is not a clean window; check the recording is on.\n';
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
@@ -86,0 +231,2 @@ export interface ConsistencyFinding {
+    /** Offset of the control's `<` within its line. */
+    column?: number;
@@ -106,0 +253,16 @@ export function loadControlRoles(artefactPath: string): ControlRoleMap | null {
+/**
+ * Whether a file of this kind can render the canonical at all: its family must
+ * be one the project defines the canonical in. A server template cannot use a JSX
+ * `Select`, nor a `.vue` file a React one; a map that does not say is not trusted.
+ */
+export function canRender(relPath: string, canonical: string, families: readonly string[] | undefined): boolean {
+    if (canonical.startsWith('native:')) return true;
+    const family = fileFamily(relPath);
+    return family !== null && families !== undefined && families.includes(family);
+}
+
+/** A design handover or an agent's reference copy is not the product's UI. */
+function isProductUi(relPath: string): boolean {
+    return !isHandoverShape(relPath) && !/(^|\/)agents\//.test(relPath.replace(/\\/g, '/'));
+}
+
@@ -116,0 +279 @@ export function consistencyFindings(
+    if (!isProductUi(relPath)) return [];
@@ -129 +292 @@ export function consistencyFindings(
-        if (!entry || entry.canonical === null) continue;
+        if (!entry || entry.canonical === null || !canRender(relPath, entry.canonical, entry.families)) continue;
@@ -136,0 +300 @@ export function consistencyFindings(
+                column: o.column,
@@ -196,0 +361,5 @@ export function main(args: string[]): number {
+    if (args.includes('--shadow-report')) {
+        const r = shadowReport(path.resolve(SHADOW_REL), asOf(), Number(arg(args, '--days') ?? '14'), json);
+        process.stdout.write(r.out);
+        return r.code;
+    }
```
