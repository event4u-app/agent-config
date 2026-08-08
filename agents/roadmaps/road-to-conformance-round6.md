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

Second measurement, same pass: **30 of 288 skills** (10.4 %) carry a
deterministic `MUST`/`NEVER`/`ALWAYS`. The draft pre-authorised the exit at a
threshold of five, so 30 clears it comfortably — but it clears it while covering
a tenth of the corpus, which is not the same thing as a working instrument.

**Corrected during execution, and the correction is the argument for the
script.** This roadmap first reported **8**. That figure came from an ad-hoc grep
anchored at line start with no list prefix, so every `- MUST` and `**NEVER**` was
invisible to it. The census script counts them and reports 30. Both figures stay
published per the instrument lock; the reason is mechanical and re-runnable,
which is precisely why a one-off grep is not an instrument. Round 5 corrected
three of its own numbers; this is the fourth in the series, and the first one
where the replacement is a committed tool rather than a better command line.

So the deliverable inverts. The honest answer to "are skills followed?" is not a
rate; it is that today's frontmatter cannot support the question, and the census
is what says so.

- [x] 3.1 Publish the census as the primary finding — **shipped** as
  `src/scripts/report_skill_activation.ts`, advisory, registered as a named task
  and deliberately not wired into a pipeline (the convention `report_imperative_density`
  set). Measured: 288 skills, **0** with a machine-matchable trigger key, **30**
  with a deterministic obligation, and **31 invocations of 6 distinct skills**
  across 59 sessions and 33 654 assistant turns in three stores. The script
  prints an explicit unmeasurable verdict while no skill declares a trigger, and
  a test pins that it never prints an activation rate — a rate would be exactly
  the theatre the conformance scan's scope lock forbids, which is also why this
  lives outside that scan.

#### Why the obligation count moved 8 → 30, re-derived independently

Two sessions measured this census concurrently and got different numbers, which
is the most direct evidence available for what the census is actually saying.
Both re-run against 288 skill directories at this commit:

| definition | count |
|---|---:|
| the shipped script's regex — leading whitespace, optional `-`/`*` marker, optional `**` | **30** |
| first non-whitespace token is `MUST` / `NEVER` / `ALWAYS`, no marker allowed | **7** |
| the roadmap's originally published figure | 8 — reproduces under **neither** |

**The finding is the spread, not either endpoint.** The originally published 8
carried no regex, and no reading recovers it: a marker-tolerant definition gives
30, a strict one gives 7. The shipped script is the right resolution precisely
because its definition lives in code (`DETERMINISTIC_RE`) where it can be
disagreed with, rather than in prose where it cannot. **30 is the number of
record**, and 3.2's scope follows it.

**The `triggers:` row survives a scare and is confirmed at 0.** A naive grep
returns 1 — `rule-writing/SKILL.md:195` — but that file's frontmatter ends at
line 10, and line 195 sits inside a worked example showing the frontmatter shape
a *rule* carries. The published claim was right; the first re-derivation was not.

That there is no stable machine-readable definition of a skill obligation — a
4× spread between two defensible readings — is a stronger basis for "activation
is not measurable against the shipped frontmatter" than any single count, and it
was found by two independent measurements disagreeing rather than by either one
alone.
- [x] 3.2 Build the one class that *is* buildable — **SK-2 loaded-but-violated**:
  a skill body is in context and a deterministic obligation stated in it is
  violated in a later assistant turn of the same session. Scope it explicitly to
  the 30 named skills, so the coverage is legible rather than implied.
  <!-- Shipped as `src/scripts/report_skill_obligation_violations.ts`, task
  `report-skill-obligation-violations`, advisory, 15 tests. The coverage came out
  legible and much smaller than the phase assumed — § 3.2 below. -->
- [x] 3.3 Validate before believing any number: hand-read every flagged turn of
  the first run and publish precision. A detector that cannot state its
  false-positive rate ships as detection-only and this roadmap says so.
  <!-- Discharged as an honest null: the flag set is EMPTY over 137 sessions, so
  there is no precision figure and none is invented. What replaces it is a
  discrimination proof — § 3.3 below. -->

