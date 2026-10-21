<!-- evidence-type: analysis -->

<!-- Round 9 prompt, 2026-10-21, branch drain/placeholders-20261021, verbatim. -->

# Modification review, round 9 — the rewrite axis and its capability check, alone

You are one seat of a modification review. Roadmap `road-to-placeholders-on-the-wire`,
step 6.1: a dated rewrite axis in `host_lowering.yaml`, per channel (`output`
post-tool, `input` pre-tool, `prompt`), each `replace`, `offered`, `gate` or
`none` with an `answered_at` date, and the one check that turns an answer into
authority.

## Why this round is this size

Rounds 7 and 8 reviewed this axis together with tool-result replacement (an
engine that emits `updatedToolOutput`). Both round-8 seats asked for staging —
the axis and the capability check first, then output replacement, then any
version-tolerance policy and the ADR-285 amendment as separate decisions. This
change is the first stage only. Removed from it and kept on a local branch for
their own reviews: the emission engine, the chunk-ceiling raise, the reversed
block-precedence assertion, the ADR-285 amendment, the coverage table and the
`domain-safety-pii` correction. The dispatcher, the egress stage, the payload
stub, the byte census and every budget file are byte-identical to `origin/main`.

## What the change does

- `host_lowering.yaml` gains a `rewrite:` map on the `claude` row:
  `output: replace` and `input: replace`, each citing the live probe of
  2026-10-20 against Claude Code 2.1.304 (`claude -p --settings <scratch file>`,
  no host settings file written; replacement observed delivered for Read, Bash,
  Grep and an MCP tool, a mismatched one dropped in silence, `updatedInput`
  delivered), and `prompt: gate` from the hooks documentation. A row with no
  `rewrite:` states nothing (`unstated`).
- `host_lowering.ts` carries the raw map on each row (`rewrite_raw`); nothing in
  the hook path reads it.
- `rewrite_capability.ts` issues an opaque frozen `RewriteCapability` (tracked
  in a module-private `WeakSet`, so a look-alike object is not one) only when
  every prerequisite holds: a propagating trampoline, a current `verified`
  block, a bound native slot; for `gate` a `block_exit`; for `replace` a native
  envelope, a probed `host_version`, and a structured probe record at
  `agents/evidence/analysis/host-<what>-probe-<date>.md` whose lines state
  `host`, `host_version`, `channel` and `result: delivered`, dated the day of the
  answer, with no later record for that host and channel saying otherwise. If a
  caller supplies the running host's version, **any version but the probed one —
  a patch release included — gets nothing**; `null` (unobservable) gets nothing.
  Revocations a caller supplies refuse too.
- `lint_hook_manifest` runs the same check over the table (it passes no running
  version: it judges the table, not a host), refuses malformed, undated,
  future-dated or unknown answers, and holds `src/config/rewrite-probe-attestations.json` <!-- ref-ignore -->
  equal to the probe records, so a consumer install without `agents/evidence/`
  resolves the same answers.

**Nothing acts on the axis.** No module in the hook path emits a rewrite field;
the only reader today is the lint. The capability only becomes authority when a
later, separately reviewed stage acts on it.

## Changed since round 8, for this part

The version check was same-minor (a patch release inherited the capability).
Both seats named that as widening one probed build to unprobed builds. It is
now exact. One test assertion changed with it, in the stricter direction: "a
running host on another minor version revokes a replace; a patch release does
not" became "a running host on any version other than the probed one revokes a
replace, a patch release included" (seen red before the code change). No other
test, fixture or threshold changed.

## Tests (all passing)

`tests/scripts/lint_hook_manifest.test.ts`, 66 tests, 32 of them on the axis:
absent is unstated and authorizes nothing; `offered` authorizes nothing;
`rewrite-toward-non-replace-host-refused` for each `replace` prerequisite missing
alone (no envelope, no live probe, a missing, out-of-tree or climbing probe
path, a probe not recording delivery for this version and channel, a
non-propagating trampoline, an expired row, an unbound slot, an unverified row,
an answer dated on another day than its probe, a later contradicting probe, a
running host on another version); `rewrite-gate-without-refusal` for each gate
prerequisite alone; `rewrite-axis-malformed` for non-mapping values, undated,
non-calendar, future-dated, unknown channel or mode; a capability-shaped object
is not a capability; the shipped attestation copy must equal the records.

