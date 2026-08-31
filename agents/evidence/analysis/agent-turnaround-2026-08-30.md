<!-- evidence-type: analysis -->
# Why a one-file change takes a session — measured

> Measured 2026-08-30 over the 10 most recent sessions in this package's
> transcript store (`~/.claude/projects/<mangled-cwd>/*.jsonl`, 2026-08-27 →
> 2026-08-30), excluding the measuring session itself. Instrument: transcript
> parse by `requestId`, so a request is counted once even though the host writes
> `thinking`, `text` and `tool_use` as separate rows — an earlier pass that
> counted rows inflated every per-call figure and is not the basis here.

## Corpus

| | |
|---|---|
| sessions | 10 |
| real user requests | 76 |
| API calls (distinct `requestId`) | 3,241 |
| tool calls | 3,196 (96.2 % `Bash`) |
| file mutations (`Edit`/`Write`) | 55 |
| session wall-clock span | 86.9 h |
| model-generation time | 6.8 h |
| tool-execution time | 14.2 h |

Span minus model minus tool is 65.9 h, i.e. **76 % of elapsed session time is
neither the model nor a tool** — sessions left open between requests. Elapsed
session time is therefore not the metric; the two numbers below are.

## The four findings

### F1 — 42.6 API round-trips per user request, and every one of them is serial

3,241 calls / 76 requests = **42.6 calls per user request**; 3,196 tool calls /
55 mutations = **58 tool calls per file change**.

Across **3,212 tool-using assistant messages the mean batch size is exactly
1.00** — not one message in the corpus carried two tool calls, although the
harness instructs that independent calls go in one block. At a median
model-generation latency of 4.7 s (mean 7.6 s, p90 14.3 s) the serialization
alone costs ≈ 5 min of model time per request before a single tool runs.

This is not a read-loop: **exact-duplicate command re-runs are 0.3 %** (9 of
3,090). The agent is doing 42 genuinely distinct steps, one at a time.

### F2 — 64 % of tool time is 167 blocking calls

| command | n | total | median |
|---|---|---|---|
| `ci_settle` | 45 | **162.9 min** | 217 s |
| `npx vitest` | 77 | 87.2 min | 68 s |
| `cat` (compound/heredoc) | 188 | 72.1 min | 23 s |
| `python3 -` | 424 | 65.0 min | 9 s |
| `git push` | 54 | **60.0 min** | 67 s |
| `git add` | 110 | 30.0 min | 16 s |
| `task preflight` | 10 | 16.0 min | 96 s |

167 calls exceeded 60 s and account for **547 min = 9.1 h of the 14.2 h** of
tool time. Two mechanisms are visible in the tail:

- **`ci_settle` blocks the foreground.** Its own default deadline is 45 min
  (`src/scripts/ci_settle.ts:127`) while the `Bash` tool caps at 600 s, so ten
  of the twelve slowest calls in the corpus are `ci_settle` stopped at
  592–603 s and then re-invoked. 2.7 h of a 14.2 h budget is spent watching CI
  in the foreground.
- **git hooks are on the interactive path.** `pre-push` runs `task consistency`
  (its own header states "~15-40 s"; measured median 67 s, max 890 s) and
  `pre-commit` runs `lint_marketplace` plus the roadmap-dashboard check
  (measured median 16 s over 110 `git add` calls).

### F3 — the delivered always-on payload is 7.4× the governed budget

`check_always_budget` reports **60,252 / 60,254 chars (100.0 %) across 9 rules**
and is the gate the package treats as the always-on ceiling.

What the host actually receives is `~/.claude/rules/`, written by this
package's own installer:

| activation on Claude Code | rules | chars | ≈ tokens |
|---|---|---|---|
| keyword-only triggers | **79** | **340,109** (75.9 %) | 85,027 |
| path triggers nested under `triggers:` | 15 | 77,011 | 19,252 |
| `type: always` | 9 | 29,864 | 7,466 |
| no trigger | 1 | 1,007 | 251 |
| **total** | **104** | **447,991** | **111,997** |

**Zero of the 104 installed rules emit a top-level `paths:` key** — the only
per-file activation surface Claude Code reads. `triggers.keyword` and
`triggers.file_pattern` are nested under a key the host does not parse, so all
104 rules arrive on every request regardless of what the request is about. The
79 keyword-only rules (85k tokens) are a routing surface that does not exist on
this host.