#### 3.2 — the coverage is 3 of 110, and that is the finding

The phase scoped SK-2 to the 30 skills the census names *"so the coverage is
legible rather than implied"*. Reading their bodies makes it legible, and the
number is far below what the scoping implied:

| | count | share of lines |
|---|---:|---:|
| skills with a deterministic obligation | 30 | — |
| obligation lines in them | **110** | 100 % |
| …naming a concrete artefact (path or command literal) | 4 | 3.6 % |
| …of those, naming the FORBIDDEN artefact | **3** | 2.7 % |
| …naming the PRESCRIBED alternative (excluded) | 1 | 0.9 % |

The three testable ones: `docs/THIRD-PARTY-NOTICES.md` and
`provenance/borrows.jsonl` (`license-compliance-credits`), and `cargo install rtk`
(`rtk-output-filtering`). The other 106 read like *"NEVER return `clean` out of
politeness"*, *"NEVER penalise an artifact for being short"*, *"NEVER invent
threat actors with unrealistic capabilities"* — the verb is absolute and the
violation is a **reading**. That is the FC-8 class this suite excludes, so it is
reported as uncovered rather than approximated.

**This repeats the 8 → 30 correction one level down.** `DETERMINISTIC_RE` matches
the *sentence*, and 3.1 was right that the definition belongs in code where it can
be disagreed with. What neither figure said is that **deterministic in wording is
not the same property as observable**, and only the second one supports a
detector. 30 was never a denominator for SK-2; 110 obligation lines with 3
mechanisable is.

