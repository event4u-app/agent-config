---
complexity: structural
status: ready
---

# Road to conformance round 6 — the guard regress I shipped, the unmeasured half, and the therapy that has not started

> Source: an independent review of merged PR #1208 (`2daf29871`), received
> 2026-08-08, re-verified here against a worktree at that exact merge commit.
> Nothing below is adopted from the review on its word: every claim was
> re-executed, and three of them came out differently — one refuted outright.
> Predecessor: `road-to-conformance-round5.md` (still open at HEAD).

## The finding that outranks everything else in this roadmap

**Round 5's Phase 2 introduced a live bypass on irreversible operations, and its
own Risk Register named that exact failure class as rank 1.**

The quote-awareness fix traded one false positive for two false negatives. Both
directions measured, same vectors, same probe, the two code states side by side:

| vector | pre-#1208 | at `2daf29871` | bash executes the op? |
|---|---|---|---|
| `echo $'don\'t' && npm publish` | **blocked** (`commandOp: publish`) | **allowed** (`null`) | **yes** |
| `echo 'oops && npm publish` (unterminated quote) | **blocked** | **allowed** | **no** — syntax error |
| `echo "$(npm publish)"` | allowed | allowed — pre-existing | **yes** |
| the round-5 grep alternation | blocked — the false positive | allowed — the fix working | no |

Exposure is every `BLOCK_OP` with no second net: `npm|pnpm|yarn publish`,
`gh release create`, `gh pr merge`. Git-shaped variants stay covered, verified:
`$'…'` also breaks `block_no_verify`'s shlex, and `_looks_like_git_invocation`
splits without quote awareness, so a `git push` in the tail is still seen.

**Correction, measured while implementing Phase 1 — the fourth column above is
new and one row moves out of the exposure set.** The unterminated-quote vector
is a regression in classification and **not** an executable bypass: bash refuses
the whole command with `unexpected EOF while looking for matching quote`, so
nothing after the separator runs. The live exposure is ANSI-C quoting and
command substitution. Blocking the unbalanced case stays right — 1.2's own
argument is that a false positive on input bash refuses to run is cheap — but it
is defence in depth, not the hole. The instrument matters here and is recorded
because it was wrong the first time: stdout cannot detect a substitution's
execution, since the substitution consumes it, and that first harness reported
"not run" for `sh -c "$(…)"` and `FOO=1 $(…)`, both of which do run. Ground
truth for every row now comes from a file side effect.

**Why the adversarial suite missed it, stated precisely, because "we needed more
test cases" is the comfortable version and it is not what happened.** The suite
tested balanced quoting only. But the deeper error is in the docstring I wrote:

> "an unterminated quote here degrades to 'the rest of the string is quoted',
> which yields one segment starting at the real command word — **the
> conservative outcome**"

That reasoning is inverted. The command word of the surviving segment is `echo`,
so everything after `&&` is swallowed — the outcome is maximally *permissive*,
not conservative. The mistake was not an untested input; it was an argument that
sounded like a safety argument and pointed the other way. Round 5 shipped it
having written the risk down one file away.

## Blockers

### blocker: stop-refusal-decision

- **Status:** open — carried unchanged from round 5
- **Owner:** maintainer
- **Blocks:** round-5 Phase 3 (3.1-3.6), round-5 Phase 6.1, and Phase 6.2 below
- **What to do:** decide whether a concern that can refuse a turn-end ships.
- **Resolved when:** the decision is recorded; if affirmative, the refusal
  concern has merged in its own PR with its own soak period.

Round 5's central measurement stands: both blocking carriers reached zero,
neither advisory carrier did, and 19 violations survived a pin one turn away.
Nothing in this roadmap substitutes for that decision, and Phase 6.2 exists to
stop a future round from inventing a third mechanism class to route around it.