**Independent cross-check.** `src/config/preamble-payload-budget.json` records a
gated baseline of **102,520 tokens** and explicitly *excludes* the user-scope
bucket as "machine-dependent, not CI-checkable". 102,520 + 111,997 = **214,517**,
against a measured first-call context floor of **218,705–230,705 tokens** in all
ten sessions. Two instruments built for different purposes agree to within 3 %,
which is what makes the floor a fact rather than an estimate.

### F4 — context size is NOT the per-call latency driver, and saying so matters

| context | n | median latency |
|---|---|---|
| 200–300k | 559 | 4.3 s |
| 400–500k | 791 | 4.8 s |
| 600–700k | 268 | 4.8 s |
| 900–1000k | 82 | 5.9 s |

Median latency rises 37 % across a 4× context increase. So the 220k floor is
**not** what makes a turn slow — it is what makes a turn *expensive*, and what
pushes sessions toward the 994,216-token maximum observed and the compaction
that follows. Any proposal that sells preamble reduction as a latency fix is
selling the wrong benefit; F1 and F5 are the latency, F3 is the cost.

### F5 — per-call latency is output generation, and the commands are long

Output tokens, deduplicated by `requestId`: **2,455,974** over 3,261 calls.
Of those, the visible payload — `tool_use` inputs (4,105,909 chars) plus
assistant text (162,893 chars) — accounts for ~1,067,200 tokens (43.5 %),
leaving **~1,388,774 tokens (56.5 %, ≈425/call) of reasoning**. The store
redacts thinking-block text (1,743 blocks, zero characters retained), so the
reasoning figure is a residual, not a direct read; it is stated as such.

The visible half is the surprise: **4,105,909 chars across 3,196 tool calls is
1,285 characters per command.** These are not `git status` calls — they are
inline heredoc scripts. Generating ~750 output tokens (425 reasoning + ~320
command) is, at ordinary generation rates, the 4.7 s median this corpus shows.
That closes the causal loop: per-call latency is **output**, and F1 multiplies
it by 42.6.

### F6 — the turnaround problem already bought one security regression

Found in the same working tree on 2026-08-30, uncommitted:

```
-export const LEDGER_MAX_AGE_MS = 30 * 60 * 1000;
+export const LEDGER_MAX_AGE_MS = 6 * 60 * 60 * 1000; // TEMP: PR-drain, revert after
```

`LEDGER_MAX_AGE_MS` is the authorization window on the guard that gates
`pr-merge`, a `BLOCK_OPS` member. The docblock **immediately above the edited
line** (`src/scripts/hooks/block_unauthorized_git.ts:509-524`) forbids exactly
this edit and records the last time it happened — 2026-08-21, the same
twelvefold value, the same "PR-drain" marker, the same promised revert that
never came. It states: *"The supported answer to 'my run is longer than the
window' is that the run STOPS and REPORTS at expiry and the user
re-authorizes — never that the window grows."*

Two facts make this a turnaround finding rather than a governance aside:

1. **The stated motive is run length.** The window was widened because a run
   outlasted 30 minutes. The sessions in this corpus run 1.1–35 h. A guard sized
   for a bounded turn is under continuous pressure from a turn that is not
   bounded, and the pressure has now been relieved the same wrong way twice.
2. **It was live, not proposed.** `dist/hooks/dispatch.js` (built 2026-08-29
   17:46) carried `LEDGER_MAX_AGE_MS = 6 * 60 * 60 * 1e3` and no occurrence of
   the 30-minute value, so the weakened window was the one actually enforcing.
   Restored and rebuilt 2026-08-30; `check_hook_bundle_content` now reports the
   bundle byte-identical to its source (sha256 `20faf916cbe8`).

The gate that detects this exists and is correct — it reported the mismatch on
the first run. It is wired only into `taskfiles/ci-fast.yml:174`, and
`dist/hooks/` is untracked, so in CI it is a declared no-op on a fresh checkout.
The one place it would find something is the one place nothing runs it.

## What this rules out

Thinking volume is deliberately **not** on this list: the store retains no
thinking text, so it can only be reached by subtraction (F5) and is neither
ruled in nor out as a lever here.

