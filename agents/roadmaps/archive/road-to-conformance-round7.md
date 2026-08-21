---
complexity: structural
status: ready
---

# Road to conformance round 7 — the rules held, the tooling did not

> Source: the last 30 local session transcripts of this package, read
> 2026-08-12. Method below. Predecessors: `road-to-conformance-round5` (open),
> `road-to-conformance-round6` (parked in `later/`, one step blocked on a
> maintainer decision). Neither is touched here.

## The finding that reframes this round

**Five audit rounds measured rule TEXT and rule DELIVERY. This one measured the
tools the rules route to, and that is where the defect mass is.**

Of ~135 quoted findings, **~85 are `tooling-failure`** — this package's own
gates, scripts and CLI. The four mechanised behaviour checks, meanwhile, are at
**zero across the 25 post-carrier sessions**.

The user said this before the measurement did, in the corpus itself
(session `3d50d0df`, 2026-08-08):

> "es zeigt, dass du nur scheiße baust. Wir haben nun zig mal sessions
> analysiert ung dass die Agents Regeln, etc. ignorieren. Warum kann das
> passieren? Warum findest Du es nicht heraus? Warum testest Du es nicht?"

The answer this round gives: the rules were largely being followed. What kept
costing time were gates that block valid input, gates that are green locally and
red remotely, allowlists that suppress nothing, commands that exit 0 and do
nothing, and paid council runs that lose the spend or report attendance they did
not have.

## Method, stated so the numbers are auditable

- **Corpus:** the 30 most recent transcripts in this package's store, **as of
  2026-08-12 T08:00Z**. 28 carry assistant turns; **2 carry none** (`67abbd6a`,
  `92a60190`) — that is the whole 30→28 gap the scan reports, verified rather than
  assumed.
- **The window SLIDES, so re-running does not reproduce these figures**, and that
  is a property of the instrument rather than a caveat about this run. Measured
  within this same session, four hours later: 27 sessions with prose, 2 pre-carrier
  instead of 3, 5.7 % instead of 6.5 % — because live sessions were appended and
  the oldest fell out of the top-30. Every absolute number below is pinned to the
  timestamp above; the RELATIONS (post-carrier zero on the four pre-existing
  checks, `completion-claim` concentrated post-carrier) held across both readings,
  which is the part a later round can check.
- **Deterministic half:** `agent-config conformance:behavior --limit 30`, whose
  four classifiers are imported from the gates they measure. 2 354 assistant
  turns.
- **Reading half:** 6 subagents over balanced batches, 28 sessions, full
  digests (user turns near-verbatim, assistant prose truncated head+tail, tool
  calls stripped). Fixed finding shape; **a finding without a verbatim quote was
  discarded**. Highest-signal evidence ranked: a user turn correcting the agent,
  a user turn expressing frustration, the agent's own retro admission.
- **Independent cross-check that mattered:** each batch counted wrong-language
  turns itself. Six batches returned per-session counts that agree with the
  detector on every session, including its two outliers. The detector's zeros are
  behaviour, not blindness.
- **Reproducible probes** (committed under `src/scripts/`, see Phase 6): era
  split, German-pin denominator, opening-canary rate, promissory-closing rate.

## Corrected numbers — published beside the wrong ones, not instead of them

