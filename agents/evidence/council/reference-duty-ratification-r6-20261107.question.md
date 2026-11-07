<!-- evidence-type: analysis -->

# Ratification review — the read ledger observes the reference duty — round 6

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it, `src/scripts/hook_manifest.yaml` and its compiled twin `src/scripts/hook_manifest.json`, are hook plumbing on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change hook plumbing but may not ratify its own change.

subject: 8da58644154f36fbdf93778a4c7f542f9a65aae30b964c1dcd57aaa4385b52cd

(The digest covers the gated files at commit `2c2e96cbda`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

- `reread-guard` (an advisory `pre_tool_use` concern that never blocks and never exits 1) now also runs on `Bash`, where it records a plain `cat <absolute file>` as a full read, and is bound on claude `pre_compact`, where it deletes the session's read ledger.
- Its ledger key includes `agent_id` when the payload carries one, so a subagent's reads never satisfy the parent's.
- On Edit/Write it records, observe-only, which `load_context` references the rules whose path/file trigger matches require, and whether the ledger holds a full read of each. Nothing is injected into context and nothing is blocked.
- Reads under exempt paths (`dist/**` etc.) are now recorded without an advisory.
- Bench: per-trial hook events are recorded from stream-json, and a map-set trial whose hooks broke its arm's expectation is marked `instrument-invalid`.

## Round 1 and what changed

Round 1: anthropic `confirmed-non-expanding`, openai `refused`. The refusal's findings, and what this round's diff does about each:

- Read credit ignored the reference's version → `dutyStates` now credits `read` only when the reference's current size and mtime equal those recorded at the read.
- Compaction deleted the whole ledger, resetting own-write and advisory bookkeeping → it now clears `reads` and `duty` only.
- `cat\n/path` and brace expansion were accepted → the recognizer allows only spaces/tabs, rejects `\\`, `{`, `}`, `[`, `]`, `$`, `*`, `?`, `~` and backtick in the path.
- The latest state overwrote earlier observations → each `rule::reference` keeps `pending` and `read` counts.
- An unreadable router read as "no duty" → it raises a typed error the hook counts as `duty_errors`.
- Not changed, stated instead: credit is still given at `pre_tool_use`, before the host returns the result, so a read the host then refuses would count. The hook is observe-only; no gate consumes the duty.

Round 2: anthropic `refused`, openai `refused` — both on the same defect: duty discovery keyed a reference outside the workspace workspace-relative (`../…`) while the read ledger keyed it absolute, so a user-level package reference was never credited. Round 3's diff:

- One `ledgerKey(workspaceRoot, absPath)` in `_lib/reference_duty.ts` is used by both the read ledger and the duty; a regression test reads a reference from a package outside the workspace (`AGENT_CONFIG_PACKAGE_ROOT`) and sees `read`.
- An unreadable rule file now raises the same typed error as an unreadable router, counted as `duty_errors`, instead of silently dropping that rule's duty.
- Stated, not changed: size+mtime equality is metadata equality, not content identity, and `read` is an advisory observation — it is never proof of delivery and no gate consumes it. The frontmatter parser and glob are local re-implementations; a divergence from the router's matcher would show as missing duties, which the counts make visible.

Round 3: anthropic `refused`, openai `refused`. Round 4's diff answers each named defect:

- A matched rule with no file, an unreadable or unparsable rule frontmatter, a `load_context` that is not a list of paths, and a router whose tiers or entries are not the router's shape now each raise `DutySourceError`, counted as `duty_errors` — never "no duty". Tests: a missing rule file and a malformed router each count one error.
- Matching reuses the router's own `trigger_matches` (path_prefix / file_pattern only); the hand-rolled glob is gone. `load_context` is parsed by the bundle's YAML reader, so an inline list reads as YAML reads it.
- Compaction clears only `reads`; own writes, advisory latches, `duty` counts and `duty_errors` are kept. Test: a pending count survives `pre_compact`.
- Stated, not changed: counts cannot show a duty whose trigger kind does not exist (a shell command) — that is the roadmap's open blocker, and step 2.4's table is the expected-duty denominator for the 20 rules with `load_context`.

Round 4: anthropic `refused`, openai refusing without a stance line. Round 5's diff:

- `tierRules` refuses an entry that is not an object and a trigger that is not an object; `loadContextOf` refuses a frontmatter that is not a mapping. Each raises `DutySourceError`.
- The hook counts ANY error from the duty computation as `duty_errors` — not only `DutySourceError` — so no failure mode reads as "no duty". Hook-level tests spawn the hook and assert exit 0 plus one counted error for `tier_1: [null]`, `triggers: [5]`, and a list-shaped frontmatter.
- Stated, not changed: references may resolve outside the workspace by design (the user-level package), and the code only `stat`s them — it reads no reference content, so symlink traversal discloses no content; it can only make an observation say `read` or `required-pending`. Runtime cost per Edit/Write (one router parse, the matched rules' frontmatter, one stat per reference) is unmeasured.

Round 5: both seats refused on test coverage and one shape gap. Round 6:

- A router whose root is an array is refused (`DutySourceError`, counted); the hook-level test spawns the hook and asserts exit 0 and one counted error. It was run without the fix and failed.
- The compaction test now writes a counted error and an advisory latch first and asserts both survive `pre_compact`, with `reads` cleared and the pending count kept.
- The `wholeFileCatPath` unit tests, the `agent_id` key tests and the `cat` E2E test exist in `tests/scripts/reread_guard_hook.test.ts`; round 5's diff omitted that file. It is included below.

## Answer each question, by number

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff (`git diff origin/main...feat/reference-duty`, hook files and both test files)

`src/scripts/hook_manifest.json` is the compiled twin of the YAML and is omitted; the bench changes touch no hook and are omitted.

```diff
diff --git a/src/scripts/_lib/reference_duty.ts b/src/scripts/_lib/reference_duty.ts
new file mode 100644
index 0000000000..f2975938fa
--- /dev/null
+++ b/src/scripts/_lib/reference_duty.ts
@@ -0,0 +1,144 @@
+/**
+ * The reference duty, observed at a file act: which `load_context` references
+ * the rules triggered by a path require, and whether the session's read ledger
+ * shows each one read whole. Observation only — it injects nothing and blocks
+ * nothing; whether a gate is worth its cost is measured before one exists.
+ *
+ * Every rule the act matches yields its duties or a {@link DutySourceError}; a
+ * source that cannot be read is never reported as "no duty".
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { parse as parseYaml } from 'yaml';
+
+import { ruleSources } from './rule_injection.js';
+import { trigger_matches, type Trigger } from './router_match.js';
+
+export interface Duty {
+    rule: string;
+    /** As the rule writes it — relative to the rule file, e.g. `../contexts/x.md`. */
+    reference: string;
+    /** The reference's {@link ledgerKey} — the form read-ledger keys take. */
+    resolved: string;
+}
+
+export type DutyState = 'read' | 'required-pending';
+
+export class DutySourceError extends Error {}
+
+/**
+ * The one key both the read ledger and the duty use for a file: relative to the
+ * workspace when the file is inside it, absolute otherwise. Two derivations of
+ * this key would silently disagree for every reference outside the workspace.
+ */
+export function ledgerKey(workspaceRoot: string, absPath: string): string {
+    const rel = path.relative(workspaceRoot, absPath);
+    return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? absPath : rel;
+}
+
+function loadContextOf(ruleFile: string): string[] {
+    let text: string;
+    try {
+        text = fs.readFileSync(ruleFile, 'utf8');
+    } catch (e) {
+        throw new DutySourceError(`rule unreadable: ${ruleFile}: ${(e as Error).message}`);
+    }
+    if (!text.startsWith('---')) return [];
+    const end = text.indexOf('\n---', 3);
+    if (end === -1) throw new DutySourceError(`rule frontmatter unterminated: ${ruleFile}`);
+    let fm: unknown;
+    try {
+        fm = parseYaml(text.slice(3, end));
+    } catch (e) {
+        throw new DutySourceError(`rule frontmatter unparsable: ${ruleFile}: ${(e as Error).message}`);
+    }
+    if (fm === null || fm === undefined) return [];
+    if (typeof fm !== 'object' || Array.isArray(fm)) throw new DutySourceError(`rule frontmatter is not a mapping: ${ruleFile}`);
+    const lc = (fm as Record<string, unknown>)['load_context'];
+    if (lc === undefined || lc === null) return [];
+    if (!Array.isArray(lc) || !lc.every((x) => typeof x === 'string')) {
+        throw new DutySourceError(`rule load_context is not a list of paths: ${ruleFile}`);
+    }
+    return lc as string[];
+}
+
+/** The router's tier rules, or a source error when the shape is not the router's. */
+function tierRules(router: unknown, file: string): Array<{ id: string; triggers: Trigger[] }> {
+    if (typeof router !== 'object' || router === null || Array.isArray(router)) throw new DutySourceError(`router is not an object: ${file}`);
+    const out: Array<{ id: string; triggers: Trigger[] }> = [];
+    for (const tier of ['tier_1', 'tier_2']) {
+        const list = (router as Record<string, unknown>)[tier];
+        if (list === undefined) continue;
+        if (!Array.isArray(list)) throw new DutySourceError(`router ${tier} is not a list: ${file}`);
+        for (const r of list) {
+            if (typeof r !== 'object' || r === null || Array.isArray(r)) throw new DutySourceError(`router ${tier} entry is not an object: ${file}`);
+            const e = r as Record<string, unknown>;
+            const triggers = e['triggers'];
+            if (typeof e['id'] !== 'string' || !Array.isArray(triggers)) {
+                throw new DutySourceError(`router ${tier} entry without id and trigger list: ${file}`);
+            }
+            if (!triggers.every((t) => typeof t === 'object' && t !== null && !Array.isArray(t))) {
+                throw new DutySourceError(`router ${tier} entry ${e['id']} has a trigger that is not an object: ${file}`);
+            }
+            out.push({ id: e['id'], triggers: triggers as Trigger[] });
+        }
+    }
+    return out;
+}
+
+/**
+ * References required by the rules whose path or file trigger matches `relPath`,
+ * matched by the router's own `trigger_matches`. Throws {@link DutySourceError}
+ * when the router or a matched rule cannot be read; a missing router is no duty.
+ */
+export function dutyForPath(relPath: string, workspaceRoot: string): Duty[] {
+    const sources = ruleSources(workspaceRoot);
+    if (sources.router === null) return [];
+    let router: unknown;
+    try {
+        router = JSON.parse(fs.readFileSync(sources.router, 'utf8'));
+    } catch (e) {
+        throw new DutySourceError(`router unreadable: ${sources.router}: ${(e as Error).message}`);
+    }
+    const out: Duty[] = [];
+    for (const rule of tierRules(router, sources.router)) {
+        const hit = rule.triggers.some((t) => ('path_prefix' in t || 'file_pattern' in t) && trigger_matches(t, '', [relPath]));
+        if (!hit) continue;
+        const dir = sources.dirs.find((d) => fs.existsSync(path.join(d, `${rule.id}.md`)));
+        if (dir === undefined) throw new DutySourceError(`matched rule has no file: ${rule.id}`);
+        for (const reference of loadContextOf(path.join(dir, `${rule.id}.md`))) {
+            out.push({ rule: rule.id, reference, resolved: ledgerKey(workspaceRoot, path.resolve(dir, reference)) });
+        }
+    }
+    return out;
+}
+
+/**
+ * `read` when the ledger holds a full read of the path the reference resolves to
+ * AND the file still has the size and mtime recorded at that read: a reference
+ * edited since the read was not read in its current form. Metadata equality, not
+ * content identity; and credit is given at the read's pre_tool_use, before the
+ * host returns the result, so a read the host then refuses would still count.
+ */
+export function dutyStates(
+    duties: readonly Duty[],
+    reads: Readonly<Record<string, unknown>>,
+    workspaceRoot: string,
+): Record<string, DutyState> {
+    const states: Record<string, DutyState> = {};
+    for (const d of duties) {
+        const rec = reads[d.resolved] as { mtime?: unknown; size?: unknown } | undefined;
+        let current = false;
+        if (rec !== undefined) {
+            try {
+                const st = fs.statSync(path.isAbsolute(d.resolved) ? d.resolved : path.join(workspaceRoot, d.resolved));
+                current = rec.mtime === st.mtimeMs && rec.size === st.size;
+            } catch {
+                current = false;
+            }
+        }
+        states[`${d.rule}::${d.reference}`] = current ? 'read' : 'required-pending';
+    }
+    return states;
+}
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 6d4058a2bb..2e3404b4ad 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1319,8 +1319,9 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: verification
-    # Provable from the hook's own source: READ_TOOLS ∪ WRITE_TOOLS.
-    tools: [Read, Edit, Write]
+    # Provable from the hook's own source: READ_TOOLS ∪ WRITE_TOOLS, plus Bash
+    # for a whole-file `cat <file>` (wholeFileCatPath), which is a read too.
+    tools: [Read, Edit, Write, Bash]
     needs_payload_bodies: [input]
   # Memory recall — delivers a memory the store ALREADY holds, at the moment
   # the tool call it is about would run. The finding: in one long autonomous
@@ -1789,7 +1790,7 @@ platforms:
     # Claude Code transcript fact. (It was the ONLY binding on this slot until
     # the entry below; that sentence is retired rather than left to rot.)
     #
-    pre_compact:      [language-mirror, rule-inject, journal-record]
+    pre_compact:      [language-mirror, rule-inject, journal-record, reread-guard]
     # road-to-subagent-lifecycle-integrity Phase 1 Step 1. `claude` is the only
     # platform where both native events were measured present on the installed
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index 8226236e61..d95139ac2c 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -1,7 +1,11 @@
 #!/usr/bin/env node
 /**
  * Re-read guard + post-edit scope hint — `pre_tool_use` concern
- * (road-to-token-economy-cache Phase 6.1/6.2).
+ * (road-to-token-economy-cache Phase 6.1/6.2), also bound on `pre_compact`,
+ * where it clears the session's ledger: compaction drops what was read.
+ *
+ * A whole-file `cat <file>` through Bash counts as a full read, and a
+ * subagent's reads are keyed apart from its parent's (`agent_id`).
  *
  * Two signals, one session-scoped read ledger:
  *
@@ -72,6 +76,7 @@ import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
 import { atomic_write_json } from './state_io.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
+import { dutyForPath, dutyStates, ledgerKey, type DutyState } from '../_lib/reference_duty.js';
 
 // Severity is taken from the EXIT CODE, not from the `decision` field — see
 // the file header for why this never blocks on `claude`. This concern never
@@ -191,6 +196,10 @@ export interface Ledger {
     writes: Record<string, number>;
     /** Per-path once-per-session advisory latch. */
     fired: Record<string, boolean>;
+    /** Reference duty observed at file acts, `rule::reference` → counts and latest state. */
+    duty?: Record<string, DutyRecord>;
+    /** File acts whose duty could not be computed (an unreadable router). */
+    duty_errors?: number;
 }
 
 function emptyLedger(): Ledger {
@@ -202,7 +211,9 @@ export function deriveSessionKey(envelope: JsonObject, payload: JsonObject): str
     const raw =
         str(envelope['session_id'] as JsonValue | undefined) ||
         str((payload['session_id'] ?? payload['sessionId']) as JsonValue | undefined);
-    const material = raw || 'unknown-session';
+    const agent = str((payload['agent_id'] ?? payload['agentId']) as JsonValue | undefined);
+    // A subagent reads into its own context, so its reads never satisfy the parent's.
+    const material = `${raw || 'unknown-session'}${agent ? `::${agent}` : ''}`;
     return crypto.createHash('sha256').update(material).digest('hex');
 }
 
@@ -218,6 +229,8 @@ export function readLedger(workspaceRoot: string, sessionKey: string): Ledger {
             reads: isObject(parsed['reads']) ? (parsed['reads'] as unknown as Record<string, ReadRecord>) : {},
             writes: isObject(parsed['writes']) ? (parsed['writes'] as Record<string, number>) : {},
             fired: isObject(parsed['fired']) ? (parsed['fired'] as Record<string, boolean>) : {},
+            ...(isObject(parsed['duty']) ? { duty: parsed['duty'] as unknown as NonNullable<Ledger['duty']> } : {}),
+            ...(typeof parsed['duty_errors'] === 'number' ? { duty_errors: parsed['duty_errors'] } : {}),
         };
     } catch {
         return emptyLedger(); // missing/corrupt ledger → fresh; never a crash
@@ -254,6 +267,19 @@ export function isRangedRead(toolInput: JsonObject): boolean {
     return false;
 }
 
+/**
+ * The file a plain `cat <absolute file>` reads whole, or null. A relative path
+ * resolves against the shell's cwd, which the hook cannot see; a pipe, a
+ * redirect, a flag, a second file or a shell expansion is not a whole-file read
+ * of one known path.
+ */
+export function wholeFileCatPath(command: string): string | null {
+    const m = /^[ \t]*cat[ \t]+(?:"([^"\n]+)"|'([^'\n]+)'|([^\s|&;<>'"]+))[ \t]*$/.exec(command);
+    if (m === null) return null;
+    const p = m[1] ?? m[2] ?? m[3] ?? '';
+    return p.startsWith('/') && !/[$*?~`\\{}[\]]/.test(p) ? p : null;
+}
+
 /** 6.1 advisory — duplicate full read of an unchanged, already-read path. */
 export function buildDuplicateReadLine(relPath: string, earlierTs: number, compared: CompareBasis): string {
     const when = new Date(earlierTs).toISOString();
@@ -275,38 +301,105 @@ export function buildPostEditReadLine(relPath: string): string {
     );
 }
 