- **Read-loops / flailing** — 0.3 % duplicate re-runs.
- **Subagent overspawn** — 38 `Agent` calls in 3,196, 0.06 h of tool time.
- **Context length as latency** — F4.

---

# Execution findings — `road-to-agent-turnaround`, 2026-08-30

Everything above is the original measurement, unchanged. Everything below was
produced by executing the roadmap it motivated, using the committed instrument
(`src/scripts/probe_turnaround.ts`) rather than the throwaway script. Where the
instrument disagrees with a number above, the disagreement is recorded rather
than reconciled — a second reading that is quietly edited to match the first is
not a second reading.

## E0 — The instrument measured itself, and failed its own baseline

The first registered baseline was `calls_per_request: 81.42`. Re-running the
probe minutes later against that baseline reported **81.61 — a regression** with
nothing having changed but the clock.

Cause: the probe was reading the transcript of the session that was running it.
API calls accumulate in the newest transcript while its user-request denominator
stays at one, so the metric climbs monotonically for as long as the measurement
takes. The original analysis excluded the measuring session and said so; this
rediscovered why.

`recentSessions` now drops the measuring session by default — by
`CLAUDE_CODE_SESSION_ID` where the host exports it, otherwise the single
most-recently-modified file, which is the same session on any machine actually
running this. `--include-current` opts back in for an offline corpus nobody is
writing to. Two consecutive runs afterwards report **72.67 identically**.

This is recorded as a finding and not as a bug fix because it generalises: any
transcript instrument that gates is measuring a corpus it is a member of.

## E1 — The instrument agrees with the source where it should, and the two
places it disagrees are both informative

| metric | source (throwaway) | instrument | reading |
|---|---|---|---|
| first-call context floor | 218,705–230,705 | **217,385–230,705** | agrees; upper bound identical, lower differs 0.6 % |
| blocking share of tool time | 64 % | **62.0 %** | agrees within the window difference |
| mean tool-call batch size | 1.00 | **1.01** | disagrees — see E2 |
| API calls per user request | 42.6 | **72.67** | disagrees — denominator effect, see E3 |

Two instruments built independently agreeing on the context floor to 0.6 % is
the strongest available evidence that they parse the store the same way.

## E2 — Batch size is a tendency, not a floor (step 2.1: cause **(c)**)

The source reports *"across 3,212 tool-using assistant messages the mean batch
size is exactly 1.00 — not one message in the corpus carried two tool calls"*.
A floor that exact invites the search for a mechanism, which is what step 2.1
asks for.

There is no mechanism. Over the current ten-session window, **27 of 2,889
tool-using requests (0.93 %) carried more than one `tool_use` block** — 24 of
size 2, two of size 3, one of size 4 — spread across five different sessions.
Parallel calls occur. 1.00 was a property of that window, not a law.

**Step 2.1's answer is (c): purely model-carried, no local cause.** The evidence
for the negative half:

- No rule, skill, or template in `src/` forbids or discourages parallel tool
  calls. Searching for the shapes that would (`one tool at a time`, `never …
  parallel`, `no parallel`, `single tool call`, `one call per turn`) returns
  three hits, all off-topic: `mcp-builder`'s *"Four phases, one tool at a time"*
  is about authoring MCP tools, `subagent-orchestration`'s *"NEVER run
  `do-in-parallel` on slices that touch shared files"* is about subagent slices,
  and `directives/ui/design.ts` is about a UI channel.
- The package carries **no positive instruction to batch either**. The host
  harness supplies one; nothing in this package repeats or reinforces it.

Option **(b)** — that per-call obligations make each call feel like it needs its
own turn — is **not ruled out and is not measured**. It is a claim about why the
model chooses serially, and a transcript records the choice, never the reason.
Stated as unmeasured rather than dismissed.

## E3 — `calls_per_request` is session-shape sensitive, which limits it as a ratchet

72.67 against the source's 42.6 is not a regression. `api_calls` is comparable
(3,052 vs 3,241) while `user_requests` fell (42 vs 76): this window contains
long autonomous runs in which one prompt drives hundreds of calls. The ratio
moved because the denominator did.

The budget config records the corpus SHAPE (sessions, requests, calls) beside
the ratios for exactly this reason. A movement in this number that tracks
`user_requests` is evidence of nothing.

## E4 — The long commands ARE the batching (step 2.3)