| # | First reading | Corrected reading | What was wrong |
|---|---|---|---|
| 1 | `language-pin 6.5 % — OUTSIDE the 9.1–39.2 % band`, i.e. the pre-registered falsifier firing | **23.1 % pre-carrier / 0.0 % post-carrier**; 9.2 % on the German-pin denominator, i.e. INSIDE the band | The rate pools eras across the mechanism it measures, and divides by ALL assistant turns although the check can only fire on German-pinned ones |
| 2 | opening canary present in 24 of 28 sessions (85.7 %) | **25 of 28 (89.3 %)**, and 24 of 25 (96.0 %) post-carrier | The first probe's harness predicate omitted `You've hit your`, so a spend-limit banner counted as a missed greeting |
| 3 | promissory closings: 1 of 163 hand-back turns (0.6 %) | **1 of 120 (0.8 %)**, loose predicate 2 of 120 (1.7 %) — and the **reason** was wrong too: a blocking `detectPromissory` already ships in `turn-end-gate`, so a low figure is residual leakage past a working mechanism, not a rare class | Two errors. The denominator counted synthetic user turns (task notifications, injected command bodies) as hand-back closers; the committed script uses the scan's own `isSyntheticPrompt` / `isInjectedBody` predicates and reads 120. And the class was declined as "below any threshold worth a gate" while the gate existed |
| 4 | "the mechanised surface is clean" | true of the **four pre-existing** checks; the fifth check this round added reads **17**, of which **15 are post-carrier across 14 of 28 sessions** | The claim was scoped to the checks that existed. Adding one moved it — which is the whole argument for adding it |

## The mechanised surface, split at the carrier

Split at 2026-08-07, the day the language-pin `user_prompt_submit` carrier
landed:

| era | sessions | assistant turns | under German pin | language-pin | git-auth | vacuous-evidence | evidence-steering |
|---|---:|---:|---:|---:|---:|---:|---:|
| pre  | 3  | 657   | 640   | 152 | 0 | 3 | 0 |
| post | 25 | 1 697 | 1 015 | **0** | **0** | **0** | **0** |

All 155 violations sit in three pre-carrier sessions. 118 of the 152 language
ones sit in **one** session (`b01eda65`, 2026-07-29) whose hook bundle was
verifiably stale — the transcript says so in its own words
(`0571cbc6`: *"der Sprach-Hook läuft dabei immer noch nicht (Bundle 07:27), das
ist also Aufmerksamkeit, kein Mechanismus"*).

## Council

Two members, 2/2 present, $0.057 actual. Both converged on three changes and
this roadmap adopts all three:

1. **The instrument fix is not a standalone phase.** It corrects the audit's own
   false alarm; it changes no behaviour. Folded into Phase 6.
2. **Premature completion displaces it as Phase 1.** 14 measured instances,
   every one costing the user a turn, and — the argument this roadmap did not
   have — *the "advisory carriers don't work" prior does not transfer*:
   language-pin and git-auth are **recognition** tasks, premature completion is a
   **precondition** check.
3. **P6 bundled three different things** (retraction, scoping decision,
   workstream split). Split into Phase 6 and Phase 7.

**Departure, recorded with its reason.** Both members said the guard fix
(Phase 2) belongs in its own PR because it can block irreversible operations.
This roadmap keeps it here and answers the substance instead of the form: no rule
requires an own-PR + soak for a hook script (`scope-control` § Kernel-rule edits
scopes that to kernel *rules*), the operator asked for one PR this run, and the
real risk — re-opening the bypass round 6 had to repair — is addressed by pinning
round 6's own vector matrix as an acceptance criterion and by landing Phase 2 as
the **first commit chunk**, so it is separable if review wants it separated.

## Challenge pass

Run before execution, per the operator's standing preference that a roadmap is
challenged and not only council-reviewed — the council judges the *mechanism*, the
challenge attacks whether the plan solves the right problem at all. Run as an
independent adversarial reader over the drafted file with instructions to verify
every cited `file:line` rather than an interactive interview, because the same
operator's standing instruction is to decide such questions autonomously and keep
working.

**It died on the account spend limit mid-run** — which is, without irony, the
eighth instance of the class this roadmap declines to fix as not-our-surface. It
returned one finding before dying, and that finding was blocking:

> "Phase 1's data-access premise is broken."

Verified independently against the source rather than adopted on its word, and it
is correct — see the rewritten Phase 1 for the two mechanisms
(`_toolCalls` keeps no results; `toolCalls` resets per user prompt) and for the
producer/consumer split that repairs it. Phase 3 was sharpened in the same pass
from a finding of my own: `task ci` **includes** `preflight`, so the original
framing ("preflight is not a root") understated the defect — the invisible set is
`CI ∩ ci \ preflight`, and `preflight`'s docstring claims a parity the gate never
checked.

Honest limit on this pass: **axes 3-5 were never run.** The premise checks on
`lint_framework_leakage`, `check_references`, the 8-of-39 dead exceptions and the
quorum counting were verified by me, which makes them self-verified rather than
independently challenged. Phase 4 and Phase 5 therefore carry less adversarial
scrutiny than Phases 1-3, and that is recorded here rather than smoothed over.

## Phase 1 — A completion claim while CI is unsettled is refused, not warned

The single most expensive behavioural class in the corpus: 14 instances, each
followed by the user handing the work back. Three verbatim:

> `e372249a` — "Fertig, Matze — die Roadmap … ist vollständig abgearbeitet und
> als PR ausgeliefert." → next user turn: *"fixe die ci und die merge konflikte"*
>
> `9502795e` — "**Stand.** … mehrere Node-/Install-Shards laufen noch." → next
> user turn: *"fixe die  ci"*
>
> `20188a37` — "Damit ist alles erledigt." → next user turn: *"consistency
> faily. fixe das"*

The rule is in context at full strength every time. What is missing is a refusal.

**This phase was rewritten after its first premise was falsified — see § Challenge
pass.** The first version had the detector read the unsettled CI state out of the
transcript. `readTranscriptTail` cannot supply it, twice over:
`_toolCalls` keeps only *name, shell command and target path*
(`turn_end_gate_hook.ts:646-660`), so a tool **result** — where the pending count
lives — is never read; and `toolCalls` is **reset at every genuine user prompt**
by design (`:641-645`, *"a verification from three turns ago cannot vouch for an
edit made now"*), while the completion claim almost always lands in a later turn
than the poll. Building it as first written would have required reversing an
invariant that file argues for in prose and pins in tests.

The producer already exists instead. `before_complete_hook.ts` runs on
`post_tool_use` and already records observable verification evidence into
`agents/runtime/state/verify-before-complete.json` (`hook_manifest.yaml:61-69`),
and `turn-end-gate` is already declared `severity: blocking`, `fail_closed: false`
(`:460-464`) with the delivered reply available as `lastAssistant`. So the split
is producer/consumer across two concerns that are both already bound.

- [x] **1.1** Producer: extend `before_complete_hook.ts` to record whether the
  most recent CI read was **settled**, from the Bash tool results it already sees
  on `post_tool_use`. It reuses the **existing** `pendingCount` /
  `isVacuousOutput` predicates from `conformance_scan.ts` rather than a new
  parser, so the gate and the scan cannot drift.
  `verify:` `npx vitest run tests/scripts/hooks/before_complete_hook.test.ts`
- [x] **1.2** Consumer: add a `completion-claim-without-settled-ci` detector to
  `turn_end_gate_hook.ts`. It fires only when BOTH hold: `lastAssistant` carries a
  completion claim, and the recorded CI state is unsettled. No network call and no
  transcript re-read — a `gh` invocation per turn-end would put a round-trip on
  the hot path (`road-to-hook-latency-repair` exists for that reason). Record the
  rejected alternative in the docstring.
  `verify:` `npx vitest run tests/scripts/turn_end_gate_hook.test.ts`
- [x] **1.2b** State the staleness asymmetry that makes cross-turn state
  legitimate here where the reader refuses it for verification: a stale
  *positive* ("I verified") wrongly vouches, a stale *negative* ("CI was
  unsettled") only ever refuses more often. The invariant is preserved, not
  bypassed.
  `verify:` `grep -ci "asymmetr" src/scripts/hooks/turn_end_gate_hook.ts`
> **The switch this detector shipped behind was deleted under it, mid-run.** PR
> #1296 landed on `main` while these phases were executing and removed
> `hooks.turn_end_gate.*` entirely, arming the gate unconditionally — its argument
> being that a default-off safety gate is an absent one, so the soak the switch
> was protecting could never happen. Detector D was written with its own
> `completion` flag and a test pinning it; the merge resolved **toward main**, so
> the flag and the ten settings tests are gone and D sits in the same
> unconditional list as A/B/C, with its gating where that file says gating
> belongs — inside the detector. Three consequences, stated rather than absorbed:
> it can no longer be turned off by configuration, only by a revert; that raises
> the bar on its false-positive corpus, which is what 1.4's negative cases and the
> three end-to-end probes are for; and Phase 1 above was written against a design
> that no longer exists, so this note sits here instead of the text being silently
> rewritten to look prescient.

- [x] **1.3** Fail-open on every internal error, and fire **at most once per
  turn**. A turn-end gate that can wedge the loop is worse than the class it
  catches.
  `verify:` `npx vitest run tests/scripts/turn_end_gate_hook.test.ts`
- [x] **1.4** Negative tests that must PASS (not block): a completion claim after
  a settled green read; a completion claim in a session that never touched CI; an
  unsettled CI read with no completion claim.
  `verify:` `npx vitest run tests/scripts/turn_end_gate_hook.test.ts`
- [x] **1.5** Register the same detector as a fifth check in
  `conformance_scan.ts` so the class has a rate before and after, measured by the
  same predicate the gate uses.

  **Measured, and it is the finding that outranks the rest of this roadmap.**
  The fifth check reads **17** over the same 28 sessions — against 14 counted by
  hand in the reading half, two independent instruments agreeing within margin on
  a class nobody had measured. Its era split is the opposite of every other
  check's:

  | check | pre-carrier | post-carrier | sessions with a hit |
  |---|---|---|---|
  | the four pre-existing | 155 / 657 turns | **0** / 1 697 | 3 of 28 |
  | `completion-claim` | 2 / 657 (0.30 %) | **15** / 1 727 (0.87 %) | **14 of 28** |

  So the round's thesis survives with one named exception: the four mechanised
  checks are clean, and the class that was never mechanised is the live one —
  diffuse rather than concentrated, higher after the carrier than before, and
  carrying two hits from the day of this audit.
  `verify:` `./scripts-run src/scripts/conformance_scan --limit 30 --store "$HOME/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config"`

## Phase 2 — `block_no_verify` fails closed on ordinary prose

Reproduced live on 2026-08-12, on this branch:

```
$ block_no_verify --command "git commit -F - <<'EOF'
fix(x): respect the maintainer's call
EOF"
BLOCKED — command parse failed (shlex) on a git-containing command — fail-closed
```

That command bypasses nothing. `shlex` has no heredoc model, so an apostrophe
inside a heredoc **body** aborts the parse, and the fail-closed branch then
blocks a valid commit. Four sessions hit it (`88d229d6`, `bddced99`, `8824e2e9`,
`3d50d0df`), each paying the same workaround — write the message to a file. The
guard's own error text documents the workaround instead of fixing the cause.

`grep -n` no longer trips it — probed and **already fixed**, so that half of the
finding is retired rather than carried.

- [x] **2.1** Threat-model first (`security-sensitive-stop`): this guard blocks
  irreversible operations, so write down what an attacker could hide in a
  heredoc body before touching the parser.
  `verify:` `grep -ci "threat model" src/scripts/hooks/block_no_verify.ts`
- [x] **2.2** Excise heredoc bodies before `shlex`, **and re-apply the guard
  recursively to each shell-consumed body**, so a body that is itself a command
  (`bash <<EOF … git commit --no-verify … EOF`) blocks while a commit MESSAGE
  naming the flag stays data.

  **Correction to this step's own premise, measured before the edit.** It read
  "excising without the recursive pass would *trade* a false positive for a real
  bypass — the exact trade round 6 had to repair". There is no trade: the bypass
  **pre-existed**. Probed on this branch at the unmodified code, both directions
  were already broken —

  | vector | before | after |
  |---|---|---|
  | `git commit -F - <<'EOF' … maintainer's … EOF` | **BLOCKED** (false positive) | passes |
  | `bash <<EOF … git commit --no-verify … EOF` | **ALLOWED** (real bypass) | blocks |

  because the stripped string fed only the substitution scan while `shlexSplit`
  still received the raw command. One change moves both rows.
  `verify:` `npx vitest run tests/scripts/hooks/block_no_verify.test.ts`
