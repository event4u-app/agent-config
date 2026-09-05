<!-- evidence-type: analysis -->
# Decision packet — `lean_projection.mode: delivery`

`road-to-the-tenth-arrival` Phase 3. **Prepared by an agent, decided by the
owner.** Nothing in this packet has been applied: `lean_projection.mode` still
resolves to `eager-all` on every host, asserted by
`tests/scripts/_lib/lean_projection_shipped_default.test.ts`, which is designed
to go red the moment the flip lands so that whoever lands it is sent here first.

**Measurement basis:** `origin/main@66f4a1cdd` plus branch
`drain/the-tenth-arrival`, measured 2026-09-04. Every number below is
reproduced by the command printed beside it; none is copied from the
2026-08-23 report.

**Validity condition, required by the AI council 2026-09-04:** the emission
figures below are a reading of this tree on this date. Rule bodies grow. If the
flip is taken after further rule edits, **re-run `model_rule_injection --corpus
tests/eval/routing-matrix` and re-derive the rows before applying the diff.**
The p90 has already moved once between the row's registration and today, which
is how this packet found the row stale — see § 2.

## 1 — What the owner is being asked to decide

The question is unchanged from the 2026-08-23 council and is quoted rather than
paraphrased, from `agents/roadmaps/archive/road-to-trigger-delivered-rule-bodies.md:497`:

> Is the owner willing to flip a delivery default on delivery-equivalence and
> cost alone, with behavioural equivalence explicitly unmeasured?

and the flag that made it owner-reserved, verbatim from the same block (`:498`):

> flag to owner for post-roadmap review given the authority question is
> genuinely close.

Two properties of that round matter and are stated because they are easy to
lose: it was **2 members configured, 1 answering** (`cli_quota_exhausted` on the
second) — a degraded reading, never convergence — and the flip was **not taken
even though all four pre-registered endpoints held**. What stopped it was the
unpaid slot charge plus the authority question, not a failed measurement.

**This roadmap does not answer that question and must not be read as answering
it.** What it does is remove a lock that was being cited over it wrongly: the
ninth disposition halted this workstream on `b-behavioural-bench-spend`, which
gates the always-on-tier bench on a different roadmap. AI council 2026-09-04
(anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, quorum 2/2,
$0.00 — both seats subscription-authed), both seats: that was a routing error,
and no hold prevents preparation.

## 2 — The re-derivation, and the stale row it found

```
$ ./scripts-run src/scripts/model_rule_injection --corpus tests/eval/routing-matrix
matched body tokens (exact BPE): p50=1764 p90=5042 p99=8510 max=13290
per-prompt cap = p90 rounded up to 500 = 5500 tok, applied as 20480 B (the concern's CAP_BYTES)
```

The concern's row is **derived, not picked** — `rule_inject_hook.ts:70-91` states
the rule ("the p90 from 0.4, rounded to 500", at 4.096 bytes/token) and ends
with *"Re-run that command if the corpus or the bodies move; a cap copied from a
stale measurement is worse than no cap, because it looks derived."*

Re-run today, the bodies have moved:

| | at row registration (2026-08) | today (2026-09-04) |
|---|---|---|
| p50 | 1,728 | 1,764 |
| **p90** | **4,804** | **5,042** |
| p99 | 8,248 | 8,510 |
| max | 12,957 | 13,290 |
| p90 rounded up to 500 | 5,000 tok | **5,500 tok** |
| × 4.096 B/tok | 20,480 B | **22,528 B** |

**The registered 20,480 B row had fallen below its own stated derivation.** It
is stale rather than conservative, and the script's printed line still says
"applied as 20480 B" because `CAP_BYTES` is a constant that nobody re-ran the
command for. This is the finding step 3.1 asks for, and it is the reason the
step was worth doing rather than guessing.

### Which slot rows actually move — checked, not assumed

`rule-inject` is bound on **three** slots in `hook_manifest.yaml`:
`user_prompt_submit`, `pre_tool_use`, `pre_compact`. It can only EMIT on two —
on `pre_compact` it clears its seen-latch and returns before any injection
(`src/scripts/hooks/rule_inject_hook.ts:258-261`). So the `pre_compact` row
stays at 2,048 and the activation charge recorded in
`hook-token-budget.json` — which names exactly two rows — **is correct**. That
was worth verifying: a bound slot is not an emitting slot, and the packet's first
draft moved three rows.

Derivation of the two rows that do move: **each rises by exactly the concern's
own ceiling**, leaving every other concern's existing headroom untouched. That
is deliberate — re-cutting the other twelve concerns' shared headroom is a
separate decision and is not smuggled in here.

