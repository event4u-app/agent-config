# Blind rating packet — council-blind-review Phase 2

For each question: rate (R1) which synthesis you prefer (1/2/tie) and
(R2) for the synthesis that HAS a "Collective blind spot" section,
whether that section is decision-influencing (yes/no).
Do NOT open rating-key.md before rating.

## subagent-auto-cost-downshift

### Synthesis-1

## Convergence / Divergence

Both responses land on the same core verdict, reached by different routes. Response-A is a detailed, self-contained round-2 review that references "Reviewer A" and "Reviewer B" from an unseen round 1, agrees and disagrees with each point by point, then adds five new findings and a full disposition. Response-B is a much shorter round-2 note that also references "Reviewer A" and "Reviewer B" but stays mostly at the level of agreement/disagreement bullets plus a short "new points" list, without building out its own independent architecture.

Where they converge: both treat the estimator ("high-volume × low-difficulty" classification) as the load-bearing, unbuilt component that the whole default-flip decision rests on — Response-A calls this "Layer 1 (Mechanism)" and treats it as disqualifying on its own; Response-B calls it "the weakest assumption in the proposal." Both explicitly endorse the prior finding that flipping `subagents.auto` to `on` is premature without a validated estimator, and both agree that rollback/kill-switch mechanisms are missing from the design. Both also converge on wanting more telemetry/measurement before any default change — Response-A operationalizes this as a formal controlled experiment with numeric gates (5% rollout, 90 days, ≥30% cost reduction, ≤5% quality degradation, ≤10% latency increase); Response-B gestures at the same idea more loosely ("telemetry and meta-monitoring," "comparative baselines," "incremental rollout").

Where they diverge: Response-B pushes back on the binary opt-in/opt-out framing implied by "keep `auto: ask`," proposing instead a graduated/blue-green style rollout as a third option — a real disagreement with the opt-in-only stance, though it is not fleshed out into concrete mechanics. Response-A goes further than Response-B in three ways the file shows no matching content for in Response-B: (1) it dismisses `quota_arbitrage` as an accounting-only red herring that cannot rescue the economics, (2) it argues verification cost is likely non-linear (bounded by max(input, output) size rather than fixed), and (3) it raises a distinct product-layer objection — that downshifting a paying-Opus user to Sonnet without consent is a service degradation, not a pure cost optimization, and proposes a `X-Subagent-Delegation` audit header as a mitigation. Response-B does not engage with this product/consent framing at all; its concerns stay in the economics/engineering register (classification granularity, baselines, monitoring).

Net effect: the council agrees the mechanism doesn't exist yet, agrees the decision is premature, and agrees on the general shape of the missing safety net (kill switches, telemetry, controlled measurement). It splits on whether the right resolution is a strict opt-in gate (Response-A, inheriting Reviewer A's position) or a more graduated exposure model (Response-B), and Response-A alone introduces the harder normative question of whether cost-driven tier downshift is even the right thing to optimize for from the user's point of view.

### Kill criteria