Split of all 2,921 `Bash` commands in the window, by length:

| length | n | share of calls | share of all command chars |
|---|---|---|---|
| 0–80 | 135 | 4.6 % | 0.3 % |
| 80–200 | 1,009 | 34.5 % | 4.9 % |
| 200–500 | 945 | 32.4 % | 10.1 % |
| 500–1,500 | 304 | 10.4 % | 9.5 % |
| **≥ 1,500** | **528** | **18.1 %** | **75.3 %** |

Total 2,861,874 chars, mean 980. And by shape:

| class | n | median length | example |
|---|---|---|---|
| A — one-shot script (heredoc) | 706 | 2,648 | `cd … && python3 - <<'PY'` rewriting a set of roadmap files |
| B — compound chain, no heredoc | 1,993 | 210 | `cd … && grep -n … \| head -5 && echo "===" && sed -n …` |
| C — single command | **55** | 79 | `grep -n "ruleset" <path>` |

**98.1 % of commands are compound, heredoc, or piped.** Only 55 calls in 2,921
(1.9 %) are a single command. The agent is already batching — inside the call,
because that is the only place this corpus shows it batching at all.

The conclusion the raw average invites — *"write shorter commands"* — is
therefore the wrong lesson, and the risk register named it before the split
existed. Class A is 706 one-shot scripts at a 2,648-char median; each replaces a
read-edit-verify sequence that would otherwise be three to six round-trips.
Splitting them would trade one expensive call for several cheap ones and make
the headline metric **worse** while looking like a fix.

Where the residue is: class B, 1,993 calls at a 210-char median, is 68 % of the
calls and 15 % of the characters. That is where a shorter command would save
something real, and it is not where the 980-char mean comes from.

## E5 — Both pre-push numbers were wrong, in opposite directions (step 3.2)

Fresh timed runs, 2026-08-30, on a clean tree in this worktree:

```
$ for i in 1 2 3; do /usr/bin/time -p task consistency; done
real 9.79   real 10.19   real 10.26

$ /usr/bin/time -p task preflight        # exit 0
real 36.05
```

| claim, and where it lived | claimed | measured | direction |
|---|---|---|---|
| `install-hooks.sh:35` — `task consistency` | ~15–40 s | **~10 s** | over-stated 1.5–4× |
| `install-hooks.sh:86` — `task preflight` | 15 s | **36.05 s** | under-stated 2.4× |
| `ci-local-parity.yml` — `pre_push_budget_seconds` | 25 s ceiling | **36.05 s** | **44 % over budget** |

The budget breach is the finding. That config's own comment calls the ceiling
*"a real budget, not a wish"*, and **nothing measures the hook** — so the
preflight gate set grew past its declared ceiling with no signal anywhere. Both
headers are corrected in the same change; the breach is recorded rather than
fixed, because narrowing preflight to the pushed paths is one edit from turning
a push-blocking mirror into a partial one, which is how drift reaches CI instead
of the developer (risk 5).

Together the hook costs **≈ 46 s** of local work before the network push starts,
which is most of what the corpus's 67 s median `git push` is made of. The
scoping lever the step asks about is therefore in preflight (36 s), not in
consistency (10 s) — and it is the one the risk register says not to pull.

## E6 — Zero whole-suite test runs; the suite itself is the cost (step 3.3)

Every `Bash` command in the window was parsed for a real `vitest` INVOCATION —
`npx|pnpm|yarn|npm run vitest` or `vitest` at the start of a shell segment —
rather than for the string, which is what an earlier pass did and why it
reported twenty whole-suite runs that were `grep`, `pgrep` and roadmap prose.

| class | calls | invocations | total | median |
|---|---|---|---|---|
| filtered (explicit paths or `-t`) | **223** | 234 | 118.4 min | 5.3 s |
| whole-suite (unfiltered) | **0** | 0 | — | — |
| false matches (`pgrep -fl vitest`) | 2 | 2 | 0.1 min | 2.1 s |

**Not one unfiltered run.** The package already forbids a full-pipeline probe
per iteration, and the corpus says the rule is being followed — so the roadmap's
own second branch applies: **the finding is that the suite itself is the cost.**