| row | now | proposed | derivation |
|---|---|---|---|
| `per_concern_caps_bytes.rule-inject` | 20,480 | **22,528** | 5,500 tok × 4.096 B/tok |
| `per_slot_sum_caps_bytes.user_prompt_submit` | 4,096 | **26,624** | 4,096 + 22,528 |
| `per_slot_sum_caps_bytes.pre_tool_use` | 2,048 | **24,576** | 2,048 + 22,528 |
| `per_turn_aggregate_bytes.ceiling_bytes` | 47,104 | **294,912** | 26,624 + (24,576 + 2,048) × 10 + 2,048 — the file's own `ceiling_derivation` says this row is the arithmetic consequence of the slot rows and never a fresh number |

### A fourth hold the roadmap's three-hold table does not list

`src/scripts/schemas/agent-settings.schema.json:36-45` declares
`lean_projection.mode` with `"enum": ["eager-all", "thin"]`. **`delivery` is
not a permitted value.** The setting cannot be set to the mode this whole
workstream is about until the enum is widened. Found by reading the schema, not
by inference; asserted by the guard test so it cannot silently change.

### What `bench_hook_injection` can and cannot say — step 3.1's verify, honestly

Step 3.1's verify asks that `bench_hook_injection` "reads the concern within the
proposed rows". **It cannot, and the reason is structural.** The bench drives
each concern against a committed fixture envelope, and
`tests/fixtures/hooks/user_prompt_submit.json` carries the prompt
`"echo hello"`, which matches no rule trigger. Probed directly: with a
`lean_projection: mode: delivery` settings file present (created, run, deleted —
the file is gitignored and absent from this branch), the bench still reports
`rule-inject` at 0 B and the `user_prompt_submit` slot sum at 922 B.

So the bench reads the concern at **0 B, inside any row**, and would do so under
the current rows too. That is a pass in the trivial sense and evidence of
nothing. The load-bearing derivation is `model_rule_injection`'s distribution —
which is what the concern's own comment names as its source — and the honest
statement is that **this verify clause is not satisfiable by the bench until a
fixture that matches a trigger exists.** Adding one is a change to the bench's
committed fixtures and is out of this roadmap's scope; it is recorded here as
the concrete follow-up rather than papered over with a vacuous green.

## 3 — Cost, with method

```
$ ./scripts-run src/scripts/model_rule_injection --corpus tests/eval/routing-matrix
standing corpora (exact BPE over dist/agent-src/rules)
  eager-all       120827 tok
  thin/delivery    18223 tok
price USD/session · sonnet in 3 / cache-read 0.3 / cache-write 3.75 per 1M
  (turns 10/50/200 × spawns 0|5|20)
  eager-all     0.7793|2.5917|8.0290   2.2293|4.0417|9.4789   7.6665|9.4789|14.9161
  delivery      0.1659|0.4392|1.2593   0.4433|0.7167|1.5367   1.4068|1.6801|2.5001
endpoint (d) price · delivery 0.7167 < eager 4.0417 at 50 turns × 5 spawns: PASS
```

At the reference session (50 turns × 5 spawns): **$4.0417 → $0.7167**, an 82.3 %
reduction. Delivery quality at the same run: recall 0.994 honouring
`open_files` (307/309), 0.903 ignoring them, **0 false fires over 198
near-miss prompts**, 0 path-rule misses.

Drift against the 2026-08-23 published figures, recorded because it is the
evidence for the validity condition at the top: $4.0335 → $4.0417 eager,
$0.7285 → $0.7167 delivery, standing corpus 120,582 → 120,827 tok,
near-misses 194 → 198. Small, and moving.

## 4 — The exact diff

Four files. Reproduce by applying the hunks below at the measurement basis
commit named above. **Not applied on this branch.**

### 4a — `src/config/hook-token-budget.json`

