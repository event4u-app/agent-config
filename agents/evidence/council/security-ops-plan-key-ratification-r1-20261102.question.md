<!-- evidence-type: analysis -->

# Ratification review — `security_ops.plan` joins class B in settings-ask-protocol — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/rules/settings-ask-protocol.md` (and its byte-identical projection `dist/agent-src/rules/settings-ask-protocol.md`), is a high-consequence rule on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: 0ab2faeecf681fe424278a4ba18eed486a91784c1e3f41228195d5673dc042fb

(The digest covers the two gated files at commit `9aa8a8890c`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

ADR-304 lets `/audit security` find a deployed project with no lever inventory and offer once: "plan a security & maintenance section?". Before this change the answer lived only for one run. Owner question OQ-60 item 2 asked whether to persist that answer as a settings key so it is asked once per user; the repository owner answered "as recommended", which for item 2 was yes (`agents/evidence/owner-directives/2026-11-02-oq-59-60-answers.md`).

`settings-ask-protocol` governs class-B keys: a key with a conservative template default that the agent may ask about once, at a moment the user's own request makes it necessary, and then persist with `agent-config settings:set <key> <value> --source jit-answer`. The rule names every class-B key and their count; a test derives that list from the contract table in `docs/contracts/settings-classes.md` and fails when they disagree.

## What the change does

- Adds `security_ops.plan` (boolean, template default `false`) to the settings template, the server schema and the class contract as class B, disposition `un-inferrable`.
- In the rule: the B count goes from 3 to 4, the key is named in the class-B list with its conservative default, and the heading counting all ask-producing keys goes from five to six. No Iron Law line, no slot, no budget and no other clause changes.
- The reader: `planAnswer()` reads the user-global settings file and the provenance sidecar `settings:set` writes. A stamped `jit-answer`, `manual` or `gui` value is a decision; the unstamped template `false` is `unanswered`; an unstamped `true` (a hand edit) is `yes`; `true` stamped `auto-detected` is `unanswered`; anything unreadable is `unanswered`. `audit:security`'s contain finding then says one of: offer once and name the command that records the answer; hand off to feature-planning without asking; or stay silent with the finding left in the report.
- `true` means the agent drafts a plan with feature-planning and the control-section blueprint when the finding appears. It does not build or throw a lever; ADR-304 § 1 is unchanged.

Separate, ungated parts of the same pull request, for context only: an `automation: off | propose` field in the consumer lever inventory (an advisory may propose a lever to its owner, nothing throws one), and `/audit` widened to the `engineering` workspace with a new `audit:agents` CLI verb.

## The diff — the gated rule and the contract it is derived from

```diff
diff --git a/docs/contracts/settings-classes.md b/docs/contracts/settings-classes.md
index 1c85951f52..b2e63052e1 100644
--- a/docs/contracts/settings-classes.md
+++ b/docs/contracts/settings-classes.md
@@ -151,7 +151,7 @@ are not triggers. This half is **prose, not lint** — no gate can read the
 agent's reason for choosing a moment, and claiming otherwise would be the
 coverage inflation this repository's gate discipline exists to refuse.
 
-That invariant is why B is small — **three keys**. It is not a placeholder for a
+That invariant is why B is small — **four keys**. It is not a placeholder for a
 larger set; it is the set that passes both halves.
 
 | Key | Why a just-in-time ask is the right shape | Conservative default |
@@ -159,6 +159,7 @@ larger set; it is the set that passes both halves.
 | `personal.open_edited_files` | it starts running the binary named in `personal.ide` on every edit — the user should say yes once before that begins | `false` |
 | `personal.canary_name` | un-inferrable, and answering arms the session-degradation canary; one keypress to accept the prefill | `""` (canary dark) |
 | `memory.learn_on_session_end` | it turns on automatic memory writes at the end of every session — a standing write the user should authorise | `false` |
+| `security_ops.plan` | only the user knows whether a deployed product should get a containment section; asked when their own `/audit security` or feature plan finds none, then persisted (OQ-60 item 2) | `false` |
 
 ## Class B is a persistence property, not an enforcement claim
 
@@ -618,6 +619,7 @@ Rows follow template order, so a diff against the template reads straight down.
 | `advisories.mode` | C | `notify` | a notice at every first session start of a day; turning it on for an install that never asked is a flip the agent may not make | consent |
 | `advisories.egress` | C | `query` | decides which package names and versions leave the machine on a refresh | policy |
 | `advisories.kev` | C | `on` | decides whether a refresh reads the CISA known-exploited catalog that raises a tier | policy |
+| `security_ops.plan` | B | `false` | turns a containment finding into a drafted plan without asking again — the user should say yes once (OQ-60) | un-inferrable |
 | `update.mode` | C | `notify` | a standing authorisation to replace the user's global install; `auto` is something they cannot un-see happening | consent |
 | `worktrees.cleanup` | C | `notify` | a standing authorisation to delete worktree directories on the proven-merged set; `auto` removes them unasked (ADR-295) | consent |
 | `legal_review_prep.acknowledged` | C | `false` | the consent gate; the safety floor requires the wizard checkbox | consent |
diff --git a/src/rules/settings-ask-protocol.md b/src/rules/settings-ask-protocol.md
index e6de178744..e36be09b77 100644
--- a/src/rules/settings-ask-protocol.md
+++ b/src/rules/settings-ask-protocol.md
@@ -33,7 +33,7 @@ obligation_frequency: "per-task"
 # Settings-Ask Protocol
 
 A settings question is the one ask where the agent poses the question *and* owns
-where the answer goes. Five keys can produce one, in two mechanisms that look
+where the answer goes. Six keys can produce one, in two mechanisms that look
 identical from outside and differ completely underneath.
 
 ## The Iron Law
@@ -61,7 +61,7 @@ Slot 4 is read from the class, never from taste:
 
 | Class | Slot 4 reads | Writer |
 |---|---|---|
-| **B** (3 keys) | "persisted to your global settings — you will not be asked again" | `agent-config settings:set <key> <value> --source jit-answer` |
+| **B** (4 keys) | "persisted to your global settings — you will not be asked again" | `agent-config settings:set <key> <value> --source jit-answer` |
 | **C** set to `ask` | "not saved; making it permanent is a human edit or the GUI" | none — the agent writes nothing |
 
 **"Not saved" is about persistence, not about how long the answer is honoured.**
@@ -69,12 +69,12 @@ How long it stays cached in working state is the key's own business, and several
 keys state their own scope. Reading the C path as "re-ask every execution" would
 turn a fence against illegal writes into a source of extra questions.
 
-## The five keys
+## The six keys
 
 **Class B — persist once**: `personal.canary_name` ·
-`personal.open_edited_files` · `memory.learn_on_session_end`. Each ships a
-conservative default (`""`, `false`, `false`), so absent is indistinguishable
-from *no* and never from *yes*.
+`personal.open_edited_files` · `memory.learn_on_session_end` ·
+`security_ops.plan`. Each ships a conservative default (`""`, `false`, `false`,
+`false`), so absent is indistinguishable from *no* and never from *yes*.
 
 **Class C carrying an `ask` value in its own enum** — a runtime question whose
 answer dies with the run: `subagents.adversarial_council`,
```

## The diff — the reader and the template, for context

```diff
diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index fd726cfd85..2fd987c082 100644
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -1520,6 +1520,20 @@ advisories:
   egress: query
   kev: on
 
+# --- Security & maintenance section — the plan offer (ADR-304) ---
+#
+# When `/audit security` (or feature planning) finds a deployed project with no
+# lever inventory, it offers once: "plan a security & maintenance section?"
+# Your answer is stored here, user-global, so the offer is not repeated.
+#
+#   false  (default) not planned — the finding stays in the report, and the
+#          offer is made once while no answer is recorded
+#   true   plan it: the agent drafts the section with feature-planning and the
+#          control-section blueprint when the finding appears. It plans; it
+#          never builds a lever or throws one in a deployed product
+security_ops:
+  plan: false
+
 # --- Update install mode ---
 #
 # What the agent may DO about a newer release, as opposed to whether it
diff --git a/src/scripts/_lib/security_ops.ts b/src/scripts/_lib/security_ops.ts
index 29eccad6fb..cbbca6b1c2 100644
--- a/src/scripts/_lib/security_ops.ts
+++ b/src/scripts/_lib/security_ops.ts
@@ -12,6 +12,8 @@ import * as path from 'node:path';
 
 import { parse as parseYaml } from 'yaml';
 
+import { globalRoot, provenanceFilePath, settingsFilePath } from '../_cli/cmd_settings_set.js';
+
 export const LEVER_INVENTORY = path.join('agents', 'settings', 'security-ops.yml');
 
 /** A file whose presence says the project is deployed, not a library or script. */
@@ -41,6 +43,59 @@ export function readLevers(root: string): Lever[] | null | 'invalid' {
     }
 }
 
+/**
+ * The inventory's `automation` mode, `off` when the inventory is absent or
+ * invalid — a proposal is only ever built from an inventory that validated.
+ */
+export function readAutomation(root: string): Automation {
+    const file = path.join(root, LEVER_INVENTORY);
+    if (!fs.existsSync(file)) return 'off';
+    try {
+        const doc = parseYaml(fs.readFileSync(file, 'utf8')) as unknown;
+        return validateSecurityOps(doc).length === 0 && (doc as SecurityOps).automation === 'propose' ? 'propose' : 'off';
+    } catch {
+        return 'off';
+    }
+}
+
+export type Automation = 'off' | 'propose';
+
+/** The persisted answer to "plan a security & maintenance section?" (OQ-60 item 2). */
+export type PlanAnswer = 'unanswered' | 'yes' | 'no';
+
+const DECIDING_SOURCES = new Set(['jit-answer', 'manual', 'gui']);
+
+/**
+ * `security_ops.plan` as a decision, read from the user-global settings file and
+ * its provenance sidecar. The template default `false` carries no stamp, so it
+ * reads `unanswered` — only a stamped answer is a recorded no. A `true` with no
+ * stamp is a hand edit and counts; a `true` stamped `auto-detected` does not,
+ * because the machine may not reach this answer for the user. Anything
+ * unreadable is `unanswered`, never `yes`.
+ */
+export function planAnswer(env: NodeJS.ProcessEnv = process.env): PlanAnswer {
+    const root = globalRoot(env);
+    let value: unknown;
+    try {
+        const doc = parseYaml(fs.readFileSync(settingsFilePath(root), 'utf8')) as unknown;
+        const section = isObj(doc) ? doc['security_ops'] : undefined;
+        value = isObj(section) ? section['plan'] : undefined;
+    } catch {
+        return 'unanswered';
+    }
+    let source: unknown;
+    try {
+        const prov = JSON.parse(fs.readFileSync(provenanceFilePath(root), 'utf8')) as unknown;
+        const entry = isObj(prov) ? prov['security_ops.plan'] : undefined;
+        source = isObj(entry) ? entry['source'] : undefined;
+    } catch {
+        source = undefined;
+    }
+    if (source === undefined) return value === true ? 'yes' : 'unanswered';
+    if (typeof source !== 'string' || !DECIDING_SOURCES.has(source)) return 'unanswered';
+    return value === true ? 'yes' : 'no';
+}
+
 export const LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
 export const OPERATOR_PATHS = ['sso', 'identity-provider', 'vpn'] as const;
 export const BREAK_GLASS = ['cli', 'edge-rule', 'infra-flag'] as const;
@@ -61,6 +116,12 @@ export interface SecurityOps {
     schema_version: 1;
     /** `separate` (the blueprint, default): the control surface does not share the app's HTTP stack. */
     control_surface?: 'separate' | 'same-app';
+    /**
+     * `off` (default): an advisory names the mapped lever in its report only.
+     * `propose`: the product's own advisory hook may raise a proposal to throw the
+     * mapped lever, which an operator confirms. Nothing throws a lever unattended.
+     */
+    automation?: Automation;
     operator_path: (typeof OPERATOR_PATHS)[number];
     break_glass: (typeof BREAK_GLASS)[number];
     levers: Lever[];
@@ -81,11 +142,18 @@ export function validateSecurityOps(value: unknown): string[] {
     if (!one(BREAK_GLASS, value['break_glass'])) out.push('break_glass must be cli|edge-rule|infra-flag — a path that works without the web UI');
     const surface = value['control_surface'] ?? 'separate';
     if (!one(['separate', 'same-app'], surface)) out.push('control_surface must be separate|same-app');
+    const automation = value['automation'] ?? 'off';
+    if (!one(['off', 'propose'], automation)) {
+        out.push('automation must be off|propose — an advisory may propose a lever, an operator confirms it; nothing throws one unattended (ADR-304)');
+    }
     const levers = value['levers'];
     if (!Array.isArray(levers) || levers.length === 0) {
         out.push('levers must name at least one lever');
         return out;
     }
+    if (automation === 'propose' && !levers.some((l) => isObj(l) && Array.isArray(l['packages']) && l['packages'].length > 0)) {
+        out.push('automation: propose needs at least one lever with packages — otherwise no advisory maps to a lever and there is nothing to propose');
+    }
     levers.forEach((l, i) => {
         if (!isObj(l)) {
             out.push(`levers[${i}]: not an object`);
diff --git a/src/scripts/audit_security.ts b/src/scripts/audit_security.ts
index 5768a756b5..e259715500 100644
--- a/src/scripts/audit_security.ts
+++ b/src/scripts/audit_security.ts
@@ -30,7 +30,7 @@ import { parse as parseYaml } from 'yaml';
 
 import { readInventory, unsupportedLockfiles } from './_lib/advisory_inventory.js';
 import { reportScanned } from './_lib/scan_scope.js';
-import { isDeployed, LEVER_INVENTORY, validateSecurityOps } from './_lib/security_ops.js';
+import { isDeployed, LEVER_INVENTORY, type PlanAnswer, planAnswer, validateSecurityOps } from './_lib/security_ops.js';
 import { scan_workflow } from './lint_workflow_security.js';
 
 export type LensStatus = 'ok' | 'finding' | 'unknown' | 'not-applicable';
@@ -160,7 +160,16 @@ function pipelineLens(root: string, read: { n: number }): LensResult {
     return { lens: 'pipeline', status: 'finding', findings };
 }
 
-function containLens(root: string, deployed: boolean, read: { n: number }): LensResult {
+const BLUEPRINT = 'feature-planning, blueprint security-audit/references/control-section.md';
+
+/** What the finding says about the plan, by the user's recorded answer (OQ-60 item 2). */
+function planOffer(answer: PlanAnswer): string {
+    if (answer === 'yes') return `security_ops.plan: true — hand off to feature-planning (${BLUEPRINT}), no question`;
+    if (answer === 'no') return 'security_ops.plan: false (answered) — not offered again; the finding stays';
+    return `Offer once: plan a security & maintenance section? (${BLUEPRINT}) — record the answer with \`agent-config settings:set security_ops.plan <true|false> --source jit-answer\``;
+}
+
+function containLens(root: string, deployed: boolean, read: { n: number }, answer: PlanAnswer): LensResult {
     if (!exists(root, LEVER_INVENTORY)) {
         if (!deployed) return { lens: 'contain', status: 'not-applicable', reason: 'no deploy signal — a library or script has nothing to switch at runtime', findings: [] };
         return {
@@ -169,7 +178,7 @@ function containLens(root: string, deployed: boolean, read: { n: number }): Lens
             findings: [
                 {
                     where: LEVER_INVENTORY,
-                    detail: 'no lever inventory — could this product be switched off, in part or whole, within minutes, with the operator still able to get in? Offer: plan a security & maintenance section (feature-planning, blueprint security-audit/references/control-section.md)',
+                    detail: `no lever inventory — could this product be switched off, in part or whole, within minutes, with the operator still able to get in? ${planOffer(answer)}`,
                 },
             ],
         };
@@ -203,10 +212,11 @@ function recoverLens(root: string, deployed: boolean, read: { n: number }): Lens
     };
 }
 
-export function auditSecurity(root: string): SecurityAudit {
+export function auditSecurity(root: string, opts: { planAnswer?: PlanAnswer } = {}): SecurityAudit {
     const deployed = isDeployed(root);
     const read = { n: 0 };
-    const lenses = [supplyLens(root, read), pipelineLens(root, read), containLens(root, deployed, read), recoverLens(root, deployed, read)];
+    const answer = opts.planAnswer ?? planAnswer();
+    const lenses = [supplyLens(root, read), pipelineLens(root, read), containLens(root, deployed, read, answer), recoverLens(root, deployed, read)];
     return {
         root,
         deployed,
```

## What to answer

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one stance line of the form `STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`.