- [x] **2.3** Pin the matrix as tests, both directions: `git commit -n` blocks ·
  `git commit --no-verify` blocks · `bash <<EOF … --no-verify … EOF` blocks ·
  a shell consumer through a path prefix (`/bin/sh`) and an `env` prefix blocks ·
  the apostrophe-in-heredoc commit **passes** · a commit message *naming*
  `--no-verify` passes · a bare mention of `bash` in a message passes ·
  an unterminated heredoc still fails closed · `grep -n` passes ·
  `[ -n "$X" ]` passes.

  **Attribution corrected:** round 6's `echo $'don\'t' && npm publish` vector is
  **not** this guard's — `npm publish` is a `BLOCK_OP` of
  `block_unauthorized_git`. Verified there instead (`commandOp` → `publish`), and
  that guard is untouched by this phase.
  `verify:` `npx vitest run tests/scripts/hooks/block_no_verify.test.ts`
- [-] **2.5** A SECOND false positive in the same guard, found by hitting it while
  executing this roadmap, and deliberately **not fixed here**. The guard blocked
  `git show HEAD:file > /tmp/x; grep -n foo /tmp/x` — a read-only command with no
  bypass in it. Mechanism, isolated by probe:

  | command | exit |
  |---|---|
  | `git show … > /tmp/x; grep -n foo /tmp/x` (no space before `;`) | **1 — blocked** |
  | `git show … > /tmp/x ; grep -n foo /tmp/x` (spaced) | 0 — passes |

  `;` IS in `_SHELL_SEPARATORS`, but `_split_subcommands` compares **whole
  tokens**, and `shlexSplit` tokenises `/tmp/x;` as one word — so no boundary is
  seen, `grep`'s `-n` is read as a flag of the `git` in command position.

  **The obvious fix is a bypass, which is why it stays open.** Splitting tokens on
  embedded separators after tokenisation cannot distinguish a quoted `;` from an
  unquoted one, because shlex has already dropped the quotes:
  `git commit -m "a;b" --no-verify` would split into `[git commit -m a]` and
  `[b --no-verify]`, the second group has no `git`, and `--no-verify` stops being
  flagged — a false NEGATIVE on the exact flag the guard exists for. A correct fix
  makes `shlexSplit` report separator boundaries it saw unquoted, which is a change
  to the tokeniser and larger than this phase. Filed in § Classes deliberately NOT
  fixed with that reason.
  `verify:` `./scripts-run src/scripts/hooks/block_no_verify --command 'git show HEAD:f > /tmp/x ; grep -n foo /tmp/x'`
- [x] **2.4** Replace the workaround-documenting error text with one that names
  the real cause. A terminated heredoc can no longer reach the fail-closed branch,
  so prescribing "write the message to a file" there described a cause that no
  longer exists; what reaches it now is quoting bash itself refuses.
  `verify:` `npx vitest run tests/scripts/hooks/block_no_verify.test.ts`

## Phase 3 — The CI↔local parity gate does not know about `preflight`

`check_ci_local_parity.ts` derives its local side from the transitive closure of
`task ci` + `task consistency` plus the pre-push hook (`LOCAL_ROOTS = ['ci',
'consistency']`). And `task ci` **includes** `preflight` as one of its ~30 steps
(`Taskfile.yml:87`). So the gate answers *"does `task ci` mirror CI"* — while the
pass an agent is actually told to run before pushing is `task preflight`, a
**deliberate subset** of it.

That makes the whole set `CI ∩ task ci \ preflight` invisible to the parity gate
by construction, and that intersection is exactly where the corpus's "green
locally, red remotely" cycles came from. `preflight`'s own docstring asserts
*"Parity with CI is enforced by `task check-ci-local-parity`"* — an overclaim of
the same false-authority class this audit found elsewhere, since the gate never
looked at `preflight`.

Note what is NOT proposed: making `preflight` equal CI. It is a subset on
purpose (its docstring excludes `check_enforcement_coverage` at a measured 30.7 s
because "a pre-push gate that doubles the hook teaches people to skip it"). The
deliverable is that the subset becomes **declared and counted** instead of implied:

| measured case | session |
|---|---|
| Thin-Root char cap runs only in a CI job, not in preflight | `0d8e4064` |
| the ratchet any new `src/scripts/lint_*` file trips lives in the Node-Tests shard preflight skips | `05291630` |
| `build_proof` / derived-page freshness is not in the local set | `9502795e` |

- [x] **3.1** Derive `preflight`'s closure as a **third** dimension alongside the
  existing `ci` / `consistency` roots — not a replacement, because `ci ⊃ preflight`
  and the two answer different questions. Pinned by a new test file: the gate had
  **none**, so the two pre-existing directions are now covered too.
  `verify:` `npx vitest run tests/scripts/check_ci_local_parity.test.ts`
- [x] **3.2** Report the `CI ∩ ci \ preflight` count. A number here is the
  deliverable, not an adjective. **Measured: `preflight` reaches 22 gates; 221
  CI-enforced gates are locally reachable and not in it.** Printed on every path,
  pass or fail.
  `verify:` `./scripts-run src/scripts/check_ci_local_parity`
- [x] **3.3** Declare the finding in `src/config/ci-local-parity.yml`.

  **Departure from this step as written, forced by 3.2's number.** It said
  "declare each entry of that set with a reason". 221 per-entry declarations would
  be precisely the allowlist-growth antipattern `autonomous-execution` caps at 20
  ("past that count the list is the problem"). So the gap is declared as a
  **policy plus its measured size** in the manifest header and left report-only —
  the subset is deliberate, and failing on it would demand `preflight` grow into
  `ci`, the opposite of its author's decision.

  One real per-entry declaration did land, and it was not mine: the gate was
  **red on `origin/main`** with `roadmap_progress_hook` undeclared local-only,
  since main's `fd8c56512` pointed the pre-commit hook at the live script path
  and thereby made it visible to this checker. A pre-commit hook script cannot run
  in any workflow, so the declaration is correct on the merits rather than a
  suppression — its committed-tree equivalent (`roadmap:progress-check`) already
  runs remotely. Gate now exits 0.
  `verify:` `./scripts-run src/scripts/check_ci_local_parity`
- [x] **3.4** Correct `preflight`'s docstring: it does not have parity with CI and
  is not meant to. The old line — *"Parity with CI is enforced by
  `task check-ci-local-parity`"* — named an authority nothing held, since that
  checker compares CI against `task ci`, which INCLUDES preflight.
  `verify:` `grep -ci "does not have parity" taskfiles/ci-fast.yml`

## Phase 4 — A line-keyed allowlist produces false reds and rots silently

`lint_framework_leakage.ts` indexes its allowlist by line number
(`_allowlist_index(rel, h.line, allowlist, h.snippet)`). Two consequences, both
measured in one PR (`4059ea0c`):

- an unrelated insertion shifts the line and the suppression stops matching —
  it fired twice in the same PR, the second time triggered by the review fixes
  themselves (*"Die Zeile ist erneut gewandert (201 → 206) — dieselbe Falle,
  zweimal in einem PR"*);
- **8 of 39 exceptions suppress nothing** — three point at lines that do not
  exist, one at a file 32 lines shorter than the number it names.

> **THIS WHOLE PHASE IS RETIRED — the defect was already repaired at HEAD, and
> the roadmap's premise was a finding read without re-deriving its consequence.**
> The finding came from session `4059ea0c` (2026-08-12) — the session that FIXED
> it. Measured on this branch before writing any code:
>
> - `_allowlist_index` matches on `entry.anchor` against the hit's line TEXT, and
>   a numeric `lines` entry is rejected by `validate_allowlist` before the run.
>   The keying is already content-based; the function's own docstring records the
>   migration and says three entries "had rotted under position keys".
> - `./scripts-run src/scripts/lint_framework_leakage` exits **0** and emits no
>   "exemption suppressed nothing this run" line. The 8-of-39 dead exceptions are
>   repaired.
>
> What I actually did wrong: I read `_allowlist_index(rel, h.line, allowlist,
> h.snippet)` and inferred line-keying from the ARGUMENT, without reading the
> body — where `line_no` is now a dead parameter used by nothing. That is this
> repo's own recorded lesson ("a step citing `file:line` still needs the
> consequence re-derived") applied to me.
>
> One residue, noted not fixed: `line_no` is an unused parameter. Removing it
> changes the signature and every call site for zero behaviour, in a file this
> diff otherwise does not touch — pre-existing debt under `minimal-safe-diff`,
> surfaced here rather than deleted drive-by.

- [-] **4.1** Re-key the allowlist on the **snippet** — already true at HEAD.
  `verify:` `./scripts-run src/scripts/lint_framework_leakage`
- [-] **4.2** Repair the 8 dead exceptions — already repaired; the gate emits no
  "suppressed nothing" line.
  `verify:` `./scripts-run src/scripts/lint_framework_leakage`
- [-] **4.3** Make the "suppressed nothing" warning authoritative — already is,
  because the keys are already content anchors.
  `verify:` `./scripts-run src/scripts/lint_framework_leakage`

## Phase 5 — The council CLI loses spend and over-reports attendance

Two defects, both measured, both cheap to fix, and both corrupting the mechanism
this very audit depends on.

- [x] **5.1** Validate `--output` **before** the first billable call. Measured
  cost: three sessions, ~$1.30 (`291f827b` ~$0.42, `9502795e` $0.44,
  `d6154522` and `3d50d0df` one discarded run each). Recorded in memory as a
  trap for weeks and still paid.
  `verify:` `./scripts-run src/scripts/council_cli run agents/tmp/council-round7-question.md --output /nope/x.json`
- [x] **5.2** Count quorum attendance from **non-empty** responses. A 290 s curl
  timeout returning 0 bytes was reported as `2/2 present` in two sessions
  (`9fc9ba3e`, `4ac2f7ac`) — a single-voice verdict presented as convergence,
  on a paid run.
  `verify:` `npx vitest run tests/scripts/ai_council/quorum.test.ts`
- [x] **5.3** A degraded run says so in its own output, so a reader cannot mistake
  attendance for agreement.
  `verify:` `npx vitest run tests/scripts/ai_council/quorum.test.ts`

## Phase 6 — The instrument that produced the false alarm

Folded down from a standalone phase on the council's verdict: this is measurement
hygiene, not a behaviour mechanism. It still ships, because the falsifier it
mis-fired is pre-registered and a mis-firing falsifier escalates to a methodology
review.

- [x] **6.1** Era guard on the band verdict: refuse a band reading whose corpus
  spans a carrier change, the same way the existing `BAND_MIN_TURNS` floor
  refuses one whose corpus is too small.
  `verify:` `npx vitest run tests/scripts/conformance_scan.test.ts`
- [x] **6.2** Report both denominators — all assistant turns AND turns under a
  German pin — and name which one the band's own three reference values used.
  `verify:` `./scripts-run src/scripts/conformance_scan --limit 30 --store "$HOME/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config"`
- [x] **6.3** Commit the probes as real scripts, so round 8 reproduces the numbers
  instead of re-deriving them.

  **Two of the four, not four**, and the reason is 6.1/6.2: the era split and the
  pin denominator are now computed INSIDE the scan, so shipping them as separate
  scripts would be two ways to derive one number — the drift this roadmap keeps
  finding elsewhere. Committed: `probe_session_canary.ts` (25/28, 89.3 %) and
  `probe_promissory_closing.ts` (1/120 narrow, 2/120 loose). Both import the
  scan's own predicates rather than copying them — the canary probe's first
  version had its own harness list and reported 24/28 for a 25/28 corpus.
  `verify:` `./scripts-run src/scripts/probe_session_canary --limit 30`
- [x] **6.4** Record in the scan's own output that ask-shape, session-canary,
  promissory closings and checkbox batching remain unmeasured — with the two of
  them this round measured by probe, and by which probe.
  `verify:` `./scripts-run src/scripts/conformance_scan --limit 30 --store "$HOME/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config"`

## Phase 7 — Honest downgrades

Every enforcement claim this audit falsified.

- [x] **7.1** `session-canary`'s pre-registered mechanism is **undecidable as
  written**. Its own text proposes "a check at delivery that rejects a task-start
  reply carrying no greeting". A *task* start is recorded nowhere in a
  transcript, so the check cannot be built as specified. What IS decidable is the
  per-**session** instance, measured here at 96.0 % post-carrier (24 of 25).
  Record both: the per-session half as measured-and-good (25/28 overall,
  **24/25 = 96.0 % post-carrier**, via the committed probe), the per-task half as
  not-mechanisable-today, and delete the implication that the proposal is merely
  unbuilt.
  `verify:` `grep -c "UNDECIDABLE as written" src/rules/session-canary.md`
- [x] **7.2** `check_references` excludes `agents/roadmaps/archive` and
  `agents/roadmaps/skipped` by construction, so the **530 dead relative links
  across 147 of 466 archived roadmaps** cannot be seen by the only checker that
  would see them. Record the measured count and the exclusion as a known,
  unrepaired gap — the repair is a bulk edit and is out of this scope.
  `verify:` `grep -c "agents/roadmaps/archive" src/scripts/check_references.ts`
- [x] **7.3** Record the four already-fixed premises this audit falsified while
  screening, so nobody re-opens them: `grep -n` no longer trips
  `block_no_verify`; the session-claim register was fixed by PR #1284 (merged
  2026-08-12); `check_ci_local_parity` already exists and derives both sides; the
  `block_unauthorized_git` raw-string match is segment-anchored now.
  `verify:` `grep -c "1284" agents/roadmaps/road-to-conformance-round7.md`

## Classes deliberately NOT fixed

| Class | Measured | Why not fixed here |
|---|---|---|
| `language-and-tone` | 152 violations, **all** pre-carrier; 0 of 1 015 German-pinned post-carrier turns | The mechanism works. Nothing to build. |
| promissory closings | 1 of 163 hand-back turns = **0.6 %** (looser predicate: 1.2 %) | **Already mechanised** — `turn-end-gate` ships a blocking `detectPromissory`. The residual 0.6 % is evidence the blocking-carrier prior holds again, not evidence the class is rare. Nothing to build; the first draft of this row said the opposite and was wrong. |
| `user-interaction` trailing free-text ask | ~11 findings, 4 sessions | Real and unmeasured, but the discriminator ("is this an ask?") needs judgement, not a predicate. The council agreed it correctly stays advisory. Phase 6.4 records it as unmeasured rather than pretending otherwise. |
| `commit-policy` remote-state gap | ~9 findings, **both directions** — one session inferred push authorization from a spent one-shot, another refused and the user repeated *"behebe die merge konflikte"* verbatim | A task whose deliverable IS remote state cannot be completed without a push. That is a **kernel rule** text change → own PR + ≥24 h soak (`scope-control`). Filed as a blocker below, not fixed here. |
| four shipped CLI verbs as silent no-ops | `doctor`, `migrate`, `refresh`, `session:recycle` — zero bytes, exit 0, on every installed copy | Touches the bundle build path, whose known trap is that building it in a worktree poisons it. Needs a non-worktree session. |
| `watch_pr_checks` accepting "no checks reported" | one production release (merge → tag → npm publish) completed with zero checks ever run | The release path can only be verified by a real release → spend + human gate. |
| ratchets charging trunk accretion to the branch | 3 findings (`eager_rule_load`, preamble ratchet ×2) | The re-anchor is a maintainer call by the budget files' own rule. |
| `block_no_verify` whitespace-dependent separators (§ 2.5) | probed live: `…/tmp/x; grep -n …` blocks, the spaced form passes | The naive fix — splitting tokens on embedded separators — introduces a false NEGATIVE on `--no-verify` itself, because shlex has already dropped the quotes that would distinguish data from a separator. Needs a tokeniser change that reports unquoted boundaries. Recorded with the probe so the next author does not ship the naive version. |
| harness / spend-limit interruptions | ~8 findings, 5 sessions, each costing the user a verbatim repeat | Not this package's surface. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 2 trades a false positive for a real bypass | implementation | Excising heredoc bodies before parsing is exactly the shape of round 6's regression: it removed a false positive and opened two false negatives on irreversible operations. | **Retired — the risk was measured and it inverted.** The bypass PRE-EXISTED: probed at the unmodified code, `bash <<EOF … --no-verify … EOF` was already ALLOWED, so the change closes a hole rather than opening one. What survives of this row is the discrimination it forced: a body is scanned only when a SHELL consumes it, pinned by 2.3's message-naming-the-flag and bare-mention-of-bash cases, or the round-5 false positive returns in a new shape. | Phase 2 |
| 2 | Phase 1 wedges the turn loop | implementation | A blocking check at turn-end that errors, hangs, or fires repeatedly makes every reply undeliverable — worse than the class it catches. | 1.3 caps it at one fire per turn and fails open on any internal error; 1.2 keeps every network call off the path; 1.4 pins three negative cases that must pass. | Phase 1 |
| 3 | Phase 1's detector reproduces the defect it measures | implementation | The first version of this audit's language detector inherited the very defect it was measuring and reported 303 instead of 626. A completion detector built on a fresh parser could do the same. | 1.1 reuses `pendingCount` / `isVacuousOutput` from `conformance_scan.ts` rather than writing a new parser, and 1.5 registers the same predicate as the scan's fifth check, so gate and measurement cannot disagree. | Phase 1 |
| 4 | Phase 4's re-key silently drops live suppressions | product | Moving from line keys to content keys can leave an entry matching nothing, which turns a suppressed pre-existing hit into a new red. | 4.2 repairs the 8 known-dead entries first and 4.3 makes the existing "suppressed nothing" warning authoritative, so a dropped suppression is reported rather than discovered in CI. | Phase 4 |
| 5 | Phase 3 declares drift instead of removing it | product | Adding `preflight` as a root and then declaring everything it misses satisfies the gate while leaving the "green locally, red remotely" cycles intact. | 3.2 makes the drift **count** the deliverable, and 3.3 requires a per-entry reason — a reason a reader can reject. Closing the drift itself is deliberately not claimed by this roadmap. | Phase 3 |

## Blockers

### blocker: commit-policy-remote-state-deliverable
- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in Phases 1-7. It is listed because the class is measured
  (~9 findings, both directions) and must not be lost, not because it gates a
  step here.
- **What to do:** decide whether an instruction whose deliverable IS remote state
  ("behebe die merge konflikte" on an open PR, "fixe die ci") authorizes the push
  that realizes it. The corpus contains both readings and a user turn repeating
  the instruction verbatim after the conservative one. `commit-policy` is a
  kernel rule, so the edit is its own PR with ≥24 h spacing
  (`scope-control` § Kernel-rule edits) and is not agent-authorable.
- **Resolved when:** `commit-policy` § One-shot authorization states the
  remote-state case explicitly, in either direction, and the round-7 finding is
  cited in the change.
- **Carried forward, so archiving this roadmap does not bury it:**
  `agents/roadmaps/later/road-to-conformance-round7-followup.md`
  (`status: later`, parked 2026-08-20) holds this decision
  with its four measured sessions. A Blockers entry is not a `[~]` step, so Iron
  Law 3's mechanical check would not have caught the loss — the promotion is
  deliberate, not automatic.

## Acceptance criteria

- [x] The four mechanised checks still read **0** over the post-carrier era after
  every change in this roadmap.
- [x] `conformance_scan` refuses a band verdict over an era-spanning corpus and
  reports both denominators.
- [x] `block_no_verify` passes the apostrophe-in-heredoc commit and blocks every
  round-6 vector, both directions pinned as tests.
- [x] `check_ci_local_parity` derives `preflight` and its drift set is either
  empty or declared with reasons.
- [x] `lint_framework_leakage`'s allowlist survives a line shift, and zero
  exceptions suppress nothing.
- [x] `council run` cannot bill before `--output` is validated, and quorum
  attendance counts non-empty responses only.
- [x] Every falsified enforcement claim is downgraded in the artefact that made
  it, and every declined class carries its measured reason.
