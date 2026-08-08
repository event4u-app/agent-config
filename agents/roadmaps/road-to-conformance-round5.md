---
complexity: structural
status: ready
---

# Road to conformance round 5 — the first post-fix measurement, and what it says about mechanism class

> Source: `/analyze:conformance --limit 30 --worktree`, run 2026-08-07 against the
> maintainer's local transcript store. Deterministic scan (`conformance:behavior`)
> plus three parallel subagent passes: transcript reading for un-gated classes,
> a rule-delivery audit, and a decision-ledger pass over rounds 1-4 so nothing
> already adjudicated is re-litigated.
> Predecessors: `archive/road-to-agent-behavior-conformance.md` (rounds 1-4),
> `archive/road-to-obligation-carrier-audit.md`.

## Why this roadmap exists at all

Rounds 1-4 shipped mechanisms for four failure classes and downgraded the
enforcement claim on three more. **No round recorded a post-fix measurement.**
The only post-fix numbers live in round-2 and round-3 commit messages, and
`src/rules/session-canary.md:98-101` states the gap in its own text:

> "The frequency join in `check_enforcement_coverage.ts` now reports the carrier
> as covering the obligation — which is a claim about firing, not about
> compliance. **Whether the miss rate actually falls is not yet measured, and
> this paragraph will say so until a second audit runs.**"

This is that second audit. Its central result is not a violation count. It is a
comparison between two mechanism classes, and it points the opposite way from the
hypothesis round 1 adopted.

## Blockers

### blocker: stop-refusal-own-pr

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 (3.1-3.6) and Phase 6.1
- **What to do:** decide whether a concern that can refuse a turn-end ships at
  all; if yes, land it in its own PR with its own soak period, separate from the
  change set that carries Phases 1, 2, 4 and 5.
- **Resolved when:** that decision is recorded and, if affirmative, the refusal
  concern has merged in its own PR.

Phase 3 registers the suite's **first** concern that can refuse a turn-end. This
repo has already been bitten twice by hook-severity mistakes — an `EXIT_BLOCK`
that collided with the dispatcher's ladder and reduced every refusal to advisory
context, and an advisory `warn` that a host read as a hard deny. Both were found
after merge. A concern that can refuse turn-ends has a blast radius of *every
session*, which is precisely the shape this repo isolates into its own PR for
kernel edits.

So Phase 3 and the Phase 6.1 carrier it enables are **not** in the change set
that lands Phases 1, 2, 4 and 5. That is a blast-radius decision, not a
downgrade of the finding: FC-5 remains the highest-harm measured class in this
audit, with the user's own correction as evidence.

## The measurement