+export interface DutyRecord {
+    state: DutyState;
+    pending: number;
+    read: number;
+    ts: number;
+}
+
+function recordDuty(ledger: Ledger, key: string, workspaceRoot: string): void {
+    let states: Record<string, DutyState>;
+    try {
+        states = dutyStates(dutyForPath(key, workspaceRoot), ledger.reads, workspaceRoot);
+    } catch {
+        // DutySourceError for a source that cannot be read, or anything else the
+        // computation throws: either way a duty went unobserved, so it is counted.
+        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
+        return;
+    }
+    if (Object.keys(states).length === 0) return;
+    const ts = Date.now();
+    ledger.duty = { ...(ledger.duty ?? {}) };
+    for (const [k, state] of Object.entries(states)) {
+        const prior = ledger.duty[k] ?? { state, pending: 0, read: 0, ts };
+        ledger.duty[k] = {
+            state,
+            pending: prior.pending + (state === 'required-pending' ? 1 : 0),
+            read: prior.read + (state === 'read' ? 1 : 0),
+            ts,
+        };
+    }
+}
+
 export function main(): number {
     try {
         const [envelope, payload] = unwrap(readHookStdin(), 'claude');
 
         const event = str(envelope['event'] as JsonValue | undefined);
+        if (event === 'pre_compact') {
+            // Compaction drops what was read, so recorded reads must not outlive it.
+            // Everything else — own writes, advisory latches, the duty counts that
+            // are this observation's measurement — is not a read and is kept.
+            const root = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
+            const sk = deriveSessionKey(envelope, payload);
+            const prior = readLedger(root, sk);
+            writeLedger(root, sk, {
+                ...prior,
+                reads: {},
+            });
+            return EXIT_ALLOW;
+        }
         if (event !== '' && event !== 'pre_tool_use') return EXIT_ALLOW;
 
         const toolName = extractToolName(payload);
-        const isRead = READ_TOOLS.has(toolName);
+        const toolInput = extractToolInput(payload);
+        const catPath = toolName === 'Bash' ? wholeFileCatPath(str(toolInput['command'])) : null;
+        const isRead = READ_TOOLS.has(toolName) || catPath !== null;
         const isWrite = WRITE_TOOLS.has(toolName);
         if (!isRead && !isWrite) return EXIT_ALLOW;
 
-        const toolInput = extractToolInput(payload);
-        const filePath = extractFilePath(toolInput);
+        const filePath = catPath ?? extractFilePath(toolInput);
         if (!filePath) return EXIT_ALLOW;
 
         const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
         const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
         const relPath = path.relative(workspaceRoot, absPath);
-        if (isExemptPath(relPath) || isExemptPath(absPath)) return EXIT_ALLOW;
+        const exempt = isExemptPath(relPath) || isExemptPath(absPath);
 
         const sessionKey = deriveSessionKey(envelope, payload);
         const ledger = readLedger(workspaceRoot, sessionKey);
-        // Ledger keys are workspace-relative where possible (stable across
-        // absolute-vs-relative host payloads), absolute otherwise.
-        const key = relPath.startsWith('..') ? absPath : relPath;
+        const key = ledgerKey(workspaceRoot, absPath);
+
+        if (exempt && isWrite) {
+            // No 6.2 bookkeeping on an exempt path, but the duty is observed:
+            // `dist/agent-src/` is itself a trigger prefix.
+            recordDuty(ledger, key, workspaceRoot);
+            writeLedger(workspaceRoot, sessionKey, ledger);
+            return EXIT_ALLOW;
+        }
+        if (exempt) {
+            // No advisory on an exempt path, but the read is recorded: a projected
+            // rule reference lives under dist/, and the reference duty asks whether
+            // it was read.
+            if (!isRangedRead(toolInput)) {
+                try {
+                    const st = fs.statSync(absPath);
+                    ledger.reads[key] = { mtime: st.mtimeMs, size: st.size, ts: Date.now() };
+                    writeLedger(workspaceRoot, sessionKey, ledger);
+                } catch {
+                    // unreadable target — nothing to record
+                }
+            }
+            return EXIT_ALLOW;
+        }
 
         if (isWrite) {
             // 6.2 bookkeeping: remember this session's own write. The write has
             // not happened yet, but for every later comparison "about to write"
             // and "wrote" are equivalent.
             ledger.writes[key] = Date.now();
+            recordDuty(ledger, key, workspaceRoot);
             writeLedger(workspaceRoot, sessionKey, ledger);
             return EXIT_ALLOW;
         }
diff --git a/tests/scripts/reference_duty.test.ts b/tests/scripts/reference_duty.test.ts
new file mode 100644
index 0000000000..dcd79eb038
--- /dev/null
+++ b/tests/scripts/reference_duty.test.ts
@@ -0,0 +1,217 @@
+/**
+ * The reference duty, observed: which references a file act requires, and
+ * whether the session's read ledger shows them read. Observation only.
+ */
+import { spawnSync } from 'node:child_process';
+import * as crypto from 'node:crypto';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { afterEach, describe, expect, it } from 'vitest';
+
+import { dutyForPath, dutyStates } from '../../src/scripts/_lib/reference_duty.js';
+import { ledgerFile } from '../../src/scripts/hooks/reread_guard_hook.js';
+
+const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
+const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'reread_guard_hook.ts');
+const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
+const tmps: string[] = [];
+afterEach(() => {
+    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
+});
+
+// Real rules write references relative to the rule file: `../contexts/...`.
+const REF = '../contexts/sot-mechanics.md';
+const RESOLVED = 'dist/agent-src/contexts/sot-mechanics.md';
+
+function workspace(): string {
+    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ref-duty-'));
+    tmps.push(root);
+    const rules = path.join(root, 'dist', 'agent-src', 'rules');
+    fs.mkdirSync(rules, { recursive: true });
+    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'contexts'), { recursive: true });
+    fs.writeFileSync(path.join(root, RESOLVED), 'mechanics\n');
+    fs.writeFileSync(
+        path.join(root, 'dist', 'router.json'),
+        JSON.stringify({
+            kernel: [],
+            tier_1: [{ id: 'sot', triggers: [{ path_prefix: '.claude/' }, { path_prefix: 'dist/agent-src/' }, { keyword: 'source' }] }],
+            tier_2: [
+                { id: 'ui', triggers: [{ file_pattern: '*.vue' }] },
+                { id: 'talk', triggers: [{ keyword: 'ask' }] },
+            ],
+        }),
+    );
+    fs.writeFileSync(path.join(rules, 'sot.md'), `---\ntype: "auto"\nload_context:\n  - ${REF}\n---\n\n# sot\n`);
+    fs.writeFileSync(path.join(rules, 'ui.md'), '---\ntype: "auto"\n---\n\n# ui\n');
+    fs.writeFileSync(path.join(rules, 'talk.md'), `---\ntype: "auto"\nload_context:\n  - ${REF}\n---\n\n# talk\n`);
+    return root;
+}
+
+function run(root: string, payload: object, event = 'pre_tool_use'): void {
+    const input = JSON.stringify({ schema_version: 1, platform: 'claude', event, session_id: 's1', workspace_root: root, payload });
+    const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd: root, input, env: { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: '' } });
+    expect(r.status).not.toBeNull();
+}
+
+function duty(root: string): Record<string, { state: string }> {
+    const key = crypto.createHash('sha256').update('s1').digest('hex');
+    return (JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty?: Record<string, { state: string }> }).duty ?? {};
+}
+
+describe('dutyForPath', () => {
+    it('names the references of rules whose path or file trigger matches, and only those', () => {
+        const root = workspace();
+        expect(dutyForPath('.claude/settings.json', root)).toEqual([{ rule: 'sot', reference: REF, resolved: RESOLVED }]);
+        expect(dutyForPath('src/App.vue', root)).toEqual([]);
+        expect(dutyForPath('src/a.ts', root)).toEqual([]);
+    });
+});
+
+describe('dutyStates', () => {
+    it('is read only when the ledger holds a full read of the reference', () => {
+        const d = [{ rule: 'sot', reference: REF, resolved: RESOLVED }];
+        const root = workspace();
+        const st = fs.statSync(path.join(root, RESOLVED));
+        const rec = { mtime: st.mtimeMs, size: st.size };
+        expect(dutyStates(d, {}, root)).toEqual({ [`sot::${REF}`]: 'required-pending' });
+        expect(dutyStates(d, { [RESOLVED]: rec }, root)).toEqual({ [`sot::${REF}`]: 'read' });
+        expect(dutyStates(d, { 'elsewhere/contexts/sot-mechanics.md': rec }, root)).toEqual({ [`sot::${REF}`]: 'required-pending' });
+    });
+});
+
+describe('E2E: the hook records the duty and changes nothing else', () => {
+    it('records required-pending on a write under the trigger, then read after a whole-file read', () => {
+        const root = workspace();
+        const target = path.join(root, '.claude', 'x.md');
+        run(root, { tool_name: 'Write', tool_input: { file_path: target, content: 'x' } });
+        expect(duty(root)[`sot::${REF}`]?.state).toBe('required-pending');
+        run(root, { tool_name: 'Read', tool_input: { file_path: path.join(root, RESOLVED) } });
+        run(root, { tool_name: 'Edit', tool_input: { file_path: target, old_string: 'x', new_string: 'y' } });
+        expect(duty(root)[`sot::${REF}`]?.state).toBe('read');
+    });
+    it('records the duty for a write under an exempt path such as dist/agent-src/', () => {
+        const root = workspace();
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, 'dist', 'agent-src', 'rules', 'new.md'), content: 'x' } });
+        expect(duty(root)[`sot::${REF}`]?.state).toBe('required-pending');
+    });
+});
+
+describe('council round 1 findings', () => {
+    it('does not credit a read of a reference that changed since', () => {
+        const root = workspace();
+        const ref = path.join(root, RESOLVED);
+        const st = fs.statSync(ref);
+        const d = [{ rule: 'sot', reference: REF, resolved: RESOLVED }];
+        expect(dutyStates(d, { [RESOLVED]: { mtime: st.mtimeMs, size: st.size } }, root)).toEqual({ [`sot::${REF}`]: 'read' });
+        expect(dutyStates(d, { [RESOLVED]: { mtime: st.mtimeMs, size: st.size + 1 } }, root)).toEqual({ [`sot::${REF}`]: 'required-pending' });
+    });
+    it('counts every observation instead of keeping only the last', () => {
+        const root = workspace();
+        const target = path.join(root, '.claude', 'x.md');
+        run(root, { tool_name: 'Write', tool_input: { file_path: target, content: 'x' } });
+        run(root, { tool_name: 'Read', tool_input: { file_path: path.join(root, RESOLVED) } });
+        run(root, { tool_name: 'Edit', tool_input: { file_path: target, old_string: 'x', new_string: 'y' } });
+        expect(duty(root)[`sot::${REF}`]).toMatchObject({ state: 'read', pending: 1, read: 1 });
+    });
+    it('keeps the write and advisory bookkeeping across a compaction, clearing only reads', () => {
+        const root = workspace();
+        const target = path.join(root, '.claude', 'x.md');
+        run(root, { tool_name: 'Read', tool_input: { file_path: path.join(root, RESOLVED) } });
+        run(root, { tool_name: 'Write', tool_input: { file_path: target, content: 'x' } });
+        run(root, {}, 'pre_compact');
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        const ledger = JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as Record<string, Record<string, unknown>>;
+        expect(ledger['reads']).toEqual({});
+        expect(Object.keys(ledger['writes'] ?? {})).toEqual(['.claude/x.md']);
+    });
+    it('counts a file act whose router cannot be read, instead of reading it as no duty', () => {
+        const root = workspace();
+        fs.writeFileSync(path.join(root, 'dist', 'router.json'), '{ not json');
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
+    });
+});
+
+describe('council round 2: one canonical key for reads and duties', () => {
+    it('credits a read of a reference that lives outside the workspace, in the user-level package', () => {
+        const pkg = workspace();
+        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ref-duty-ws-'));
+        tmps.push(root);
+        const target = path.join(root, '.claude', 'x.md');
+        const env = { AGENT_CONFIG_PACKAGE_ROOT: pkg };
+        runEnv(root, { tool_name: 'Write', tool_input: { file_path: target, content: 'x' } }, env);
+        expect(duty(root)[`sot::${REF}`]?.state).toBe('required-pending');
+        runEnv(root, { tool_name: 'Read', tool_input: { file_path: path.join(pkg, RESOLVED) } }, env);
+        runEnv(root, { tool_name: 'Edit', tool_input: { file_path: target, old_string: 'x', new_string: 'y' } }, env);
+        expect(duty(root)[`sot::${REF}`]?.state).toBe('read');
+    });
+});
+
+function runEnv(root: string, payload: object, env: Record<string, string>): void {
+    const input = JSON.stringify({ schema_version: 1, platform: 'claude', event: 'pre_tool_use', session_id: 's1', workspace_root: root, payload });
+    const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd: root, input, env: { ...process.env, ...env } });
+    expect(r.status).not.toBeNull();
+}
+
+describe('council round 3: every matched rule yields duties or a counted error', () => {
+    it('counts a matched rule whose file is missing', () => {
+        const root = workspace();
+        fs.rmSync(path.join(root, 'dist', 'agent-src', 'rules', 'sot.md'));
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
+    });
+    it('counts a router whose tiers are not lists', () => {
+        const root = workspace();
+        fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify({ tier_1: 'oops', tier_2: [{ id: 'sot', triggers: 'nope' }] }));
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
+    });
+    it('keeps the duty counts and errors across a compaction, clearing only reads', () => {
+        const root = workspace();
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
+        fs.writeFileSync(path.join(root, 'dist', 'router.json'), '{ broken');
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'y.md'), content: 'y' } });
+        const ledgerPath = ledgerFile(root, key);
+        const before = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as Record<string, unknown>;
+        before['fired'] = { 'src/a.ts': true };
+        fs.writeFileSync(ledgerPath, JSON.stringify(before));
+        run(root, {}, 'pre_compact');
+        const after = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as Record<string, unknown>;
+        expect(after['reads']).toEqual({});
+        expect(after['duty_errors']).toBe(1);
+        expect(after['fired']).toEqual({ 'src/a.ts': true });
+        expect(duty(root)[`sot::${REF}`]).toMatchObject({ pending: 1 });
+    });
+    it('reads an inline load_context list the way YAML does', () => {
+        const root = workspace();
+        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', 'sot.md'), `---\ntype: "auto"\nload_context: ["${REF}"] # inline\n---\n\n# sot\n`);
+        expect(dutyForPath('.claude/a.md', root)).toEqual([{ rule: 'sot', reference: REF, resolved: RESOLVED }]);
+    });
+    it.each([
+        ['a null tier entry', { tier_1: [null] }],
+        ['a trigger that is not an object', { tier_1: [{ id: 'sot', triggers: [5] }] }],
+        ['a router that is an array', [{ id: 'sot', triggers: [{ path_prefix: '.claude/' }] }]],
+    ])('counts %s, and the hook still exits 0', (_name, router) => {
+        const root = workspace();
+        fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(router));
+        const input = JSON.stringify({ schema_version: 1, platform: 'claude', event: 'pre_tool_use', session_id: 's1', workspace_root: root, payload: { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } } });
+        const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd: root, input, env: { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: '' } });
+        expect(r.status).toBe(0);
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
+    });
+    it('counts a rule whose frontmatter is not a mapping', () => {
+        const root = workspace();
+        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', 'sot.md'), '---\n- just\n- a list\n---\n\n# sot\n');
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
+    });
+});
diff --git a/tests/scripts/reread_guard_hook.test.ts b/tests/scripts/reread_guard_hook.test.ts
index 6fc69aeb00..78bdd51a97 100644
--- a/tests/scripts/reread_guard_hook.test.ts
+++ b/tests/scripts/reread_guard_hook.test.ts
@@ -32,6 +32,7 @@ import {
     isExemptPath,
     isRangedRead,
     ledgerFile,
+    wholeFileCatPath,
 } from '../../src/scripts/hooks/reread_guard_hook.js';
 
 const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