**Council recommendation, recorded as advisory — it is not the authorization.**
2026-08-08, both members chose the same option: build it, behind an explicit
opt-in setting **defaulting to off**, so the mechanism exists and soaks before it
binds. Reasoning as given: two prior hook-severity mistakes plus a turn-end blast
radius make default-on uninsurable, while default-off costs nothing to have. The
decision stays with the maintainer because a concern that can refuse every
session's turn-end is a safety-surface change, and a chat-delegated council
verdict is not the gate that authorises one. What changes is the *default* this
blocker resolves toward, not who resolves it.

**A design hole the council found in the proposal itself, which the blocker must
now carry:** the re-entrancy guard is specified ("a refused turn-end cannot
loop") and unverified. What happens when the refusal *itself* triggers the
turn-end event? Two shapes were named — a refused turn bypasses all hooks, or a
flag is checked before every hook fires — and the proposal picks neither. A soak
period would discover the answer the expensive way. So: whichever option the
maintainer chooses, the guard's re-entrancy shape has to be stated and tested
before the concern is registered, not after.

### blocker: command-substitution-posture

- **Status:** **resolved** 2026-08-08 by council, on a measurable difference
  rather than a majority
- **Owner:** was maintainer; delegated to the council for plan-shaping questions
- **Blocks:** nothing — Phase 1.4 now carries the resolved design
- **What to do:** nothing further to decide. The resolution is: classify
  **inside** the substitution by command position. A substitution whose command
  word is a blocked op is an invocation and is refused; a substitution that
  merely *mentions* one in an argument is not. Implementing it is Phase 1.4.
- **Resolved when:** ✅ recorded here and in Phase 1.4.

**How the split was resolved.** The council divided: one member proposed
fail-closed on any substitution containing a blocked literal, the other argued
that over-blocks and proposed repairing the detector instead. Neither was adopted
on authority. The falsifiable difference is one case — *a substitution whose
command word is harmless but whose argument names a blocked op*, e.g.
`echo "$(grep -c 'npm publish' package.json)"`. Fail-closed refuses it; the
detector repair does not.

The guards already answer that question in their own contract: `commandOp`
"matches per invoked segment and only when the segment BEGINS with the tool — a
mention inside an argument is not an invocation." Applying the existing rule one
level deeper is consistency, not taste, so the detector repair wins.

One correction to the council's own reasoning, recorded because a verdict adopted
with a broken example is cover: the member arguing against fail-closed cited
`grep "git push" file.txt` as the false positive. That command contains no
substitution at all, so neither posture fires on it. The argument is right and
the example was wrong — the real case is the nested-`grep` one above.

## What was verified, and what came out differently

Every row was executed against a worktree at `2daf29871`. The three rows marked
**changed** are where this roadmap departs from the review it came from.

| review claim | verdict |
|---|---|
| M1 · ANSI-C quoting bypass, introduced by #1208 | **Confirmed**, both directions, and one vector added: an unterminated single quote bypasses identically and is also a regression. The review folded that case into a fix step; it belongs in the measured set. |
| M2 · command substitution bypasses both guards | **Confirmed**, all three variants. `block_no_verify` does split on `$(` and backtick — but only in the fail-closed branch, which balanced quotes never reach. `_looks_like_git_invocation` returns `true` for the git variants and is never consulted. The more parseable the command, the less protected it is. |
| M3 · scanner and hook now disagree on the trigger | **Confirmed and widened — changed.** `isSyntheticPrompt` is not referenced in `conformance_scan.ts`; the scanner's only general net is `length > 2500 && english`. The asymmetry also runs the **other** way, which the review did not raise: the hook has no injected-body net at all, so a prompt dominated by pasted foreign-language content pins to the paste. That fired in the session that received this review — the pin read English because an English roadmap draft was pasted below German prose. |
| Point 4 · `isSyntheticPrompt` may over-filter a real prompt | **Refuted — changed.** Measured across 1 540 user-role text entries: 509 open at character zero with a marker, and in **0** of them does human text survive wrapper removal. The suspected shape — a prepended `<system-reminder>` — occurs **0** times. `<local-command-caveat>` occurs 42 times but always as its own wrapper-only entry, because the harness stores the wrapper and the typed prompt as separate entries. No phase is spent on this; the null is published so round 7 does not re-raise it. One honest residue below. |
| Point 5 · zero enforcement shipped for the core class | **Confirmed** by construction. Everything round 5 shipped is delivery, instrument, or false-positive repair. |
| Point 6 · skills are not measured at all | **Confirmed.** Skills appear in the conformance scan only as bodies to exclude. |
| Point 7 · the volume interaction was never discussed | **Confirmed, with different numbers — changed.** Measured here: the project projection goes from ~76 300 tokens (92 rules) to **~99 500** (108 rules), so restoring the 21 rules added **~23 200 tokens** to that carrier; union across both carriers moves ~176 000 → **~199 300**. The review cites a ~207 000 figure from another measurement; not reproduced, not adopted. |
| Point 8 · round 5 merged with its acceptance list untouched | **Confirmed.** All six criteria are `[ ]` and the roadmap is unarchived at HEAD. |
| — · a third defect in #1208, found by someone else | **Not from the review; found while merging.** PR #1211, `fix(gates): a zero-tool checkout is an absent surface, not a dead scan scope`, repairs the projection gate #1208 shipped: a checkout with no host tool trees was classified as a dead scan scope — which errors — instead of an absent surface. The `assertScanned` discipline was applied to the wrong condition. Counted here because this roadmap's opening claim is about what #1208 shipped, and an audit that lists only the defects a reviewer handed it is not counting. |

### M5 — the cross-project control group, and the null it produced

Found during the challenge pass, from data that already existed. The suite is
installed **machine-globally**, so every project on this machine receives the
~112-rule global carrier; only this project also has a per-project projection.
Other projects are therefore a single-carrier control group, and nobody had
looked.

| project | carriers | sessions | assistant turns | language violations | rate | German-prompt share | asst turns / prompt |
|---|---|---:|---:|---:|---:|---:|---:|
| `private/capisco` | global only, ~100k | 10 | 1 978 | 775 | **39.2 %** | 89.0 % | 14.2 |
| `private/agent-switch` | global only, ~100k | 19 | 3 368 | 308 | **9.1 %** | 87.8 % | 9.1 |
| this package | both, ~199k | 27 | 2 280 | 578 | **25.4 %** | 80.2 % | 9.0 |
| `private` (parent dir) | global only | 2 | 77 | 1 | 1.3 % | — | — |

Same instrument for all four, via `conformance:behavior --store`. The obvious
confound is largely ruled out: a project with more German prompts has more
violatable turns, but all three sit at 80-89 %. The two projects with
near-identical turns-per-prompt (9.1 and 9.0) differ in rate by 2.8×.

**Neither carrier volume nor autonomy ratio orders the three.** The
single-carrier condition contains both the worst rate and the best. n = 3, and n
cannot cheaply be raised — only three projects have a corpus worth measuring, and
the largest private one holds 19 sessions, so "the last 30 chats per project" is
not a satisfiable request there.

This is exploratory, computed after seeing the data, and it is **not** the
pre-registered test. What it does is remove the motivating prior from the phase
that planned that test — see Phase 4.

### The residue on the refuted point

The transcript is not the surface the hook reads. The hook takes
`payload.prompt` from the host's `UserPromptSubmit`, and there is direct evidence
the host forwards harness-generated turns there — a state file observed mid-run
carried `prompt_chars: 6627` for a background notification nobody typed. Whether
the host also prepends the slash-command wrapper to that field is an inference,
not a measurement, and the repo cannot answer it. Falsifier, cheap: record the
received prompt length for one slash-command turn and compare it against the
length of the text actually typed. Phase 2.3 does exactly that and nothing more.

## Phase 1 — Close the regress, then the standing hole

- [x] 1.1 `splitOutsideQuotes`: recognise `$'` as a quote opener with C-style
  escape semantics (`\'` does not close it) and `$"` as `"`. Pin the exact
  measured command; it must classify as `publish` and block.
- [x] 1.2 Replace the unterminated-quote posture. Today the tail becomes one
  quoted segment, which is permissive for the reason named above. Instead
  re-split the tail **without** quote awareness and classify every segment. A
  false positive on input bash would itself refuse to run is acceptable; a false
  negative on input bash *does* run is the failure the guard exists for. Pin
  `echo 'oops && npm publish` as blocked, and the round-5 grep alternation as
  still allowed — its quotes balance, so this branch never sees it.
  <!-- Shipped as specified. Only the segments completed BEFORE the unclosed
  opener keep their quote-aware split; the trailing one is re-read with
  separators live. -->
- [x] 1.3 Extend the adversarial suite with the full vector set: `$'…'`,
  unterminated single and double quotes, substitutions inside and outside double
  quotes, backticks, `sh -c "$(…)"`, and an env-assignment-prefixed
  substitution. Record the measured outcome for every vector **including the
  ones deliberately left open** — a vector table with only the fixed rows is the
  same false-completeness this round is about. The council named the cost this
  step exists to pay: a fail-closed posture cannot be confirmed by reading the
  splitter, so every row's ground truth comes from running a shell against the
  same input, as the round-5 regress was established.
  <!-- `ROUND6_VECTORS` (16 rows, each carrying its measured `bashRuns`) and
  `ROUND6_OPEN_VECTORS` (2 rows) in tests/scripts/git_authorization.test.ts. One
  test asserts the invariant directly: no vector bash executes classifies null. -->
- [x] 1.4 Implement the resolved substitution design in **both** guards: extract
  each `$(…)` / backtick payload and classify it by **command position**, so
  `$(git push --force …)` is an invocation and `$(grep -c 'npm publish' f)` is
  not. `block_no_verify`'s `$(` split is unreachable exactly when it is needed —
  it lives in the fail-closed branch that a well-formed command never enters — so
  repairing one guard would leave the git-shaped variants open. Pin both: the
  invocation blocks, the quoting mention does not.
  <!-- `substitutionPayloads` is exported from block_unauthorized_git and
  imported by block_no_verify, so the two cannot drift. Heredoc bodies are
  stripped before extraction, or a backtick in a commit message would re-open
  the round-5 false positive from the other side. -->
- [x] 1.5 Amend both guard headers. They currently claim the quote fix "does not
  discard quoted payloads, so `sh -c "npm publish"` still unwraps" — true, and
  incomplete in a way that reads as coverage. State the substitution exclusion
  until 1.4 lands.
  <!-- 1.4 landed in the same change, so there is no substitution exclusion to
  state. Both headers now carry the residue that IS real — variable indirection
  and xargs — under an explicit "what this guard does not see". -->
- [x] 1.6 **Added while measuring 1.3, not in the original plan.** Three of the
  five vectors the suite found open are the same two mechanisms Phase 1 already
  implements, not shell interpretation: `eval` is `sh -c` by another name,
  `<(…)` is a substitution, and quotes inside the command word (`np''m publish`)
  are removed by the shell before lookup. All three execute under bash and were
  classified `null`. Closed here rather than filed, because leaving a vector open
  in the same file that just added an "everything bash runs is blocked" assertion
  would make that assertion false on the day it shipped.

## Phase 2 — One trigger definition, both directions

- [x] 2.1 Extract the synthetic-prompt predicate into a shared module and apply
  it in `conformance_scan.ts` alongside `isCompactSummary` and `isInjectedBody`.
  Hook and scanner must classify the same entry identically, or every future era
  split argues about two different populations.
  <!-- `src/scripts/_lib/prompt_shape.ts`. The hook re-exports it so its tested
  surface is unchanged; the scanner imports it. -->
- [x] 2.2 Give the **hook** the net it lacks: a prompt whose bulk is pasted
  foreign-language content must not pin to the paste. The scanner's heuristic
  (`length > 2500 && english`) is the wrong shape for a bidirectional test —
  derive the rule from the human-authored fraction, not from a hard-coded
  language. This is the defect that fired on the review's own session.
  <!-- Shipped as lead-first classification: the typed span above the first
  pasted document decides, and only an undetermined lead falls through to the
  whole body. Names no language, so it resolves German-over-English-paste and
  English-over-German-paste by the same step; both pinned. -->
- [x] 2.3 Settle the residue named above: record the prompt length the hook
  receives for one slash-command turn, compare against the typed text, and
  publish the answer. If the host does prepend the wrapper, 2.1's predicate
  needs a strip-then-classify branch; if it does not, the null closes the
  question permanently.
- [x] 2.4 Re-run `conformance:behavior --limit 30` after 2.1-2.2 and publish the
  delta against 578, whatever its sign. Per the instrument lock the superseded
  figures stay in the table beside it.

### 2.3 — the answer, and it is a null

The falsifier ran on the turn that opened this session's work: a
`/roadmap:next im working tree` invocation, 15 characters typed, against a
12 224-character command body.

| payload | chars | classifier verdict |
|---|---:|---|
| the typed text alone | 15 | `und` — 1 de marker, 0 en |
| wrapper + command body | 12 273 | `en` — 1 de marker, 254 en |

The pin that turn resolved **German**. An `und` verdict leaves the previous pin
standing, which is what German requires; an `en` verdict would have flipped it
and every later turn with it. So the host does **not** prepend the slash-command
wrapper or body to `payload.prompt`, and 2.1's predicate needs no
strip-then-classify branch. Both classifier versions were run on both payloads
and agree, so the answer does not depend on this round's own change.

The question is closed permanently rather than deferred: the observation is
direct, not an inference about the host.

### 2.4 — the delta, decomposed rather than attributed

Same store (27 sessions), same `--limit 30`, both halves isolated by disabling
one at a time.

| state | language-pin |
|---|---:|
| published, round 5 | 578 |
| today's corpus, neither change | **577** |
| + synthetic-turn skip (2.1) | **622** (+45) |
| + lead-first classification (2.2) | **622** (+0) |

The 578 → 577 step is corpus drift of one turn, not a code effect.

**The mechanical reason for +45, which is a correction and not noise.** A
harness-generated user turn is English and was read as a chat message, so it set
`pinned = "en"`, and every English assistant turn after it counted as
CONFORMING. The scanner was under-reporting, and it was under-reporting exactly
the population the hook has skipped since round 5 — the divergence 2.1 closes
was not neutral, it was flattering. 622 is the first figure both surfaces agree
on.

**2.2 contributes zero on this corpus, and that is published rather than
buried.** The paste-dominance defect is real — it fired on a live session and
both directions are pinned in the suite — but across ~2 280 assistant turns it
moves no count. The mechanism is right and its measured magnitude here is null;
a future round should not re-derive it as new evidence.

## Phase 3 — Skills: the census IS the finding

The original complaint names rules **and** skills. Six rounds in, skills have
been measured exactly never — they enter the scan only as bodies to exclude.

**This phase was rewritten by the challenge pass, against its own first draft.**
The draft defined a missed-activation detector as "a turn matches a skill's own
**frontmatter triggers**". Measured: **0 of 288 skills carry a `triggers:` key**;
all 288 carry only a `description:`. So that detector was unbuildable as
specified, and matching `description:` prose instead is exactly the FC-8-shaped
prose-matching the draft's own next step forbade — the contradiction sat two
steps apart in one file, and no gate would have caught it.

Second measurement, same pass: **8 of 288 skills** carry a deterministic
`MUST`/`NEVER`/`ALWAYS` at line start. The draft pre-authorised the exit at a
threshold of five, so 8 clears it — but it clears it while covering **2.8 %** of
the corpus, which is not the same thing as a working instrument.

So the deliverable inverts. The honest answer to "are skills followed?" is not a
rate; it is that today's frontmatter cannot support the question, and the census
is what says so.

- [ ] 3.1 Publish the census as the primary finding: 288 skills, **0** with
  machine-readable triggers, **8** with a deterministic obligation. Skill
  activation is not measurable against the shipped frontmatter, and no number
  should be reported as if it were.
- [ ] 3.2 Build the one class that *is* buildable — **SK-2 loaded-but-violated**:
  a skill body is in context and a deterministic obligation stated in it is
  violated in a later assistant turn of the same session. Scope it explicitly to
  the 8 skills, and name them, so the coverage is legible rather than implied.
- [ ] 3.3 Validate before believing any number: hand-read every flagged turn of
  the first run and publish precision. A detector that cannot state its
  false-positive rate ships as detection-only and this roadmap says so.
- [ ] 3.4 Do **not** build a missed-activation detector over `description:`
  prose, and record the refusal here so round 7 does not propose it as new.
  Adding `triggers:` to 288 skills is a separate scope with its own blast radius;
  it is named in the deferred table, not smuggled in as a sub-step.

## Phase 4 — The volume question, answered differently than planned

Round 5 measured the condition and deferred the fix. Then its Phase 1 pushed the
delivered volume up by ~23 200 tokens on the project carrier. If instruction
volume contributes to non-compliance, round 5 made delivery correct and volume
worse in the same change — and never said so, because the interaction appears
nowhere in that roadmap.

**The plan for this phase was to pre-register and test that. It does not run.**
M5 above is a natural experiment that already existed and nobody had looked at:
the single-carrier condition contains both the worst rate and the best, the
language-mix confound is ruled out, and two projects with identical
turns-per-prompt differ 2.8×. What survives is everything that stood on its own
merit — two rules whose delivered copies make opposite claims, an invisible
divergence, and a token instrument a separate pending decision needs — plus one
step neither the plan nor the council's options contained (4.5).

- [ ] 4.1 Land round-5 Phase 1.3 (cross-carrier divergence report, advisory) and
  1.4 (ledger registration plus the non-empty-scan confirmation). Both are open
  at HEAD; 1.3 is what makes the 91 divergent pairs visible instead of silent.
- [ ] 4.2 Resolve the two contradictory pairs ahead of any general dedup. The
  global `git-history-discipline` still asserts unqualified deterministic
  blocking that the shipped copy retracts. A contradiction held with no
  precedence marker is worse than either copy alone.
- [ ] 4.3 Add per-session delivered-token measurement to the conformance scan:
  total rule-text tokens reaching context, split by carrier. This is the
  instrument the `essential` default-flip has been waiting on. The flip itself
  is a human gate and is not decided here.
- [x] 4.4 **Cancelled — the hypothesis test does not run, and M5 is why.**
  Council 2026-08-08, unanimous across both members: the natural experiment
  already falsified the ordering, and a pre-registration written *after* its
  numbers are known is not blind. One member said so directly — "pre-registering
  post-hoc is theater". Cancelled rather than deferred: a deferral implies the
  same test is still the right one, and it is not.
- [ ] 4.5 **The step both members added that was in no option.** Dropping the
  test without adding forward instrumentation closes the investigation
  permanently, because the project-identity variable cannot be recovered
  retroactively. So: record per-project violation rates from this round onward,
  keyed by store, alongside the delivered-token figure from 4.3. Both members
  independently named Q1 as the decision most likely to be wrong in hindsight,
  and both named the same early-warning signal — **a fourth project falling
  outside the observed 9.1-39.2 % band**. That is the falsifier; without 4.5
  nobody would ever see it.

## Phase 5 — Close round 5's own accounting

- [ ] 5.1 Walk round 5's six acceptance criteria. Check the ones its shipped
  phases satisfy — the stale-tree case has a pinned test, the refused commands
  have regression tests, no kernel rule was modified, both era numbers are
  published. Mark the Phase-3-dependent ones as blocked rather than leaving them
  ambiguous. A merged roadmap with an untouched acceptance list reads as
  unverified even where it is not, and this round is the proof: an independent
  reviewer had to re-derive what those criteria would have recorded.

## Phase 6 — What this roadmap will not do

- [ ] 6.1 No new advisory carrier ships for any measured class. The round-5
  result (a fresh pin ignored at distance 1) stands, as does the council's
  refusal of frequency-as-mechanism. Recorded so round 7 does not re-propose it.
- [ ] 6.2 No enforcement work beyond Phase 1's repair happens before the
  stop-refusal blocker resolves. Inventing a third mechanism class to route
  around a parked decision is how a blocker becomes a silent drop.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-08 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The Phase 1 repair re-opens the round-5 false positive | implementation | The grep alternation must stay allowed while ANSI-C quoting becomes blockable; both pull on the same splitter, and last round the trade went the wrong way silently | Both commands are pinned in one suite so neither can regress alone, and 1.2's posture applies only when quotes do not balance — which the grep case's do. The vector table in 1.3 makes the trade legible instead of implied | Phase 1 |
| 2 | Phase 1 is reasoned safe again and is not | implementation | The rank-1 risk last round was written down and shipped anyway, because the argument for safety was inverted and nobody tested the argument | No posture in Phase 1 ships on an argument alone: each is pinned by a vector whose ground truth was established by running bash, not by reading the splitter | Phase 1 |
| 3 | Substitution posture (a) floods with false positives | product | BLOCK_OP literals inside substitutions occur legitimately in docs-grep and heredoc-adjacent commands, and a noisy blocking guard teaches bypass | The blocker exists so the trade is chosen rather than defaulted; whichever posture loses is recorded with its measured cost from 1.3's table | Blockers |
| 4 | The skill census reads as an excuse rather than a finding | product | "Not measurable" is exactly what a team says when it does not want to measure, so a census published in place of a rate has to carry its own proof | The census is two counts anyone can re-run — `triggers:` keys present in 288 skill frontmatters, and line-start deterministic obligations — and 3.4 records the refused shortcut by name so the absence of a rate is visibly a choice with a reason | Phase 3 |
| 5 | SK-2 has no precision floor | implementation | A detector over 8 skills can still produce confident nonsense, and a small corpus makes a bad rate look precise | 3.3 makes hand-validation a gate on publication, and 3.2 requires the 8 to be named so coverage is legible rather than implied | Phase 3 |
| 6 | Cancelling the volume test closes the investigation for good | product | The project-identity variable cannot be recovered retroactively, so dropping the test without adding forward capture means a later reversal has no data to reverse onto. Both council members independently named this the decision most likely to be wrong in hindsight | 4.5 captures per-project rates from this round onward and names the falsifier both members converged on — a fourth project outside the observed 9.1-39.2 % band. The cancellation is recorded as cancelled, not deferred, so nobody re-runs the same non-blind test | Phase 4 |
| 7 | This round also ships zero enforcement | product | Phases 1-5 are repair and instruments. If the stop-refusal blocker stays open, round 6 repeats round 5's shape at higher cost | Stated in the opening rather than discovered at the end; 6.2 makes the dependency explicit. The blocker carries an owner, an action and a resolution condition | Blockers |
| 8 | Re-measurement moves the headline count a fourth time | product | 2.4 will change 578 in some direction, and a series whose number moves every round invites disbelief in all of them | Every figure stays published side by side with its mechanical reason; 2.1's cause is a shared function, checkable by someone who was not here | Phase 2 |
| 9 | Phase 2.2 over-corrects and stops pinning real prompts | implementation | A bidirectional net on the hook could suppress the pin on a legitimately long or quote-heavy prompt, which fails silently | The measured 0/1 540 null bounds the risk on the transcript surface, and 2.3 settles the hook surface before 2.2's rule is finalised rather than after | Phase 2 |

## Council convergence (2026-08-08 · anthropic/claude-sonnet-4-5, openai/gpt-4o · peer-review round)

Four decisions were routed to the council after the maintainer delegated
plan-shaping questions to it. Verdicts and how each landed:

| question | verdict | disposition here |
|---|---|---|
| The volume hypothesis after M5's null | **unanimous: drop the test** | Adopted. 4.4 cancelled, and 4.5 added — a step neither the options nor the plan contained. |
| Fail-closed on unbalanced quotes | **unanimous: adopt** | Adopted as Phase 1.2. One member flagged developer frustration on malformed input as the residual cost; recorded, not treated as a blocker, because the alternative leaves an executable bypass. |
| Command substitution | **split** | Resolved on the falsifiable difference, not the majority — see the blocker above. One member's supporting example was wrong and that is recorded with the fix. |
| The turn-end refusal | **unanimous: build behind opt-in, default off** | Recorded as **advisory only**. The blocker stays maintainer-owned; a council verdict does not authorise a safety-surface change. The council also found an unverified re-entrancy hole in the proposal, now a precondition on that blocker. |

Two things the council added that no option offered: forward per-project capture
(4.5) and the re-entrancy specification requirement. Both are in, and both are
attributed rather than absorbed.

## Measured, deferred, and why

| item | why not fixed here |
|---|---|
| Stop-refusal concern (FC-5 plus the language detector) | Maintainer blocker, unchanged. Not re-argued and not routed around. |
| Compaction re-pin (round-5 6.1) | Same blocker; its unverified premise — that an injection survives the boundary — also still stands. |
| `essential` default flip | 4.3 builds the instrument the decision needs. The decision is a human gate and stays one. |
| General dedup of the 91 divergent pairs | 4.2 takes only the two contradictions. A body-keyed dedup changes projection semantics and needs 4.3's numbers to justify its own blast radius. |
| Semantic skill obligations beyond deterministic MUSTs | FC-8-shaped; the round-1 reasoning stands. |
| Adding `triggers:` frontmatter to the 288 skills | This is what would make a missed-activation detector possible, and it is a 288-file surface change with its own blast radius and its own linter/schema consequences. Named here rather than smuggled into Phase 3 as a sub-step. The census in 3.1 is what justifies opening it later, or not. |
| A missed-activation detector over `description:` prose | Refused, not deferred. It is the only way to get a number without the frontmatter change, and it is precisely the prose-matching the same phase forbids. 3.4 records the refusal so it does not return as a fresh idea. |
| Full shell parsing in the guards | Explicitly not attempted. The guards classify, they do not interpret, and the posture blocker is what bounds what classification promises. |
| Over-filter branch in `isSyntheticPrompt` | Refuted: 0 of 1 540 entries. Only the hook-surface residue survives, and 2.3 is the whole of the work it justifies. |
| The review's ~207 000-token budget figure | Not reproduced. This roadmap uses its own ~199 300 union measurement and says which method produced it. |

## Acceptance criteria

- [ ] The ANSI-C and unterminated-quote commands block; the round-5 grep
  alternation does not; all three are pinned in one suite.
- [ ] Every vector in 1.3's table has a recorded outcome, including the ones
  left open, and both guard headers state the residual exclusions.
- [ ] Hook and scanner classify the same entry identically, proven by a shared
  import and a test that feeds both the same input.
- [ ] The hook-surface residue is settled by measurement, in either direction.
- [ ] The re-measured language count is published beside 578 and 641 with the
  mechanical reason for the delta.
- [ ] The skill census is published (288 / 0 with triggers / 8 with a
  deterministic obligation), SK-2 publishes a count with a stated precision over
  the named 8, and no activation number is reported at all.
- [ ] The volume hypothesis has a pre-registered threshold and a published
  result, null or not.
- [ ] No enforcement claim in this roadmap's diff exceeds what a shipped
  mechanism backs.