## The diff

`origin/main..HEAD` for every source and config file of the change, comment
lines stripped from added TypeScript hunks. Gated by `check_kernel_edit_ratified`:
`host_lowering.yaml`, `host_lowering.ts` and the compiled `host_lowering.json`
(not shown; it is the YAML compiled). Subject digest at head `fd17092bc`:
`2b6500bb3de256cf16a7b477232eab99e408b26d9f0c4b1adaaea5f1849b417a`. Not shown:
the test file (titles above) and a contract paragraph in
`docs/contracts/hook-architecture-v1.md` describing the axis.

```diff
diff --git a/src/config/rewrite-probe-attestations.json b/src/config/rewrite-probe-attestations.json
new file mode 100644
index 000000000..80ddad08f
--- /dev/null
+++ b/src/config/rewrite-probe-attestations.json
@@ -0,0 +1,32 @@
+{
+  "_comment": "Generated from agents/evidence/analysis/host-*-probe-*.md by lint_hook_manifest --write-probe-attestations; do not edit.",
+  "records": [
+    {
+      "path": "agents/evidence/analysis/host-input-rewrite-probe-2026-08-23.md",
+      "date": "2026-08-23",
+      "host": null,
+      "host_version": null,
+      "channel": null,
+      "result": null,
+      "auth_mode": null
+    },
+    {
+      "path": "agents/evidence/analysis/host-input-rewrite-probe-2026-10-20.md",
+      "date": "2026-10-20",
+      "host": "claude",
+      "host_version": "2.1.304",
+      "channel": "input",
+      "result": "delivered",
+      "auth_mode": "subscription"
+    },
+    {
+      "path": "agents/evidence/analysis/host-output-rewrite-probe-2026-10-20.md",
+      "date": "2026-10-20",
+      "host": "claude",
+      "host_version": "2.1.304",
+      "channel": "output",
+      "result": "delivered",
+      "auth_mode": "subscription"
+    }
+  ]
+}
diff --git a/src/scripts/_lib/rewrite_axis.ts b/src/scripts/_lib/rewrite_axis.ts
new file mode 100644
index 000000000..b860fedd6
--- /dev/null
+++ b/src/scripts/_lib/rewrite_axis.ts
@@ -0,0 +1,81 @@
+
+export const REWRITE_CHANNELS = ['output', 'input', 'prompt'] as const;
+export type RewriteChannel = (typeof REWRITE_CHANNELS)[number];
+export const REWRITE_CHANNEL_SLOT: Readonly<Record<RewriteChannel, string>> = {
+    output: 'post_tool_use',
+    input: 'pre_tool_use',
+    prompt: 'user_prompt_submit',
+};
+
+export const REWRITE_MODES = ['replace', 'offered', 'gate', 'none'] as const;
+export type RewriteMode = (typeof REWRITE_MODES)[number];
+
+export interface RewriteAnswer {
+    mode: string;
+    answered_at: string | null;
+    docs_url: string | null;
+    probe: string | null;
+    host_version: string | null;
+}
+
+export type ParsedAxis =
+    | { readonly ok: true; readonly answers: ReadonlyMap<string, RewriteAnswer> }
+    | { readonly ok: false; readonly error: string };
+
+function asString(v: unknown): string | null {
+    if (v === null || v === undefined) return null;
+    if (v instanceof Date) return v.toISOString().slice(0, 10);
+    return String(v);
+}
+
+export function parseRewriteAxis(where: string, raw: unknown): ParsedAxis {
+    const answers = new Map<string, RewriteAnswer>();
+    if (raw === undefined) return { ok: true, answers };
+    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
+        return { ok: false, error: `${where} \`rewrite:\` is not a mapping` };
+    }
+    for (const [ch, av] of Object.entries(raw as Record<string, unknown>)) {
+        if (typeof av !== 'object' || av === null || Array.isArray(av)) {
+            return { ok: false, error: `${where}/${ch} rewrite answer is not a mapping` };
+        }
+        const a = av as Record<string, unknown>;
+        answers.set(ch, {
+            mode: String(a['mode'] ?? ''),
+            answered_at: asString(a['answered_at']),
+            docs_url: asString(a['docs_url']),
+            probe: asString(a['probe']),
+            host_version: asString(a['host_version']),
+        });
+    }
+    return { ok: true, answers };
+}
+
+export function rewriteModeFor(row: { readonly rewrite_raw: unknown }, channel: RewriteChannel): RewriteMode | 'unstated' {
+    const parsed = parseRewriteAxis('', row.rewrite_raw);
+    const mode = parsed.ok ? parsed.answers.get(channel)?.mode : undefined;
+    return (REWRITE_MODES as readonly string[]).includes(mode ?? '') ? (mode as RewriteMode) : 'unstated';
+}
diff --git a/src/scripts/_lib/rewrite_capability.ts b/src/scripts/_lib/rewrite_capability.ts
new file mode 100644
index 000000000..9ce7797d0
--- /dev/null
+++ b/src/scripts/_lib/rewrite_capability.ts
@@ -0,0 +1,237 @@
+import * as fs from "node:fs";
+import * as path from "node:path";
+
+import type { SurfaceRow } from "../hooks/host_lowering.js";
+import { parseRewriteAxis, REWRITE_CHANNEL_SLOT, type RewriteChannel } from "./rewrite_axis.js";
+
+export const REWRITE_PROBE_PATH = /^agents\/evidence\/analysis\/host-[a-z0-9-]+-probe-(\d{4}-\d{2}-\d{2})\.md$/;
+
+const ISSUED = new WeakSet<object>();
+
+export interface RewriteCapability {
+  readonly host: string;
+  readonly channel: RewriteChannel;
+  readonly mode: "replace" | "gate";
+  readonly probedVersion: string | null;
+  readonly expires: string;
+}
+
+export function isRewriteCapability(v: unknown): v is RewriteCapability {
+  return typeof v === "object" && v !== null && ISSUED.has(v);
+}
+
+export interface ProbeRecord {
+  readonly path: string;
+  readonly date: string;
+  readonly host: string | null;
+  readonly host_version: string | null;
+  readonly channel: string | null;
+  readonly result: string | null;
+  readonly auth_mode: string | null;
+}
+
+export const PROBE_ATTESTATIONS_REL = "src/config/rewrite-probe-attestations.json";
+
+function attestations(root: string): ProbeRecord[] {
+  try {
+    const raw = JSON.parse(fs.readFileSync(path.join(root, PROBE_ATTESTATIONS_REL), "utf-8")) as { records?: unknown };
+    return Array.isArray(raw.records) ? (raw.records as ProbeRecord[]).filter((r) => typeof r?.path === "string") : [];
+  } catch {
+    return [];
+  }
+}
+
+export function renderProbeAttestations(root: string): string {
+  const records = recordsOnDisk(root);
+  return `${JSON.stringify({ _comment: "Generated from agents/evidence/analysis/host-*-probe-*.md by lint_hook_manifest --write-probe-attestations; do not edit.", records }, null, 2)}\n`;
+}
+
+export interface CapabilityContext {
+  readonly today: string;
+  readonly root: string;
+  readonly observedHostVersion?: string | null;
+  readonly revoked?: ReadonlyArray<{ readonly host: string; readonly channel: string; readonly reason: string; readonly at: string }>;
+  readonly probes?: readonly ProbeRecord[];
+}
+
+export type CapabilityResult =
+  | { readonly ok: true; readonly capability: RewriteCapability }
+  | { readonly ok: false; readonly gaps: readonly string[] };
+
+function lineValue(lines: readonly string[], key: string): string | null {
+  const hit = lines.find((l) => l.startsWith(`${key}: `));
+  return hit === undefined ? null : hit.slice(key.length + 2).trim();
+}
+
+export function readProbeRecord(root: string, rel: string): ProbeRecord | null {
+  const m = REWRITE_PROBE_PATH.exec(rel);
+  if (m === null) return null;
+  let text: string;
+  try {
+    text = fs.readFileSync(path.join(root, rel), "utf-8");
+  } catch {
+    return attestations(root).find((a) => a.path === rel) ?? null;
+  }
+  const lines = text.split(/\r?\n/).map((l) => l.trim());
+  return {
+    path: rel,
+    date: m[1] as string,
+    host: lineValue(lines, "host"),
+    host_version: lineValue(lines, "host_version"),
+    channel: lineValue(lines, "channel"),
+    result: lineValue(lines, "result"),
+    auth_mode: lineValue(lines, "auth_mode"),
+  };
+}
+
+export function listProbeRecords(root: string): ProbeRecord[] {
+  const disk = recordsOnDisk(root);
+  return disk.length > 0 ? disk : attestations(root);
+}
+
+function recordsOnDisk(root: string): ProbeRecord[] {
+  const dir = path.join(root, "agents", "evidence", "analysis");
+  let names: string[];
+  try {
+    names = fs.readdirSync(dir);
+  } catch {
+    return [];
+  }
+  const out: ProbeRecord[] = [];
+  for (const n of names.sort()) {
+    const r = readProbeRecord(root, `agents/evidence/analysis/${n}`);
+    if (r !== null) out.push(r);
+  }
+  return out;
+}
+
+export function rewriteCapabilityGaps(
+  host: string,
+  row: SurfaceRow,
+  channel: RewriteChannel,
+  ctx: CapabilityContext,
+): string[] {
+  const parsed = parseRewriteAxis(host, row.rewrite_raw);
+  if (!parsed.ok) return [parsed.error];
+  const answer = parsed.answers.get(channel);
+  const mode = answer?.mode;
+  if (answer === undefined || (mode !== "replace" && mode !== "gate")) {
+    return [`the answer is ${mode === undefined ? "unstated" : `'${mode}'`}, which authorizes nothing`];
+  }
+  const why: string[] = [];
+  const slotName = REWRITE_CHANNEL_SLOT[channel];
+  const slot = row.slots.get(slotName);
+  if (row.fail_policy !== "propagate") why.push(`the trampoline does not propagate (\`fail_policy: ${row.fail_policy}\`)`);
+  if (row.verified === null) why.push("the row is unverified");
+  else if (row.verified.expires < ctx.today) why.push(`the row expired ${row.verified.expires}`);
+  if (slot === undefined || !slot.native.some((n) => n !== "" && n !== "null")) {
+    why.push(`this package binds no native \`${slotName}\` event here`);
+  }
+  if (mode === "gate") {
+    if (slot !== undefined && slot.block_exit === null) why.push(`\`${slotName}\` carries no \`block_exit\``);
+    return why;
+  }
+  if (row.json_shape === "none") why.push("the row has no native envelope (`json_shape: none`)");
+  if (answer.host_version === null) why.push("the answer names no probed host version");
+  if (answer.probe === null) {
+    why.push("the answer cites no live substitution probe (use `offered` for a documented field)");
+    return why;
+  }
+  if (!REWRITE_PROBE_PATH.test(answer.probe)) {
+    why.push(`the probe ${answer.probe} is not a record under agents/evidence/analysis/ named host-<what>-probe-<date>.md`);
+    return why;
+  }
+  const rec = readProbeRecord(ctx.root, answer.probe);
+  if (rec === null) {
+    why.push(`the cited probe ${answer.probe} does not exist`);
+    return why;
+  }
+  if (answer.host_version !== null) {
+    const want: Array<[string, string | null, string]> = [
+      ["host", rec.host, host],
+      ["host_version", rec.host_version, answer.host_version],
+      ["channel", rec.channel, channel],
+      ["result", rec.result, "delivered"],
+    ];
+    const missing = want.filter(([, got, exp]) => got !== exp).map(([k, , exp]) => `\`${k}: ${exp}\``);
+    if (missing.length > 0) why.push(`the probe ${answer.probe} does not record ${missing.join(", ")}`);
+  }
+  if (answer.answered_at !== rec.date) {
+    why.push(`the answer is dated ${answer.answered_at ?? "nowhere"} and its probe ${rec.date}; a replace is answered the day it was probed`);
+  }
+  const probes = ctx.probes ?? listProbeRecords(ctx.root);
+  const later = probes.find(
+    (p) => p.path !== rec.path && p.host === host && p.channel === channel && p.date > rec.date && p.result !== "delivered",
+  );
+  if (later !== undefined) why.push(`a later probe ${later.path} records \`result: ${later.result ?? "nothing"}\``);
+  const seen = ctx.observedHostVersion;
+  if (seen === null) why.push("the running host's version is not observable, so drift from the probed version cannot be ruled out");
+  else if (seen && answer.host_version !== null && seen !== answer.host_version) {
+    why.push(`the running host is ${seen} and the probe observed ${answer.host_version}`);
+  }
+  const revoked = ctx.revoked?.find((r) => r.host === host && r.channel === channel);
+  if (revoked) why.push(`revoked on this workspace at ${revoked.at} after a ${revoked.reason}`);
+  return why;
+}
+
+export function resolveRewriteCapability(
+  host: string,
+  row: SurfaceRow | null | undefined,
+  channel: RewriteChannel,
+  ctx: CapabilityContext,
+): CapabilityResult {
+  if (row === null || row === undefined) return { ok: false, gaps: [`no lowering row for ${host}`] };
+  const gaps = rewriteCapabilityGaps(host, row, channel, ctx);
+  if (gaps.length > 0) return { ok: false, gaps };
+  const parsed = parseRewriteAxis(host, row.rewrite_raw);
+  const answer = parsed.ok ? parsed.answers.get(channel) : undefined;
+  const capability: RewriteCapability = Object.freeze({
+    host,
+    channel,
+    mode: answer?.mode as "replace" | "gate",
+    probedVersion: answer?.mode === "replace" ? answer.host_version : null,
+    expires: row.verified?.expires ?? ctx.today,
+  });
+  ISSUED.add(capability);
+  return { ok: true, capability };
+}
diff --git a/src/scripts/hooks/host_lowering.ts b/src/scripts/hooks/host_lowering.ts
index 446bbc52a..00ae32c8d 100644
--- a/src/scripts/hooks/host_lowering.ts
+++ b/src/scripts/hooks/host_lowering.ts
@@ -125,2 +125,8 @@ export interface SurfaceRow {
     slots: Map<string, SlotRow>;
+    rewrite_raw: unknown;
 }
