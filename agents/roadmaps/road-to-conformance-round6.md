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

| vector | pre-#1208 | at `2daf29871` |
|---|---|---|
| `echo $'don\'t' && npm publish` | **blocked** (`commandOp: publish`) | **allowed** (`null`) |
| `echo 'oops && npm publish` (unterminated quote) | **blocked** | **allowed** |
| `echo "$(npm publish)"` | allowed | allowed — pre-existing |
| the round-5 grep alternation | blocked — the false positive | allowed — the fix working |

Exposure is every `BLOCK_OP` with no second net: `npm|pnpm|yarn publish`,
`gh release create`, `gh pr merge`. Git-shaped variants stay covered, verified:
`$'…'` also breaks `block_no_verify`'s shlex, and `_looks_like_git_invocation`
splits without quote awareness, so a `git push` in the tail is still seen.

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

### blocker: command-substitution-posture

- **Status:** open — new this round
- **Owner:** maintainer
- **Blocks:** Phase 1.4
- **What to do:** choose the posture for `$(…)` and backtick payloads reaching a
  guard. (a) Treat a `BLOCK_OP` literal inside a substitution as an invocation,
  accepting false positives on `echo "$(cat notes-about-npm-publish.md)"`.
  (b) Fail-closed on any substitution containing a `BLOCK_OP` literal, with the
  guard message naming the workaround. (c) Document the exclusion and claim
  nothing. Doing nothing silently is not on the list, because the guard headers
  currently imply coverage they do not have.
- **Resolved when:** the posture is recorded in both guard headers and Phase 1.4
  implements it or states the exclusion.

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

- [ ] 1.1 `splitOutsideQuotes`: recognise `$'` as a quote opener with C-style
  escape semantics (`\'` does not close it) and `$"` as `"`. Pin the exact
  measured command; it must classify as `publish` and block.
- [ ] 1.2 Replace the unterminated-quote posture. Today the tail becomes one
  quoted segment, which is permissive for the reason named above. Instead
  re-split the tail **without** quote awareness and classify every segment. A
  false positive on input bash would itself refuse to run is acceptable; a false
  negative on input bash *does* run is the failure the guard exists for. Pin
  `echo 'oops && npm publish` as blocked, and the round-5 grep alternation as
  still allowed — its quotes balance, so this branch never sees it.
- [ ] 1.3 Extend the adversarial suite with the full vector set: `$'…'`,
  unterminated single and double quotes, substitutions inside and outside double
  quotes, backticks, `sh -c "$(…)"`, and an env-assignment-prefixed
  substitution. Record the measured outcome for every vector **including the
  ones deliberately left open** — a vector table with only the fixed rows is the
  same false-completeness this round is about.
- [ ] 1.4 Implement the substitution posture the blocker resolves, in **both**
  guards. `block_no_verify`'s `$(` handling is unreachable exactly when it is
  needed, so fixing one guard would leave the git-shaped variants open.
- [ ] 1.5 Amend both guard headers. They currently claim the quote fix "does not
  discard quoted payloads, so `sh -c "npm publish"` still unwraps" — true, and
  incomplete in a way that reads as coverage. State the substitution exclusion
  until 1.4 lands.

## Phase 2 — One trigger definition, both directions

- [ ] 2.1 Extract the synthetic-prompt predicate into a shared module and apply
  it in `conformance_scan.ts` alongside `isCompactSummary` and `isInjectedBody`.
  Hook and scanner must classify the same entry identically, or every future era
  split argues about two different populations.
- [ ] 2.2 Give the **hook** the net it lacks: a prompt whose bulk is pasted
  foreign-language content must not pin to the paste. The scanner's heuristic
  (`length > 2500 && english`) is the wrong shape for a bidirectional test —
  derive the rule from the human-authored fraction, not from a hard-coded
  language. This is the defect that fired on the review's own session.
- [ ] 2.3 Settle the residue named above: record the prompt length the hook
  receives for one slash-command turn, compare against the typed text, and
  publish the answer. If the host does prepend the wrapper, 2.1's predicate
  needs a strip-then-classify branch; if it does not, the null closes the
  question permanently.
- [ ] 2.4 Re-run `conformance:behavior --limit 30` after 2.1-2.2 and publish the
  delta against 578, whatever its sign. Per the instrument lock the superseded
  figures stay in the table beside it.

## Phase 3 — Skills get an instrument at all