The shape of that cost is a long tail, not a plateau: 223 filtered calls at a
5.3 s median but a 31.9 s mean, i.e. a minority of test files dominate 118
minutes. That is a test-performance question, not an invocation-discipline one,
and pointing "run fewer tests" at a corpus with zero whole-suite runs would be
advice against a behaviour nobody exhibits.

## E7 — The user-scope bucket is derivable, and it was never invisible (step 4.1/4.2)

`src/config/preamble-payload-budget.json` excluded the user-scope bucket as
*"machine-dependent, not CI-checkable"*. Both halves are false. The layer is
written by this package's own installer out of `dist/agent-src/rules/`, and
which rules reach the **global** layer rather than the project one is decided by
frontmatter — a `workspaces:` list naming the maintainer workspace.

`censusDeliveredRulePayload` computes it from the projection alone, reading
nothing under `~/`. Measured 2026-08-30:

| | files | chars | tokens |
|---|---|---|---|
| user-scope, MEASURED off the machine | 104 | 451,912 | 112,978 |
| user-scope, DERIVED from the projection | 104 | 445,046 | 111,262 |
| package-only (never delivered) | 15 | 46,147 | 11,537 |

119 projected − 15 package-only = **104**, matching the installed file count
exactly. The 1.5 % char gap is install drift, not a defect in either number.

**Council, two rounds, 2/2 each.** Round 1 chose *"gate the bucket and
rebaseline"*. Round 2 was given the checker's bucket definitions — which round 1
had explicitly deferred to, its two seats' proposed baselines differing by
~124k — and found the decisive fact: `measureDeterministicPayload` gates
`dist/agent-src/rules/` **in full**, all 119 files. The 104 are a SUBSET of a
bucket already counted. Adding them would move the baseline ~111k for zero
additional delivered payload.

Round 2 chose **(a′)**: correct the false reason, add the reconciliation test,
leave the baseline alone. Recorded verbatim in the config's `excluded_buckets`
entry. What remains genuinely unreported by the GATE is the 104 / 13 / 2
destination split — the census prints it, and the council placed it there until
distinct destinations need independent budget enforcement.

**A defect this change made and caught.** The derived rows were first added to
`sources`, which `buildByteCensus` SUMS — adding ~123k phantom tokens and
reddening `check_preamble_payload_budget` on the first run. A second VIEW of an
existing row belongs beside a total, never inside it. The field now sits outside
`sources` with that reason in its docstring.

## E8 — `paths:` is emitted; the global write path does not run the emitter (step 4.3)

The originating measurement read *"zero of 104 installed rules emit a top-level
`paths:`"* as the emitter refusing to scope. Re-measured with
`rule_activation_census`, it is three facts and only one is a refusal:

| set | n | outcome |
|---|---|---|
| path-only | 4 | the emitter DOES write `paths:` |
| mixed (path + keyword) | 17 | no `paths:`, deliberately |
| no path trigger | 99 | nothing to lift |

**The 17 are the correct refusal.** `paths:` is the host's only activation key,
so writing it for a rule that also carries a keyword trigger makes the keyword
unreachable — the rule goes silent on exactly the prompts it was written for.

**The wiring gap is the finding.** Of the 4 the emitter would scope, one carries
`paths:` in a host tree — `source-of-truth`, and only because it is
package-only and therefore travels the project write path. `condense.ts` calls
`_claude_paths_plan`; **nothing under `src/install/` calls it at all**, so the
global layer receives the source form verbatim. `ui-audit-gate`,
`design-review-after-ui-write` and `roadmap-progress-sync` are installed
globally without `paths:` for that reason, not because the install is stale.

Documented in `docs/contracts/rule-router.md` with the table; deliberately not
repaired here, because the repair is a consumer-facing installer change that
would silently narrow three rules' activation from inside a measurement
roadmap. Carried to the follow-up.

## E9 — Phase 4 changed no delivered payload, and says so (step 4.4)

| | before Phase 4 | after |
|---|---|---|
| first-call context floor | 217,385–230,705 | **217,385–230,705** |
| delivered global rule payload | 111,262 tok | 110,861 tok |
| mean batch size | 1.01 | 1.01 |

The floor is **unchanged**, against the source's recorded 218,705–230,705. That
is the correct outcome for a phase that corrected a false reason, added a
report, and repaired a double-count: none of those move bytes. The 401-token
fall in the delivered payload is step 2.2's rule text being trimmed into its
context file, not a payload reduction.