@@ -197,2 +203,3 @@ function _structure(raw: Record<string, unknown> | null): HostLowering {
             surfaces.set(surface, {
+                rewrite_raw: s['rewrite'],
                 entry_shape: String(s['entry_shape'] ?? 'none'),
diff --git a/src/scripts/hooks/host_lowering.yaml b/src/scripts/hooks/host_lowering.yaml
index 3e4f6a6ee..844e7b852 100644
--- a/src/scripts/hooks/host_lowering.yaml
+++ b/src/scripts/hooks/host_lowering.yaml
@@ -103,2 +103,15 @@ hosts:
           expires: 2027-09-06
+        # What this package may do to each channel. A `replace` rests on a live
+        # probe record whose structured lines this table is checked against
+        # (rewrite_capability.ts), and authorizes nothing by itself: a stage
+        # acts only on a capability that check issues. The 2026-10-20 probe of
+        # Claude Code 2.1.304 observed a shape-preserving `updatedToolOutput`
+        # delivered for Read, Bash, Grep and an MCP tool, a mismatched one
+        # dropped in silence, and `updatedInput` delivered. `prompt` is a
+        # refusal, because UserPromptSubmit can block a prompt and cannot
+        # replace it. A row with no `rewrite:` states nothing (`unstated`).
+        rewrite:
+          output: { mode: replace, answered_at: 2026-10-20, host_version: 2.1.304, probe: agents/evidence/analysis/host-output-rewrite-probe-2026-10-20.md }
+          input:  { mode: replace, answered_at: 2026-10-20, host_version: 2.1.304, probe: agents/evidence/analysis/host-input-rewrite-probe-2026-10-20.md }
+          prompt: { mode: gate,    answered_at: 2026-09-29, docs_url: https://code.claude.com/docs/en/hooks.md }
         slots:
diff --git a/src/scripts/lint_hook_manifest.ts b/src/scripts/lint_hook_manifest.ts
index c66c46cff..7ca400bae 100644
--- a/src/scripts/lint_hook_manifest.ts
+++ b/src/scripts/lint_hook_manifest.ts
@@ -37,2 +37,4 @@ import { asOf } from "./_lib/as_of.js";
 import { parseHostLowering, type HostLowering } from "./hooks/host_lowering.js";
+import { parseRewriteAxis, REWRITE_CHANNELS, REWRITE_MODES, type RewriteChannel } from "./_lib/rewrite_axis.js";
+import { listProbeRecords, PROBE_ATTESTATIONS_REL, renderProbeAttestations, rewriteCapabilityGaps } from "./_lib/rewrite_capability.js";
 import { RE_ARM_EVENTS } from "./_lib/prefix_stable_surfaces.js";
@@ -773,2 +775,75 @@ export function _check_host_lowering(
   _check_slot_answers(table, errors);
+  _check_rewrite_axis(table, errors, today);
+}
+
+function _isCalendarDate(d: string): boolean {
+  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
+  const t = new Date(`${d}T00:00:00Z`);
+  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
+}
+
+export function _check_rewrite_axis(table: HostLowering, errors: string[], today: string, root: string = REPO_ROOT): void {
+  const probes = listProbeRecords(root);
+  if (root === REPO_ROOT) {
+    let shipped = "";
+    try {
+      shipped = fs.readFileSync(path.join(root, PROBE_ATTESTATIONS_REL), "utf-8");
+    } catch {
+    }
+    if (shipped !== renderProbeAttestations(root)) {
+      errors.push(
+        `${PROBE_ATTESTATIONS_REL}: rewrite-probe-attestation-drift — the shipped copy differs from the probe records; ` +
+          "run ./scripts-run src/scripts/lint_hook_manifest --write-probe-attestations.",
+      );
+    }
+  }
+  for (const [host, surfaces] of table) {
+    for (const [surface, row] of surfaces) {
+      const axis = parseRewriteAxis(`host_lowering.yaml: ${host}/${surface}`, row.rewrite_raw);
+      if (!axis.ok) {
+        errors.push(`${axis.error}.`);
+        continue;
+      }
+      for (const [channel, answer] of axis.answers) {
+        const where = `host_lowering ${host}/${surface}/${channel}`;
+        if (!(REWRITE_CHANNELS as readonly string[]).includes(channel)) {
+          errors.push(`${where}: rewrite-axis-malformed — unknown channel; the axis has ${REWRITE_CHANNELS.join(", ")}.`);
+          continue;
+        }
+        if (!(REWRITE_MODES as readonly string[]).includes(answer.mode)) {
+          errors.push(`${where}: rewrite-axis-malformed — unknown mode '${answer.mode}'; one of ${REWRITE_MODES.join(", ")}.`);
+          continue;
+        }
+        if (answer.answered_at === null || !_isCalendarDate(answer.answered_at)) {
+          errors.push(`${where}: rewrite-axis-malformed — no \`answered_at\` calendar date; the axis is dated like every column.`);
+          continue;
+        }
+        if (answer.answered_at > today) {
+          errors.push(`${where}: rewrite-axis-malformed — \`answered_at: ${answer.answered_at}\` is after ${today}.`);
+          continue;
+        }
+        if (answer.mode === "none") continue;
+        if (answer.docs_url === null && answer.probe === null) {
+          errors.push(`${where}: rewrite-axis-malformed — '${answer.mode}' cites nothing on the answer itself; a row's docs_url says nothing about rewriting.`);
+        }
+        if (answer.mode === "offered") continue;
+        const mode = answer.mode as "replace" | "gate";
+        const why = rewriteCapabilityGaps(host, row, channel as RewriteChannel, { today, root, probes });
+        if (why.length > 0) {
+          const id = mode === "replace" ? "rewrite-toward-non-replace-host-refused" : "rewrite-gate-without-refusal";
+          errors.push(`${where}: ${id} — ${why.join("; ")}.`);
+        }
+      }
+    }
+  }
 }
@@ -1010,2 +1085,6 @@ export function main(argv: string[]): number {
       strict = true;
+    } else if (a === "--write-probe-attestations") {
+      fs.writeFileSync(path.join(REPO_ROOT, PROBE_ATTESTATIONS_REL), renderProbeAttestations(REPO_ROOT), "utf-8");
+      process.stdout.write(`lint_hook_manifest: wrote ${PROBE_ATTESTATIONS_REL}\n`);
+      return 0;
     }
```

Answer each question below, numbered 1 to 9 in this order, each on its own
numbered top-level line, then close with exactly one stance line in the form
`STANCE: <label> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>` where
<label> is one of `ratified`, `confirmed-non-expanding`, `refused`.

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?