The original complaint names rules **and** skills. Six rounds in, skills have
been measured exactly never — they enter the scan only as bodies to exclude.
With 288 skills shipped, adherence is an unbacked claim, which is the precise
condition round 5 spent a phase deleting from rules.

- [ ] 3.1 Define two deliberately narrow classes. **SK-1 missed activation**: a
  turn matches a skill's own frontmatter triggers and no activation appears in
  the transcript. **SK-2 loaded-but-violated**: a skill body is in context and a
  deterministic obligation stated in it — a MUST with an observable surface — is
  violated in a later assistant turn of the same session.
- [ ] 3.2 Validate the instrument before believing any number: hand-read every
  flagged turn of the first run and publish precision. A detector that cannot
  state its false-positive rate ships as detection-only and this roadmap says so.
- [ ] 3.3 Bound the scope honestly. Semantic obligations ("write idiomatic X")
  are FC-8-shaped and stay out. If fewer than five skills carry a deterministic
  obligation, **publish that as the finding** — it would mean skill compliance is
  currently unmeasurable, which is itself an answer to the original question and
  a better one than a number nobody can check.

## Phase 4 — The volume question stops being deferred

Round 5 measured the condition and deferred the fix. Then its Phase 1 pushed the
delivered volume up by ~23 200 tokens on the project carrier. If instruction
volume contributes to non-compliance, round 5 made delivery correct and volume
worse in the same change — and never said so, because the interaction appears
nowhere in that roadmap. The hypothesis is cheap to test and untested.

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
- [ ] 4.4 Pre-register the volume hypothesis **before** 4.3 produces numbers:
  state the threshold and the comparison, then look. If the split shows nothing,
  publish the null — the volume theory loses its strongest support, which
  redirects round 7 rather than embarrassing it.

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
| 4 | SK-1/SK-2 have no precision floor | implementation | Skill triggers are prose; a matcher over prose invites the FC-8 trap the series has avoided for five rounds | 3.2 makes hand-validation a gate on publication, and 3.3 pre-authorises the honest exit — "unmeasurable" is a publishable finding | Phase 3 |
| 5 | The volume hypothesis is confirmed by construction | implementation | Choosing the threshold after seeing the data turns a measurement into a narrative, which is the exact failure the instrument lock was written for | 4.4 pre-registers threshold and comparison before 4.3 runs | Phase 4 |
| 6 | This round also ships zero enforcement | product | Phases 1-5 are repair and instruments. If the stop-refusal blocker stays open, round 6 repeats round 5's shape at higher cost | Stated in the opening rather than discovered at the end; 6.2 makes the dependency explicit. The blocker carries an owner, an action and a resolution condition | Blockers |
| 7 | Re-measurement moves the headline count a fourth time | product | 2.4 will change 578 in some direction, and a series whose number moves every round invites disbelief in all of them | Every figure stays published side by side with its mechanical reason; 2.1's cause is a shared function, checkable by someone who was not here | Phase 2 |
| 8 | Phase 2.2 over-corrects and stops pinning real prompts | implementation | A bidirectional net on the hook could suppress the pin on a legitimately long or quote-heavy prompt, which fails silently | The measured 0/1 540 null bounds the risk on the transcript surface, and 2.3 settles the hook surface before 2.2's rule is finalised rather than after | Phase 2 |

## Measured, deferred, and why

| item | why not fixed here |
|---|---|
| Stop-refusal concern (FC-5 plus the language detector) | Maintainer blocker, unchanged. Not re-argued and not routed around. |
| Compaction re-pin (round-5 6.1) | Same blocker; its unverified premise — that an injection survives the boundary — also still stands. |
| `essential` default flip | 4.3 builds the instrument the decision needs. The decision is a human gate and stays one. |
| General dedup of the 91 divergent pairs | 4.2 takes only the two contradictions. A body-keyed dedup changes projection semantics and needs 4.3's numbers to justify its own blast radius. |
| Semantic skill obligations beyond deterministic MUSTs | FC-8-shaped; the round-1 reasoning stands. |
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
- [ ] SK-1/SK-2 publish counts with a stated precision, or publish
  "unmeasurable" with the frontmatter census that shows why.
- [ ] The volume hypothesis has a pre-registered threshold and a published
  result, null or not.
- [ ] No enforcement claim in this roadmap's diff exceeds what a shipped
  mechanism backs.