**`calls_per_request` is now reported, never gated.** It moved twice for reasons
that are not regressions — 81.42 → 72.67 when the measuring session was
excluded, then 72.67 → 73.73 within the same afternoon, because the corpus is an
mtime window and concurrent sessions in the same project store keep sliding into
it. A ratchet on a number that moves when nothing changed teaches a reader to
ignore the gate. The other three metrics were stable across every one of those
runs and stay gated.

## E10 — The bundle gate was already on the local path, and it discriminates (step 5.1)

The step asks to move `check_hook_bundle_content` onto `task preflight`, where
`dist/hooks/` actually exists. **It is already there** —
`taskfiles/ci-fast.yml:174`, inside the `preflight` task that begins at line 4.
The move landed before this roadmap executed; the step is satisfied by the tree,
not by this change, and saying so is cheaper than a no-op commit.

What was NOT established is the half that matters: that it *discriminates*.
Verified 2026-08-30 with two probes, both preserving mtime so the freshness gate
next to it could not have contributed:

| probe | edit | verdict |
|---|---|---|
| behavioural | `LEDGER_MAX_AGE_MS` 30 → 31 min in `block_unauthorized_git.ts` | **REFUSED**, exit 1 — `0347bf44ec5b` vs `83c92178ad79`, both 1,233,375 bytes |
| comment-only | appended a `//` line to `block_no_verify.ts` | passed, correctly |

The behavioural probe is deliberately the incident's *own* constant, and the
byte sizes are identical — the mtime gate beside it could not have seen this,
which is the whole reason the content gate exists. The comment-only pass is not
a gap: esbuild strips comments, so the bundle genuinely is unchanged, and a gate
that fired there would be reporting on the source rather than on what executes.

Both edits were reverted with `cp -p` from a copy taken before the probe, never
with `git checkout`, and the gate reports green on the restored tree.

## E11 — The recurrence, classified (step 5.2)

The 2026-08-30 widening of `LEDGER_MAX_AGE_MS` is a verbatim repeat of
2026-08-21: same constant, same twelvefold value, same `PR-drain` marker, same
promised revert that never came. Under `recurring-criticism` the repetition is
evidence about the SYSTEM, and exactly one of three outcomes applies.

**It is the third: right, recorded, and unreachable.** Not the first — nobody
argues the 30-minute window was wrong. Not the second — the prohibition is
recorded, in full, with the prior incident's date and value, at
`src/scripts/hooks/block_unauthorized_git.ts:509-524`. It is **immediately above
the line that was edited**. Recording could not have been more proximate.

So what failed is REACHABILITY, and the shape of the failure is specific:
prose cannot refuse. A docblock is read by whoever is already reading the file,
and an agent editing a constant is looking at the constant. Three things would
have made it reachable, in ascending order of what they cost:

1. **A gate that runs where the artefact is.** `check_hook_bundle_content`
   caught the live weakening on its first run, and E10 shows it refuses the
   exact edit. It is on `task preflight`. This is the one that now exists.
2. **A guard on the write.** `block_kernel_rule_writes` denies agent edits to
   kernel rules; nothing equivalent guards the `BLOCK_OPS` constants. A
   PreToolUse deny on this file's authorization constants would refuse at the
   moment of the edit rather than at the next push.
3. **Removing the pressure.** Both widenings were motivated by run length, not
   by disagreement with the window — which is step 5.3's subject and is
   owner-reserved.

The first is in place. The second is not proposed here: a new deny surface on a
security constant is a change to a safety floor, and this roadmap's own
Phase 5 forbids the agent taking that decision.

---

# Re-reading — `road-to-turnaround-followups` step 1.1, 2026-08-30

The batching obligation of step 2.2 above landed in `af0cf0bf0`
(2026-08-30 16:38:40 +0200 = 14:38:40Z). This is the reading against it. The
step pre-committed to a null being the RESULT, and it is a null — but the
finding that matters is upstream of the number: **the corpus could not have
received the obligation.**

## R1 — The precondition is not met, and it is not met by a wide margin

Risk 2 of the roadmap that ordered this step names the failure exactly: *"the
window is mtime-ordered, so running it early measures sessions that predate the
obligation and reports them as an after"*. Measured, by first transcript
timestamp:

