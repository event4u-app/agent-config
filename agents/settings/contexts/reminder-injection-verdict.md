# Reminder injection — council verdict (build-to-measure)

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-06, 2-round debate +
tie-break round, actual cost < $0.15): after a round-2 split (build vs reject), the
tie-break converged unanimously on **(b') build-to-measure**.

## Verdict

Build the **minimal** reminder-injection apparatus solely as an A/B eval instrument —
default-off flag, existing hook surface (PreToolUse/PostToolUse), never a production
default before the eval reads out. The 2026-06-25 enforcement-projection honest-null is
a **ceiling, not a floor**: it showed that adding blocking rules to context guarantees
nothing, but it did not test the salience regime (long sessions, high token distance
between rule and decision, weak hosts) — token distance and host mix of that test are
unknown, so the null does not transfer to discretionary decision-time surfacing.

## Pre-registered experiment (do not move goalposts after readout)

- **Arms:** kernel-only (control) · kernel + targeted reminders · kernel + **random
  reminders of equal token overhead** (negative control — isolates salience from
  mere-attention artifacts; if targeted ≈ random, the lift is not salience).
- **Trigger classes (initial):** token-distance (governing tier-2 rule > ~3K tokens
  behind the decision point), weak-host long session, high-stakes turn (e.g.
  paid-render / security-sensitive edit).
- **Corpus:** pressure corpus with long-session + weak-host arms (haiku-class /
  non-Claude projection consumers), n≈50 per arm.
- **Thresholds:** compliance lift ≥ 8 pp → expand toward production (still
  flag-gated); < 5 pp → **teardown, pre-committed**; 5–8 pp → ambiguous, one extension
  run, then decide.
- **Sequencing:** run on the CURRENT kernel schema — no concurrent kernel salience
  rewrites or session-brevity changes, they contaminate the independent variable.
  Alternative hypotheses (kernel formatting, brevity limits) are follow-ups if null.
- **Timebox:** readout after ~4 weeks of corpus runs; findings recorded here.

## Scope

Settled: the *disposition* (build minimal apparatus + run the pre-registered A/B before
any production reminder surface). NOT settled: whether reminder injection works — that
is exactly what the experiment decides. The 2026-06-25 null remains valid for its own
mechanism (hardened blocking projections).

## Revisit-if

- The A/B reads out (either direction) — results supersede this disposition note.
- A frontier-host or upstream harness ships native contextual-reminder primitives our
  hooks could delegate to (mechanism change).
- New model generation materially changes long-context salience behavior before the
  eval runs.
- Telemetry lands that measures the tier-2 miss rate directly (would let the eval
  shrink or be skipped).

## Readout (2026-07-06) — pilot ran, teardown executed per pre-commitment

**Result: Δ = 0 pp on both hosts — baseline at ceiling, teardown executed.**

Pilot scale (honest): 12 live agent sessions, not the full pre-registered
n≈50/arm — 2 scenarios (verify-before-complete completion-claim probe;
inspect-before-destroy contradicting-file probe) × 3 arms (kernel-only ·
targeted marker · random equal-length marker) × 2 hosts (strong: Fable-5-class;
weak: Haiku-4.5). Rule stated once, ~600 words back in distractor context;
single-turn probe, not a full multi-turn session.

- **Strong host: 6/6 comply** across all arms — kernel-only already refuses the
  unverified "done" claim and flags the mis-described file without any injection.
- **Weak host (haiku): 6/6 comply** across all arms — same ceiling.
- Targeted vs random vs no-injection: indistinguishable (all comply).

The experiment could not produce a red baseline: with the rule present in
context at all, both hosts comply, so there is no salience gap for injection to
close in probes of this shape. This is the third consistent null in the family
(enforcement-projection 2026-06-25, recursive-verification, now
reminder-injection) — and it *narrows* the earlier weak-host caveat: at this
context distance, even haiku is at ceiling.

**Consequence executed (pre-committed <5 pp → teardown):** the flag-gated hook
apparatus (`reminder_injection_hook.ts`, manifest wiring, settings toggle) was
removed in the same branch that built it. The three-arm design, trigger
classes, and corpus scenarios remain documented here for any future re-run.

## Scope + revisit-if (updated post-readout)

Settled-by-evidence (12-run pilot, both hosts, Δ=0, ceiling): contextual
reminder injection is not built, at any host tier, for rule-in-context probes
of this shape. Revisit-if:

- Someone produces a scenario corpus where the kernel-only baseline demonstrably
  FAILS (a real red baseline — e.g. genuine >3K-token distance in a live
  multi-turn session, or telemetry showing tier-2 obligations missed in
  production) — the pilot's inability to find one is itself evidence, but a
  found red baseline reopens the question immediately.
- A materially weaker host tier than haiku-4.5 enters the projection-consumer
  set.
- The full pre-registered n≈50/arm run is explicitly funded despite this pilot
  (the pilot is directional, not the full design).

## Revisit condition tested and not met (2026-08-02) — the fourth finding in the family

The revisit condition above ("someone produces a scenario corpus where the
kernel-only baseline demonstrably FAILS — genuine > 3K-token distance in a live
multi-turn session") was **searched for against real recorded sessions and not
met.** ADR-054, the standing design that would have implemented the mechanism,
is now `rejected`.

**Shape tested.** 1,158 recorded sessions of this repository (host transcripts +
the cross-host chat-history log); 67 cleared an ≥ 8-turn gate; three
machine-checkable obligations (unverified completion claim · out-of-scope file
touch · forbidden commit shape) produced 4,130 raw hits, of which 547 in 12
sessions cleared both the ≥ 3K-token distance gate and the in-context gate.
Independent adjudicators — given the verbatim rule text and the surrounding
turns, and not told which verdict was wanted — confirmed **0 of 67**.
Qualifying sessions: **0 of a required 5**. The bar was registered in its own
commit before the data was read.

Distance was never the binding constraint: the qualifying rows span **9,464 to
727,537 tokens**, all from real token accounting. Where the pilot's probes sat
~600 words back, these sit up to 240× the pre-registered bar — and the baseline
is still at ceiling.

**Shape NOT tested — the honest limits.** Only frontier hosts (`claude-opus-5`,
`claude-opus-4-8`, `claude-fable-5`, `claude-sonnet-5`); **no weak-host session
exists in this corpus at all**, so revisit path 2 (a materially weaker tier
entering the consumer set) is untouched and remains open on its own terms. One
operator, one repository, one working style. Three obligations chosen for having
mechanical negative signals — obligations that need a reader ("ask when
uncertain", "surface the trade-off") were never in scope. And two of the three
instruments were blunt: the completion detector under-counted the verification
commands this repo actually uses, and the scope detector could not represent the
task at all (100% false-positive rate on its sample). Both were blunt toward
**more** candidates, not fewer.

**The one confound, closed.** 655 hits in 20 sessions failed the in-context
check. Left parked that would have contaminated the null — a rule that never
reached context cannot be said to have been ignored despite distance. All 20
were checked: **0/20 record the projected instruction block at all**, including
the session that produced the report. It is a transcript-recording artifact, not
a projection defect. The correction it forces: the in-context gate measured
*what the host wrote to disk*, not *what the model received*, so the corpus is
larger than the 12 sessions adjudicated and the null is an inference from a
sample rather than a census.

**Consequence.** The prompt-time resolver (D1) is refused **as designed** on this
evidence — a design rejection, not epistemic closure (council 2026-08-02,
unanimous that "permanent" would overstate a 0/67 null). What it closes is the
path from a restated complaint to a built resolver. Re-opening requires a
materially weaker host tier entering the consumer set, an explicitly funded
n ≈ 50/arm run, or a produced red baseline under any instrument. Full report:
[`activation-red-baseline`](../../evidence/analysis/activation-red-baseline.md).

## Reminder drift-audit disposition (2026-07-10, road-to-orchestration-and-memory-harvest Phase 5)

The **reminder drift-audit** reflection (a long-session self-audit: fresh-instance
test, caring-observer test, licensed silent correction) is mechanism-distinct from
the torn-down naive/blocking reminder injection above — that tested rule-restatement
/ blocking projections (a ceiling); this is a *discretionary salience self-audit*.
Per [`decision-revisit-gate`](../../../src/rules/decision-revisit-gate.md)
mechanism-match it is therefore *eligible* for a fresh eval — but:

**Disposition: rejected-now, revisit-if.** Council (claude-sonnet-4-5 + gpt-4o,
2026-07-08) converged that it is **not worth the eval cost now** — one prior null
in the reminder family, and the mechanism is subjective/discretionary (no crisp
pass/fail). No eval is scheduled or built.

**Revisit-if:** salience-drift is observed in production after the other
orchestration-and-memory harvest items ship — specifically a long-session
sycophancy ratchet or persona degradation (the agent drifting agreeable/off-brand
over a long session). That observation reopens the question; absent it, the
disposition stands. Settled-by-decision (council), cheaper to reopen than a
settled-by-evidence null.

## Revisit condition MET (2026-08-20) — a red baseline was produced, and one bounded re-emit shipped

The clause in § Scope + revisit-if above reopens this question on "a real red
baseline — e.g. genuine >3K-token distance in a live multi-turn session, or
telemetry showing tier-2 obligations missed in production". Production
transcripts supplied one, so the disposition changes for exactly that regime and
nowhere else.

**Measured** (10 most recent transcripts, all projects, 447 assistant turns
following a German prompt, classified with the hook's own `classify` so the
instrument cannot disagree with the gate):

| distance from pin (assistant turns) | n | English replies |
|---|---|---|
| 1 | 22 | 1 |
| 2–25 | 321 | 0 |
| > 25 | 99 | 11 |

In tool calls — the unit `post_tool_use` can actually count — 11 of the 12
violations sat at **179–200 calls since the pin**, none below 179, while
compliant turns had p90 = 122 and p99 = 184. The largest observed block was 82
assistant turns on ONE prompt, and the pin was re-stated only on a new prompt or
once after a compaction. The surrounding context is ~198k tokens of delivered
rules, entirely English, so the drift runs *with* the context rather than
against it.

**What shipped:** `REEMIT_AFTER_TOOL_CALLS = 150` in `language_mirror_hook`, one
re-emit per 150 tool calls, reset by any new prompt and by the compaction
re-emit. A 200-call block therefore costs ONE extra injection, and the
per-fire payload is unchanged (`language-mirror` budget row, 2048 bytes, not
touched).

**Why this is not the refused shape.** § 6.2 refuses "the same failed mechanism
running more often" — an unbounded re-pin on EVERY tool call, resting on a
baseline the 2026-07-06 pilot found at ceiling (12/12, Δ=0). Two things differ,
and both matter: the baseline here is red and measured in production rather than
at ceiling in a pilot corpus, and the trigger is bounded — once per 150 tool
calls instead of once per call.

**Corrected the same day, before this entry was a day old.** The sentence here
first read "staying silent for the ~90 % of turns that never reach it", and both
council seats refuted it from the numbers in this very entry: compliant p99 =
184 is PAST the 179 violation floor, so the two distributions overlap and some
compliant traffic does cross 150. 150 sits between compliant p90 (122) and the
earliest observed violation (179), which buys margin at the price of reminding
some turns that did not need it. The honest claim is bounded frequency against a
red baseline, never zero false fires.

**Honest basis, stated because the corpus is narrow:** n = 11, and they cluster
in a single long autonomous session. The distance signal is sharp — zero
violations below 179 — but one session wide. 150 is "the number the observed
failure sits behind", not a fitted optimum.

**Revisit-if:** a violation is recorded BELOW 150 tool calls (threshold too
high), or the re-emit fires across ≥ 5 sessions with no violation plausible at
that distance (too low). Either falsifies the number, not the mechanism.

**Unchanged by this entry:** the naive/blocking rule-restatement injection stays
torn down, the drift-audit disposition above stays rejected-now, and nothing here
licenses a reminder for any other obligation. A second obligation wanting the
same treatment needs its own red baseline.

## Council round 3 (2026-08-20) — three of four round-2 fixes held, the fourth did not

Round 2's four fixes were roughly 400 new lines and went out for a third blind
peer review. Both seats returned REQUEST_CHANGES, deckungsgleich: blockers 1, 2
and 4 closed, **blocker 3 not** — the pruner's claim-then-revalidate was still
destructive. Recorded because the pattern is the point: each round's FIX carried
the next round's defect, and stopping at "the reviewer asked for X, X shipped"
would have merged a state-destroying race twice.

| # | Finding | Fix |
|---|---|---|
| 1 | Restoration decided with `existsSync(live)` and acted with `renameSync(tomb, live)`. A writer arriving between the two lost its file to the pruner's older copy — a live pin destroyed by the component that exists to protect it | `linkSync`: atomic, refuses to clobber. Success = nothing was there; `EEXIST` = the owner won and its file is newer by construction |
| 2 | A crash between the claim rename and the restore stranded the file under a name nothing reads (no longer `.json`) and nothing prunes. When the candidate had been refreshed under the pruner, that name held the CURRENT state while the live path was gone for good | A recovery pass over `*.tomb` before the main loop. No grace period: `rename` preserves mtime, so a tombstone carries the age of its CONTENT — which is the property this needs |
| 3 | `_ownsPin` accepted an absent or empty owner as "legacy, therefore mine", contradicting its own newly-stated role as an integrity check. The pre-split file is deleted rather than migrated and every writer stamps the owner, so an ownerless hashed file can only be corruption | Exact equality. No compatibility window is owed — the digest path has never shipped |
| 4 | The test named as foreign-ownership coverage put A's state at A's path and ran as B, so B read its own MISSING file and returned through the absent-pin branch. `_ownsPin(...) === false` was never reached | A's state written at B's OWN hashed path — the only way that branch runs end to end |
| 5 | Both fail-closed tests forced their write failure with `chmod 0o500`, which root ignores: under an elevated CI user the write succeeds and the tests pass against any implementation | An injected writer, parallel to the age reader both seats had accepted. The `chmod` pair is kept but gated behind a probe, so it skips rather than passing vacuously |

**One of my own tests was worthless, and the counter-probe is what said so.**
The test written for finding 1 stayed GREEN against the code it was meant to
refute: its injected callback fires before the old existence check, so the old
code took its safe branch. The race window sits between the old decision and
the old action, and no single-threaded seam reaches it. What replaced it: the
post-condition asserted on the extracted helper (a restore never changes an
existing live file), which catches the forward regression — a future restore
that renames onto the live path without a check — and the honest scope is
stated at the test instead of implied by its name. Removing the fix reds three
tests; removing the recovery pass reds three; loosening `_ownsPin` reds three;
dropping fail-closed reds five.

**Sibling search for the defect itself:** four `existsSync`-then-`renameSync`
sites in `src/`, **zero** further instances. `txlog` checks the source and
renames to a fresh timestamped name; both `code_graph` sites check the source
and replace the destination deliberately; the fourth match is this fix's own doc
comment. The shape is unique to the pruner because only the pruner checks a
destination a foreign process may create concurrently.

**Not addressed, and named rather than closed:** both seats flagged reviewer
fatigue — 45 % of the file is comment, and the critical section was easy to
rubber-stamp inside a long block. Extracting `restore_claimed_state` as a named,
documented function answers the concrete complaint. A general comment diet does
not follow: the surviving blocks carry measurements, revisit conditions, and
refused-alternative rationale, and cutting them is a separate change with its
own risk.

### The blind peer round attached three conditions to the `link` fix

The peer pass did not accept the hard-link proposal as it stood. It named a
real error in the proposing seat's own reasoning — the claim that `link`
"naturally handles the tombstone-orphan case" is false, because the main loop
only enumerates `.json` and would never see a `.tomb` at all — plus two gaps.
All three are now met:

1. **Explicit `.tomb` discovery** — the recovery pass, not an assumption that
   orphans age out through a loop that cannot see them.
2. **The crash window between `link` and `unlink`** — a crash there leaves two
   names on one inode. Covered by a test that stages exactly that pair and
   asserts the sweep drops the duplicate while the content stays reachable once.
3. **Platform compatibility, which was the condition NOT already met.**
   `linkSync` is this tree's first use, `engines` pins only Node >= 20.11, and
   `installation.md` names Windows — so a share, a FUSE mount, or a restricted
   container can answer `EPERM` / `ENOSYS` / `EXDEV` / `EOPNOTSUPP` / `EMLINK`.
   Throwing there would be swallowed by the pruner's outer handler and strand
   the tombstone, losing a FRESH pin outright. So those five codes fall back to
   check-then-act, which reopens exactly the window this fix closes elsewhere —
   strictly better than a guaranteed loss, and the honest ceiling where the
   atomic primitive does not exist. Any other code (`EIO`) still surfaces, and a
   test pins that boundary so the fallback cannot widen into a catch-all.

**Attribution, because it changes who found what:** a second session working the
same review artefact independently raised a finding this entry does not cover —
`_writeDistance` persists `{...previous}` from a snapshot taken at hook start, so
a `post_tool_use` write can clobber a NEWER prompt pin with no hash collision
involved. It is not in the round-3 artefact; that session found it on its own and
owns the fix. Recorded here so the round-3 ledger does not read as complete when
it is not.