@@ -368,3 +369,52 @@ describe('reread_guard_hook E2E', () => {
         expect([0, 2]).toContain(run(readEvent(root, abs), root).status);
     });
 });
+
+// ── Reference-duty fitness (road-to-a-reference-that-arrives-before-the-act 2.2) ──
+
+describe('wholeFileCatPath — a Bash read the ledger can count', () => {
+    it('takes a plain `cat <absolute file>` and nothing broader', () => {
+        expect(wholeFileCatPath('cat /w/src/a.ts')).toBe('/w/src/a.ts');
+        expect(wholeFileCatPath('  cat "/w/docs/x y.md" ')).toBe('/w/docs/x y.md');
+        // A relative path resolves against the shell's cwd, which the hook cannot see.
+        expect(wholeFileCatPath('cat src/a.ts')).toBeNull();
+        expect(wholeFileCatPath('cat ~/a.ts')).toBeNull();
+        expect(wholeFileCatPath('cat /w/$F')).toBeNull();
+        expect(wholeFileCatPath('cat /w/*.md')).toBeNull();
+        expect(wholeFileCatPath('cat\n/w/a.md')).toBeNull();
+        expect(wholeFileCatPath('cat /w/{a,b}.md')).toBeNull();
+        expect(wholeFileCatPath('cat "/w/a\\b.md"')).toBeNull();
+        expect(wholeFileCatPath('cat a.ts | head')).toBeNull();
+        expect(wholeFileCatPath('cat a.ts b.ts')).toBeNull();
+        expect(wholeFileCatPath('cat -n a.ts')).toBeNull();
+        expect(wholeFileCatPath('cat a.ts > b.ts')).toBeNull();
+        expect(wholeFileCatPath('grep x a.ts')).toBeNull();
+    });
+});
+
+describe('deriveSessionKey separates a subagent from its parent', () => {
+    it('keys on agent_id when the payload carries one', () => {
+        const env = { session_id: 's' };
+        expect(deriveSessionKey(env, { agent_id: 'a1' })).not.toBe(deriveSessionKey(env, {}));
+        expect(deriveSessionKey(env, { agent_id: 'a1' })).toBe(deriveSessionKey(env, { agent_id: 'a1' }));
+        expect(deriveSessionKey(env, { agent_id: 'a1' })).not.toBe(deriveSessionKey(env, { agent_id: 'a2' }));
+    });
+});
+
+describe('E2E: the ledger as the reference duty needs it', () => {
+    it('records a whole-file `cat` through Bash as a full read', () => {
+        const { root, abs } = makeWorkspace();
+        run(envelope(root, { tool_name: 'Bash', tool_input: { command: `cat ${abs}` } }), root);
+        const key = deriveSessionKey({ session_id: 'sess-1' }, {});
+        const ledger = JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8'));
+        expect(Object.keys(ledger.reads)).toEqual([path.relative(root, abs)]);
+    });
+    it('clears the recorded reads on pre_compact, so a duty applies again', () => {
+        const { root, abs } = makeWorkspace();
+        run(readEvent(root, abs), root);
+        const key = deriveSessionKey({ session_id: 'sess-1' }, {});
+        expect(Object.keys(JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')).reads)).toHaveLength(1);
+        run(JSON.stringify({ schema_version: 1, platform: 'claude', event: 'pre_compact', session_id: 'sess-1', workspace_root: root, payload: {} }), root);
+        expect(JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')).reads).toEqual({});
+    });
+});
```
