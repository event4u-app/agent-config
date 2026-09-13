<!-- evidence-type: analysis -->

# `Known limitations`: what the derivation returns over the two spans that shipped `_none_`

Phase 1 § 1.2 of `road-to-a-release-head-field-nothing-derives`. The field was
the one curated label of five that nothing derived, so `_none_` was what it
printed when nobody wrote anything — and 15.0.0 and 16.0.0 both shipped that
line. This file records what the new derivation returns over exactly those two
spans, so a later reader can re-run the measurement rather than trust the
summary.

- **Measured:** 2026-09-13, on `drain/release-head-field` branched from
  `origin/main`.
- **Spans:** `14.23.0..15.0.0` (161 commits) and `15.0.0..16.0.0` (145
  commits), `--no-merges`.
- **Instrument:** the shipped `collect_span_commits` + `derive_category_hits` +
  `make_span_file_reader`, called directly. Nothing in this file
  re-implements the derivation.

## The command

Run from the repository root. It is the whole measurement — both spans, one
invocation:

~~~bash
npx tsx -e "import('./src/scripts/_lib/release_highlights.ts').then(m=>{for(const [f,t] of [['14.23.0','15.0.0'],['15.0.0','16.0.0']]){const s=m.collect_span_commits(f,t,process.cwd());const h=m.derive_category_hits(s,{readTouchedFile:m.make_span_file_reader(t,process.cwd())});console.log(f+'..'+t+': '+s.length+' commits, '+h['Known limitations'].length+' candidate(s)');for(const x of h['Known limitations'])console.log('  '+x.sha.slice(0,7)+' '+x.text)}})"
~~~

The tags are what make it re-runnable and also what bounds it: on a shallow
checkout without `14.23.0`, `15.0.0` and `16.0.0`, `collect_span_commits`
throws rather than returning an empty span, so a failed re-run is legible as a
missing tag and never as a derivation that found nothing.

## 1. Output — the shipped pattern list

~~~
14.23.0..15.0.0: 161 commits, 1 candidate(s)
  6b08a37 refactor(hooks): retire the hot-context cache, keep the session-index restore (src/scripts/_lib/obligation_frequency.ts declares a residual)
15.0.0..16.0.0: 145 commits, 2 candidate(s)
  6b5c574 fix(ci): pay the ratchets this branch moved, in the way both prescribe (src/scripts/_lib/dropped_decision.ts declares a residual)
  3232bde test(install-layout): port the conformance test the contract has been claiming (src/scripts/install.ts declares a residual)
~~~

Each candidate traces to a real `file:line` in its own span:

| Span | Candidate | Residual, at the ref | Judgement |
|---|---|---|---|
| `14.23.0..15.0.0` | `6b08a37` | `git show 15.0.0:src/scripts/_lib/obligation_frequency.ts \| sed -n '34p'` — *"a CI gate firing three times inside one session is not covered by a `session_start` check"* | true positive |
| `15.0.0..16.0.0` | `6b5c574` | `git show 16.0.0:src/scripts/_lib/dropped_decision.ts \| sed -n '80,92p'` — *"TWO KNOWN FALSE-POSITIVE PATHS, named because a refusing detector owes its residual rather than only its fix"*, then the two paths | true positive |
| `15.0.0..16.0.0` | `3232bde` | `git show 16.0.0:src/scripts/install.ts \| sed -n '2206p'` — *"**Known limitation — `--dry-run` does not exercise this gate.**"* | true positive |

The 16.0.0 span names the `dropped_decision.ts` residuals, which is what § 1.2
required of it. `6b5c574` is also the commit that makes the file-content half
of the derivation load-bearing rather than decorative: its subject is *"pay the
ratchets this branch moved"* and its body is about line counts. Nothing in its
metadata says a limit exists. The limit is in the file it moved.

## 2. What the measurement changed before anything gated on it

Risk 1 of the roadmap is that a broad pattern turns every careful sentence in
this tree into a release-head limitation. It was answered by reading the output
of two earlier pattern lists over these same two spans, not by taste. Both
narrowings are the same failure — the pattern matching the repo's VOCABULARY
for limits rather than a declaration of one.