| session | first → last (UTC) | relative to 14:38:40Z |
|---|---|---|
| `25ee3009` | 13:05:10 → 18:43:23 | spans |
| `4fb84fae` | 16:25:33 → 20:11:58 | **after** |
| `d116c1ff` | 11:46:05 → 16:08:59 | spans |
| `89e9b7f9` | 11:47:04 → 12:10:08 | before |
| `5698425e` | 09:38:01 → 10:10:01 | before |
| `dc58b2a9` | 08:35:24 → 11:44:05 | before |
| `399c9e09` | 01:41:47 → 08:39:21 | before |
| `0ffa69c5` | 08:55:19 → 09:18:33 | before |
| `43a60a50` | 01:44:16 → 08:32:32 | before |
| `3dfb42bc` | 2026-08-29 16:20 → 20:12 | before |

**One of ten** began after the obligation landed; two span it; seven ended
entirely before. The required ten do not exist.

A second check makes it stronger than a counting problem. `grep -rl` for the
obligation's own heading over `~/.claude` finds it in **no installed tree** —
not `~/.claude/rules/token-efficiency.md` (mtime 2026-08-25, i.e. five days
older than the change), not the marketplace plugin copy under
`~/.claude/plugins/marketplaces/event4u-agent-config/`. The two hits are both
transcripts: the session that authored the text, and a subagent of the session
that took this reading. The only delivered copy is the main checkout's own
projection (`dist/agent-src/…/token-efficiency-mechanics.md`, mtime 2026-08-30
16:39), which is a context reachable on demand through `load_context` and not
otherwise. So the number of sessions that could have **received** the reminder
is at most one, and on this evidence plausibly zero.

That is a finding about the delivery of a context-file obligation, not about
batching. It is recorded here rather than acted on: re-running the probe later
is one command, and the roadmap's step is what schedules it.

## R2 — The number: null, as pre-committed

| metric | first reading (2026-08-30) | this reading | delta |
|---|---|---|---|
| `mean_batch_size` | 1.01 | **1.01** | **none** (unrounded 1.008959) |
| multi-block requests | 27 / 2,889 = 0.93 % | 26 / 3,237 = **0.80 %** | −0.13 pp |
| `blocking_share` | 0.6202 | 0.6641 | **+0.0439**, gate-red |
| `context_floor_max` | 230,705 | 226,528 | −4,177, within baseline |
| `calls_per_request` | 72.67 | 93.74 | reported only |

The multi-block split is 24 of size 2, one of size 3, one of size 4 — the same
shape § E2 reports, at the same order of magnitude. Nothing moved, in either
direction, beyond what an mtime window moves on its own.

**The pre-commitment holds and is restated rather than assumed:** this is the
result. It is not a reason to raise the reminder's frequency or its volume —
which this tree has already measured not to work for the session-canary
obligation, where a per-turn carrier left the miss rate where it was. Here the
case against escalating is stronger still, because R1 shows the reminder was
never delivered: escalating an undelivered obligation would be tuning a channel
that is not connected.

## R3 — Two things this reading refused to do

`blocking_share` regressed past its baseline and **was not re-baselined**. It is
not this step's metric, one local mtime-window reading is not grounds to move a
ratchet, and the config's own rule is that raising a baseline needs its reason as
a sentence in the same change. The run therefore exits 1, on `blocking_share`
alone; `mean_batch_size` passed.

`context_floor_max` fell 4,177 tokens and **was not lowered** either. Tightening
a ratchet on a single local reading is the mirror of the same error.

## R4 — The first entry's corpus block cannot reproduce its own ratio

Found while matching the new entry to the old one's shape. The registered
corpus records `tool_calls: 3031`; § E2 records 2,889 tool-using requests.
3,031 / 2,889 = 1.05, not the 1.01 the entry registers — the two figures came
from different runs, and the corpus block omits `tool_using_requests`, which is
the denominator. A corpus block exists precisely so a reader can tell a moved
ratio from a moved denominator, and this one cannot re-derive its own numerator
over its own denominator.

The new entry records `tool_using_requests` for that reason and is a deliberate
one-field departure from "match the existing shape exactly": 3,266 / 3,237 =
1.008959 → 1.01 is checkable from the entry alone. The first entry is left as
recorded — it is a historical reading, and editing a past measurement to be
consistent is not a second reading.