```diff
--- a/src/config/hook-token-budget.json
+++ b/src/config/hook-token-budget.json
@@ -30,14 +30,14 @@
   "session-eol_reason": "one recycle-advisory line, once per session past the committed threshold (road-to-token-economy-recycling 3.2); recording itself emits nothing",
   "skill-route": 512,
   "skill-route_reason": "road-to-inbox-harvest-2026-08-d-runtime-skill-routing 2.1: one line carrying at most three skill ids and their scores - pointers, never bodies. Registered BELOW the 1024 default deliberately: this row is the ceiling that keeps it a pointer line, so a later change that starts injecting descriptions fails the build instead of quietly doubling a per-turn slot that already carries nine other concerns under a 4096-byte sum cap",
-  "rule-inject": 20480,
-  "rule-inject_reason": "road-to-trigger-delivered-rule-bodies 1.1: this concern delivers rule BODIES, not a pointer line, so its ceiling is the per-prompt token cap converted to bytes rather than a measured emission - 5,000 exact-BPE tokens (the p90 of the matched-body-token distribution over tests/eval/routing-matrix, rounded up to 500, reproduced by `model_rule_injection --corpus tests/eval/routing-matrix`) at ~4 bytes/token. Registered ABOVE the 4,096-byte user_prompt_submit and 2,048-byte pre_tool_use slot sums ON PURPOSE, and the mismatch is the finding rather than an oversight: the concern is default-OFF and emits ZERO bytes under every shipped setting, so no slot sum is breached today. The run that flips `lean_projection.mode: delivery` is the run that must move those two slot rows - that is the activation charge step 1.7 defers, and it is recorded here so the flip cannot be taken without meeting it."
+  "rule-inject": 22528,
+  "rule-inject_reason": "road-to-trigger-delivered-rule-bodies 1.1, re-derived 2026-09-04 by road-to-the-tenth-arrival 3.1: this concern delivers rule BODIES, not a pointer line, so its ceiling is the per-prompt token cap converted to bytes rather than a measured emission - 5,500 exact-BPE tokens (the p90 of the matched-body-token distribution over tests/eval/routing-matrix, rounded up to 500, reproduced by `model_rule_injection --corpus tests/eval/routing-matrix`) at 4.096 bytes/token = 22,528 B. The p90 MOVED since the row was first registered: 4,804 -> 5,042 tok as rule bodies grew, so the old 20,480 B row had fallen BELOW its own stated derivation and was stale rather than conservative. The two slot sums this concern can EMIT under - user_prompt_submit and pre_tool_use - each rise by exactly this ceiling, leaving every other concern's registered headroom untouched. It is bound on a third slot, pre_compact, and that row stays at 2,048: the concern clears its seen-latch there and returns before any injection (src/scripts/hooks/rule_inject_hook.ts:258-261), so the binding is inert for bytes. Checked rather than assumed - a bound slot is not an emitting slot, and the original two-row charge is right. `CAP_BYTES` in src/scripts/hooks/rule_inject_hook.ts is the same number in the same unit and moves with it."
  },
  "per_slot_sum_caps_bytes": {
   "_comment": "Cross-concern per-fire sum per slot (roadmap 3.1). session_start is one-time and may carry the restore payloads; per-turn slots stay tight.",
   "session_start": 16384,
-  "user_prompt_submit": 4096,
-  "pre_tool_use": 2048,
+  "user_prompt_submit": 26624,
+  "pre_tool_use": 24576,
   "post_tool_use": 2048,
   "stop": 2048,
   "session_end": 1024,
@@ -64,7 +64,7 @@
    "agent_error"
   ],
   "excluded_slots_rationale": "session_start is excluded BY THE STEP: it is the one-shot restore slot that legitimately carries hot-context, handoff-context and the canary contract, and capping it against a per-turn number would evict exactly the payloads it exists to deliver. The other three are not per-turn events at all.",
-  "ceiling_bytes": 47104,
+  "ceiling_bytes": 294912,
   "ceiling_derivation": "NOT a fresh number, and deliberately so: it is the arithmetic consequence of the per_slot_sum_caps_bytes rows already registered above — 4096 + (2048 + 2048) x 10 + 2048. A tighter per-turn ceiling would contradict per-slot rows that are already the committed decision, and a looser one would let the composition exceed what every part was capped at. Tightening it is a decision about those rows, taken there, in a PR.",
   "gate_on_ceiling": false,
   "gate_on_ceiling_rationale": "The bench REPORTS the aggregate but does not red the build on it yet — the first-reading discipline the latency twin's observe_only flag encodes. Measured 2026-08-19 under the committed fixtures: ~1,142 B against a 47,104 B ceiling, i.e. the row is registered roughly forty times above any reading that exists. The reading MOVES between runs — 922, 1,140 and 1,142 B observed within one hour — and the mechanism is worth naming precisely rather than as 'flaky': the stop-slot end-review-nudge sizes its line from the branch's own mutation volume, and replay skips its writes but not its reads, so the number grows as the working branch grows. That is a pre-existing bench non-determinism this row surfaces rather than introduces, and it is the strongest single reason not to arm the ceiling against it. Arming a ceiling nobody has ever approached would gate on an untested inequality. Runtime enforcement is NOT gated by this flag and is always on: this flag governs CI, the ceiling governs the live session.",
```

### 4b — `src/scripts/hooks/rule_inject_hook.ts`