**Draft A — the bare word `residual`.** Top hit over `15.0.0..16.0.0` was
`0339e07 fix(settings): refuse a repair over a file with no reading to
preserve`, where the match is `const residual = residualParseError(rawText)` —
a local variable holding a parse error. Dropped for phrase-level patterns.

**Draft B — `residual (limit|gap|cost|risk)` and bare `known limit(s)`.**
Returned 4 and 5 candidates:

~~~
14.23.0..15.0.0: 161 commits, 4 candidate(s)
  6b08a37 refactor(hooks): retire the hot-context cache, keep the session-index restore (src/scripts/_lib/obligation_frequency.ts declares a residual)
  03e4eb7 revert(governance): the deny stays — the replacement was refused 2/2 (.github/workflows/consistency.yml declares a residual)
  9c3f86b docs(governance): stop asserting a mechanism that no longer exists (src/scripts/build_proof.ts declares a residual)
  c0fa95d feat(design-fidelity): gate the route, cascade the mode, and land the arbitration where both rules reach it (.github/workflows/consistency.yml declares a residual)
15.0.0..16.0.0: 145 commits, 5 candidate(s)
  6b5c574 fix(ci): pay the ratchets this branch moved, in the way both prescribe (src/scripts/_lib/dropped_decision.ts declares a residual)
  16d7354 fix(hooks): act on the R2 completion review — six fixed, four recorded as limits (src/scripts/_lib/review_skipped_record.ts declares a residual)
  2ffd518 fix(hooks): act on the neutral review of this branch (src/scripts/_lib/review_skipped_record.ts declares a residual)
  6b92b2f feat(end-review-nudge): charge a session for its own mutation, not the tree's (src/scripts/_lib/review_skipped_record.ts declares a residual)
  3232bde test(install-layout): port the conformance test the contract has been claiming (src/scripts/install.ts declares a residual)
~~~

Two false-positive classes, both read rather than assumed:

- `review_skipped_record.ts:137` — *"a skipped review over a large diff carries
  more residual risk than one just past the fire threshold"*. A threshold
  rationale, not a limit of the release. One phrase in one file produced
  **three of the five** candidates over `15.0.0..16.0.0`, which is precisely
  the "field becomes noise and gets ignored exactly like `_none_` did" shape
  Risk 1 registered. `residual risk` and `residual cost` were dropped;
  `residual limit` and `residual gap` kept.
- `build_proof.ts:330,342` — `L.push('## 3. Known limits (published,
  witness-tested)')`. The phrase is a string literal in a report GENERATOR.
  Bare `known limit(s)` was dropped for `known limitation(s)`, the declarative
  noun.
- `.github/workflows/consistency.yml:213` — *"same residual risk"* — fell out
  with the first narrowing.

`does not yet` and `is not covered` are the two broadest patterns and were
kept. `is not covered` is the only pattern that reaches `6b08a37`, the single
candidate in the `14.23.0..15.0.0` span; dropping it for tidiness would have
left that span deriving nothing and the 15.0.0 correction unsupported.

## 3. The residual of this measurement, named rather than left to be discovered

**A limitation nobody wrote down is invisible to this.** The derivation reads
SELF-DECLARED residuals — prose in a commit or in a touched executable file —
so a span whose limitations were never documented derives none, and the field
then prints a `_none_` that reads stronger than the undefended one it replaced.
That is Risk 2, and it is paid at the gate rather than here:
`check_release_highlights` prints `UNDERIVED_LIMITATIONS_NOTE` whenever the
field passes as `_none_`, stating that no candidate was derived and not that no
limitations exist.

**Recall is unmeasured.** These three candidates were hand-judged as true
positives, so this file reports PRECISION over two spans (3/3 after narrowing).
It does not establish how many documented residuals in those spans the pattern
list missed — the same limit `release-head-derivation-recall.md` records for
`_EXECUTABLE_EXACT`, and for the same reason: the denominator would have to be
built by reading all 306 commits' touched files by hand.

**The content half is scoped to executable surface.** A residual declared in a
rule or a roadmap is a plan; one declared in shipped code is a property of the
release. So a span that documents a limit only in a roadmap derives nothing
here. That is deliberate, and it is the other half of Risk 1's mitigation.