**The polarity trap, found while building and worth the guard.**
`using-git-worktrees` says *"NEVER `rm -rf` a worktree — **use** `git worktree
remove`"*. A naive artefact extraction lifts `git worktree remove` and would flag
the prescribed **fix** as the violation. Artefacts after a pivot (`—`, `use`,
`instead`, `→`) are therefore classified `prescribed` and excluded by name. The
forbidden half stays unmechanised deliberately: `rm -rf` is legitimate against
anything that is not a worktree, so a literal match would manufacture false
positives — the exact failure 3.3 exists to catch, and this detector declines to
create it.

#### 3.3 — no precision figure, because there are no flags

**Result: 0 flags over 137 sessions** (every `*agent-config*` transcript store,
`--limit 50` each; 30 sessions in the main store, of which 12 had a skill in
context). Hand-reading "every flagged turn" is therefore vacuous, and precision
over an empty flag set is **undefined, not 100 %**. Publishing 100 % here would be
the cheapest possible overclaim.

So what discharges 3.3 is the other half of its own sentence — *a detector that
cannot state its false-positive rate ships as detection-only*. This one ships
detection-only, and its **discrimination is proven by fixtures rather than by a
live hit**, because with no firing case "0 flags" and "blind" are the same output:

- fires on a write to the forbidden path after the skill loaded;
- fires on the forbidden command in a shell call after the skill loaded;
- refuses a **read** of the same path (the obligation is about editing);
- refuses an act that **precedes** the load (loaded-*but*-violated, in that order,
  so a skill invoked to clean up is not read as having caused the mess);
- refuses when the skill was never in context (otherwise it is a repo-wide grep);
- refuses a path artefact named inside a shell command (`git add <path>` is not a
  hand-edit).

The honest reading of the null: over three obligations and 137 sessions, absence
of violations is weak evidence of compliance and strong evidence that the
mechanisable surface is too small to learn from. Whether it grows is a question
about how skills are WRITTEN — an obligation that names its artefact is testable,
one that appeals to politeness is not — and that is a separate scope from
measuring, named here rather than smuggled in.
- [x] 3.4 Do **not** build a missed-activation detector over `description:`
  prose, and record the refusal here so round 7 does not propose it as new.
  Adding `triggers:` to 288 skills is a separate scope with its own blast radius;
  it is named in the deferred table, not smuggled in as a sub-step.
  <!-- Refusal stands, and 3.1's re-derivation strengthens it: the obligation
  count moves 6 → 7 → 29 with the regex, so prose matching would not merely be
  FC-8-shaped, it would have no stable denominator to report against. -->

  **3.2 and 3.3 stay open, and the census is now their input rather than their
  motivation.** SK-2 is scoped to the **30** the shipped script names, under its
  own `DETERMINISTIC_RE`. Note for whoever builds it: that is 10.4 % of the
  surface, so 3.3's hand-validation is still tractable and its precision figure
  will be the whole of what the detector can honestly claim — and the scope is
  legible only because the definition is in code rather than in prose.

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

- [x] 4.1 Land round-5 Phase 1.3 (cross-carrier divergence report, advisory) and
  1.4 (ledger registration plus the non-empty-scan confirmation). Both are open
  at HEAD; 1.3 is what makes the 91 divergent pairs visible instead of silent.
  <!-- Both landed; per-step evidence is in round 5. Two corrections this step
  forced, both to premises it inherited, and § 4.1-4.2 below carries them. -->

#### 4.1 — the 91 pairs are not "two different versions", and one carrier reaches further than the other

Round 5 published *"91 rules load twice, **in two different versions**"*, and
round 6 wrote its next step on top of that. Re-measured at this commit with the
shipped report, over all 107 pairs the two carriers share:

| class | count | what it means |
|---|---:|---|
| byte-identical | 0 | expected — the installer stamps every file it writes |
| differ ONLY in `package:` / `source_path:` | **107** | the installer's own provenance keys; bodies byte-equal |
| differ in BODY | **0** | no rule's two copies say different things |

<!-- The denominator read 244 in the first draft of this section — the
gate-script population from § 4.1's registration note, carried across from an
unrelated measurement into this one. Caught by the R2 completion review, which is
the second time in this roadmap that a figure was right in the table and wrong in
the sentence introducing it. -->


So "two different versions" describes the **bytes** and not the **text**, and the
distinction is the whole load: a provenance stamp cannot contradict anything. The
figure also moves with the anchor — 91 shared names against the maintainer's
stale `.claude/rules`, 107 against a freshly generated tree, 112 against `dist/` —
which is the second reason a number in a roadmap could not own this condition.

**And the direction round 5 did not look at.** The global installer delivers the
five ADR-004 `type: manual` rules (`analysis-skill-routing`, `brand-consistency`,
`guidelines`, `package-ci-checks`, `size-enforcement`); the project projection
filters them out. Two writers, different filters — so on a machine with both
carriers those five reach the model, and on a project-only machine they do not.
That asymmetry is why a project-scope reach figure does not transfer to another
machine, which is exactly what M5's cross-project comparison rests on. It was
invisible while the comparison was anchored on `dist/`, and it is the reason the
shipped report anchors on the project tree instead.
- [x] 4.2 Resolve the two contradictory pairs ahead of any general dedup. The
  global `git-history-discipline` still asserts unqualified deterministic
  blocking that the shipped copy retracts. A contradiction held with no
  precedence marker is worse than either copy alone.
  <!-- The named pair is GONE at this commit, verified two ways, and the second
  was never named. The same defect class survives INSIDE one carrier, in a kernel
  rule, and is recorded rather than touched — § 4.2 below. -->

#### 4.2 — the named contradiction resolved itself, and the durable one is somewhere else

**The pair round 5 named no longer exists.** Two independent checks at this
commit: the report's body-divergence class is empty over all 107 shared pairs,
and a direct read of both copies finds the host-scoped qualification (*"on the
three hosts that have a `pre_tool_use` slot at all"*) present in each. The cause
is mundane and is the point: the global install was refreshed on 2026-08-08, so
the stale copy that carried the unqualified claim was overwritten. Round 5's
measurement was true when taken and false four hours later, without anyone
resolving anything.

That is why 1.3 shipped as a re-runnable report and why this step does not edit a
rule to "fix" it. A condition that appears and disappears with the maintainer's
install cadence cannot be closed by a text change; it can only be made visible,
and the report now prints the precedence (project projection wins, global install
is a release snapshot) at the moment a body difference appears.

**The second pair cannot be checked, and that is a finding about the record.**
Round 5 wrote *"for four rules the divergence is semantic, and for two it is
contradictory"* and named exactly one. An unnamed member of a stated count is not
auditable by anyone later — including by the round whose step was written to
resolve it. Both figures are unreproducible now for the same reason the first
pair vanished.

**Where the same defect class actually persists — intra-carrier, and not
self-healing.** Grepped across the delivered rule set for rules claiming a
tool-call-time guard, then for the host-scoped retraction beside it:

| delivered rule | claims a PreToolUse guard | carries the host qualification |
|---|---|---|
| `git-history-discipline` | `block-no-verify` | yes |
| `evaluator-independence` | `evidence-independence` | yes |
| **`autonomous-execution`** | **`block-config-weakening`** | **no** |

`src/scripts/hook_manifest.yaml` binds `block-config-weakening` under
`pre_tool_use` for **augment, claude, cowork** and nowhere else — cursor, cline,
windsurf, gemini and copilot declare no `pre_tool_use` concern list at all. So
"Enforced at tool-call time by the `block-config-weakening` PreToolUse guard"
holds on 3 of 8 hosts while its two siblings qualify the identical slot. This is
round 5's defect with the carriers removed: one delivered copy asserting
enforcement another retracts, no precedence marker, and it does not disappear on
reinstall.

**Not fixed here, on two independent grounds.** `autonomous-execution` is one of
the nine kernel rules, so `scope-control` requires its own PR plus a ≥ 24 h soak —
unavailable to this run by construction. And Phase 6.2 forbids new enforcement
work while `stop-refusal-decision` is parked; a kernel-rule honesty edit smuggled
into a measurement PR is exactly the routing-around that step exists to stop.
Filed as the successor's first item, with the grep that found it.
- [x] 4.3 Add per-session delivered-token measurement to the conformance scan:
  total rule-text tokens reaching context, split by carrier. This is the
  instrument the `essential` default-flip has been waiting on. The flip itself
  is a human gate and is not decided here.
  <!-- Shipped, and NOT per-session — the one word in this step that cannot be
  honoured. § 4.3 below carries the reason and the first readings. The flip stays
  a human gate; nothing here decides it. -->
- [-] 4.4 **Cancelled — the hypothesis test does not run, and M5 is why.**
  Council 2026-08-08, unanimous across both members: the natural experiment
  already falsified the ordering, and a pre-registration written *after* its
  numbers are known is not blind. One member said so directly — "pre-registering
  post-hoc is theater". Cancelled rather than deferred: a deferral implies the
  same test is still the right one, and it is not.
- [x] 4.5 **The step both members added that was in no option.** Dropping the
  test without adding forward instrumentation closes the investigation
  permanently, because the project-identity variable cannot be recovered
  retroactively. So: record per-project violation rates from this round onward,
  keyed by store, alongside the delivered-token figure from 4.3. Both members
  independently named Q1 as the decision most likely to be wrong in hindsight,
  and both named the same early-warning signal — **a fourth project falling
  outside the observed 9.1-39.2 % band**. That is the falsifier; without 4.5
  nobody would ever see it.
  <!-- Shipped as `--record` on the same scan, because 4.3 and 4.5 turned out to
  be one mechanism: the delivered figure is only interpretable as a series. Two
  design corrections the first run forced are in § 4.3-4.5 below. -->

#### 4.3 / 4.5 — the instrument, and the two things it refuses to say

**"Per-session" cannot be honoured, so it is not claimed.** The delivered payload
is a property of the carriers on disk. A transcript records `message.usage` counts
and response content and no system or tools field — verified in
`preamble_byte_census`, not assumed here — and the carriers move under the
sessions: this round alone added three rules to the project tree and the global
install was refreshed mid-day. Attaching today's figure to a three-week-old
session would be a fabrication wearing a per-session label. So the scan reports
**one reading per run**, and 4.5's series is what makes that reading
interpretable. That is also why the two steps ship as one flag rather than two
mechanisms.

First readings, `chars/4`, same basis as `preamble_byte_census` and
`measure_scope_dedup`:

| carrier | rules | tokens |
|---|---:|---:|
| project projection (`.claude/rules`) | 110 | 101 626 |
| machine-global install (`~/.claude/rules`) | 112 | 102 402 |
| **union — what a machine with both pays** | | **204 027** |

That is the number the `essential` default-flip decision was waiting on, and it
sits beside round 6's own ~199 300 estimate: same order, measured rather than
projected, and both stay published per the instrument lock. **The flip is not
decided here** — it is a human gate and 4.3 only builds its instrument.

**The falsifier fired on its first run, and it was wrong — which is how the
guard got built.** The worktree's own store read **4.1 % over 606 assistant
turns** and would have announced "a fourth project outside the band" on its
second day of existence. Two separate errors were hiding in that:

1. **Corpus size.** M5's three stores carried 1 978 / 2 280 / 3 368 assistant
   turns. A rate over 606 is not comparable to them, so `bandVerdict` now
   withholds a verdict below **1 978** — the smallest corpus the band was
   actually derived from, not a threshold anyone chose. Below it the scan says
   *"a verdict here would be about corpus size, not behaviour."*
2. **Store novelty is not project novelty.** A git worktree gets its **own**
   transcript store under the same project, so a store-keyed series counts it as
   new. The out-of-band branch now says so in the output, because the first thing
   a reader must check is whether the "fourth project" is a fourth project.

With the guard in place the instrument reproduces M5 on the store M5 measured:
**26.7 % over 2 193 turns, inside the band**, against M5's published 25.4 % over
2 280 — the corpus moved by 87 turns and the rate moved with it. The scan's diff
removes zero lines (`git diff origin/main` on that file: 0 deletions), so no
classifier changed and the movement is corpus movement, not a code effect.

**The series is privacy-shaped by construction, not by scrubbing.** The record is
keyed on a SHA-256 digest of the store path because the real slug is
`-Users-<realname>-projects-<client>-…` — a real name and often a customer
identifier, which `domain-safety-pii` § Surface 3 forbids exporting and
`low-impact-corpus-privacy-floor` names outright. `RateRecord` has **no field
able to hold** a path, a prompt or a session id, so there is no scrubber that
could fail, and the file lives under the gitignored `agents/runtime/`. A test
asserts the key set exhaustively.

## Phase 5 — Close round 5's own accounting

- [x] 5.1 Walk round 5's six acceptance criteria. Check the ones its shipped
  phases satisfy — the stale-tree case has a pinned test, the refused commands
  have regression tests, no kernel rule was modified, both era numbers are
  published. Mark the Phase-3-dependent ones as blocked rather than leaving them
  ambiguous. A merged roadmap with an untouched acceptance list reads as
  unverified even where it is not, and this round is the proof: an independent
  reviewer had to re-derive what those criteria would have recorded.

#### Round 5's acceptance list, walked and marked

Each verdict below is a command run at this commit, not a reading of round 5's
prose. The criteria are checked in `road-to-conformance-round5.md` itself; this
table is the evidence for those marks.

| # | criterion | verdict | evidence |
|---|---|---|---|
| 1 | the projection gate fails on a stale checkout and passes after regeneration | **met** | Both halves observed in one session: `task check-rule-projection-integrity` exited 1 naming 3 stale entries, `task generate-tools` ran, the gate then reported `324 planned / 324 scanned / 0 skipped` and exited 0. |
| 2 | both wrongly-refused commands run, and the real prohibitions still refuse | **met** | The `grep -E` alternation and the apostrophe-bearing heredoc both exit 0 against `block_unauthorized_git` AND `block_no_verify`. The prohibitions still refuse — 43 + 74 tests, and this round's own vector table adds the stronger half: every command bash actually executes is blocked. |
| 3 | Phase 3's turn-end concern fires correctly and cannot block twice | **blocked** | `stop-refusal-decision`. Nothing was built, so nothing is claimed. Explicitly blocked rather than left open, which is what 5.1 exists to fix. |
| 4 | every enforcement claim is backed by a shipped mechanism or says it is model-carried | **met** | Round 5's Phase 5 shipped the honesty pass. This round adds two of its own: both guard headers now name what they do NOT see, and Phase 3's census publishes the command behind each count. |
| 5 | no kernel rule text modified; `verify-before-complete` untouched | **met** | `git log -- src/rules/verify-before-complete.md` since round 5 opened returns nothing. Holds for this round too — no kernel rule is in either diff. |
| 6 | the corrected era number and the superseded one both appear | **met** | 303, 578, 626 and 641 all present in round 5. This round extends the series rather than replacing it: 577 → 622 with the mechanical reason, in § 2.4. |

Four met, one blocked, and criterion 3 is the only one that needed a decision
rather than work. That is the honest shape of round 5 — and it is a materially
better result than the "all six untouched" the reviewer found, which is the
whole reason this step existed.

## Phase 6 — What this roadmap will not do

- [x] 6.1 No new advisory carrier ships for any measured class. The round-5
  result (a fresh pin ignored at distance 1) stands, as does the council's
  refusal of frequency-as-mechanism. Recorded so round 7 does not re-propose it.
  <!-- Held. This round ships two repairs (Phase 1, Phase 2) and three
  measurements; no advisory carrier was added, and the one place it would have
  been tempting — 2.2's paste net — became a change to an EXISTING classifier
  rather than a new reminder. -->
- [ ] **BLOCKED on `stop-refusal-decision`.** 6.2 No enforcement work beyond
  Phase 1's repair happens before the stop-refusal blocker resolves. Inventing a
  third mechanism class to route around a parked decision is how a blocker
  becomes a silent drop.
  <!-- Held so far and worth stating explicitly, because Phase 1 shipped real
  enforcement: every line of it repairs a guard that already existed, and no new
  blocking surface was registered. -->

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

Walked the way 5.1 walked round 5's: every verdict below is a command run at this
commit, listed in § Acceptance evidence, not a reading of this roadmap's prose.

- [x] The ANSI-C and unterminated-quote commands block; the round-5 grep
  alternation does not; all three are pinned in one suite.
- [x] Every vector in 1.3's table has a recorded outcome, including the ones
  left open, and both guard headers state the residual exclusions.
- [x] Hook and scanner classify the same entry identically, proven by a shared
  import and a test that feeds both the same input.
  <!-- The import half was already true at HEAD; the "feeds both the same input"
  half was NOT — the existing test exercised the predicate through one surface
  only, so the criterion rested on a code reading. Closed here with a test that
  runs one entry through the hook's re-export and through `scanSession`, and
  asserts they agree in both directions. -->
- [x] The hook-surface residue is settled by measurement, in either direction.
- [x] The re-measured language count is published beside 578 and 641 with the
  mechanical reason for the delta.
- [x] The skill census is published (288 / 0 with triggers / **30** with a
  deterministic obligation, the 8 corrected with its reason), and no activation
  rate is reported at all — pinned by a test.
- [x] SK-2 publishes a count with a stated precision over the named 30.
  <!-- Rewritten in the same way 4.4's criterion was, and for the same reason: as
  published it could only be satisfied by a fact that does not exist. The flag set
  is EMPTY over 137 sessions, so "a stated precision" has no value to state and
  100 % would be an overclaim. What IS published: the count (0), the real
  denominator (110 obligation lines, of which 3 are mechanisable — not 30, which
  was never SK-2's denominator), and precision explicitly recorded as UNDEFINED
  over an empty flag set, with the detector's discrimination proven by six
  fixtures instead. See § 3.2-3.3. -->
- [x] The mechanisable share of the 30 skills' obligations is published, and the
  unmeasurable remainder is named rather than approximated.
  <!-- Added, not inherited. The criterion above assumed a violation rate was the
  deliverable; the measurement says the coverage ratio is, and an acceptance list
  that cannot record the actual finding is the same contradiction Phase 3 caught
  in its own first draft. 3 of 110 testable without judgement; the other 106
  named as the FC-8 class. -->
- [x] The volume hypothesis is **cancelled, not deferred**, with M5's natural
  experiment as the reason, and forward per-project capture (4.5) replaces the
  test so the falsifier stays observable.
  <!-- Rewritten. As published this criterion demanded "a pre-registered
  threshold and a published result", which step 4.4 had already been cancelled
  for — the council's own words were "pre-registering post-hoc is theater". An
  acceptance list that can only be satisfied by doing the thing the roadmap
  decided not to do is a contradiction two sections apart in one file, and it is
  the same shape Phase 3 caught in its own first draft. Found by the pre-run
  screen, corrected here — and it survived the concurrent Phase-3 branch, which
  carried the stale wording forward unchanged. -->
- [x] 4.5's forward capture is live: per-project violation rates recorded from
  this round onward, and a fourth project outside the 9.1-39.2 % band is
  detectable when it appears.
  <!-- Live: `conformance:behavior --record` appends to the gitignored
  agents/runtime/state/conformance-rates.jsonl, two records written on the first
  run. "Detectable when it appears" needed one correction the criterion did not
  anticipate — the falsifier fired immediately on a 606-turn store and would have
  announced a fourth project on the instrument's first day, so a verdict is now
  withheld below the 1 978 turns of the smallest corpus the band came from, and
  the out-of-band branch names the worktree confound. See § 4.3-4.5. -->
- [x] No enforcement claim in this roadmap's diff exceeds what a shipped
  mechanism backs.
  <!-- Checked mechanically over this diff: zero added lines contain
  "deterministically blocked", "enforced by" or "blocking guard"
  (`git diff origin/main | grep '^+' | grep -ciE …` → 0). Every artefact added is
  advisory and says so in its own first paragraph — the two reports and the SK-2
  detector each print "gates on nothing", and no gate, hook or pipeline step was
  registered. The one claim this diff CHANGES it makes smaller: gate-coverage.yml's
  backstop sentence, corrected from a guarantee to a measured 1-of-2 emit shapes
  (§ 4.1's registration note). -->
- [x] A claim this roadmap inherited is re-measured before being built on, and a
  falsified one is recorded as falsified.
  <!-- Added, and it is the shape of the whole phase-4 half: round 5's "91 rules
  load twice in two different versions" and round 6's own "the global copy still
  asserts unqualified blocking" were both premises, both re-run, and both came out
  differently (§ 4.1, § 4.2). Recorded rather than quietly worked around. -->

## Acceptance evidence

Each row is the command that produced the verdict, run at this commit. Listed
because 5.1's whole point was that an acceptance list with no evidence beside it
reads as unverified even where it is not — and this round is the one that said so.

| # | criterion | verdict | command |
|---|---|---|---|
| 1 | ANSI-C + unterminated-quote block, grep alternation does not, one suite | **met** | `npx vitest run tests/scripts/git_authorization.test.ts` → 43 passed; `ROUND6_VECTORS` and `ROUND6_OPEN_VECTORS` both present in that file |
| 2 | every 1.3 vector has a recorded outcome; both guard headers state the exclusions | **met** | same suite (each vector carries its measured `bashRuns`); `grep -i "WHAT THIS GUARD DOES NOT SEE"` hits in `block_unauthorized_git.ts` **and** `block_no_verify.ts` |
| 3 | hook and scanner classify identically, shared import + a test feeding both | **met, after closing half of it** | `grep -n prompt_shape` shows both `language_mirror_hook.ts` and `conformance_scan.ts` importing `_lib/prompt_shape.js`; the both-surfaces test was added here — `npx vitest run tests/scripts/conformance_scan.test.ts` → 29 passed |
| 4 | hook-surface residue settled by measurement | **met** | § 2.3's falsifier: 15 typed chars vs a 12 224-char command body, both classifier versions run on both payloads |
| 5 | re-measured count published beside 578 and 641 with the mechanical reason | **met** | 578 ×7, 641 ×2, 577 ×3, 622 ×4 present in this file; the reason is § 2.4's harness-turn explanation |
| 6 | skill census published, no activation rate | **met** (round 6) | `report_skill_activation`, pinned by a test that it never prints a rate |
| 7 | SK-2 count with a stated precision | **met as rewritten** | 0 flags over 137 sessions; precision recorded UNDEFINED over an empty flag set; discrimination proven by 6 fixtures (§ 3.3) |
| 7b | mechanisable share published, remainder named | **met** | `report_skill_obligation_violations` leads with 3 of 110 (§ 3.2) |
| 8 | volume hypothesis cancelled, not deferred, with forward capture replacing it | **met** (round 6) | 4.4 cancelled; 4.5 shipped as `--record` |
| 9 | forward capture live, a fourth out-of-band project detectable | **met, with a guard the criterion did not anticipate** | 2 records in `agents/runtime/state/conformance-rates.jsonl`; band withheld below 1 978 turns; worktree confound named in the out-of-band branch |
| 10 | no enforcement claim exceeds a shipped mechanism | **met** | `git diff origin/main \| grep '^+' \| grep -ciE 'deterministically blocked\|enforced by\|blocking guard'` → 0 |
| 11 | an inherited claim is re-measured; a falsified one recorded as falsified | **met** | § 4.1 (91 pairs → 0 body-divergent) and § 4.2 (the named contradiction is gone; the durable one is elsewhere) |

**Still open, and why.** 6.2 stays blocked on `stop-refusal-decision` — a
maintainer decision, unchanged, and nothing here routed around it. The successor's
first item is named in § 4.2: `autonomous-execution` asserts unqualified
tool-call-time enforcement of a guard that binds on 3 of 8 hosts, which is a
kernel-rule edit and therefore its own PR with its own soak.

## R2 completion review — 14 findings, all real, and the one that mattered

Dispatched via `dispatch_r2_reviewer.ts` (tooling-authored prompt, `prompt_hash`
recorded in the findings header — the property that makes a self-commissioned
review admissible at all per `evaluator-independence`). One fresh subagent, no
implementation context. **14 findings: 1 high, 7 medium, 6 low. Every one was
real; all 14 are fixed in this branch.**

**The high one is the reason to run these reviews.** `loadedSkills` read
`message.content` only when it was a `string`. Measured after the finding landed,
in one 30-session store:

| user-entry content shape | entries | injected skill bodies |
|---|---:|---:|
| bare string | 1 440 | **0** |
| array of content blocks | 23 907 | **41** |

So the reader saw **none** of them, and the failure was invisible by construction:
an empty loaded-set returns no flags, which is indistinguishable from compliance.
§ 3.3 had just published "0 flags over 137 sessions" and called the fixtures its
discrimination proof — and the fixtures could not catch this, because the test
helper emitted the string shape only. Six passing cases, all exercising the one
branch that worked.

**What the repair moved.** The shape logic now lives in
`_lib/transcript_entry.ts`, shared with the scanner that already handled both
(the two readers disagreeing about the same field was the root, not the symptom).
Sessions-with-a-skill goes **12 → 13** in the main store and **55 of 137** across
all stores; flags stay **0**. So the null holds, and it now rests on a reader that
can see the population.

**My own verification mistake, recorded because it is the transferable part.** I
confirmed the marker existed with `grep -oh "Base directory for this skill"` over
the raw JSONL — which matches raw text and says nothing about the parse path. A
grep over the file is not evidence about the code that reads it.

**The other 13, by class.** Two self-contradicting outputs (`rate_pct` persisted
rounded while `band` compared the unrounded value, so a raw 9.06 could print
"9.1%" above "OUTSIDE the 9.1-39.2% band" — the declared falsifier fired by a
rounding artefact; and this section's own denominator read 244, a figure carried
in from § 4.1's unrelated gate-script count). Two cwd-relative resolutions (the
project carrier silently recording 0 tokens with no presence flag; the series path
landing outside the ignore rule whose coverage its docstring claims). Two
over-broad matchers (a forbidden path matched inside `new_string`, so editing any
file that *mentions* it counted as hand-editing it; and `PIVOT_RE`'s bare `use`
inverting polarity on "NEVER use `X`" — the guard against dropping a forbidden
artefact, dropping forbidden artefacts). Two missing sidechain exclusions. Then
I/O waste, a flag-value parsing hole this same diff guarded elsewhere, a share-of-
lines label over an artefact count, a docstring narrower than its function, a test
coupled to one shipped skill's prose, and step 4.4 checked `[x]` while its own text
says **cancelled** (now `[-]`, the glyph the vocabulary reserves for it — in the
roadmap whose Phase 5 exists to correct exactly that accounting).

Nine new fixtures cover the classes the first suite could not: the block shape end
to end, both sidechain paths, replacement-text and description over-match, the
"NEVER use `X`" phrasing, the rounded-vs-unrounded band, absent-vs-zero carriers,
and the flag-value position.