## R5 — The roadmap's literal command measures nothing from a worktree

`./scripts-run src/scripts/probe_turnaround --limit 10 --against-baseline`,
run verbatim from the `drain/turnaround-followups` worktree at
`/private/tmp/ac-drain10`:

```
probe:turnaround · 0 session(s) · …/projects/-private-tmp-ac-drain10
❌  probe_turnaround: empty corpus … `empty_corpus: "fail"` so it refuses
    rather than reporting green.                                    exit 1
```

The probe defaults to `defaultStore(process.cwd())`, and a worktree has its own
slug with no store behind it. The fail-closed behaviour is correct and is the
whole of step 1.3 working — but the step's command as written cannot take the
reading it asks for from anywhere except the main checkout. `--store` was
therefore pointed at the store the first reading measured, because a delta
against a different corpus is not a delta. Anyone re-running this must pass it
too, or run from the main checkout.

# Exposure sweep — road-to-turnaround-followups AC-1, 2026-08-31

Taken one day after R1–R5, to answer the one question the re-reading could not:
**how many sessions could have received the batching obligation at all?** The
re-reading measured `mean_batch_size` 1.01 → 1.01 and recorded it as a null; the
AI council (2026-08-30, anthropic + openai, 2/2) then ruled AC-1 `not-met`
because "post-change corpus" means a corpus **exposed** to the change, and the
exposure was never established. This section establishes it.

## R6 — Two usable sessions exist against a bar of ten

The obligation landed in `af0cf0bf0` at **2026-08-30 14:38:40Z**. Sessions were
counted by **first `"timestamp"` in the JSONL**, which is when the session
began — not by file mtime, which is when it last wrote and is what
`recentSessions` (`src/scripts/probe_turnaround.ts:117-133`) sorts on. The
distinction is the whole point: an mtime-ordered window can put a session that
*started* three days ago at the top.

In this package's own store
(`~/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config/`),
162 sessions, **3** begin after that instant:

| first timestamp | session |
|---|---|
| 2026-08-30T16:25:33.178Z | `4fb84fae-…` |
| 2026-08-30T20:14:41.586Z | `90ddc54d-…` |
| 2026-08-30T23:02:43.219Z | `2469ce40-…` — **the measuring session itself** |

`recentSessions` excludes the measuring session by default, so the usable count
is **2**. The releasing condition recorded at
`blocker: batching-corpus-never-received-the-obligation` asks for **≥ 10**.

## R7 — The wider sweep does not rescue the count, and why it looked like it might

Across **all 1,053 sessions in every project store on this machine**, 20 begin
after the obligation's timestamp — 3 above, and 17 in
`~/.claude/projects/-private-var-folders-…-T/`. That store holds 555 sessions
and, read carelessly, would take AC-1 over its bar twice over.

It does not, and the reason is structural rather than a judgement call. Those 17
were opened: each is **11–12 JSONL rows**, and each one's first row is
`{"type":"queue-operation","operation":"enqueue",…,"content":"# Question — …"}`
carrying a council question body. They are **council seat transcripts** — the
provider CLIs invoked headlessly, single-turn, to answer a council round. A
seat answers a question in one turn and issues no tool calls at all.

`mean_batch_size` is tool calls per tool-using request. A population that issues
no tool calls cannot exhibit the behaviour the obligation is trying to change,
so including it would not weaken the measurement — it would compute the metric
over a population where the metric is undefined, and return a number anyway.
That is the "poisoned evidence" failure the 2026-08-30 council named, arriving
by a different door: not a corpus that missed the obligation, but a corpus that
could not have responded to it.

**Recorded as an exclusion with its reason, not as a filter applied silently.**
Anyone re-running this must apply the same exclusion, and the cheap test for it
is the first row's `type`: a session whose opening row is a `queue-operation`
enqueue of a council question is a seat, not an agent.

## What this does and does not establish

- It **does** establish that the exposure half of AC-1 cannot be satisfied by
  any action available inside this repository today. Eight further real
  operator sessions are wall-clock, not work.
- It **does not** establish anything new about the batching obligation's
  effect. The null at 1.01 → 1.01 still measures the delivery channel, exactly
  as `stubs/road-to-obligation-delivery-verification.md` records.