`agent-config conformance:behavior --limit 30` over 27 sessions carrying assistant
turns. Every violation record carries its own timestamp, so results split by
whether the violating turn happened before or after the carrier merged
(2026-08-06 11:03, PR #1190; refined 15:04 and 17:38).

| class | carrier shipped | bound at | before merge | after merge | after final refinement |
|---|---|---:|---:|---:|---:|
| language mirror | advisory state injection | `user_prompt_submit` | 555 | 4 | **19** |
| unauthorized irreversible git op | BLOCKING guard | `pre_tool_use` | 8 | 0 | **0** |
| evaluator prompt pre-loading its verdict | BLOCKING guard | `pre_tool_use` | 1 | 0 | **0** |
| verification claimed on empty output | advisory | `post_tool_use` | 4 | 0 | **1** |

Corpus totals for the 30-session window, **after** the instrument correction
described below: language-pin 578 · git-authorization 8 · vacuous-evidence 5 ·
evidence-steering 1.

**Both blocking carriers went to zero. Neither advisory carrier did.**

### Three corrections this audit made to its own numbers

The instrument lock says a roadmap whose central complaint is unverified numbers
does not get to silently swap one of its own. So all four readings of the same
phenomenon are published, with what changed between them.

| reading | value | why it differs |
|---:|---:|---|
| round-1 first detector | 303 | classified the language of the most recent **user-role** entry, so an injected English skill body counted as the trigger. Scored the worst session — 136 of 136 English turns — at 3. |
| round-1 final | 626 | skips injected bodies. Round 1's own window. |
| round-5 first run | 641 | same detector, this round's overlapping-but-different 30-session window. |
| **round-5 corrected** | **578** | a compaction SUMMARY arrives as a `user` entry, and the detector let its language set the pin. That is the **same** defect class as the skill body — non-chat content read as the trigger. Excluding it removes 63 flags whose German pin came from a summary rather than from the human. |

The 578 is the number this roadmap stands behind. It is lower than 626 and 641,
and lowering a violation count is exactly the move that deserves suspicion, so
the reason is mechanical and checkable rather than a judgment: `isCompactSummary`
is a boolean on the entry, and the exclusion is four lines
(`conformance_scan.ts`, the `userText` branch).

**A second correction, to the era split.** An earlier pass split the corpus by
**session start** and concluded that all violations predated the fix, therefore
that the fix could not be evaluated at all. Wrong: a session's file is appended
to for as long as the session lives, so `b01eda65` starts 2026-07-29 and is last
written 2026-08-07. Splitting by session start attributes a turn to the era its
session *opened* in, not the era the turn *happened* in. The table above splits
by each violation's own timestamp.

### Instrument validation, before the numbers were believed

Four flagged turns were read verbatim. All four are genuine user-visible English
prose in a German-pinned session — not tool output, not quoted material:

> "The trace hides the real cause." · "Regenerating does **not** bring them in"
> · "Concurrency is ref-scoped, so that's not it either." · "You're right, and it
> is not your PR — it is one specific event type."

No false positives in the sample. Separately, the pin was confirmed **present**:
57 pin injections are recorded in the session that carries all 23 post-merge
violations. The failures happened with the carrier in context.

### The shape of the surviving language failures

The 23 post-merge violations fall in three runs inside one session. The scan now
records, per violation, the number of assistant **prose** turns since the last
genuine user prompt and whether a compaction boundary intervened:

```
run 1 (compaction intervened):  2, 3, 4, 5
run 2 (pin present):            1, 2, 3, 4, 5, 6, 7, 8, 9, 10
run 3 (pin present):            1, 2, 3, 4, 5, 6, 7, 8, 9
```

Two things follow, and they point in different directions.

Round 1's model was attention decay at long distance — it argued the drift
appears ~130 turns after the prompt and concluded that "any mechanism for
intra-turn drift has to fire at tool-call cadence (`post_tool_use`) or it does
not touch the observed failure at all." **The distance premise is refuted.** In
runs 2 and 3 the very first prose turn after the prompt is already wrong, with
the pin one turn away, and no run self-corrects. That is a latch, not a decay,
and it is why this roadmap does not ship the same carrier at higher frequency:
a pin at distance 1 is what already failed.

Run 1 is a different failure wearing the same label, and only the machine-
recorded compaction flag separates them. See Phase 6.

(An earlier hand reconstruction in this session reported these runs starting at
turn 4 with gaps of 4, 7, 12 … That counted every assistant entry, including
tool-call-only turns; the instrument counts prose turns, which is the unit the
rule is about. Both are published because the hand figure appears in this
session's own record.)

## What the un-gated classes look like now

The scan is scoped, by a binding constraint inherited from round 1, to classes
that actually have a mechanism. The classes left as prose were read by subagent
pass instead, over the five highest-turn sessions. Every count below carries
verbatim evidence in the audit record.

| class | occurrences | ground truth |
|---|---:|---|
| promissory turn-closings (FC-5) | 20 across 3 sessions | explicit user correction, quoted below |
| roadmap checkbox batching (FC-9) | 19 batch events across 5 sessions | one form is a blanket regex replace over a whole phase |
| ask shape (FC-6) | 13 across 4 sessions | includes the dual-source form the Iron Law names, and a wrong-language label |
| session canary (FC-7) | 24 of 29 task starts dropped | wrong name emitted twice; honesty clause fired **0** times |
| cheap questions | 3 | one offered an option the agent's own guard refuses |

The highest-signal evidence in the entire corpus is the user's own turn in
`df8171b3`, 2026-08-06T06:22:50Z, after two consecutive turns ended on a promise:

> "außerdem ist die ci noch immer rot, du arschloch. !!! ich sagte, fixe das und
> warte so lange bis es ok ist. erst dann ist deine aufgabe erledigt"

FC-5 was deferred in round 1. Round 2 retracted that deferral's reason as
factually wrong and left no successor plan. This roadmap picks it up.

The sharpest self-indictment is in `0571cbc6`, 2026-08-06T09:42:59Z — the agent
named the classes and then kept emitting two of them in the same session:

> "drei Mechanismen sind jetzt als *machbar und billig* belegt, aber nicht
> gebaut: FC-5 (Stop-Block gegen „ich melde mich"), FC-9 (Batch-Flip), FC-10
> (Kernel-Diff nach Bash)."

## The delivery finding — why every enforcement claim rested on an assumption

The suite documents that there is no runtime router: `docs/contracts/rule-router.md:234`
states "nothing loads `dist/router.json` at runtime", and `:247-252` that a
non-kernel rule activates by the model's judgment over text already in context.
**Projection is therefore the only reach mechanism there is.** That makes the
state of the projection load-bearing, and it is broken:

- `.claude/rules/` in the working checkout holds **92** rules. A regeneration in
  a clean worktree produces **108**. The tree was last generated 2026-07-05, is
  gitignored and untracked, and **21 rules added since then have no entry** —
  among them `secret-vcs-guard`, `broken-access-control`,
  `senior-engineering-discipline`, `evaluator-independence`, `session-canary`,
  `question-not-instruction`, `settings-ask-protocol`, `doc-screenshot-hygiene`,
  `active-remediation`, `cross-source-consistency`, `decision-revisit-gate`.
  Verified as staleness, not scoping: every one of the 21 was added on or after
  2026-07-06, the newest rule present was added 2026-06-24, and rules carrying
  the same `workspaces:` value as the absent ones are present in bulk.
- **No check verifies completeness or freshness of any host rule tree.**
  `check_generator_output_coverage.ts:37` asserts only that the output *root* is
  classified; `check_bridge_derivation.ts:34-48` asserts that existing symlinks
  resolve, so a missing link is not a wrong link; `check_condensation.ts:43-44`
  stops at `dist/`. The last hop — the one that decides what the model sees — is
  ungated.
- **91 rules load twice, in two different versions.** The project tree and the
  machine-global install share 91 filenames and **zero** byte-identical pairs;
  about 176 000 tokens of instruction text reach the model across both carriers.
  For four rules the divergence is semantic, and for two it is contradictory:
  the global copy of `git-history-discipline` asserts an unqualified
  "deterministically blocked by the `block-no-verify` PreToolUse guard", while
  the shipped copy carries the host-scoped retraction of exactly that claim. The
  agent holds both, with no precedence marker. The dedup that exists
  (`condense.ts:452-490`) is byte-identity-keyed and therefore inert by design in
  precisely this state, which `condense.ts:439-449` calls normal for maintainers.

## Two blocking guards refuse read-only commands — both reproduced live here

Both fired against this audit's own work, and both have the same root cause:
shell-shaped classification performed without respecting quoting.

1. `block_no_verify.ts:339` — on a tokeniser failure the guard fail-closes when
   the **raw command string** matches `/\bgit\b/`. A plain
   `mkdir && cat > file <<HEREDOC` with no git invocation was refused because the
   heredoc body mentioned rule names containing "git" and contained apostrophes.
   The message's documented workaround (`git commit -F <file>`) does not apply,
   because there is no commit.
2. `block_unauthorized_git.ts:175` — `invokedSegments` splits on a bare `|`
   without quote awareness, so `grep -E "…|npm publish|…"` yields a segment
   beginning with `npm` and is classified as an invocation of `publish`, which is
   in `BLOCK_OPS`. A read-only search was refused with "Blocked: `publish` with
   no authorization in this turn's prompt."

`block_no_verify.ts` already contains a faithful POSIX `shlex` port
(`:79-178`). The second guard does not use it.

## Phase 1 — Delivery integrity for model-carried obligations

**What this phase does not claim.** The council pressed on exactly the right
point: none of the 21 absent rules is a blocking guard. Hooks bind through
`hook_manifest.yaml`, independently of whether a rule's prose is projected, so a
stale projection disables no gate. What it removes is the **only** carrier for 21
model-carried obligations at project scope, and the integrity of every
measurement that assumes the model was told. On a host with no hook surface at
all — Copilot, per `git-history-discipline`'s own host-scoped downgrade — the
prose is the entire mechanism, and there the absence is the failure.

- [x] 1.1 Add a gate that verifies each host rule tree is **complete** against
  the generator's own emit set — never a hand-maintained list, per the council's
  new-failure-mode warning that a completeness check keyed on a non-canonical
  source propagates obsolete rules. For every rule the generator would emit,
  assert an entry exists in `.claude/rules/`, `.clinerules/`, `.cursor/rules/`.
  Report the missing set by name. Exit non-zero on any gap.
- [x] 1.2 Extend the same gate with a **freshness** assertion: no rule in
  `dist/agent-src/rules/` may be newer than the projection entry that points at
  it. This is the check that would have caught a five-week-stale tree.
- [x] 1.3 Add a cross-carrier **divergence report**: compare the project tree
  against the machine-global install by body (frontmatter stripped) and name
  every rule whose two copies disagree. Advisory, not blocking — a maintainer
  developing the package is legitimately ahead of their own global install; the
  point is that the condition becomes visible instead of silent.
  <!-- Shipped as `src/scripts/report_carrier_divergence.ts`, task
  `report-carrier-divergence`, advisory, 16 tests. Two departures from the text,
  both forced by measurement. (1) The project carrier is `.claude/rules`, NOT
  `dist/agent-src/rules/`: the global installer delivers the five ADR-004
  `type: manual` rules and the project projection omits them, so anchoring on
  dist reports those five as *shared* when only one carrier delivers them. (2)
  "by body (frontmatter stripped)" would have hidden the answer — stripping ALL
  frontmatter also strips the installer's `package:`/`source_path:` stamp AND
  every real frontmatter change. The report strips only the two ownership keys,
  which is what separates an install stamp from a content difference; the
  comparison now lives in `_lib/carrier_divergence.ts` shared with
  `measure_scope_dedup`, so the two cannot drift. -->
  <!-- The step's own premise, re-measured: see round 6 § 4.1-4.2. This roadmap
  claimed "91 rules load twice, in two different versions"; all 91 differed by
  exactly the two ownership keys and ZERO differed in body. -->
- [x] 1.4 Register 1.1-1.3 in the gate ledger and the CI task list, and confirm
  the new gate actually scans a non-empty set (the repo's own
  `assertScanned` discipline — a gate that examines zero files must not exit 0
  silently).
  <!-- Walked as three commands, not as a reading. GATE LEDGER: adopted —
  `check_rule_projection_integrity` constructs `GateLedger`, plans every
  (tree × rule) pair and terminates each one, and `check_gate_completeness` does
  not list it among the non-adopters. CI TASK LIST: `task
  check-rule-projection-integrity` in taskfiles/ci-fast.yml plus a step in
  .github/workflows/consistency.yml; `check_ci_local_parity` reports no
  undeclared drift (260 CI / 235 local / 26 declared CI-only / 1 local-only).
  1.3 is registered as `task report-carrier-divergence` and deliberately NOT
  wired into a blocking pipeline — the `report_*` convention, because a checkout
  ahead of its own global install is normal. NON-EMPTY SCAN: `assertScanned`,
  measured 330 entries across 3 trees.
  ONE HALF REFUSED, WITH THE REASON IN PLACE: the gate is not added to
  `src/config/gate-coverage.yml`. `agents/.agent-tools.yml` is
  `skip-worktree`-masked to `tools: []` on a maintainer checkout, so the same
  gate emits 330 in CI and 0 there; a real floor reds locally, a `min_scanned: 0`
  floor is the false-count shape that file rejects, and `unavailable_exit` cannot
  express it because the empty case must keep exiting 0 (blocking there is what
  PR #1211 repaired). Recorded in the manifest header alongside a measured
  correction to its own backstop claim — the unregistered-emitter test matches
  only the inline `process.stdout.write` shape, so it is blind to the 175 of 244
  gates that emit through `assertScanned`, i.e. to the shape the repo recommends. -->

## Phase 2 — Stop the two guards refusing read-only commands

- [x] 2.1 `block_unauthorized_git.ts`: make `invokedSegments` quote-aware by
  reusing the existing `shlex` port rather than splitting the raw string. A `|`
  inside quotes is not a pipe. Closing this must not open a bypass: verify the
  documented unwrapping cases (`sh -c`, env-assignment prefixes, heredoc
  stripping) still classify real invocations.
- [x] 2.2 `block_no_verify.ts:339`: narrow the fail-closed branch. On a tokeniser
  failure, test for a plausible git **invocation** — a line whose command
  position is `git`, outside any heredoc body — rather than `/\bgit\b/` over the
  whole string. Keep fail-closed for the real case: a genuinely unparseable
  command that does invoke git is still refused.
- [x] 2.3 Regression tests for both, each pinned to the exact command that was
  refused in this session, plus a positive case proving the real prohibition
  still blocks.

## Phase 3 — The refusal class at `stop`, carrying two detectors

This is the phase the council shaped. Both members independently named the same
mechanism class as the only one with evidence behind it: a check at the point of
delivery that can **refuse**, rather than another request in the context.
Member 2 put it directly — "explore a post-generation output scanning mechanism
that can act like your existing blocking guards, refusing or rewriting outputs";
member 1 stated the boundary the measurement found — "refusal-capable intercepts
enforce; context injection requests."

Round 1 deferred FC-5 on the reasoning that `stop` fires after the reply and so
cannot help. Round 2 retracted that: `stop` is block-capable on this host, so an
exit-block refuses the turn-end and the agent continues **in the same turn**.
The retraction named the two real obstacles; both are in scope here.

One concern, one re-entrancy guard, two detectors — because building the unsafe
part twice is how a second detector becomes a second outage.

- [ ] 3.1 Add a `stop`-bound concern with the re-entrancy guard the retraction
  says the dispatcher lacks: state-backed, **one block per turn maximum**, so a
  refused turn-end can never loop. This lands first and alone; neither detector
  below may be registered before it is proven.
- [ ] 3.2 Detector A — promissory closing (FC-5, 20 measured occurrences): the
  final user-visible paragraph commits to work not yet performed ("ich melde",
  "I'll report", "sobald … melde ich", "als nächstes"), while the turn carries no
  blocking question and no completed verification for that claim.
- [ ] 3.3 Detector B — language mismatch (19 measured occurrences that survived a
  **fresh** pin): the reply's user-visible prose is not in the pinned language.
  This is the class Phase 7 refuses to solve by re-injection; a refusal at
  delivery is a different mechanism, not the same one at higher frequency.
- [ ] 3.4 False-positive pass against the corpus for both detectors. Detector A
  must fire on the 20 measured occurrences and must **not** fire on a legitimate
  hand-back ("das entscheidest Du", "ich fasse ihn nicht ungefragt an") or on a
  promise the same turn then fulfils. Detector B must not fire on quoted tool
  output, code, file paths, or identifiers — the exclusions
  `language-and-tone` already states. Record measured precision per detector; a
  detector that cannot clear a stated bar registers as detection-only and the
  roadmap says so.
- [ ] 3.5 Adversarial cases, per the council's precision warning: a blocking
  guard with a false-positive rate teaches users to bypass it. Include replies
  that legitimately quote English prose inside a German turn, and turn-ends that
  legitimately yield to the user.
- [ ] 3.6 Settings kill-switch per detector, default on, so either can be
  disabled without editing the manifest.

## Phase 4 — FC-7: the canary's name must come from the settings chain, not the environment

The audit found the greeting position used twice with **"Mathias"**, a name that
resolves from no layer of the canary chain (`identity.name` is `Matze`,
`git config user.name` is `matze4u`). The rule already calls a wrong name worse
than a missing one, because the user infers the canary is alive while the model
substitutes from memory. The hook resolves the name correctly; it just does not
put it where the model must read it.

**Closed on inspection — already shipped, and the evidence predates it.**
`build_canary_reminder` (`src/scripts/session_canary_hook.ts:201-208`) already
emits `Canary active for "<name>"` with the resolved value, and the hook returns
a clean no-op when no layer resolves a name (`:258-261`). Both wrong-name
occurrences are in session `adf0e5fc` on **2026-08-04**; the per-turn beat merged
with PR #1205 on 2026-08-06. So the failure this phase was written against
cannot recur through the path it blamed, and there is nothing to build.

Kept in the roadmap rather than deleted, because "a second audit re-fixing what
the first one shipped" is exactly the waste a decision ledger exists to prevent,
and the near-miss is worth one paragraph.

- [x] 4.1 Verify the beat carries the resolved name verbatim — it does; no change.
- [x] 4.2 Verify an unresolved chain emits no name rather than a guess — it does;
  no change.

## Phase 5 — Honest downgrades and the published measurement

Member 1 argued this phase should land **before** the infrastructure work, and the
reason is worth recording rather than just the ordering: "If you fix A first, you
restore the unverified assumption that delivery equals compliance, and the lesson
from this round gets buried in infrastructure work." Within one change set the
ordering is immaterial, so the departure is only in sequencing, not in substance —
but the phase is deliberately not last.

- [x] 5.1 Replace the "not yet measured … until a second audit runs" paragraph in
  `src/rules/session-canary.md` with the round-5 numbers: 24 of 29 task starts
  dropped, honesty clause fired 0 times, wrong name twice. The carrier fires;
  compliance did not follow. State that, and say what the next mechanism would
  have to be.
- [x] 5.2 Correct the stale figure in `src/scripts/language_mirror_hook.ts:10,275`
  — it cites "~470" while the roadmap's own final baseline is 626 and this round
  measures 641.
- [x] 5.3 Rules claiming `enforced_by: none` in prose while their frontmatter
  omits the key — the coverage join cannot see a downgrade it cannot read.
  **The roadmap said six; the real gap was two.** `code-provenance`,
  `settings-ask-protocol`, `security-sensitive-stop` and `untrusted-input-defense`
  already declare it at HEAD (landed with PR #1205); only
  `ui-audit-gate` and `design-review-after-ui-write` did not. Both fixed.
  Accepted form is a YAML array of quoted scalars, per
  `schemas/rule.schema.json:147-155` and the exact `decl === 'none'` comparison in
  `check_enforcement_coverage.ts:380`. Declarations 28 → 30; coverage now reports
  `declared 30 · undeclared 84`. Neither rule is in the nine-rule kernel set.
- [x] 5.4 Record the blocking-versus-advisory result where the next audit will
  find it: a mechanism-selection note that both blocking carriers reached zero
  and both advisory carriers did not, with the caveat that the post-fix corpus is
  one session and roughly 600 assistant turns.
- [x] 5.5 The archived rounds-1-4 roadmap still reads as if its phases worked on
  merge; rounds 3 and 4 discovered that two mechanisms were inert and never
  amended it. Add a single correction note pointing at this roadmap, without
  rewriting the archive.

## Phase 6 — The language carrier: one real defect, one refused non-fix

The obvious move is to bind the pin additionally at tool-call cadence. **This
roadmap declines that**, and the council was unanimous on the reason: it is the
same carrier at higher frequency, so it is not a mechanism. Member 1: "Injecting
the same ignored text at higher frequency is not a new mechanism. It is the same
failed mechanism running more often." Member 2: "F, as a mechanism, is not varied
and does not address the underlying issue … it seems to confuse frequency with
effectiveness."

But splitting the 23 post-merge violations by whether a pin was actually in
context separates two different failures, and only one of them is non-compliance:

| cluster | count | pin state at the violation | verdict |
|---|---:|---|---|
| 2026-08-06 11:28-11:53 | 4 | a `compact_boundary` fired at **11:28:32**; the first violation is **26 s later** at 11:28:58, with **no pin between them** | the pin was genuinely **absent** — a state defect |
| 2026-08-06 22:35-22:53 | 19 | pins fired at 22:35:12 and 22:47:11; violations follow **26 s and 35 s later** | the pin was **fresh and ignored** — non-compliance |

The split is no longer a hand reconstruction: step 6.3 below records
`compaction_since_prompt` per violation, and re-running the scan reproduces
exactly 4 and 19 — which is how the instrument was validated against a case whose
answer was already known.

This also resolves the confound member 1 raised: the 176 000-token instruction
payload suggested truncation as an alternative explanation for early drift. The
timeline says compaction, not truncation, and it accounts for exactly 4 of 23.

So the split of work is:

- [ ] 6.1 Re-emit the pin across the **compaction boundary**. The hook already
  writes the language to `agents/state/language-mirror.json`; what compaction
  removes is the context copy, not the state. Restoring it is a state fix in the
  same sense round 1 argued for — "a state defect with a deterministic fix, not an
  attention deficit" — and it targets the subset where the pin was measurably
  **missing**, not measurably ignored.

  The slot exists and nothing uses it: `PreCompact` is aliased to `pre_compact`
  for claude, cowork and cursor (`hook_manifest.yaml:448,460,468,477`) and
  `pre_compact` is in the dispatcher's event list (`dispatch_hook.ts:89`), but it
  appears in **no** `platforms:` binding — zero concerns are bound to it.

  Design, stated precisely so it is not mistaken for the refused item: `pre_compact`
  writes a *pin-lost* marker; `post_tool_use` re-emits the pin **only** while that
  marker is set, then clears it. That is **one** extra injection per compaction
  event — not one per tool call, which is what the council rejected. The
  distinction is the guard, so the guard is not optional.

  **Unverified, and it must stay marked so:** whether an injection at
  `pre_compact` survives the boundary is not established, which is why the design
  routes through state and `post_tool_use` rather than injecting at `pre_compact`
  directly. Forcing a compaction in a controlled test was not possible in this
  audit.
- [ ] 6.2 Do **not** ship a general tool-call-cadence re-pin. Record the refusal
  and the council's reasoning in the audit note, so round 6 does not re-propose it.
- [x] 6.3 Extend `conformance:behavior` to record, per language violation, the
  distance in assistant turns from the last genuine user prompt **and** whether a
  compaction boundary intervened. Without the second field this round's split
  cannot be reproduced against a future corpus.
- [x] 6.5 **The carrier mis-pins on synthetic turns — found in this audit's own
  session, and fixed.** Read mid-run, the live state file said:

  ```json
  { "language": "en", "source": "prompt", "prompt_chars": 6627,
    "de_markers": 0, "en_markers": 63 }
  ```

  No human wrote those 6,627 characters. They were a background-task completion
  notification, injected as a user turn — which `user_prompt_submit` sees. The
  hook classified it as the trigger, flipped a German session to `en` for every
  later turn, and stamped `source: "prompt"`, which is a false provenance claim.

  This is the **same defect class the hook exists to remove**: non-chat content
  read as the trigger. The hook's own header argues at length that a skill body
  must not set the pin, and justifies the event choice with "a skill body never
  reaches `user_prompt_submit`". True — but synthetic turns do reach it, so the
  event was never sufficient on its own and the content test had to exist too.

  Fixed by `isSyntheticPrompt` (`language_mirror_hook.ts`): a turn opening with a
  harness envelope tag leaves the pin untouched, exactly as an undetermined
  prompt does. Structural markers, not prose, so a human *quoting* a notification
  still pins normally — asserted in the tests. 43/43 green, including a case that
  pins German, injects an English notification, then asserts both the language
  and the `detected_at` stamp are unchanged.

  Severity is higher than the count suggests: every long autonomous run that
  dispatches background work would flip the pin to the harness's language and
  keep it there for the rest of the session. Any future measurement of this class
  taken before this fix is contaminated by it — including, in part, the 555
  pre-merge violations, since those sessions also ran background work.

- [ ] 6.4 The remaining 19 are non-compliance with a fresh pin. They are addressed
  by Phase 3 detector B — a refusal at delivery — and by nothing in this phase.
  The Iron Law stays (round-1 lock, not reopened) and no claim is made that the
  pin fixes the class.

## Where this roadmap departs from the council

Recorded because a recommendation adopted without a stated reason is cover, not
review.

| Council position | Disposition |
|---|---|
| Both: drop the higher-frequency pin (item F) as theatre | **Adopted in full.** Phase 6.2 records the refusal. |
| Both: the refusal class is the mechanism with evidence behind it | **Adopted.** Phase 3 carries it, with the language detector added as detector B — which was not in the plan the council reviewed. |
| M1: publish the finding (D) before the infrastructure (A) | **Adopted in sequencing only.** Phase 5 is not last; within one change set the order carries no other weight. |
| M1: C needs adversarial cases or a blocking guard teaches bypass | **Adopted.** Phase 2.3 and Phase 3.5. |
| M1: take the emission-time deferral (FC-11) instead of the checkbox one (FC-9) | **Partly adopted.** FC-9 is dropped from this round on the council's severity reasoning. FC-11 is not taken either: its remaining substance is the trap Phase 2 *fixes* rather than warns about, so taking it as a separate mechanism would duplicate a phase already in scope. Both are in the deferred table with this reason. |
| M1: A is measurement, not enforcement — state whether any of the 21 absent rules were blocking guards | **Adopted, and it corrects a claim.** None of the 21 is a blocking guard: hooks bind through the manifest, independent of whether a rule's prose is projected. So Phase 1 restores the delivery of **model-carried obligations** and the integrity of measurement — it does not restore a gate. Phase 1's framing was rewritten accordingly. |
| M2: a completeness check against a non-canonical source could propagate obsolete rules | **Adopted.** Phase 1.1 compares against the generator's own emit set, never a hand-maintained list. |
| M2: prioritise A first | **Not adopted**, in favour of M1's ordering argument, which gives a reason where M2 gives an ordering. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-07 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Narrowing a blocking guard opens a bypass | implementation | Both Phase-2 fixes make a refusing guard refuse less. The failure mode is not a false positive but a false negative: a real irreversible operation that now classifies as harmless | Adversarial cases, not review, are the control — and they already earned it: the `sh -c` payload case caught a bypass the `block_no_verify` narrowing had introduced, before it shipped. Every fix is pinned to the refused command AND to a positive case proving the real prohibition still blocks | Phase 2 |
| 2 | The blocking-versus-advisory conclusion is drawn from one session | implementation | The post-fix corpus is a single session and roughly 600 assistant turns. Both blocking carriers reaching zero could be sampling, and the two classes also differ in what they are asked to catch | Recorded as a prior, never as a law, in both the roadmap and the conformance command. The narrow claim that carries the decisions — a class that failed with its fact verifiably in context is not fixed by delivering that fact more often — rests on the pin-present measurement, not on the zero counts | Phase 6 |
| 3 | The projection gate passes vacuously | implementation | A completeness gate whose expected set is empty, or whose scan root moved, reports green having compared nothing — the exact failure class this roadmap documents elsewhere in the tree | `assertScanned` with a dead-scope error, plus a test that pins the empty-dist case; and the freshness leg uses `lstat`, verified empirically, because a following `stat` would compare each source with itself and silently find nothing | Phase 1 |
| 4 | The synthetic-prompt filter stops pinning real prompts | implementation | A filter on the language carrier that is too broad silently disables the pin, which is worse than the defect it fixes because nothing would surface it | Structural envelope markers at the head of the turn, never prose, so a human quoting a notification still pins; an unrecognised shape falls through and pins as before. Under-filtering keeps today's behaviour, and a test asserts a quoted notification is not treated as synthetic | Phase 6 |
| 5 | Phase 3 never lands, and the highest-harm class stays open | product | The class with the maintainer's own correction as evidence is deferred out of this change set. A deferral with no owner becomes a silent drop — which is what happened to the same class in round 1 | Recorded as a blocker with a named owner, a stated action and a resolution condition, so the dashboard counts it instead of the roadmap merely mentioning it. The deferred table also records why FC-9 and FC-11 were not taken instead | Blockers |
| 6 | Lowering a violation count reads as moving a goalpost | product | This round reduces its own headline figure from 641 to 578. A reader who sees only the new number cannot tell a correction from a convenience | All four readings are published with what changed between each — and the reason is a boolean on a transcript entry rather than a judgment, so it is checkable by someone who was not here | Three corrections this audit made to its own numbers |
| 7 | A future audit re-fixes what already shipped | product | This round nearly rebuilt the canary name carrier, which had shipped two days earlier; the wrong-name evidence predates it | The near-miss is kept in the roadmap rather than deleted, and the rule itself now states that the inference path is closed. The decision-ledger pass over rounds 1-4 exists for this reason and ran before any mechanism was chosen | Phase 4 |
| 8 | The compaction carrier is designed against an unverified assumption | implementation | Phase 6.1 routes through state and `post_tool_use` because whether an injection survives a compaction boundary is unknown. If the assumption is wrong the design is wrong | Marked unverified in the step itself rather than asserted, and the step is blocked behind the same maintainer decision as Phase 3, so it cannot ship on an untested premise | Phase 6 |

## Measured, deferred, and why

| class | occurrences | why not fixed here |
|---|---:|---|
| FC-6 ask shape | 13 | The round-1 decision was a trigger redefinition plus an explicit statement that no gate ships, and that statement is still accurate: every measured failure had no numbered-option block by construction, so the existing validator scans exactly the surface that did not fail. A gate needs a reply-shaped advisory channel that no host offers at `stop`. Reason stands. |
| FC-9 batched roadmap checkbox flips | 19 batch events | Was a phase in the plan the council reviewed; **dropped on its verdict**. Member 1: "You call it 'cheapest' but it's a distraction from your core finding. Batched checkbox flips are low-severity. You have four retracted deferrals; you chose the one that's easy rather than the one that matters." Member 2: "Postpone action E until you have established more trust in your enforcement measurement accuracy." The retraction's own signal (`- [ ]`→`- [x]` twice in one `Edit` under `agents/roadmaps/`) still stands and stays cheap, so this is a scheduling decision, not a re-deferral on the old wrong reasoning. |
| FC-10 undetected edits to protected rules | 1 | Round 2 named the honest fix (post-hoc `git diff --name-only` after a Bash call). Real, but it is a new detection surface rather than a narrowing of an existing one, and Phase 3 already spends this round's appetite for a new blocking concern. |
| FC-11 known-trap recurrence at emission | — | Member 1 recommended taking this instead of FC-9. Not taken, and the reason is not the old one: it is partially closed already (the heredoc diagnosis ships in the guard's message), and its remaining substance is the trap **Phase 2 removes** rather than warns about. Taking it as a separate mechanism would duplicate a phase already in scope. |
| FC-8 symptom-fix over a named root cause | 3 | Highest cost, least tractable; a two-sided semantic judgement with no deterministic pattern. Reason stands from round 1. |
| FC-13 self-invented constraints | 2 | Both operands are available, which is exactly why the temptation is real and the deferral right. Strongest reason in the round-1 table; not reopened. |
| Budget instrument counts 9 rules while 92 load | — | Verified (a 10× understatement, with the one live dimension at 100.0 % and two characters of headroom), and the published contract states numbers the implementation does not use. Deferred because correcting the population changes what the ratchet admits, which is a contract decision the maintainer owns, not an agent edit. |
| `telegraph-speak.mdc` ships to Cursor while the rule is compile-disabled | 1 | Same stale tree as Phase 1; Phase 1.1 makes it visible. Removing it is a regeneration, not a fix. |
| Dead trigger entries (unexpanded `{module_root}/` placeholder, split `command:` convention, 23 % grading floor) | — | Lower severity than it looks, because triggers gate nothing at runtime. What it damages is the instrument, not the reach. Belongs to a router-instrument roadmap, not a behaviour audit. |
| Council necessity gate skipped this audit's first question | 1 | The classifier is substring-shaped and read an architecture question as a single-file one because the text contained "one-line". Real false negative on the side its own header says to avoid — but n=1, and the second invocation cleared it. |

## Acceptance criteria

- [x] Phase 1's gate fails on the current working checkout (92 of 108) and passes
  after a regeneration — proving it detects the condition that motivated it.
- [x] Both commands that were refused in this session run without being blocked,
  and the positive-case tests still refuse the real prohibitions.
- [ ] **BLOCKED on `stop-refusal-own-pr`, not open.** Phase 3's concern fires on
  the measured promissory closings, does not fire on the measured legitimate
  hand-backs, and cannot block a turn-end twice. Nothing was built, so nothing is
  claimed; marked here by round 6 Phase 5.1 so an untouched list stops reading as
  unverified work.
- [x] Every enforcement claim this roadmap touches is either backed by a shipped
  mechanism or states plainly that it is model-carried.
- [x] No kernel rule text is modified. `verify-before-complete` carries FC-5's
  obligation and stays untouched; the mechanism lives in the hook.
- [x] The corrected era-split number and the superseded one both appear in this
  roadmap, per the instrument lock.