```diff
--- a/src/scripts/hooks/rule_inject_hook.ts
+++ b/src/scripts/hooks/rule_inject_hook.ts
@@ -72,8 +72,11 @@
  *
  * DERIVED, NOT PICKED: `model_rule_injection --corpus tests/eval/routing-matrix`
  * measured the matched-body-token distribution over the frozen labelled corpus
- * at p50 1,728 / p90 4,804 / p99 8,248 / max 12,957 exact-BPE tokens, and step
- * 1.1 specifies "the p90 from 0.4, rounded to 500" — 4,804 rounds up to 5,000.
+ * at p50 1,764 / p90 5,042 / p99 8,510 / max 13,290 exact-BPE tokens (re-run
+ * 2026-09-04 by road-to-the-tenth-arrival 3.1; the 2026-08 reading was p50
+ * 1,728 / p90 4,804 / p99 8,248 / max 12,957 and the bodies have grown since),
+ * and step 1.1 specifies "the p90 from 0.4, rounded to 500" — 5,042 rounds up
+ * to 5,500.
  *
  * BYTES rather than tokens, and the unit change is the point rather than a
  * detail. `_lib/token_count.ts` resolves `js-tiktoken` at module load, so a
@@ -89,7 +92,7 @@
  * Re-run that command if the corpus or the bodies move; a cap copied from a
  * stale measurement is worse than no cap, because it looks derived.
  */
-export const CAP_BYTES = 20480;
+export const CAP_BYTES = 22528;
 
 /** Tools whose input names a file this concern can match path triggers against. */
 export const FILE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'Read', 'MultiEdit']);
```

### 4c — `src/scripts/schemas/agent-settings.schema.json`

```diff
--- a/src/scripts/schemas/agent-settings.schema.json
+++ b/src/scripts/schemas/agent-settings.schema.json
@@ -39,7 +39,7 @@
       "properties": {
         "mode": {
           "type": "string",
-          "enum": ["eager-all", "thin"]
+          "enum": ["eager-all", "thin", "delivery"]
         }
       }
     },
```

### 4d — `src/config/agent-settings.template.yml` — **the flip itself**

```diff
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -196,7 +196,7 @@
 #             keep `task trigger-coverage` at 100%. One-flip revert:
 #             set eager-all + `task generate-tools`.
 lean_projection:
-  mode: eager-all
+  mode: delivery
 
 # --- Telegraph condensation (output-side) ---
 #
```

## 5 — Before / after / rollback

**Before landing anything.** `lean_projection.mode: eager-all`; the concern
emits zero bytes on every slot under every shipped setting; the four budget rows
are as printed on the left of § 2's table; the schema rejects `delivery`.

**After landing 4a–4c only** (the sizing, without the flip). The mode is still
`eager-all` and the concern still emits nothing, so behaviour is unchanged —
but `hook-token-budget.json` now asserts headroom the shipped configuration does
not use. **That is risk 4 in the roadmap's own register**, and it is the reason
the AI council 2026-09-04 recommended, 2/2, that these rows do NOT land
separately: *"configuration should describe the shipped eager-all mode until the
authorized mode flip and its dependent row changes can land atomically."*

**After landing 4a–4d** (atomic). Rule bodies are delivered on a trigger match
on Claude; the standing corpus drops 120,827 → 18,223 tok; the guard test goes
red and must be updated in the same change.

**Rollback, one flip:** set `lean_projection.mode: eager-all` and run
`task generate-tools && task sync`. This is stated in the template's own comment
(`agent-settings.template.yml:196-197`) and is unchanged by this packet. The
budget rows may be left wide on a rollback without breaking anything — a cap
above the emission is inert — but leaving them wide re-creates risk 4, so the
honest rollback reverts all four files.

## 6 — What needs approval BEFORE landing, and what after

| part | before or after | why |
|---|---|---|
| 4d — the flip (`mode: delivery`) | **before**, owner only | the shipped-default decision, and the authority question of § 1 |
| 4c — schema enum widening | **before**, with 4d | it exists only to make 4d expressible; landing it alone advertises a mode the tree does not ship |
| 4a + 4b — the resized rows and `CAP_BYTES` | **before**, atomically with 4d | council 2026-09-04, 2/2: landing them early leaves the config describing a state that is not shipped |
| the guard-test update | **after**, in the same commit | mechanical once 4d is decided |
| a trigger-matching bench fixture | **after**, independently | closes step 3.1's verify clause properly; needed whether or not the flip is taken |

**Residual risk the owner is accepting if they land it.** Behavioural
equivalence stays unmeasured — ADR-202 closed three instruments for it and this
packet reopens none. The delivery arm is Claude-only; on every other host the
thin projection's live behaviour is an operator-run probe
(`probe_host_compliance.ts:82-87`) with no committed artefact. And the emission
figures decay: see the validity condition at the top.

**Residual risk if they do not.** The standing corpus keeps being re-paid on
every spawn at the § 3 rates, and the finding arrives a tenth time — but now
against three separately-stated sub-item states rather than one bundle, which is
what this roadmap was for.