- A validated low-difficulty/high-volume estimator ships with a measured false-positive rate documented against real historical workloads (target Response-A cites: <5%) — if this cannot be produced, the default-flip question stays closed regardless of any other progress.
- A controlled rollout (Response-A's proposed 5% of `subagent_spawn: true` users, ~90 days) reports cost, quality, and latency deltas — until this exists, "should we flip the default" has no empirical answer.
- Verification-failure retry policy and per-session/rolling cost ceilings are implemented and observed to fire correctly at least once in the experiment population — their absence today is a named blocking gap in both responses.
- If Response-B's graduated-rollout alternative is pursued instead of Response-A's strict opt-in, the two are functionally different designs; adopting one silently forecloses testing the other, so that choice itself needs to be made explicit before either is built.

### Concrete next step

Draft and commit the break-even/verification-cost model that Response-A specifies (the deterministic formula plus a plan to sample ~1000 existing manual subagent-spawn telemetry records for `T_delegation`, `T_verify`, and `T_exec`) as a short design note, before writing any code that touches the `subagents.auto` default.

## Collective blind spot

Neither response — nor, on their own account, the round-1 reviewers they are responding to — asks who is accountable for a runaway-cost or quality-degradation incident *during* the proposed controlled experiment itself. Both responses design careful gates for a hypothetical production default-flip, but neither specifies who monitors the 5%-rollout population in real time, what the escalation path is if the experiment itself burns unexpected budget, or how "opt-in to be part of the test" is disclosed to the affected users. The safety apparatus is designed for the destination (the flipped default) but not for the experiment that is supposed to justify reaching it.

## One-line verdict

Do not flip the `subagents.auto` default — the estimator, break-even math, and kill-switches the decision depends on don't exist yet, and the strongest reason is that the entire proposal asks the council to approve a policy built on a mechanism ("high-volume × low-difficulty" classification) that has never been built or measured.

### Synthesis-2

# Chairman Synthesis: Cost-Based Default Flip for `subagents.auto`

Both council members converge on the same disposition: **do not flip the default**. Neither treats this as a close call — the anthropic reviewer frames it as "malpractice in production infrastructure" to change a default on an unfalsified cost model, and gpt-4o independently lands on the same instrumentation-first sequencing without hedging. That two models built on different reasoning paths land on identical rejection, with no daylight on the headline verdict, is itself a strong signal — this is not a case where the council is papering over a real split.

Where they diverge is depth and originality, not direction. gpt-4o's contribution is thin and largely restates the (unseen, in this file) Reviewer A/B points it's responding to: cost-model-as-assertion, sequencing risk, trust boundaries, rollback criteria. Its one disagreement with "Reviewer B" — that the dispatch-trigger problem, not pre-spawn cost estimation, is the more fundamental architectural gap — is stated but not developed into a mechanism or a test. Its "new points" (instrumentation stages, task-sizing logic, A/B testing) are generic good-practice statements, not specific enough to act on directly.

The anthropic reviewer does the actual load-bearing work of this round. It doesn't just agree with prior reviewers — it identifies a conflation problem underneath the whole proposal: the document treats "cost optimization," "latency optimization," and "quota-utilization optimization" as one problem when they are three problems with different trigger logic and, potentially, non-overlapping recommendations. This matters because the proposal's own quoted example (50-file PR review, 3x Sonnet subagents costing 37% more but running 3x faster) is a latency win being sold as a cost win. If that's representative of where delegation actually pays off in practice, the entire "cost-based default flip" framing may be aimed at the wrong lever. This is a genuinely new critique, not a restatement, and it changes what "prove the thesis" would even mean — you'd need separate shadow-mode measurements per objective (cost / latency / quota), not one blended number.

The second load-bearing point is the serialization-cost gap: the proposal's cost model has no line item for the Opus tokens spent constructing the delegation prompt in the first place, and the worked example (700 tokens delegated vs. 600 tokens inline for a trivial "add type hints" task) shows this can flip a nominally-cheaper delegation into a net loss before Sonnet even runs. Combined with the quality-null callback — orchestration showed no quality lift on strong hosts, which the reviewer reads as implying a nonzero Sonnet failure rate, which in turn multiplies retry cost on top of verification cost — the anthropic review builds a coherent argument that the proposal's cost formula is missing at least three terms (serialization, verification, failure-retry), any one of which could dominate the calculation.

There is no real disagreement between the two members on the bottom line, and the anthropic reviewer's disagreement with "Reviewer B" (that Question 5 — quota arbitrage — is a hidden decision fork rather than an open question) is not contested by gpt-4o at all; gpt-4o doesn't engage with it. So on the substantive architecture points, this reads less like a debate and more like one member doing depth-first analysis while the other does a competent but shallow pass. The chairman's job here is to weight the anthropic review's specifics over gpt-4o's generalities where they don't conflict — and they don't.

The anthropic review's proposed remediation (90-day shadow-mode instrumentation phase, opt-in beta capped at 500 users, monthly review gates, explicit numeric revisit-if / do-not-revisit thresholds) is the most concrete artifact in the file and should be treated as the working proposal rather than just a critique. gpt-4o's "clear experimental pathway with A/B testing" gestures at the same shape without the specifics.

## Kill criteria

- Shadow-mode data shows fewer than 70% of would-delegate tasks achieve net cost reduction >20% — the cost thesis does not survive contact with real telemetry.
- Verification failure rate on Opus→Sonnet delegation exceeds 10% in shadow or beta measurement — quality degradation cost dominates any nominal token savings.
- Cost "wins" only materialize when `quota_arbitrage: true` — this falsifies the *cost*-optimization framing specifically (it would instead validate a distinct quota-utilization feature, not this proposal).
- Cost "wins" only materialize under N>1 parallel delegation — this falsifies cost-optimization as the mechanism (the real driver would be latency arbitrage, requiring a different flag and a different default-flip argument).
- Measured serialization overhead (Opus tokens to construct the delegation prompt) exceeds 20% of total delegation cost on the sampled task mix — the "invisible" cost term the anthropic review flagged would then be load-bearing, not marginal.
- Fleet-wide mean cost-per-repo rises >10% for any cohort already on `auto: on` (if such a cohort exists) versus a 4-week baseline — an empirical signal the default-flip direction is actively wrong, independent of the pre-flip debate.

## Concrete next step

Draft the shadow-mode instrumentation spec as a roadmap artifact: define the exact metrics to log (hypothetical Sonnet+verification cost vs. Opus-inline cost per candidate task, serialization token count, task-volume distribution against the "high-volume × low-difficulty" criterion), the `subagents.optimize_for: cost | latency | quota` mode split the anthropic review calls for, and the 90-day/beta-cap/monthly-gate structure — without touching the `subagents.auto` default.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## mcp-stdio-tiebreak

### Synthesis-1

# Synthesis — mcp-stdio-tiebreak (round B)

## Convergence / Divergence

Both members land on the same binding pick, A2×B1, and neither treats that as
controversial — the round's real work happens in the caveats layered on top,
not in the pick itself. Both explicitly side with Reviewer A over Reviewer B
on the upgrade-trigger threshold: a ≥50-user bar is rejected by both as
unfalsifiable given no telemetry, and both prefer Reviewer A's "≥3 named
script requests in 90 days" as the operative Phase-2 trigger. On this point
the two responses don't just agree, they converge on the same *reasoning* —
an unfalsifiable threshold that can never be proven unmet functionally
blocks Phase-2 forever, which both flag as the actual defect in Reviewer B's
proposal, not just its number.

Where they diverge is in rigor and specificity, not direction. Response-B is
the sharper pass: it introduces a genuine open question the round hadn't
settled — what "configure" means for end-users (read-only metadata access vs.
script replacement) — and argues the maintainer must bind that term before
A2×B1 can be greenlit responsibly, because the two readings imply different
risk profiles. Response-B also supplies a concrete rollback threshold ("≥5
users report fundamental capability mismatch within 30 days") and a
sequencing-risk observation that Reviewer A's trigger is self-defeating
unless the docs make the 112 unavailable scripts *discoverable* — otherwise
no one will know to request them, and the signal never fires. Response-A
raises the same categories (trust boundaries, rollback, scaling) but stays
at the level of naming them as gaps ("these should be clarified") rather than
proposing thresholds or resolving the ambiguity. Response-A's trust-boundary
point is narrower and orthogonal to Response-B's: it argues A2×B1's
Node-only surface avoids the added security burden of Python execution,
which is true but doesn't engage with the "configure" ambiguity Response-B
raises — the two are compatible, not competing, but only one closes the gap
with an actionable definition.

Net effect: the council converges tightly on the decision (A2×B1, ≥3-request
trigger over ≥50-user trigger) and on the *category* of missing scaffolding
(trust boundary, rollback, sequencing) but only Response-B converts every
named gap into a testable, numeric commitment. Response-A's contribution is
best read as confirming Response-B's diagnosis is on the right axes rather
than adding new axes of its own.

### Kill criteria

- **Documentation omits the 112 scripts entirely.** If A2×B1 ships without
  the scripts being discoverable in the README/tool listing, the "≥3 named
  requests in 90 days" trigger cannot fire (no user can name what they don't
  know exists) — the whole Phase-2 gating mechanism is void from day one.
- **"Configure" is left undefined at ship time.** If the maintainer ships
  A2×B1 without stating whether end-user "configuration" means read-only
  metadata access or script-swapping, the scope claim underlying the A2×B1
  pick is unverifiable, and the pick itself should be revisited.
- **≥5 users report fundamental capability mismatch within 30 days of
  release** (Response-B's proposed rollback bar) — this falsifies "A2×B1 is
  the right scope for actual user intent," independent of the Phase-2
  execution question.
- **≥3 distinct users request execution of a specific named script within 90
  days, confirmed by maintainer interview as a real workflow gap** — this is
  the convergent Phase-2 trigger; its occurrence falsifies "defer execution
  indefinitely."

### Concrete next step

The maintainer writes a one-paragraph scope note (in the design doc or PR
description) that (a) defines "configure" as either read-only metadata
access or script-replacement access, (b) confirms whether the shipped
A2×B1 documentation will list the 112 scripts with an "execution not yet
available" marker, and (c) states the rollback threshold in numeric form.
This is the one artefact both responses agree is missing and both agree is
required before A2×B1 ships.

## Collective blind spot

Neither response — nor, on the evidence quoted here, Reviewer A or Reviewer
B before them — questions why every voice in the chain lands on A2×B1
without a single dissenting vote for A1×B2 or another cell. Four
consecutive members agreeing on the same pick while disagreeing only on
threshold numbers is exactly the shape of anchoring: once Reviewer A framed
A2×B1 as the minimal-safe-diff choice, no one in this round re-derived the
decision from first principles or asked whether the "reliability hedge vs.
feature gap" framing might itself be the wrong axis. Separately, both
responses propose a manual, request-counting Phase-2 trigger ("≥3 named
requests") but neither assigns an owner or a mechanism for actually
collecting and counting those requests — without a designated intake point
(an issue label, a form, a maintainer inbox), the trigger is precise in
wording but has no operational home, and could silently under-fire even if
the demand genuinely exists.

## One-line verdict

Ship A2×B1 with Reviewer A's ≥3-named-request trigger, but only once
"configure" is defined and the 112 scripts are made discoverable — without
that, the round's carefully-argued Phase-2 gate has nothing to fire on.

### Synthesis-2

## Convergence / Divergence

Both council members land on the same binding pick — **A2×B1** (local stdio-lite, pure-Node, via the existing `@event4u/agent-config` npm bin) — and for the same underlying reason: A1×B2 front-loads unscoped security work (sandboxing, consent, supply-chain attestation) onto a capability with no validated demand, which is exactly the kind of premature-execution-surface anti-pattern the repo's own architecture rules exist to block. Both explicitly endorse Reviewer A's "minimal-safe-diff" framing from the prior round — ship the lightweight, read-only base now, gate any execution capability behind evidence rather than speculation. Neither model treats this as a close call; both call it a clean win for A2×B1 over A1×B2.

The one substantive disagreement in the input is the Phase-2 trigger threshold. Reviewer B's prior-round number was "≥100 end-users." Both council members in this round independently reject that as a bare headcount threshold with no architectural content — it doesn't distinguish "100 users asking for the same tool" (a real signal) from "100 users asking for 100 different tools" (noise). Both converge instead on Reviewer A's alternative: "≥3 requests for a specific named tool" — a concrete use-case-convergence signal rather than a raw count. Anthropic's Claude also sharpens the "limited execution capability" language from OpenAI's own trade-off framing, insisting the honest trade-off is **zero** local execution in Phase 1, not "limited" — there is no script runner, no execution surface at all, so soft language understates what's being deferred.

Where the two models add distinct value is the gap-list. Anthropic's Claude is the more rigorous of the two here, naming three concrete Phase-1-blocking omissions the design (and the prior round) left unaddressed: (1) no rollback/kill criterion defining what "broken" looks like for a read-only stdio server and what triggers a revert; (2) no content-trust control — the npm bin serves `dist/` content to an LLM, and a compromised publish pipeline could inject a poisoned "guideline" that is executable-by-LLM even with zero scripts running, so npm provenance (or a documented review-before-publish SOP) is a missing control, not a nice-to-have; (3) an open question disguised as closed — the design claims the hosted Worker "already does exactly this," but doesn't establish whether the npm bin's implementation is identical to or merely equivalent to the Worker's, leaving room for two canonical content sources to silently drift. OpenAI's GPT-4o converges on the rollback/kill-switch point independently but states it more loosely (as a general good practice) and does not independently surface the content-trust or implementation-drift risks — instead offering softer, non-blocking suggestions (concurrent Phase-2 risk-mitigation planning, a user feedback loop) that are reasonable but not decision-relevant additions to the Phase-1 gate.

Net: full agreement on the pick, full agreement on rejecting the ≥100-user threshold in favor of ≥3-named-tool-requests, and a asymmetric but non-contradictory divergence on gap depth — Claude names three specific, falsifiable Phase-1-blocking conditions; GPT-4o affirms the general need for a kill-switch but does not independently derive the content-trust or drift-forcing-function requirements. Nothing in the two responses actually conflicts; the second model simply covers less ground.

### Kill criteria

- If ≥3 end-users request the same, specific named tool (not merely raise the total request count) with concrete use-cases the hosted Worker or read-only content cannot satisfy, the "no execution capability" position is falsified and Phase 2 scoping should open.
- If ≥10% of `npm install` / stdio-handshake invocations report a failure within 7 days of publish, the "turnkey and safe" claim for the A2×B1 bin is falsified and the bin should be yanked / reverted to Worker-only.
- If npm package provenance (or an equivalent documented review-before-publish SOP) cannot be put in place, the "safe to ship" premise for A2×B1 is falsified and Phase 1 publish should be blocked until it exists.
- If the npm bin's content-serving implementation is found to diverge from the hosted Worker's (e.g. one caches, the other doesn't) without a documented reason and owner, the "two implementations, one canonical source" assumption is falsified and the divergence must be resolved or explicitly justified.

### Concrete next step

Add the three Phase-1-blocking additions (rollback/kill-switch criterion, npm provenance/content-trust control, and the Worker-vs-bin implementation-identity requirement) to the A2×B1 design document now, replacing the ≥100-end-user Phase-2 trigger with the ≥3-named-tool-request trigger, before starting implementation.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## knowledge-wiki-tiebreak

### Synthesis-1

# Synthesis: Option B vs Option C Knowledge/Wiki Architecture

## Convergence / Divergence

The two responses converge on almost nothing at the level of verdict, but they converge tightly on the underlying diagnostic: **the real question is whether "classification friction" is a property of the storage topology or a property of the capture workflow.** Response-A makes this the spine of its rebuttal — routing ambiguity ("is this a card or a concept?") exists identically under B's `knowledge/` + `wiki/` split and under C's `cards/` + `concepts/` + `procedures/` split, because moving both stores under one parent directory does not answer the triage question, it just relocates where the unanswered question lives in the filesystem. Response-B does not directly engage this argument — it asserts that C's "unified namespace" reduces "routing ambiguity" and "logical complexity," but never rebuts A's specific claim that the classification decision is invariant to directory layout. That is the load-bearing disagreement: A treats namespace unification as cosmetic; B treats it as substantive. Neither response resolves this with evidence — A because it wants a dedup-code-delta that isn't in front of it, B because it treats C's structural claims as already-agreed premises from an unspecified "Round 1."

The two responses also diverge sharply on what "acceptable risk" means for a phased migration. Response-A treats C's Phase 1/Phase 2 split as a shell game: Phase 1's "zero consumer impact" claim is only true if Phase 2 (the actual path rewrite, not a "glob change") never ships, and if Phase 2 stalls, C degenerates into exactly the dual-system state B is honest about from day one — except C's version is unacknowledged and permanent. Response-B treats the same phased structure as a virtue ("Lower Risk Migration Strategy... keeping initial changes transparent to existing systems") and explicitly downgrades A's stall-scenario objection, disagreeing that "initial untouched cards under Option C provide sufficient risk mitigation without further proof" is a real problem — i.e., B acknowledges A's exact concern by name and waves it off as something "real-world implementation often reveals" in general, without addressing why C's specific Phase 2 path-rewrite is more likely to complete than not.

Where they diverge most consequentially is on whether B or C is even the right choice set. Response-A's actual recommendation is **neither B nor C** — it proposes Option D: keep everything in flat `agents/knowledge/*.md`, add `lifecycle` and `content_type` frontmatter fields, make the linter validate them additively, and defer any directory split until (if ever) proven necessary by an automated migration keyed off `content_type`. This directly attacks the shared premise of both B and C — that a directory-level split is the right unit of solution at all — using the observed pattern that modern PKM tools (Notion, Obsidian, Roam) favor flat storage plus composable tags precisely because directories force single-parent hierarchies while tags compose. Response-B never engages Option D; it operates entirely inside the binary the prompt handed it and picks C. So the apparent "split decision" (A leans B-if-forced, B firmly picks C) actually masks a deeper divergence: A's real position is "reject the premise," and B's position implicitly re-affirms the premise that this is a two-option contest.

The one place they converge on a concrete, checkable claim is that C's own justification is self-undermining on migration honesty: A shows this via the Phase 1/Phase 2 contradiction and the "single glob pattern change" mischaracterization (it's a path rewrite, not a glob); B independently concedes, in its own words, that untouched-cards-as-risk-mitigation is unproven, which is the same crack A is pointing at, even though B still lands on recommending C overall.

### Kill criteria
- A working dedup/routing implementation for Option B's design comes in under ~100 LOC (the threshold both responses independently name) — this falsifies the "C's unification meaningfully reduces complexity" claim that drives Response-B's verdict.
- Phase 2 of Option C (the path-rewrite migration) is scheduled and then stalls or is deferred past its target window while Phase 1's typed directories are already in active use — this falsifies C's "additive, low-risk migration" framing and confirms Response-A's "permanent hybrid state" prediction.
- A metadata-first flat-frontmatter prototype (Response-A's Option D) is built and demonstrably resolves the cards/concepts/procedures classification need without any directory split — this falsifies the shared premise of both B and C that a topology change is required at all.
- The consumer inventory (every script/tool reading `agents/knowledge/…`) shows more than a small number of hardcoded, non-glob path constructions — this falsifies C's claim that its Phase 2 migration is a "single glob pattern change" and confirms Response-A's understated-migration-risk critique.

### Concrete next step
Produce the consumer-path inventory: grep every script, linter, and tool under the repo for references to `agents/knowledge/` (and any `agents/wiki/`) path construction, and classify each hit as hardcoded-path / glob-pattern / recursive-traversal. This is the single piece of evidence both responses independently call for (A names it explicitly as "Consumer inventory"; B's endorsement of C's "lower risk migration" claim is unverifiable without it), it requires no architectural commitment yet, and it directly falsifies or confirms the migration-risk severity that separates every option on the table (B, C, and A's proposed D).

## Collective blind spot

Neither response asks **who performs the classification act, and how often.** The entire debate — routing ambiguity under B, lifecycle taxonomy under C, tags-vs-directories under A's Option D — is argued as if "deciding whether this is a card, a concept, or a procedure" is a recurring human cognitive cost worth architecting around. But if captures are made by an AI agent at write time (which the source material's own framing, e.g. `observed_at` fields and automated linting, suggests is at least partly the case), the marginal cost of populating a `content_type` field or choosing a target directory approaches zero and can be re-derived or corrected automatically later — which would make most of the routing-ambiguity argument on both sides (A's "the problem is invariant to topology" and B's "C reduces ambiguity") moot, since the real cost driver would be retrieval quality under either layout, not capture-time friction. Nobody in either response measures or even names retrieval-side cost (how an agent or linter actually re-finds and re-uses a card months later) as the dimension that should decide between flat-tags and directories — the entire argument stays fixated on write-time classification cost and migration mechanics.

## One-line verdict

Adopt Response-A's Option D (flat storage, additive `lifecycle`/`content_type` frontmatter, no directory split) over both B and C, because it is the only proposal on the table that is falsifiable and reversible without a path-rewrite migration, while B and C both stake their case on an unmeasured claim (dedup LOC delta for B; a Phase 2 that may never complete for C).

### Synthesis-2

## Convergence / Divergence

The two tie-break judges converge on exactly one load-bearing fact and diverge sharply on what to do with it. Both agree that the entire B-vs-C debate rests on an unaudited assumption: whether the existing `agents/knowledge/<source>.md` cards are episodic (raw, time-stamped observations that can migrate cleanly into a lifecycle taxonomy) or already semantic (curated, trust-weighted, human-reviewed artifacts). Both also agree that Option B's routing ambiguity — forcing an upfront episodic-vs-semantic classification at write time — is a real, non-trivial cost, and that some form of card audit has to happen regardless of which option wins.

Past that shared premise, they part ways completely. GPT-4o treats the audit as a parallel, phased implementation detail bolted onto an otherwise-settled decision: it picks Option C outright, on the strength of routing-ambiguity avoidance, smaller migration footprint (one glob-pattern change), lifecycle-taxonomy alignment, and a "straightforward" rollback (just delete the new subdirs). Its reasoning is almost entirely a restatement and endorsement of two prior reviewers (A and B) rather than independent stress-testing — it does not engage with whether the episodic/semantic framing even applies to this system, and it does not surface any structural gap the prior reviewers hadn't already named.

Claude-Sonnet's response refuses to pick either option and instead argues the audit is a hard precondition, not a phase-2 task: proceeding without it means betting the whole design on an unvalidated premise, and if that premise is wrong, both options fail in different ways — B with permanent dual-store ambiguity, C with silent in-namespace collisions between curated cards and new "semantic" pages that duplicate them. It directly contradicts GPT-4o's rollback claim: where GPT-4o calls C's rollback clean, Claude argues C's rollback risk *grows silently with adoption time* (once even one cross-reference or backlink exists between a merged concept page and a session page, `rm -rf concepts/` orphans references) while B's rollback risk is at least bounded and explicit. Claude also raises three concrete architectural gaps that GPT-4o's response never touches at all: no specified retrieval precedence (does `concepts/` shadow `sessions/`? is there an `INDEX.md` priority order?), no specified dedup algorithm (embedding-similarity favors C's unified namespace, content-hash favors B's separated stores — the "one namespace" advantage is contingent on a choice never made), and a sequencing inversion risk if the linter glob is broadened before `SCHEMA.md` exists (malformed pages could land in subdirs ungated during the window between phases).

Most importantly, Claude's response challenges the framing itself, not just the implementation of it: existing knowledge cards, being trust-weighted and human-review-gated, may already be semantic-stage outputs rather than episodic-stage inputs — in which case the correct model isn't an episodic→semantic lifecycle (C) at all, but two semantic layers at different versions (B, reframed as `sources/` vs `derived/` rather than "dual stores"). GPT-4o's answer implicitly assumes the lifecycle framing is correct without testing it.

This is a substantive disagreement, not a stylistic one: GPT-4o converges to a decision, Claude converges to a decision *procedure* and explicitly declines to pick a winner. Given that GPT-4o's justification never rebuts Claude's specific rollback-risk and framing objections — it simply wasn't given the chance to, since both were dispatched independently — the council does not have a settled answer on B vs C. It has a settled answer on what evidence is missing.

### Kill criteria

- **Card composition test fails the ">80% one class" bar** — if a fuzzy-match/timestamp audit of existing cards shows a genuinely mixed population (roughly 50/50 episodic vs. semantic, not just a long tail), that falsifies both C's clean-migration bet and B's clean-separation bet; neither option is safe and a redesign is required.
- **Any cross-reference lands during a C pilot** — the first time a `sessions/*.md` page backlinks a `concepts/*.md` page (or vice versa), C's "rollback = `rm -rf concepts/ procedures/`" claim is falsified; rollback cost is no longer fixed and grows with time-in-production.
- **Dedup strategy turns out to be content-hash, not embedding-similarity** — this falsifies the "single namespace simplifies dedup" argument GPT-4o and the prior reviewers relied on; content-hash dedup wants separated stores precisely to avoid false-positive collisions between episodic and semantic records of the same fact.
- **Collision rate on new typed pages exceeds ~20% against existing cards** — this was Claude's proposed threshold for "the episodic/semantic split doesn't hold, stop and reconcile"; crossing it after adoption has started is a stronger signal than any pre-adoption audit.

### Concrete next step

Run the 2-day (claimed <3-hour) measurement sprint Claude specified before writing any subdir or schema code: grep existing `agents/knowledge/*.md` cards for timestamp/date patterns (episodic signal), run a fuzzy-match/dedup pass across cards against each other (clustering = semantic signal), and have a human reviewer classify 10 random cards as "raw observation" vs. "synthesis." Produce this as a short written audit artefact (e.g. `agents/knowledge/CARD-AUDIT.md` with the raw counts and the human-reviewer verdicts) — that artefact, not a fresh council round, is what should decide B vs. C.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## reminder-injection-tiebreak

### Synthesis-1

## Convergence / Divergence

Both tie-break responses land on the same headline call — **(b') Build-to-measure** — and neither treats that as a close call: Response-A calls it "well-balanced, data-driven," Response-B calls it the binding verdict "with material modifications." The real substance is in how differently they get there and how far they're willing to restructure the plan on the way.

On the floor, they converge hard. Both keep a kill switch / default-off flag as non-negotiable. Both treat the original pre-registered-threshold discipline as the right instrument, not a formality — Response-A explicitly defends Reviewer A's 12% expansion threshold over Reviewer B's 10% on the grounds that a higher bar protects against productionizing a marginal effect; Response-B doesn't re-fight that specific number but goes further by replacing a single aggregate threshold with per-trigger-class minimums, which is a stricter, not looser, discipline in the same spirit. Both also independently flag a **trust-boundary gap** the prior round left open — Response-A names it as "trust boundaries and module coupling" plus a rollback/kill-switch scope broader than latency and compliance-Δ; Response-B operationalizes the identical concern into a concrete YAML block (flag authority, telemetry isolation, rollback migration). This is real convergence, arrived at independently, which is a stronger signal than if one had simply cited the other.

Where they split is on the **weak-host causal question**, and it's a genuine disagreement, not a nuance. Response-A sides with the prior round's caution: if the weak-host compliance lift turns out to be driven by accessibility (better structure) rather than salience (decision-time attention), the fix should be kernel-structure work, not conditional reminders — and Response-A treats that as still an open, unresolved question the eval needs to settle. Response-B rejects the premise outright, arguing it is "structurally impossible" for the lift to be a structure effect: the honest-null baseline it's being compared against *already had* the structured schema, and still showed Δ=0, so the lift by construction came from something added on top of structure — not from structure itself. That's not a difference in emphasis; one response treats the accessibility-vs-salience question as still live, the other treats it as already answered by the 2026-06-25 data and redesigns the trigger classes on that closed premise.

That disagreement cascades into a second, larger divergence: how much of the existing plan to keep versus rebuild. Response-A is conservative — it accepts the prior round's phase structure and threshold table nearly as-is, adding guardrails (trust boundary, broader rollback criteria, a sample-size contingency) without touching the experimental design itself. Response-B is not conservative — it inserts an entirely new phase-0 (two weeks of passive attention-weight instrumentation with no reminders at all, gated on R²>0.6 before any mechanism gets built), replaces the trigger classes wholesale on the grounds that several of the prior round's proposed triggers (time-based, user-engagement-based) are either hyperparameters in disguise or circular, and adds a difference-in-differences design specifically to rule out the confound that "lift concentrates in long sessions" could just mean long sessions are inherently higher-risk, not that the mechanism works. Response-A never raises the passive-instrumentation option or the confound-control argument at all — it's a genuinely new idea from Response-B, not something Response-A considered and rejected.

So the picture is: same destination, different confidence about what's already settled. Response-A's version is the lighter-touch, lower-effort-to-adopt tie-break; Response-B's is the more rigorous, more expensive one that spends two extra weeks up front specifically to avoid building the wrong six-week experiment.

### Kill criteria

- All three (Response-B's redesigned) trigger classes show Δ<5% on their individual, pre-registered outcome — teardown, no re-convene.
- p95 latency exceeds 80ms on any trigger path — the latency veto both responses treat as unconditional.
- If Response-B's phase-0 is adopted: attention-to-kernel vs. compliance correlation comes back R²<0.4 — the causal premise is rejected before any reminder-injection code ships.
- Response-A's independent condition: post-hoc analysis attributes the weak-host lift predominantly to accessibility/structure rather than decision-time salience — this doesn't kill the experiment outright but redirects the intervention target from reminders to kernel structure, which functions as a kill on the reminder-injection mechanism specifically.
- Sample size for the eval cohort fails to reach the pre-registered n within the evaluation window (Response-A's sequencing-risk contingency) — treated as a hard stop pending a scope decision, not a silent extension.

### Concrete next step

Write and lock the pre-registration document — the single artefact both responses agree must exist before any code is touched: trigger-class definitions, per-class (not aggregate) Δ thresholds, the latency veto, and the trust-boundary block (flag authority, telemetry isolation, rollback path). Locking this now, in the user's current turn, is what makes either response's verdict falsifiable rather than just directionally agreed — and it forces the one open disagreement (weak-host lift: salience vs. accessibility) to be written down as an explicit, testable branch in the document rather than resolved by assumption.

## Collective blind spot

Neither response addresses **multiple-comparisons inflation**. Response-B's own falsification criteria specify "p<0.05" per trigger, and its whole redesign is built around testing three independent trigger classes with individual thresholds instead of one aggregate — but nowhere does either response correct the significance threshold for testing three (or more) hypotheses simultaneously. Running three independent p<0.05 tests without a Bonferroni/Holm-style correction inflates the family-wise false-positive rate to roughly 14%, which means the "per-trigger-class minimum" design both responses treat as a rigor improvement over aggregate-Δ measurement is, as specified, more likely to produce a false "expand" verdict than the single-aggregate-threshold design it replaced. Both responses spend real effort worrying about confounds (session-length, host-capability drift, structure-vs-salience) but neither notices that their own proposed fix for one statistical problem (bundling) quietly reintroduces a different one (multiple testing).

## One-line verdict

Build-to-measure, not build-to-ship — the strongest reason both responses converge on independently is that treating the reminder mechanism as a falsifiable instrument, gated behind a hard kill switch and pre-registered thresholds, is the only design that lets the weak-host salience-vs-accessibility question get answered by evidence instead of by whichever review happened to argue more forcefully.

### Synthesis-2

## Convergence / Divergence

Both council members land on the same binding verdict — **(b') Build-to-measure** — and neither offers a competing recommendation, so on the top-line question the round closed rather than split. The convergence is substantive, not just a shared label: both accept that Position A ("build pilot now, measure after") and Position C ("validate first, then build") are each half-right and half-wrong in the same way — A has the correct instinct that you cannot measure a salience effect without an artifact that injects reminders, but errs by letting that artifact default to a production surface; C correctly refuses to ship on an unfalsified hypothesis but never names the mechanism that would resolve it. (b') resolves the tension by building the eval apparatus only, flag-gated and default-off, with pre-registered expansion/teardown thresholds decided before any data exists — so the measurement instrument and the production feature are never the same artifact, and no rollback-after-user-adaptation cost is ever incurred because production traffic never enters the experimental cohort.

Where the two responses diverge is in depth and in one substantive disagreement about a prior reviewer's claim, not about the destination. Claude/Anthropic's response does most of the design work: it accepts Reviewer A's threshold reasoning (8% lift, 60% margin above the 5% falsification floor; secondary gate requiring Δ≥6% on both strata independently) and Reviewer A's preference for pre-registered kill-switches over retrofitted rollback, but explicitly rejects Reviewer B's framing that trust-boundary/reminder-integrity concerns apply here — arguing that contextual reminders are build-time-controlled template injection within a single process, not externally-sourced messages, so runtime trust-boundary scrutiny is the wrong lens (the caveat given: this would flip if the design ever admitted user- or plugin-supplied reminder templates, which it does not). It also partially disagrees with Reviewer B's rollback critique, conceding B is right that Reviewer A's teardown spec is incomplete (no session-drain policy, no log-retention window) while maintaining that "rollback" is the wrong frame entirely for a flag-gated apparatus whose default state already is rollback. GPT-4o's response is shallower and does not engage with the trust-boundary question at all; it instead sides with Reviewer A over Reviewer B on two narrower points — that Reviewer A's flag-toggle-plus-git-revert rollback is adequate without added complexity, and that Reviewer A's 8% threshold is better calibrated than a proposed 10% figure (a threshold GPT-4o attributes to Reviewer B that does not appear directly quoted in the visible transcript). Neither response contradicts the other's stated verdict or thresholds; GPT-4o's silence on trust boundaries and telemetry design reads as scope-narrower agreement rather than disagreement.

The genuinely new material — and the place still under-specified — comes entirely from the Claude/Anthropic response, since GPT-4o stays at the level of agreeing/disagreeing with Round 1 framing and does not add mechanism. Four points stand out as load-bearing refinements that were not present in the prior round: (1) "weak-host simulation" is ambiguous between instruction-degradation (hamstringing a strong model) and actual weak-model API output, and the response argues these test different hypotheses (adversarial robustness vs. baseline capability gap) and recommends the latter, pre-registered explicitly to avoid an uninterpretable eval; (2) the coarse "state transition detected" trigger conflates high-stakes junctures (PR-merge, deploy) with high-frequency low-stakes ones (task boundaries), and should split into two separately-run arms to avoid confounding frequency with salience; (3) the secondary-gate logic (Δ≥6% both strata) doesn't say what happens when only one stratum shows a strong, significant effect — a decision rule is proposed (partial expansion with stratum-conditional triggering if one stratum clears 8% and the other is non-negative; immediate teardown if either stratum is significantly negative, i.e., an active-harm gate that overrides averaging); and (4) the "0.5 day/quarter" maintenance-cost estimate omits context-switching and documentation-drift cost, mitigated by mandating a ≤2-page runbook as part of the (b') deliverable. These are all refinements layered onto the shared verdict, not challenges to it — the council converged; the remaining work is operational detail, most of which is now specified in the convergence record's YAML block (trigger classes, thresholds, session-drain, log-TTL, revisit triggers) rather than left open.

### Kill criteria

- **Teardown on null**: Δ < 5% compliance lift OR p ≥ 0.10, evaluated over n ≥ 100 sessions per arm — record as "salience gap undetected at 5%" and stop, per both reviewers' shared floor.
- **Active-harm override**: any stratum (long-context-drift or weak-host) showing Δ < 0 with p < 0.05 triggers immediate teardown regardless of the other stratum's result — averaging is not permitted to mask a harmful arm.
- **Ambiguous-deadband default**: Δ in the 5–8% range is recorded as ambiguous and resolves to teardown, not expansion — the deadband does not get the benefit of the doubt.
- **Idle-apparatus sunset**: if the eval apparatus goes unused for 2 release cycles, it is auto-flagged for a teardown review (cost of latent maintenance outweighs an unexercised instrument).
- **Superseding external evidence**: if external research independently demonstrates a salience gap under 2% in comparable production systems, skip straight to teardown without re-running the local eval.
- **Anti-revisit guard**: the convergence explicitly forbids revisiting the verdict on anecdata or a single-session outlier, and forbids expanding to production before the A/B completes even if interim results look favorable — both are named as things that would falsely appear to justify reopening the question but don't.

### Concrete next step

Write the pre-registration document for the A/B eval (trigger-class definitions, the weak-host operationalization choice — actual tier-2 model API output, not instruction-degraded strong model — the expansion/teardown/partial-expansion decision tree, and the session-drain and log-retention policies) as a committed file before any implementation code is written, so the thresholds are locked prior to seeing data.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## tripwire-engine-tiebreak

### Synthesis-1

## Convergence / Divergence

Both members land on the same answer — option (a), SQLite FTS5 via built-in
`node:sqlite` — and neither treats this as a close call. Response-A builds a
detailed economic case (persistence cost only grows past the 200-file
tripwire, incremental re-index beats full re-index, the tripwire is a
commitment device that option (c)'s "punt to a future note" defeats) and then
spends most of its space disagreeing with a *prior-round* Reviewer B position
that is not itself in this file — it rebuts claims about compatibility risk,
ADR-061 coherence, and deployment simplicity that it attributes to that absent
reviewer. Response-B, working from the same prior round, also converges on
(a): it agrees with Reviewer A's persistence-economics framing, and it
explicitly reverses course on the in-memory "superior adaptability" claim it
attributes to Reviewer B, concluding the persistent-storage benefit wins at
tripwire scale. So on the core recommendation, the two responses agree with
each other and both correct the same prior-round objection.

The divergence is not about the answer but about what still needs to be
nailed down before treating the answer as final. Response-A's residual worry
is narrow and operational: if `node:sqlite` FTS5 is unavailable, the fallback
to grep is a *silent* performance cliff, and the fix is a startup warning plus
a re-index-time metric in both code paths — a concrete, checkable ask.
Response-B's residual worries are broader and less resolved: it flags that
rollback/kill-switch criteria back to `bm25_search.ts` in-memory search are
never specified, that trust-boundary clarity on the grep fallback is thin, and
that cross-Node-version staging/testing strategy is undefined. Response-A
treats the FTS5-unavailable path as an observability gap to patch; Response-B
treats it as part of a larger unanswered "what happens when this breaks"
question. Neither response disputes the other's point — they are simply
looking at different altitudes of the same remaining risk: A wants a log line,
B wants a documented reversal path. Both also independently reject the
two-step hybrid (option c) as the weaker choice, for the same underlying
reason: it defers the persistence decision to a moment of delivery pressure
instead of deciding it now, at the tripwire.

### Kill criteria

- The `node:sqlite` FTS5 fallback-to-grep path fires in practice without a
  startup warning or re-index-time metric being emitted — i.e., degraded
  search performance goes unobserved by operators (Response-A's named
  condition for reversing).
- A documented rollback/kill-switch back to in-memory `bm25_search.ts` is
  requested or required and cannot be produced — i.e., the persistence choice
  turns out to be a one-way door with no tested reversal path (Response-B's
  named gap).
- Measured re-index time at 200+ files, or across a tested spread of Node
  versions, turns out *not* to be negligible — this would undercut the
  core economic argument both responses build the recommendation on.

### Concrete next step

Add the `node:sqlite`-unavailable startup warning + re-index-time log line to
the existing FTS5 guard pattern (the one already in `mcp_telemetry_store.ts`),
and pair it with a one-paragraph rollback note stating the exact condition
under which the system falls back to in-memory `bm25_search.ts` search.

## Collective blind spot

Both responses reason entirely about node:sqlite/grep-fallback risk and
startup-cost economics, but neither addresses what happens to the *existing
index* when the underlying files change out from under it between sessions —
i.e., staleness/invalidation of the persisted SQLite index is never
discussed. Response-A's "incremental update" argument (index one new file
when written) assumes an update hook exists and fires reliably; neither
response asks what happens if a file is edited, deleted, or renamed outside
that hook (external tooling, a rebase, a bulk rename) and the persisted index
silently drifts from the corpus it's supposed to describe — a failure mode
that is arguably worse than the "silent grep fallback" both responses do
flag, because a *stale* index returns wrong results with no error at all,
where grep at least returns correct (if slow) ones.

## One-line verdict

Adopt SQLite FTS5 via `node:sqlite`, extending the repo's existing
telemetry-store pattern rather than building a second in-memory system first —
the strongest reason is that the tripwire threshold itself already proves
persistence is needed, so deferring it (option c) only relocates the same
decision to a moment of higher delivery pressure.

### Synthesis-2

## Convergence / Divergence

Both council members converge on option (a) — SQLite FTS5 via built-in `node:sqlite` — as the pre-decided path for the tripwire engine, and neither raises a substantive objection to that choice. Anthropic (claude-sonnet-4-5) gives the fuller argument: the repo already pays the `node:sqlite` runtime-guard tax in production code, so adopting FTS5 adds no new trust boundary, and the incremental index (~100 LOC, trivial `path TEXT, content TEXT` schema) is cheap relative to the two alternatives it explicitly rejects — option (b)'s unbounded re-index cost at scale, and option (c)'s "escalation threshold," which it calls a deferred decision disguised as pragmatism because the threshold is unnameable without reintroducing the very measurement harness the earlier convergence rejected. OpenAI (gpt-4o) agrees with both prior reviewers' preference for (a) and records no disagreement of substance — its only contribution is a risk note rather than a counter-direction.

Where the two responses differ is in depth, not direction. Anthropic surfaces four gaps neither reviewer had caught: (1) FTS5 compile-time availability is not guaranteed by `node:sqlite` alone and needs an explicit `PRAGMA compile_options` check before first write; (2) incremental-update semantics are underspecified — it proposes synchronous backfill on first post-activation query with a progress indicator, accepting a one-time UX cost over stale-result risk; (3) option (c)'s threshold is structurally unnameable because re-index time is load-dependent (file-size distribution, disk I/O, CPU contention), which is the real reason (c) is a trap rather than a mere style preference; (4) the FTS5 index is a derivable cache, not source-of-truth, so the rollback path (delete `search.db`, regenerate on next query) is trivial and lower-risk than either reviewer implied. Anthropic also flags a Node-version sequencing risk: the activation threshold itself must be gated on `node:sqlite`/FTS5 availability, or a sub-22.5 Node user hits the file-count tripwire and silently degrades to grep.

OpenAI's response is thinner and converges without adding the same rigor: it names concurrent-access robustness, non-blocking updates, and disk-I/O monitoring under high load as considerations, and calls out (as Anthropic also does, independently) that neither original reviewer addressed Node-version/FTS5-compatibility risk. There is no real divergence between the two members — OpenAI's list is a subset of concerns Anthropic already covers in more actionable form (Anthropic gives a concrete check and a concrete fallback; OpenAI gives the same categories as open questions). The council is unanimous on the decision; the residual work is implementation detail (the FTS5-availability guard, the sync-backfill UX, and the version-gated activation threshold), not a re-litigation of (a) vs (b) vs (c).

### Kill criteria

- `PRAGMA compile_options` on the target `node:sqlite` build does not report FTS5 support — the pre-decided path assumed compiled-in FTS5; if false on a supported Node version, option (a) needs a fallback design before it can ship as specified.
- Node <22.5 usage is non-trivial among contributors/CI (i.e., the version-gated activation threshold would leave a meaningful population permanently on grep) — this would mean the "deterministic win from activation" framing overstates the actual coverage.
- Synchronous backfill on first post-activation query measurably blocks (e.g., >1–2s) on a realistic >200-file corpus — this would invalidate the "accept the one-time UX hit" design choice and require an async/progress-indicator redesign.
- Index corruption or the delete-and-regenerate rollback fails to restore correctness on a real corrupted `search.db` — this would break the "it's a cache, not source-of-truth" safety claim the convergence relies on.

### Concrete next step

Add the `PRAGMA compile_options` FTS5-availability check (with actionable error message on absence) and the Node-version gate on the activation threshold to the tripwire engine's implementation spec/roadmap entry before writing the indexing code.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## lean-init-primitive-choice

### Synthesis-1

## Convergence / Divergence

All three round-2 contributions converge on Q1: Option B (the evidence-first `rg` primitive) stands. Anthropic's reviewer treats it as settled precisely because the honest-null already killed the alternative — routing to `code_graph` after recording its own 0.365-vs-0.797 recall loss and a permanent-disable consequence would contradict the project's own evidence registry, not open a fresh design question. GPT-4o reaches the same verdict independently, citing the same recall gap as dispositive. No participant argues for Option A or Option C on the merits; Option C is explicitly called "speculative engineering against your own benchmark." Q1 is convergent at the verdict level, but Anthropic's reviewer adds a load-bearing qualifier the others don't: the "≥10 goldens, primitive ≡ agent answer" test silently answers a second question — what "definition" and "reference" *mean* operationally — and if those goldens are agent-generated rather than human-labeled, the test proves consistency, not correctness. That's not a rebuttal of Option B; it's a claim that Option B as currently specified has an unstated dependency (ground-truth source) that needs to be pinned before Phase 1 can be called done.

Q2 converges on the verdict "seeds are defensible, refine via telemetry" but diverges sharply on what gate should sit in front of that refinement. GPT-4o and Round-1 Reviewer B accept "seed now, refine later" essentially as-is, with GPT-4o adding only that budget-exhaustion criteria need to be precise. Anthropic's reviewer takes a harder line and rejects Round-1 Reviewer A's proposed Phase-2 gate ("zero stop-loss trips on the 10-golden set") as internally inconsistent — a zero-trip gate would block exactly the legitimate deep-refactor tasks it claims to worry about, and it's answering the wrong question anyway. The reviewer reframes the actual counterfactual: the 96.8k main-agent baseline isn't what a worker "needs 1.55× of" — it's being compared against a documented four-worker run that burned 1.21M tokens on lookup tasks the main agent handled in 96.8k. Against that number, a 150k high-tier seed is a −87.6% improvement, not a cost-control failure. This produces a second, more consequential fork: what a stop-loss trip on a golden task *means* is undetermined by the current design, because the design has no independent way to tell a misclassified task (routing bug) apart from a correctly-classified task the primitive genuinely can't handle (tool bug). Both failure modes currently look identical in telemetry.

That fork is the crux of the disagreement, and it surfaces a shared blind spot in Round 1 that only the Anthropic reviewer names directly in Round 2: nobody has specified who or what performs the lite/medium/high tier classification, or what its accuracy is. The Phase-2 "any mismatch = routing bug" criterion silently assumes the router is infallible. If it's an LLM, that's an unmodeled single point of failure; if it's regex, it needs a confusion matrix from the Phase-1 goldens before Phase 2's diagnostic logic is trustworthy. This is not a restatement of the Q1 recall gap — it's a distinct, unaddressed risk sitting one layer up from the primitive choice, and it directly undercuts the interpretability of whatever seed-refinement telemetry Phase 2 produces.

The Anthropic reviewer's third point — that "lookup-class" may not be a stable category in a modern TS/JS codebase (conditional exports, dynamic `import()`, build-config-dependent definitions) — is the deepest and least-converged claim in the transcript. No other participant addresses it. It is not yet evidence of failure; it is a falsifiable prediction with a stated test: pull 10 backlog tasks confidently believed lookup-class, run the proposed `rg` patterns, and check whether a human would accept the answer without reading surrounding code. If 2+ of 10 need "yes, but also check the config," the category itself — not just the seed or the primitive — is underspecified. This is the one open question in the transcript that a golden-set run would resolve outright rather than merely inform.

### Kill criteria

- Router classification accuracy on the 10-golden set falls below the threshold set as a Phase-1 deliverable (no threshold currently pinned in the transcript — this itself is a gap to close before the criterion is checkable).
- ≥2 of 10 backlog tasks confidently pre-labeled "lookup-class" require out-of-band context (e.g., "check the build config") that the proposed `rg` patterns cannot surface — falsifies "lookup-class" as a stable, context-free category.
- The 10 Phase-1 goldens turn out to be agent-generated rather than human-labeled with an edge-case rubric — falsifies the claim that "primitive ≡ agent answer" measures correctness rather than mere self-consistency.
- A stop-loss trip on a golden task cannot be attributed to either "misclassified tier" or "primitive failure" via available telemetry — falsifies the Phase-2 diagnostic assumption that mismatches are unambiguously routing bugs.

### Concrete next step

Before Phase 1 is marked ready, pin two currently-unspecified items in the ADR/roadmap text in one edit: (1) the ground-truth source for the 10 goldens (human-labeled with an edge-case rubric, or explicitly downgraded to a "consistency with prior agent behavior" bar), and (2) a stated router-classification-accuracy threshold on that same golden set, so Phase 2's "mismatch = routing bug" criterion has something to check against.

### Synthesis-2

## Convergence / Divergence

Both responses land on the same broad direction — trust the evidence on Q1 (a
recall-backed `rg`-based primitive over the weaker `code_graph` option) and
resist accepting the proposed medium/high token seeds on Q2 as given. That
much is genuine agreement, not surface-level politeness: Response-B explicitly
endorses "Reviewer A" on both questions, and Response-A independently arrives
at an evidence-first posture for Q1 and an evidence-demand posture for Q2. The
convergence is real, but it is convergence on a *direction*, not on a
*design* — and the gap between the two responses is exactly the gap between
direction and design.

Response-A does the work the direction demands: it names a specific residual
risk in each question and resolves it with a concrete mechanism. On Q1 it
does not simply pick "rg" — it revises the verdict to a chained option (rg
primary, `code_graph` hook kept dormant behind a boolean, not deleted), and it
backs that revision with a named failure mode (a better graph-tool showing up
later) and a quantified cost comparison (three lines of dormant code vs. a
full second ADR-and-goldens cycle). It also refuses to accept "structured
rg patterns" as a finished design, producing a concrete counter-example
(property-valued handlers vs. top-level exports) and demanding a pattern-suite
appendix before the primitive is allowed to ship. On Q2 it goes further than
"the seeds are too generous" — it proposes a specific empirical gate
(Phase-1.5 backlog sampling of 50–100 historical medium/high tasks, seed from
observed percentiles, collapse to two tiers if the data doesn't support
three).

Response-B agrees with the same conclusions but stays at the level of
naming categories of concern rather than resolving them: it flags "trust
boundaries and coupling," "rollback criteria," "clearer task-class
definitions," and "future adaptability" as things that *should* be discussed,
without specifying what a rollback trigger would be, what a clear task-class
boundary would look like, or what evidence would resolve the coupling
question. This is the real divergence between the two: not a disagreement
on which primitive to pick, but a difference in whether "evidence-first" is
treated as a slogan to affirm or a set of gates to build. Response-A's
gates are falsifiable and actionable in the next phase; Response-B's
concerns are legitimate but would need another full pass to become
actionable.

There is one substantive point of daylight even within the convergence:
Response-A's Q1 verdict is not the same as the "Option B" both responses
credit to a prior reviewer — it is a refinement (Option C) that keeps a small
dormant hook for the rejected tool. Response-B never engages with that
refinement at all; it stops at agreeing with pure evidence-first rejection.
Whether the dormant hook is worth its complexity is therefore not something
this pair of responses actually settled — only one side of the council
argued it, and it went unchallenged rather than agreed with.

### Kill criteria

- Phase-1 golden validation shows the "structured rg" pattern suite mismatching more than roughly 15% of lookup-class goldens — this falsifies "structured rg" as ship-ready and blocks Q1's chosen primitive until Appendix A is built and re-validated.
- Backlog sampling (the Phase-1.5 step both threads implicitly demand) shows the historical medium/high task token distribution does NOT cluster below the proposed 60k/150k seeds — if the 90th percentile already exceeds the proposed seeds, "seed now, telemetry refines" was under-provisioned, not over-cautious, and the direction converged on here is wrong.
- After shipping, `primitive_route` tasks show a budget-hit rate above roughly 10% or an escalation-to-main rate above roughly 5% — this is Response-A's own falsification trigger for the classifier, not just the seed values.
- A competing graph-shaped tool is demonstrated on the same benchmark with recall materially above the current `code_graph` option — this is the specific event that would justify activating the dormant hook Response-A argues for keeping, and its absence is what currently justifies keeping it dormant rather than deleting it.

### Concrete next step

Build the rg pattern-suite (Appendix A: top-level exports, re-exports,
default-export members, CommonJS `module.exports`/`exports.X` assignments) and
run it against the existing 10-golden validation set now, in this turn —
this is the one artefact both threads' convergence depends on: without it,
"structured rg" is a placeholder, and neither the Q1 verdict nor the Q2
seeding question can be evaluated on real evidence rather than assumption.

## Collective blind spot

Neither response addresses what happens *after* shipping, on the residual
miss-rate the pattern suite will not close. Response-A's counter-example
(property-valued handler objects) makes clear that TypeScript's export
surface has more shapes than any finite pattern suite will exhaustively
cover — decorators, namespace merging, conditional/dynamic exports, and
future syntax will keep producing new misses even after the golden set
passes. Both responses treat recall entirely as a pre-ship gating metric (get
it above some threshold, then ship) and never ask the operationally
important follow-up question: when the primitive *does* miss a match in
production, does it fail loud (surfaces as a routing bug someone notices) or
fail silent (returns an empty/incomplete result the agent quietly trusts as
complete)? A recall number without a stated failure mode for the uncovered
tail is an incomplete safety story — the pattern suite proves the primitive
is good enough to ship, not that a miss will ever be caught once it is
shipped.

## One-line verdict

Ship the evidence-backed `rg` primitive only after the pattern-suite
appendix passes golden validation and the medium/high seeds are set from
observed backlog data rather than assumption — because the council's most
substantive contribution is showing that both of the roadmap's key artefacts
("structured patterns," "reasonable seeds") are currently unvalidated
placeholders dressed as decisions, not evidence-backed designs.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## linter-size-thresholds

### Synthesis-1

## Convergence / Divergence

Both members converge on rejecting the proposal as submitted, and they converge on *why*: raising numeric ceilings to accommodate already-oversized assets treats the current violations as proof of legitimacy rather than as a hypothesis that needs testing. Neither member accepts "we already wrote it this way" as evidence that a 411-line skill or a 1679-word command is *necessarily* that size. Both explicitly credit Reviewer A's Round-1 framing on this point, and both separately land on the same missing piece: the proposal has no rollback/kill-switch criteria and no target exception rate, which the anthropic member traces to Reviewer B's Round-1 critique. So on the meta-question — "is threshold-raising an acceptable first move?" — the two responses are not just aligned, they cite the same upstream reasoning to get there.

Where they diverge is in what they think should replace numeric-only thresholds. GPT-4o stays at the level of principle: call for a structural-evaluation framework (dependency diagrams, modularity metrics), a data-driven empirical study to set baselines, documented criteria for "structural complexity" vs. "size," and contextual categories (orchestration, reference-heavy) that get their own rules. It does not commit to numbers. The anthropic member goes much further and commits to a fully worked counter-proposal: a three-way archetype split for skills (procedural/reference/orchestrator, each with its own warn/strong-warn/error/structural-gate row), a matching three-way complexity split for commands (atomic/sequential/orchestrator), and a wholesale replacement of rule line-count warnings with structural checks (branching depth, section count, numbered-steps-without-routing), backed by a concrete hard ceiling of 100 lines for rules, 650 for orchestrator skills, and 1800 words for commands — explicitly lower than the proposal's 2500-word ceiling, which it calls "wishful thinking." It also raises four points GPT-4o never touches: LLM-context-budget ambiguity (the proposal never says which context window it's optimizing for), a read-time-vs-write-time cost distinction between commands/skills/rules, a call for structured (YAML) delegation metadata instead of prose "see also" references as the gate for large commands, and a specific accusation that several oversized commands (`feature/plan.md`, `project-analyze.md`) are skills wearing a command wrapper.

Both members also disagree with different Round-1 reviewers on different points, but not with each other: the anthropic member pushes back on Reviewer A's *absolute* rejection of any threshold movement (arguing 40% of rules sitting in the 41–60 warning band is itself evidence of miscalibration, just not the kind the proposal assumes) and on Reviewer B's claim that size doesn't correlate with complexity (arguing context-window cost is real even in well-modularized files). GPT-4o pushes back on Reviewer A's insistence on a single fixed numeric ceiling with no room for justified exceptions, and on Reviewer B's implicit assumption that thresholds are inherently punitive rather than preventative. These are secondary disagreements with the Round-1 material, not disagreements between the two Round-2 members — on the core question the two responses read as complementary tiers of specificity (GPT-4o: principle; anthropic: worked implementation) rather than as competing verdicts.

The clearest residual tension is scope of ambition. GPT-4o's four "new points" (structural evaluation, data-driven adjustment, documentation, contextual classes) are essentially satisfied by the anthropic member's proposal — but the anthropic member's specific numbers (300/400/500 for procedural skills, 100-line hard cap for rules, etc.) are exactly the kind of un-validated numeric claim GPT-4o's "empirical study first" stance would flag as premature. In other words, the anthropic member proposes the structural framework GPT-4o asks for, then immediately fills in numbers GPT-4o's own methodology says shouldn't be set without the empirical study running first. That's not a contradiction so much as an unresolved sequencing question the council didn't get to interrogate in a further round.

### Kill criteria

- If a post-implementation audit finds that assets classified as "reference" or "orchestrator" under the archetype split are, on inspection, indistinguishable in editing/reasoning difficulty from "procedural" assets of the same length, the archetype-based tiering is falsified — length alone was the right axis after all.
- If the 100-line hard cap for rules forces splitting of assets that empirically show *no* review-time or comprehension improvement after being split (i.e., splitting a verbatim-policy kernel rule into two files makes it harder, not easier, to audit), the rule-structural-checks-only proposal is falsified for that asset class.
- If, after running the proposed Phase 1 "shadow mode" (log-only, non-blocking) for the stated measurement window, the false-positive rate on "reference skill too large" warnings is not measurably lower than today's baseline, the archetype classification isn't doing the discriminating work claimed for it.
- If no one produces the "3 commands at 1400–1800 words where a split attempt failed due to tight coupling" evidence the anthropic member names as the condition that would change its mind, the burden-of-proof default (reject threshold increases absent proof of irreducibility) should stand as-is, unrevisited.

### Concrete next step

Run the Phase 0 triage the anthropic member specifies: for every currently over-threshold skill, command, and rule, tag it `[reference|orchestrator|procedural|misclassified|legacy_debt]` and, for commands over 800 words specifically, record whether its content should instead live in a skill — producing a single triage table as the artefact that either supports or undercuts the proposal's premise before any threshold number is touched.

### Synthesis-2

## Convergence / Divergence

Response-A and Response-B converge on the same bottom line even though they arrive at very different depths of detail: **do not relax the size thresholds, especially the command-size limit.** Both treat the proposal's core evidence — 5.9% of skills over threshold, 9.5% of commands over threshold, 12% of rules over the 60-line warn — not as proof that the thresholds are miscalibrated, but as a signal that specific artefacts (orchestrator-shaped commands like `council/default.md`, reference-shaped skills like `quality-tools`) are in the wrong category. Response-A states the pushback compactly: orchestrator commands that exceed the limit indicate "a structural problem" and should be refactored into skills or a different architecture, not accommodated by raising the ceiling. Response-B develops the identical instinct into a full mechanism: six command categories (generator, orchestrator, planner, analyzer, reviewer, importer) each needing a different structural rule, a reframing of "kernel rule" as a lifecycle property rather than a size property, and a proposed decomposition of `ai-council` into middleware + orchestration files as a worked example of what the forcing function is supposed to produce.

Both also converge on rejecting the proposal's due-diligence gap: Response-A flags "rollback / kill-switch criteria" as missing (agreeing with a round-1 reviewer on this point) and separately faults the proposal for treating "increase thresholds across the board" as a decision rather than an open question needing per-artefact evidence. Response-B makes the same objection sharper: the proposal's own two open questions ("who pays the context tax" and "kernel rules can be longer") are each, on inspection, already answerable from the artefact structure itself (frontmatter shows skills/commands/rules are already selectively retrieved, not injected wholesale; "kernel" tracks precedence and disableability, not line count) — so the proposal's request for more data is itself evidence that the underlying categorization was never done.

The divergence is in ambition and mechanism, not direction. Response-A stays at the level of naming missing considerations — module coupling across trust boundaries, a feedback loop that routes threshold-crossing artefacts to a redesign review rather than a size bump, evaluating whether `ai-council`-like orchestrators are even necessary in their current form — without specifying how any of that would be implemented or enforced. Response-B commits to concrete, testable mechanisms: category frontmatter (`category: kernel`, `precedence: 1`) with linter checks that kernel rules must be *more* concise rather than exempted; a `## TL;DR` requirement for rules over 60 lines; a `composition:` frontmatter escape hatch for skills over 300 lines; and a specific pilot (extract `quality-tools` from 411 lines of prose into a YAML data file plus a thin selection skill) as proof-of-concept before generalizing the pattern. Response-B also explicitly rejects the "2-week spike for historical size-over-time data" that a round-1 reviewer proposed, arguing the git-history angle is a lagging indicator when the artefact names and structure are already a leading indicator — and substitutes a 48-hour categorical audit (classify each flagged artefact by category and decomposition-viability) instead. Response-A does not take a position on the spike-versus-audit choice at all, which is the one place the two responses are silent on each other rather than aligned.

### Kill criteria

- If a 48-hour (or equivalent) categorical audit of the flagged artefacts finds that a majority (roughly 5 of 7 rules over 60 lines, or a comparable majority of the 8 skills over 300 lines / 9 commands over 1000 words) are single-purpose, non-decomposable, and already at minimum viable size for their content — the "this is a categorization problem, not a threshold problem" thesis is falsified, and a genuine, evidence-backed threshold adjustment (not a blanket relaxation) becomes the right move.
- If the proposed structure linters (command `category:` frontmatter, rule `## TL;DR` requirement, skill `composition:` declaration) ship and, after a fixed adoption window, authors are not populating them — compliance stays near zero on new or edited artefacts — the "enforce categories instead of relaxing size" bet is falsified; category-based linting is unenforceable in practice and a different lever (including possibly threshold relaxation) needs reconsideration.
- If the `quality-tools` extraction pilot (prose skill → YAML data + thin selector skill) fails to shrink the skill below the target ceiling while preserving functional coverage, the "size warnings are mostly extractable-data-in-disguise" pattern is falsified for reference skills, and the data-extraction recommendation should not be generalized to `traefik` / `pest-testing` as planned.

### Concrete next step

Produce the categorical-audit table both responses converge on needing: for each of the 8 skills over 300 lines, 9 commands over 1000 words, and 7 rules over 60 lines, add a row classifying (a) its inferred category (e.g. orchestrator / generator / analyzer for commands; reference / procedural for skills; kernel / non-kernel for rules), (b) whether it is disableable / has elevated precedence (rules only), and (c) a one-line judgment on whether a size-legitimizing structure (delegation section, TL;DR, composition frontmatter) already exists or would need to be authored. This is the artefact the audit both responses call for, and it is what any subsequent threshold decision — relax, hold, or split into per-category limits — would need to cite as its evidence.

## Collective blind spot

Both responses treat the *current* thresholds (300 lines / 1000 words / 40–60 lines) as the sound baseline to defend, but neither asks where those specific numbers came from or whether they were ever empirically derived in the first place. Response-B goes so far as to call them "well-calibrated" purely because the flagged tail is small (5.9%–12%), which is exactly the kind of distribution-shape argument it criticizes the original proposal for making in the other direction. Neither response considers that the current limits could be just as arbitrary as the proposed new ones — only older and therefore assumed correct by incumbency. Relatedly, neither response weighs the maintenance cost of the enforcement machinery it is proposing instead of a threshold bump: six command-category linters, kernel-rule precedence checks, and composition/TL;DR frontmatter are themselves new surface area that someone has to keep in sync as categories drift — a governance burden that could rival or exceed the "warning fatigue" both responses are trying to avoid.

## One-line verdict

Both council members converge on rejecting the threshold-relaxation proposal because the oversized artefacts are evidence of miscategorized structure (especially orchestrator commands) rather than miscalibrated limits — but neither questions whether the thresholds they're defending were ever verified either, which is the same unverified-assumption failure they diagnose in the proposal.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## install-path-convergence

### Synthesis-1

# Chairman Synthesis — Install-Path Convergence (Round 2)

Two independent reviewers weighed in on this round, and they converge on the diagnosis while diverging sharply on the prescription.

Both reviewers accept, without qualification, three of the prior round's critiques: (1) the design's Q2 auto-uninstall option crosses a real trust boundary — a plugin the user installed is user-owned state, and removing it without explicit, informed consent is a constraint violation, not a caveat; (2) the design has no rollback or kill-switch story for any of its proposed mutations, and both treat this as a blocking gap rather than a nice-to-have; (3) the Q4 runtime self-detection mechanism (a SessionStart probe) is risky on its face — it trades a standing, always-on mechanism for a benefit that hasn't been measured, and both reviewers want evidence before it ships in that form.

Where they diverge is in how far that agreement should push the overall verdict. The Anthropic reviewer treats the convergence above as proof that the *entire* active-mechanism family (bootstrap plugin, auto-cleanup, per-tool matrix, runtime detection) is incompatible with the stated constraints — "no destructive action without consent," "zero runtime daemon," "single maintainer, fewest standing mechanisms" — and concludes the design should be rejected outright as over-engineered. In its place it proposes a specific alternative architecture: convergence as a *data-model invariant enforced at write time*, not a runtime behavior. Concretely: `setup` fails fast when a second surface already exists (reject, don't fix); `doctor` describes duplicate state and prints remediation without acting; the marketplace plugin channel is tombstoned (listing kept alive, content replaced by a README-only pointer to the npx path) so it cannot manufacture new duplicates by construction. It backs this with genuinely new arguments not present in the other response: a "channel taxonomy" reframing that dissolves the 23-tool matrix into an O(1) problem (only tools with more than one install channel need a convergence decision at all — currently one confirmed, one suspected, not 23); a challenge to the unexamined assumption that npx-projection is always canonical (corporate/air-gapped environments may structurally prefer the plugin, so "converge" and "retire the plugin" are being treated as synonyms when they're separable decisions); a zero-cost detection alternative that piggybacks on existing skill dispatch instead of a new SessionStart probe; and a quickstart compatibility matrix (fresh / plugin-only / projection-only / duplicate) that the design doc currently leaves unspecified despite the "30-second wedge" being sold as a stability guarantee.

The OpenAI/GPT-4o reviewer reaches a materially softer verdict from the same starting agreements. It explicitly declines to reject the bootstrap-plugin and unified-matrix approaches outright, arguing each could be viable "if proven stable through rigorous testing" or "if it includes adaptability for each tool" — treating the missing evidence as a gap to fill rather than a disqualifying property of the mechanism itself. Its new contributions are almost entirely procedural rather than architectural: a decision matrix scoring each open question on user impact / effort / reversibility / maintenance burden, a more detailed (but still unspecified) consent-documentation requirement, a phased tool-by-tool rollout with pilots, and a call for user research into why people choose one install channel over another. None of these propose a concrete alternative mechanism; they ask for more process wrapped around the same four active mechanisms the design already contains.

The real fork, then, is not about the facts (both reviewers see the same trust-boundary gap, the same missing rollback, the same risk in Q4) but about what those facts license. One reviewer treats the constraints as already having settled the architecture — anything requiring "agent-config acts on the user's install" is out, full stop, until specific evidence thresholds are met — and offers a fully-specified passive alternative today. The other treats the constraints as a checklist of concerns to be mitigated through better process (frameworks, docs, pilots, comms plans) while keeping the active mechanisms on the table. Given that this package explicitly operates under a Hard Floor against unconsented mutation of user-owned surfaces and a stated preference for the fewest standing mechanisms a single maintainer can carry, the harder line is the one consistent with the package's own declared constraints — the passive/fail-fast/tombstone design is not a compromise position, it's the position the constraints already imply, and it ships today rather than after a research program.

### Kill criteria

- **Passive convergence measurably fails at scale**: more than ~20% of new or existing installs end up in a duplicate-surface state *despite* `setup` rejecting duplicate-creating operations (i.e., users are bypassing `setup` entirely — manual installs, stale doc copy-paste). This would mean fail-fast-at-write-time isn't reaching the population that matters, and runtime or in-band detection needs reconsideration.
- **A stable delegation protocol appears**: the marketplace plugin channel ships a manifest or mechanism that lets it declare "I delegate my own removal to npx @event4u/agent-config," and that mechanism is verified stable across the plugin host's own versioning. This removes the trust-boundary objection to auto-cleanup and reopens Q2.
- **Skill-dispatch nudges are tried and underperform**: if the zero-cost, dispatch-time duplicate nudge (proposed above) is implemented, measured, and shown to move fewer than half of duplicate-holders to run `doctor` within a defined window, that is evidence the "users who never run doctor" problem is real and larger interventions (including forms of Q4) need re-examination.
- **Channel-distribution data contradicts the npx-primary assumption**: if telemetry or proxy measurement (e.g., `doctor` runs on plugin-only installs) shows a large minority of users are structurally blocked from npx (corporate proxy, air-gapped), "converge to projection" stops being a cleanup and becomes a breaking migration for that cohort — the co-equal-channel design needs to be revisited.

### Concrete next step

Draft (as a short ADR amendment or a revision to the existing design doc) the passive architecture the Anthropic review specifies in full: `setup` fails fast on an existing competing surface, `doctor` becomes inform-only with exact remediation commands, and the Claude Code marketplace plugin is tombstoned to a README-only pointer — including the quickstart compatibility matrix (fresh / plugin-only / projection-only / duplicate → behavior → outcome) as an explicit acceptance table, and explicitly deferring Q1 (bootstrap plugin), Q2(a/b) (auto-cleanup), Q3 (per-tool matrix), and Q4 (runtime self-detection) pending the kill-criteria evidence above.

### Synthesis-2

## Convergence / Divergence

The two responses converge on the two load-bearing rejections and diverge sharply on depth and on one architectural bet.

**Where they agree, cleanly:** Both reject immediate, unconditional auto-cleanup (Q2a) on trust-boundary grounds — a user may have deliberately installed two surfaces, and removing one without explicit, informed consent violates the "no destructive action without consent" floor. Both also independently flag the proposal's missing rollback/kill-switch story as a required deliverable, not a nice-to-have: if `upgrade` runs a cleanup step and the user wanted what got removed, there is currently no undo.

**Where they diverge, sharply:** Response-A treats this as a full architectural redesign pass — it adopts a prior reviewer's (external, not shown here) sequencing critique wholesale, argues the per-tool matrix (Q3) is a hard blocking dependency rather than a parallel question, and produces a five-phase revised plan with concrete YAML schemas, a `hooks_verified()` pseudocode check, a consent-storage decision tree (settings key vs state file vs flag), a bootstrap-as-telemetry-honeypot proposal, and an evidence-gated re-litigation of auto-cleanup at Phase 4. It explicitly disagrees with the (unseen) "delist over bootstrap" recommendation, arguing a silent 404 six months from now is a worse failure mode than a stale-but-self-updating bootstrap shim, provided the shim always points at `@latest` rather than a pinned version.

Response-B, by contrast, stays at the level of a short reaction memo: it agrees with the same two points, disagrees with the same delist-vs-bootstrap tension (calling bootstrap potentially "elegant... if designed correctly," but without engineering detail), and adds four new concerns — a user-facing preference center for consent, phased logging-before-nudging, unspecified "security protocols" for automated actions, and a survey-based user-intent-gathering step. None of Response-B's additions are specified to executable detail; they name categories of concern rather than closing them.

The substantive disagreement worth flagging to the user is not between the two responses shown here — it's that Response-A stakes out a specific, falsifiable position (bootstrap over delist, with a 12-month sunset gated on install-rate telemetry <5% of peak) while Response-B treats the same fork as still genuinely open and defers to "further insights into user behavior." Only one of these can be the plan; the other is a hedge dressed as analysis.

### Kill criteria
- If Claude Code's plugin registry has historically maintained ≥99.9% uptime (per Response-A's own stated reversal condition), the case for bootstrap-over-delist weakens substantially — a 404 becomes rare enough that the added coupling/maintenance cost of a bootstrap shim may not be worth it.
- If the Phase-0 tool-matrix audit (once run) shows zero tool-specific variance in duplicate-surface behavior across the first several tools checked, the claimed sequencing dependency (Q3 gates Q1/Q2/Q4) is falsified and the original parallel-questions framing was fine.
- If telemetry from a diagnostic-logging-only phase shows that manual cleanup (`--converge` flag usage) already exceeds 50% of duplicate-surface sessions, the entire evidence-gate-before-cleanup sequencing argument loses its premise — users are already self-resolving without intervention.

### Concrete next step
Draft the Phase-0 tool-matrix verification schema (the YAML shape in Response-A §3.1) for exactly two tools — Claude Code and Augment — and commit it as a tracked file, since both responses agree these are the only two tools where convergence behavior is currently known or suspected to be broken.

## Collective blind spot
Neither response questions whether the underlying premise — that "duplicate surfaces" are inherently a problem requiring a resolution mechanism at all — has been validated with real user reports. Both accept the frame that convergence/cleanup tooling is needed and argue only about *how* (sequencing, consent storage, telemetry, rollback), never *whether* the support burden or confusion rate justifies building any of this machinery before at least one real support ticket or GitHub issue documents actual user harm from having two surfaces installed. Response-A gestures at this once ("counter-evidence that would change my mind: demonstrated harm... not just accidental duplicates") but then proceeds to design five phases of infrastructure anyway, without first checking whether that evidence already exists or is cheap to gather before any code is written.

## One-line verdict
Both responses agree cleanup must never be automatic-and-unconsented and must ship with rollback — but only Response-A commits to a specific, falsifiable answer (bootstrap-over-delist, evidence-gated) while Response-B's additions remain unexecuted categories, so the strongest single reason to prefer Response-A's shape is that it is the only one of the two that could actually be implemented from what's written.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## weak-host-lift-default-and-tiering

### Synthesis-1

## Convergence / Divergence

Both Response-A and Response-B are reacting to a prior Reviewer-A/Reviewer-B round (not itself included in this artifact) on a design for weak-host "lift" rule loading and tiering, and both land on the same headline verdict: **not greenlit**. They converge tightly on five points: the evidence base (n=24 pairs, 2 tasks, no confidence intervals, Claude-only) is too thin to justify a permanent default or API shape; automatic host-strength gating — the package inferring whether the host model is "weak" and silently changing its own behavior — is a trust-boundary violation, not merely an operational risk; the choice between sysprompt-injection and the thin projector must be resolved before settings shape is finalized, because it changes what the measured cost factor even means; the design has no rollback/kill-switch mechanism; and the document itself reads as a list of options awaiting a decision rather than a decision document.

Where they diverge is in rigor and posture, not direction. Response-A takes the harder line and defends it with a distinct argument: host selection is a *revealed preference* signal (a user who chose Haiku chose a cost/quality tradeoff), so the package overriding that choice via inferred gating is presumptuous regardless of accuracy. Response-A's prescribed shape is strictly binary and opt-in-only (`{ loadLiftRules: boolean, default: false }`), with tool/user ownership, and it names a specific bar for reversing that stance: user research showing (a) users on weak hosts don't know it, (b) they won't act on a boolean setting even when prompted, and (c) tool vendors refuse to set the default — all three, not just one. Response-B is more permissive: it explicitly disagrees with a strict binary and proposes keeping a non-binary shape (`minimal | lean | full`) as long as the default is conservative, and it reframes the host-strength-ownership problem as something to hand to tool vendors rather than resolve architecturally. Response-B's contribution is thinner overall (roughly a quarter the length, largely restating rather than extending the prior round) but adds two forward-looking items neither Response-A nor the prior round names explicitly: a telemetry/analytics mechanism to measure real-world impact of any shipped tier, and a documentation/education obligation for tool vendors and users about what tiers mean.

Response-A is substantially the more load-bearing response and surfaces six concrete defects that Response-B never touches: (1) the shipped `balanced` profile is measured useless (Δ≈0, high cost) yet still shipped with no deprecation plan — a live production-correctness bug, not a design nit; (2) a "cost is behaviour, not context size" finding — rule content can change agent turn-taking, so token-cost factors (3.3×, 11.7×) are task-distribution-dependent and won't generalize; (3) a concrete model-naming staleness failure mode (a future `claude-haiku-5` with Sonnet-class capability silently mis-gated) together with the actual fix an env-var escape hatch (`AGENT_LIFT_RULES=on|off`) that the design currently omits; (4) a second, harder evidence gate beyond the full-corpus requirement: cross-vendor replication (at least one non-Claude weak model showing lift, plus one strong model confirming null lift), since the current n=24 is Haiku-only and "weak host" as claimed is actually just "Haiku's behavior"; (5) a namespace-collision risk in reusing `router.json`'s `minimal|balanced|full` profile vocabulary for the new runtime consumer setting — two different concerns (compile-time content selection vs. runtime loading) sharing names, worsened by "balanced" now being known-broken; and (6) missing threat-model and compatibility-matrix sections entirely absent from the document, covering metered-billing misfires, misleading fine-tune names, and vendor-naming churn.

Read together, the two responses converge on rejecting the document as-is and on the shape of the missing evidence (bigger corpus, explicit opt-in, kill-switch), but only Response-A turns that rejection into an actionable, falsifiable gate list; Response-B's disagreement (allow a graded `minimal|lean|full` tier) is asserted, not argued, and its "push responsibility to tool vendors" proposal does not address how tool vendors are supposed to independently arrive at the same "weak host" classification the design is trying to avoid encoding statically.

### Kill criteria

- **Cross-vendor null:** a non-Claude weak-class model (e.g. GPT-4o-mini, Gemini-Flash) run on the same task family shows no lift, or shows lift with a confidence interval that does not overlap the Haiku result — falsifies "weak host" as a general category rather than a Haiku-specific artifact.
- **Corpus-scale null:** the full 30-task corpus at n≥50 per arm produces a discipline-lift confidence interval that includes zero — falsifies that the n=24 finding was real rather than noise.
- **Mechanism confound:** once the sysprompt-injection vs. thin-projector question is resolved, re-measuring the same tasks under the *actual* shipped mechanism shows a materially different cost factor (e.g. outside roughly 2×–5×) than the 3.3× currently quoted — falsifies the cost claim used to justify tiering.
- **Support-burden signal:** any user-reported issue tying a cost spike to the `balanced` profile before a deprecation notice ships — falsifies the assumption that the buried finding is low-urgency.
- **Model-naming drift:** a new model release matching an existing weak-host name heuristic but demonstrating strong-host-class capability (or vice versa) before an override mechanism exists — falsifies the safety of shipping name-based gating without an escape hatch.

### Concrete next step

Draft and commit an ADR (or design-doc revision) that pins the settings shape to Response-A's binary, explicit-opt-in form — `{ loadLiftRules: boolean, default: false }`, no auto-gating — and lists the three-part evidence gate (full-corpus n≥50 on Haiku with CI excluding zero, at least one non-Claude weak-host replication, and one strong-host null confirmation) as the acceptance criteria for ever flipping the default; this converts the current round-2 "list of options" into the single convergent decision both responses say is missing, and gives the next review round something concrete to either approve or falsify.

## Collective blind spot

Neither response questions whether "discipline" — the metric the entire design optimizes for — is even the right outcome to measure, only whether it is well-defined and whether the sample size behind it is adequate. Both treat "does the lift rule increase discipline" as the settled question and argue only about evidence quantity and governance; neither asks whether a lift that improves "discipline" (scope-bounded completion) might trade off against something unmeasured — task success rate, user-perceived latency, or false-positive over-caution on weak hosts that are weak for reasons unrelated to the scope/downstream trap family this evidence covers. A design that ships a behavior-changing rule on the strength of one metric, however well-measured, without a stated companion metric it must not regress, can pass every evidence gate in this synthesis and still be a net loss on the axis nobody checked.

## One-line verdict

Not greenlit: the document asks reviewers to converge on a settings shape before resolving whether the package should be inferring host capability at all, and Response-A's revealed-preference argument — that overriding a user's already-chosen model with inferred gating is presumptuous regardless of measurement quality — is the strongest reason no version of this design should ship until that boundary question is settled independently of the evidence-size problem.

### Synthesis-2

## Convergence / Divergence

Both council members land on the same architectural skeleton, and neither
disputes the core factual claims carried over from Round 1 (staleness of any
model→tier mapping, the un-isolated lift attribution, the absent rollback
gate, the unresolved thin-vs-eager question). Where they diverge is direction
and risk tolerance on exactly one axis: what happens when the host model is
unrecognized.

**Where they converge.** Both members reject a purely heuristic or
purely-table-driven host-strength gate as too brittle for a multi-vendor,
fast-moving model landscape — heuristics ("`gpt-4*` = strong") go stale the
moment a vendor ships a new tier under an old name, and a static mapping
table rots on the same clock. Both treat the "full" (~12x) tier as an
unproven, not-yet-justified default and agree it should ship opt-in at most,
gated behind real evidence rather than the "pending evidence" hand-wave in
the original document. Both explicitly want a simpler, more legible settings
surface than the original doc's undecided on/off-vs-tier-enum-vs-profile
question, and both want documentation/evidence discipline (published
benchmark numbers, explicit claims) rather than an implied default backed by
n=24 on two tasks. Anthropic's response goes considerably further in
substance — it proposes a concrete three-value `lift_tier: auto|always|never`
enum, a confidence-scored runtime capability probe with a small fallback
table, a full phased rollout with numbered evidence gates (0–4), a forcing
resolution to retire the dead `balanced` profile outright rather than
re-cut/rename it, and a new methodological point neither reviewer raised in
Round 1: the vanilla-vs-kernel-dc cost comparison may be confounded with raw
context length rather than content, and needs a vanilla+placebo control to
rule that out. It also raises the archetype-generalization problem — the
current n=24 evidence spans only one of five task archetypes ("scope/downstream
trap family"), so a corpus-wide mean masks whether the lift is real everywhere
or concentrated in one shape of task; a blended default computed naively could
overstate expected lift by roughly 5x. OpenAI's response is comparatively
thin — it restates agreement with prior-round critiques (staleness, testing
gaps, evidence-gate necessity, thin-vs-eager measurement) and volunteers three
new but underdeveloped points (vendor-neutral design, user overrides,
staleness-mitigation strategy) without operationalizing any of them into a
concrete mechanism, threshold, or rollout step.

**Where they diverge.** The one substantive fork is the default direction for
an *unrecognized* host model. Anthropic's own recommendation (§4.2) sets
default-to-`never` (assume strong, no lift applied) on low-confidence
classification, reasoning that unverifiable lift shouldn't be auto-enabled at
3x cost — but then immediately dissents against its own call in §5, arguing
that default-`never` silently fails the package's actual value proposition
(discipline) on exactly the models that most need it, with no visible error
at default log verbosity. It proposes `default-ask` as the principled
alternative but concedes this conflicts with the original doc's "no wizard"
constraint, landing on default-`never` as merely the "least-bad" option under
that constraint, provided the failure is surfaced at ERROR (not INFO) level.
This is a genuine, acknowledged-as-unresolved tension inside a single
member's argument, not a full team split — but it is real and load-bearing:
it determines whether new/unknown weak models get lift by default or require
active user intervention to get it at all. OpenAI does not take a position on
this fork; its "fallback and override options" point gestures at the same
territory but never states a default. There is also a secondary,
lower-stakes divergence on the `full` tier: OpenAI argues for keeping it
opt-in indefinitely as flexibility, whereas Anthropic wants it timeboxed —
shipped as `experimental_full_load` with an explicit deprecation date (removed
in v3.0 unless a named evidence gate passes) rather than kept as permanent
unlabeled optionality.

Net: the council converges on architecture (three-value enum, capability
probe over static table, evidence-gated phased rollout, retire `balanced`,
timebox `full`) with only one member (Anthropic) actually specifying the
mechanism in enough detail to implement, and it converges on a genuine but
narrow point of unresolved risk (unknown-model default direction) that is
better described as an open dissent than a disagreement between members —
both would prefer `default-ask`, both are blocked from it by a "no wizard"
constraint neither response was able to relitigate within these two turns.

### Kill criteria

- **Placebo control gap not closed.** If the vanilla-vs-vanilla+placebo arm
  is never run (or, when run, shows kernel-dc ≈ vanilla+placebo, e.g. within
  ~0.1 lift), the claimed content-attributed lift collapses to a raw
  context-length effect — the entire tier ladder becomes moot (just inject
  filler tokens instead).
- **Archetype segmentation shows lift is localized.** If the 30-task ×
  weak-host run segments lift by archetype and fewer than 3 of 5 archetypes
  show p<0.05 lift, a corpus-wide `auto` default is not justified — the
  blended mean overstates real-world benefit.
- **Probe accuracy fails the stated bar.** If the capability probe scores
  below ~95% agreement against the 20-model (10 strong / 10 weak) held-out
  set, or produces >5% false-negative (weak-classified-as-strong) misses on
  models released after the training cutoff, ship the fallback table instead
  of the probe (per Anthropic's own §6 dissent) — shipping a sub-95%-accuracy
  auto-gate generates more support burden than the automation saves.
- **Thin-lift does not replicate eager-lift.** If thin-lift (lazy-loaded
  downstream-changes + scope-control) comes in at ≥2x cost or <90% of
  eager-lift's measured +0.458 lift, thin projector should be deleted rather
  than kept as a "someday" default — eager remains the shipped mechanism.
- **Unknown-model default silently fails in the field.** If Phase-1 telemetry
  shows unknown-model users are not manually overriding `lift_tier` at a
  material rate (Anthropic's own bar: <30% self-correct), `default-never` is
  quietly starving the package's own value proposition on exactly the hosts
  that need it, and the ERROR-level warning is not sufficient mitigation —
  this reopens the unresolved dissent in §5/§6 rather than confirming it as
  settled.

### Concrete next step

Run the vanilla vs. vanilla+placebo vs. kernel-dc three-arm comparison on the
existing two pinned tasks at the existing n=24 (no new task authoring, no new
host access required — it re-uses the current harness and pinned corpus) and
publish the three numbers side by side. This is the cheapest artefact that
either confirms the lift is content-attributed (unblocking the rest of the
gate sequence as designed) or falsifies the entire premise (vanilla+placebo ≈
kernel-dc), and every other gate in the converged plan (archetype
segmentation, thin-vs-eager, probe accuracy) is downstream of knowing which
of those two worlds is true.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

## secret-hygiene-guardrail

### Synthesis-1

## Convergence / Divergence

Both responses land on the same architectural core, but at very different resolutions. Response-A, doing a full Round-2 re-review, converges with the (unseen) Round-1 reviewers A and B on three load-bearing points: the hook and the rule enforce at different trust boundaries and must both exist rather than being framed as alternatives; a from-scratch TypeScript secret-detector risks reimplementing gitleaks and should be scoped down to a last-resort fallback, not a primary engine; and the build order should start with a standalone, testable CLI tool before wiring anything into a hook, because a detector library embedded directly in a hook has no testable surface on its own. Response-B, in a much shorter pass, agrees with the identical three points — trust-boundary separation, gitleaks-over-reimplementation, and CLI-first sequencing — and also converges with Response-A in preferring a dedicated new rule for secret detection over overloading an existing rule.

Where they diverge is less about conclusions than about depth and rigor. Response-A does the actual adjudication work the "synthesis" role requires: it takes explicit disagreement positions (rejecting Reviewer A's ">30% of consumers" evidence bar as backwards burden-of-proof for a fail-safe, rejecting Reviewer B's "both inline markers and allowlist file" as unjustified mechanism duplication, rejecting "optional shell-out to gitleaks" as architecturally muddled), and it surfaces seven genuinely new issues no one else raised — a kill-switch specification, agent-assisted-write cross-layer messaging, binary-secret detection, entropy as a false-positive trojan horse, multi-secret reporting UX, rotation-verification gaps, and a test-fixture escape hatch. It then compiles all of this into a concrete phased roadmap with acceptance criteria per phase. Response-B does none of this analytical work: it restates the prior reviewers' points as agreement/disagreement bullets, adds four thin one-line "new points" (bypass clarity, telemetry, standards alignment, binary/perf handling) without developing any of them, and offers no phasing, no acceptance criteria, and no resolution of the one substantive disagreement it names (TS-detector-first vs. gitleaks-first) beyond restating Reviewer A's side. The two responses are not in tension on substance — B's positions are a strict subset of A's, expressed without A's depth — so the "divergence" here is a divergence in analytical thoroughness and actionability, not in direction.

The one place a real judgment call remains open across both is the detector strategy itself: Response-A's specific compromise (gitleaks required with fail-loud-if-missing, plus a narrow ~10-pattern TS fallback for transient failures, explicitly labeled reduced-coverage) is a genuine synthesis position that neither Round-1 reviewer nor Response-B actually stated in that form — B gestures at "fallback conditions if consumers show restrictions" but never commits to gitleaks-required as the default. That compromise is the most load-bearing unresolved design choice in the whole review chain, and it currently rests on Response-A's judgment alone, unconfirmed by independent agreement from B at the same level of specificity.

### Kill criteria
- If a consumer-environment survey shows >30% of target repos cannot install a system binary (e.g., locked-down CI runners, no package-manager access), the gitleaks-required default should flip to TS-detector-primary — re-evaluate the whole detector-strategy decision.
- If telemetry (once shipped) shows fewer than 5 inline `# secret-allow` markers added per repo on average, the deferred centralized allowlist-file phase should stay cut; if telemetry shows more than ~50 per repo, that phase should be pulled forward.
- If hook latency on a 10MB staged diff exceeds 5 seconds in real measurement, the CLI-first/hook-second phasing assumption (that performance is a solvable Phase-1 concern) is falsified and needs redesign before Phase 2 ships.
- If "gitleaks not found" errors appear in fewer than 10% of real hook invocations once telemetry exists, the TS-detector-hardening phase (Phase 6) should stay deferred indefinitely rather than scheduled.

### Concrete next step
Write the Phase-0 decision table (the five rows: Hook-vs-Rule split, bypass/kill-switch mechanism, detector strategy, false-positive control, phase ordering) as a standalone decision document the user can review and approve line-by-line before any code is written — Response-A's table is ready to be transcribed into that document essentially as-is.

## Collective blind spot
Neither response — despite Response-A's unusual depth — addresses who is accountable for keeping the TS fallback detector's pattern list current as providers rotate key formats (Anthropic, OpenAI, AWS, GitHub, Google key prefixes/shapes change over time without notice). A fallback detector that silently goes stale is arguably worse than no fallback, because it creates false confidence ("the guard would have caught it") exactly in the transient-failure scenario it exists to cover. No maintenance/update cadence, ownership, or staleness-detection mechanism is proposed by either response.

## One-line verdict
Response-A is the substantively useful synthesis — it adjudicates the actual disagreements, surfaces seven new load-bearing gaps, and produces an implementable phased roadmap — while Response-B, though directionally aligned, restates rather than resolves and would leave the design unimplementable on its own.

### Synthesis-2

## Convergence / Divergence

Both Round-2 responses land on the same side of every load-bearing question Reviewer A raised, and neither breaks new ground that contradicts the other — the council converges on a single direction, with anthropic/claude-sonnet-4-5 doing the work of turning that direction into a concrete, gated build plan and openai/gpt-4o affirming the same conclusions at a lighter level of detail without itself producing a full design.

On architecture, both members accept Reviewer A's trust-boundary split: agent-writes-a-file and human-commits-to-VCS are different enforcement problems with different guarantees, and the design should not conflate them. Sonnet operationalizes this directly — PreToolUse hook on `WriteFile`/`PatchFile` as the enforceable Phase-1 boundary, a pre-commit git hook deferred to a conditional Phase 2, and a behavioral rule demoted to "guidance, not enforcement" (a new point sonnet adds explicitly: the rule reduces how often the hook fires by helping the agent self-correct, but the hook is the actual boundary). gpt-4o agrees with this framing via its agreement-with-Reviewer-A section but does not itself work out the rule-vs-hook mechanics or propose where the guidance should live.

On sequencing, both treat the detector as the critical path and both independently push back on delaying detector work: gpt-4o explicitly disagrees with Reviewer B's suggestion to defer detector-building to Phase 2, arguing detector quality is foundational and must precede any enforcement mechanism — the same conclusion sonnet reaches via its Phase-0-prototype-as-greenlight-blocker decision. Neither model disagrees with the other here; they arrive at the same gate from different angles.

On the own-detector-vs-gitleaks question, both models want the same outcome (Git-first, no external dependency assumed) but sonnet supplies the argument Reviewer A's critique invites and gpt-4o doesn't fully resolve: the constraint isn't "custom detectors are inherently better," it's that this package ships to consumer repos with zero runtime dependencies, so gitleaks (a 40MB Go binary) can't be assumed present — meaning "own detector, v1" is forced by the deployment model, not a stylistic preference. gpt-4o's agreement-with-Reviewer-A-point-5 reads as generic skepticism toward building a custom detector without justifying why existing tools don't work; sonnet supplies that justification. This is a difference in depth, not a disagreement in conclusion — both members land on "own detector, v1, with accuracy targets," and sonnet's Decision 3 states that outcome explicitly.

On VCS scope, gpt-4o explicitly disagrees with Reviewer B that SVN/Mercurial support should gate initial implementation, insisting Git-only for v1 with other VCS as later, feedback-informed work. Sonnet reaches the identical cut (SVN/hg explicitly listed under v1 CUTS, revisited only if >5% of users request it). Same conclusion, independently reached — no fork here either.

Where the two responses diverge is in coverage, not direction. Sonnet works out an entire layer gpt-4o never touches: rule placement (extend `security-sensitive-stop`, not `tool-safety`, and not a new tier-2a rule — with an explicit rebuttal of Reviewer A's "extend tool-safety" proposal on trigger-specificity grounds), a gitignore-integration compromise (detection-time suggestion text only, never automatic modification — a deliberate middle ground between Reviewer A's "cut it" and the prevention-is-cheaper-than-detection instinct), binary-file handling elevated from "polish issue" to "correctness blocker" with a concrete failure scenario (an agent innocently touching `logo.png` and getting blocked on 99%-entropy noise), an entropy-calibration research spike named as the load-bearing unknown Reviewer A gestured at but didn't name, and a fully worked allowlist/checksum failure mode (checksums invalidate on cosmetic re-formatting, not just on real secret insertion — pushing checksum allowlisting to v2 in favor of inline `# agent-secret-allow` suppression for v1). gpt-4o's own additions are smaller in scope and mostly UX/process refinements: extended audit-log use, a call for a more concretely specified MVP with explicit success criteria, a two-way auditable opt-out (config-file entry plus console log), and a general binary-file caution — all directionally compatible with, and subsumed by, sonnet's more detailed treatment of the same points. gpt-4o's response is also markedly shorter (896 output tokens vs. 6,247) and does not reach a final decision matrix, roadmap, or go/no-go recommendation — it stops at agreement/disagreement/new-points without synthesizing them into a shippable plan. That asymmetry means the council's actionable output is effectively sonnet's Decision 1–8 set plus Phase 0/1/2 roadmap, with gpt-4o functioning as a directionally-confirming second opinion rather than a co-author of the plan.

No genuine three-way (or two-way, since only two Round-2 members are present in this file) disagreement surfaces that would require re-convening. Every place gpt-4o pushes back is a pushback on Reviewer B, and it resolves the same way sonnet resolves it.

### Kill criteria

- Phase 0 prototype (100-line regex+entropy detector, benchmarked against the OWASP/gitleaks corpus plus 5 popular repos) shows false-positive rate >10% → do not proceed to Phase 1; redesign the detector or treat this as a research spike, not a 3-week build.
- The entropy-calibration study (thresholds 60–80% swept against the same corpora) finds no threshold achieving <5% false positives → drop entropy detection entirely; ship regex+keyword-only for v1.
- Detector latency exceeds the performance budget on the benchmark set (>100ms p95 for a 1k-line file, >500ms p95 for a 10k-line file, or fails to fail-open by 2s on a 50k-line file) → not shippable as designed; revisit before Phase 1 hook wiring.
- The bypass audit log (`.agent-config/security-audit.jsonl`) shows >10 bypasses/week on a given repo → signal that the detector or UX is over-triggering, or that the repo needs a dedicated secret-cleanup pass; investigate before treating the design as validated.
- Post-launch data shows >20% of real-world violations are human-authored commits rather than agent-initiated writes → the case for a Phase 2 pre-commit hook becomes live; absent that threshold, it stays out of scope.

### Concrete next step

Commission the Phase 0 prototype: build the 100-line regex+entropy secret detector and run it against the OWASP/gitleaks test corpus plus five real repositories (this repo, React, Next.js, and two others), producing a written accuracy report (false-negative rate, false-positive rate, and ms/file latency) that the maintainer can use as the go/no-go gate before any hook or rule work begins.

**R1 preference (1/2/tie):** ____   **R2 blind-spot decision-influencing (yes/no/n.a.):** ____

