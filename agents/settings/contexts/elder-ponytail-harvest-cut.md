# Elder / ponytail harvest — the roadmap cut (2026-07-29)

> Durable record of the council convergence that turned **six externally-drafted
> roadmaps into three**, plus the rejected items and the verified findings that
> falsified several drafts' premises. Cite this file, not the transient inbox
> files or the council response directory.

## What was analysed

Five substantive external analyses arrived as inbox files, each carrying a
finished `road-to-*` draft written by an assistant that **did not have this
repo's source in context** (every "AC today" cell self-labelled `UNVERIFIED` /
`[ASSUMED]`):

| Source | Draft proposed | License posture |
|---|---|---|
| A conlang / xenolinguistics engine | `road-to-adversarial-conlang` (Track A hardening + Track B token-efficiency reject) | AGPL — threat spec only, never vendored |
| A jailbreak chat frontend | `road-to-adversarial-input-hardening` (T1 canonicalization · T2 override-quarantine · **T3 council anti-refusal** · T5 marker preservation · T4/T6 expected null) | AGPL — threat spec only |
| An abliteration toolkit | `road-to-adoption-signal` (telemetry · onboarding ladder · license note · "post the announcement") | AGPL — threat spec only |
| A 45-repo sweep of the same author (multi-agent red-team platform + two stego/transform suites) | `road-to-swarm-resistant-enforcement` (**P0-S1 decomposition laundering**) + `road-to-encoding-corpus-consolidation` (self-labelled amendment) | AGPL — threat spec only |
| A minimalism coding skill (MIT, ~90k★) + an independent third-party A/B benchmark + a seven-word critic prompt | `road-to-solution-minimalism` (9 phases) | MIT — mechanisms borrowed, own text, CREDITS entry required |

A sixth file was a stale council question from a prior session about an
unrelated roadmap's S0.1 step; no roadmap follows from it.

## Verified findings that override the drafts (measured in-tree 2026-07-29)

1. **`src/scripts/_lib/retrieval_sanitize.ts` exists** (71 LOC; the drafts
   guessed at a differently-named file). It strips the **invisible** class
   (bidi, zero-width, Unicode-Tag, deprecated-format — codepoint classes shared
   with `lint_hidden_unicode._classify`) plus C0/C1 controls, and caps fields at
   8192 chars. Its header records a **deliberate** decision not to rewrite
   visible text, because that would corrupt legitimate rule bodies and code
   snippets.
   → the **visible layer** (homoglyph/confusable, math-alphanumeric,
   full-width, punycode) is not covered, by design. That design tension —
   normalise vs. corrupt — is a real question.

   **1b. CORRECTION to my own first pass, and the more severe finding.** The
   sentence above originally continued "…on the `retrieve_v1` / `memory_get_v1`
   read surfaces", because that is what the sanitizer's header prose says. Read
   as fact, it is exactly the error this whole harvest is about. Measured
   instead:
   - `retrieve_v1` and `memory_get_v1` are defined in `memory_lookup.ts`, and
     **`memory_lookup.ts` has zero imports** — it cannot be applying the
     sanitizer.
   - `mcp_server/tools.ts` calls `memoryLookup.retrieve_v1(...)` and
     `memoryLookup.memory_get_v1(...)` **directly**, with no sanitize call in
     that file.
   - The sanitizer's only production caller is `second_brain_retrieval.ts`.
   - `tests/scripts/consumer_flow_wiring.test.ts` has a case literally titled
     "sanitize floor **already applied on the read surface**" — and every
     assertion in it calls `sanitize_text(...)` on a fixture directly. It proves
     the **algorithm**; it does not exercise the read surface at all.

   So the honest state is: **the algorithm is proven, its wiring into the
   primary read path is unasserted and appears absent, and the header claims
   otherwise.** This is the same class the active gates-that-can-fail work
   named — proven through an injection seam, unproven at the default entry
   point — applied to a security floor rather than a lint. It outranks the
   visible-layer question, because "the invisible layer is already handled at
   runtime" is only true on the paths that actually call the floor.

   The drafts also named a **second** threat surface which I initially dropped:
   the **inter-agent / subagent message channel**. It has no sanitizer at all —
   no `sanitize` call anywhere under the hook or subagent scripts.
2. **`lint_confusables.ts` + `lint_hidden_unicode.ts` are authoring-time CI
   linters** over `src/{skills,rules,agent-src,domains}/**/*.md`. They protect
   this package's own corpus, not runtime retrieved content. The
   injection-defense pressure corpus already shipped.
3. **This package's rules are prompt-side prose read by a model, not a
   deterministic string matcher.** "Obfuscation evades the Iron-Law keyword
   check" therefore mostly has **no target**. The deterministic matchers that do
   exist are the hooks (e.g. the `--no-verify` PreToolUse guard) and the lint
   scripts — a far smaller, concrete surface than the drafts assume. This single
   finding is what killed the largest slice of the drafted work.
4. **`hooks/hooks.json` dispatches exactly six events**: SessionStart,
   SessionEnd, Stop, UserPromptSubmit, PreToolUse, PostToolUse. No
   SubagentStart/SubagentStop entry exists anywhere in `src/`. ~~Whether the host
   exposes such an event is itself unverified.~~ **Corrected 2026-08-02 by the
   solution-minimalism S0.2 spike: the host DOES expose `SubagentStart` and
   `SubagentStop`** (Claude Code 2.1.220; `SubagentStart` carries an
   `additionalContext` injection payload), **and projected rules already reach a
   subagent's context without either** — a zero-tool-call probe reproduced two
   Iron Laws verbatim. The `src/`-side half of the finding stands: this repo
   still registers neither event. Evidence:
   `agents/evidence/investigations/solution-minimalism-phase0-spikes.md`.
5. **The license is already MIT** — the drafted AGPL→permissive relicensing
   side-note is moot.
6. **`.github/FUNDING.yml` does not exist**, while the maintainer's stated
   monetisation decision is donation-only (no paid tier, no dual-licensing).
7. **`src/scripts/adoption_snapshot.ts` already exists** with a pinned contract
   (`docs/contracts/adoption-signal-floor.md`): npm installs, version
   distribution, stars/forks, topic-search rank → dated JSONL. The drafted
   "passive-signal audit" is already built.
8. **`road-to-adoption-without-narrative-debt.md` is active** and already
   carries the open steps "publish ONE launch story built entirely on
   reproducible artifacts", "submit to the third-party surfaces the competitors
   appear in", and a human-gated step needing a real external person. The
   abliteration draft's load-bearing action ("post the announcement") is a
   **duplicate of an already-open step**, not a new finding.
9. **The council aggregation surface is real and testable**: `chairman.ts`,
   `consensus.ts`, `stance_tally.ts`, `confidence_gate.ts`, `blind_review.ts`,
   `debate_gates.ts`.
10. **Over-building coverage is partial, not absent** (the minimalism draft
    claimed "no equivalent"): `minimal-safe-diff-mechanics` § Anti-over-engineering
    already states "three similar lines beat a premature abstraction" and "no
    speculative features"; `improve-before-implement` already carries a demand
    gate ("should this exist?"). What is genuinely absent is the
    **reuse → stdlib → native-platform → dependency ordering** and any
    deletion-hunting review lens.
11. `internal/bench/ab` exists (fixture-based, placebo arm) — a public-repo
    agentic benchmark is an extension of it, not new infrastructure.

## Council convergence (2 members × 2 rounds, $0.11)

**Three roadmaps land, not six.**

- **`road-to-runtime-encoding-hardening`** — absorbs conlang Track A +
  jailbreak-frontend T1 + the encoding-corpus consolidation. All three address
  one surface: text normalisation before the model reads it. Amendment-shaped:
  the infrastructure and the design decision exist; this closes the visible-layer
  gap against a verified channel taxonomy, with file/network stego scoped out.
  **Re-scoped after finding 1b** — its first phase now proves the floor runs at
  all, because the visible-layer question is meaningless on a surface the floor
  never touches.
- **`road-to-governance-invariants`** — absorbs the council anti-refusal
  question + the decomposition-laundering question. Both ask the same
  meta-question: *do the governance mechanisms degrade when the violation
  becomes indirect?* Merged because finding 3 makes them share one failure mode
  (model reasoning under indirection), so they need the same mitigation class,
  not separate lifecycles.
- **`road-to-solution-minimalism`** — the minimalism borrow, truncated to the
  falsifiable engineering vertical (ladder rule → over-build review lens →
  public-repo benchmark).

**Rejected outright** (do not re-open without new evidence):

- **Conlang token-efficiency track** — pre-registered as a reject by its own
  author; a novel-orthography vocabulary fragments toward byte level in a
  tokenizer aligned to English/code, and the ~8k-token teaching artefact has no
  break-even when the per-message saving is negative. Direction of the idea is
  wrong, not merely unproven.
- **The whole adoption-signal draft** (telemetry endpoint, leaderboard,
  onboarding ladder, "post the announcement") — findings 7 + 8: the passive
  signal is built and the load-bearing action is already an open step in an
  active roadmap. Building instruments for an unmeasured funnel is the known
  displacement failure.
- **Override-pattern quarantine** — finding 3: there is no deterministic
  instruction-channel matcher to quarantine around; the draft assumes an
  enforcement architecture this package does not have.
- **Sampling-parameter steering + telemetry-exfiltration differential** —
  self-labelled "expected null" by the draft.
- **Runtime intensity levels / statusline / mode flag file** — a writable
  runtime state surface contradicts the machine-checked zero-runtime-daemon
  posture; the install-time discipline profile already covers the knob.
- **Host-adapter breadth race** — every extra adapter is standing drift debt;
  demand-driven only.
- **Product-vertical pilot + adversarial builder/deleter pairing + symmetric
  builder competition** — speculative breadth before the engineering vertical
  has any result; the symmetric variant additionally contradicts the measured
  team-mode Δ=0 null. Revisit only on a large cost-normalised win a single
  review pass cannot explain.
- **File/network stego channels** (image/audio/PDF/DNS/TCP/metadata) — out of
  this package's threat model; it governs text, not arbitrary files or packets.
  Recorded as out so coverage is never over-claimed.

**Not roadmap work** (both members agreed):

- **The SubagentStart finding is a verification task, not a roadmap** — a
  host-capability probe with a yes/no answer. It rides as one Phase-0 step in
  the minimalism roadmap and escapes to its own change **only if the event turns
  out to exist and rules do not reach subagents**, because then it affects every
  rule, not this borrow.
- **`.github/FUNDING.yml` is a direct commit, not a plan** — the decision is
  already made; the gap is execution. It rides as one step in the active
  adoption roadmap's Phase 0 ("quick wins already verified missing"), with the
  one thing an agent must not invent named as an open question: whether Sponsors
  is enabled for the org and what the donation target is.

**Deferred to `later/`** — **`road-to-benchmark-obsolescence-lifecycle`**: the
lifecycle states (`active → redundant-on-strong-hosts → outgrown → retired`),
re-run triggers on a staleness window, applied to every benchmark-backed claim.
Genuine package-wide honesty infrastructure — but building lifecycle machinery
with N=1 benchmark-backed rule is premature. Un-parks when a second
benchmark-backed claim ships.

### Residual disagreement (recorded, not papered over)

Round 1 converged 2/2 that the **ladder rule is the highest-value first
commit**: falsifiable today, verified gap (finding 10), low blast radius, and
the governance questions are documented adversarial techniques rather than
observed failures of this package.

Round 2 produced a real rebuttal of that ordering: the governance work's
infrastructure gap is **smaller** than round 1 claimed (findings 9 + 11 — it
instruments existing council machinery and adds fixtures to an existing
harness), and its blast radius is larger (if council selection is steerable
toward less-safe output, every council-gated decision is compromised).

**Convener's resolution, and why:** the round-1 ordering stands — the ladder is
the first *authoring* commit — but the rebuttal is folded in as a binding design
constraint rather than discarded, because its methodological core is correct:
**diff size is a proxy, not ground truth, for what the ladder actually changes.**
The ladder enforces a *search discipline*; LOC measures output volume. So the
minimalism roadmap's benchmark must carry a search-adherence endpoint, not only
a size endpoint, or it measures the wrong hypothesis. Separately, the governance
spikes are read-only and zero-dependency, so they do not have to queue behind
authoring work — they sequence first *inside their own roadmap*.

The honest framing for the governance roadmap, taken from the dissent's own
"what would change my mind": there is **no observed instance** of either attack
against this package. Both spikes therefore run as falsifications whose expected
outcome is a publishable null, and the roadmap says so up front rather than
implying a known vulnerability.

### Considered and deliberately left with no roadmap home

Recorded so a later reader can tell "we decided against it" from "we missed it":

- **A leaked host system prompt** from the same sweep. Useful only to understand
  which host prompt these projections run *alongside* — but it is an unverified
  leak, so nothing here may be hard-coded against it. Reference, never a
  dependency.
- **A Selenium-driven red-team harness** (permissively licensed, so no copyleft
  obstacle) — but it drives a vendor chat UI and is stale; the technique does not
  align with this package's bench. No adoption.
- **A leaderboard/consensus mechanic** from the same author set: it is the
  concrete implementation of the telemetry/leaderboard pattern the abliteration
  draft already proposed and the council already rejected. Cross-reference only;
  a separate roadmap would be duplicate planning twice over.
- **Off-domain repos** in the sweep (image watermarking, personal projects): not
  package-relevant. One of them is interesting to the maintainer personally and
  is noted as such, not as work.
- **A stale council question** about an unrelated roadmap's S0.1 disposition.
  Verified closed: that roadmap is archived, with its commit stating the QA
  matrix was recorded at closure. No action — checked, not assumed.
- **A local benchmark artefact directory** left in the inbox (probe and question
  YAMLs plus a run detail file). Not feedback prose; left where it was rather
  than swept, since only the named feedback files were consumed.

### Also recorded from the sources (no build attached)

- The highest-quality repo in the adversarial set independently ships this
  package's own methodology — re-derivable scores, a stable/experimental/roadmap
  status table, "a claim that can't be reproduced doesn't ship" — paired with a
  loud mission and thousands of stars. **Convergent validation that the
  discipline is right, and a reminder that discipline is table-stakes, not a
  moat.** It re-points at reach, and nothing in these three roadmaps fixes that.
- The minimalism source carries a **stale claim surface**: one of its own skill
  files still renders a retracted scoreboard while its README shows the
  corrected figure. That is exactly the failure class the claims-ledger + pinned
  report rendering exists to prevent, and it is why every number these roadmaps
  display must render from a pinned report rather than hand-typed prose.
- An independent benchmark of the minimalism source measured **zero
  self-activation** of a description-triggered skill across ten sessions — only
  hook injection produced any effect. Consequence: the ladder ships as a
  projected rule, never as a description-triggered skill, or a null would really
  be an activation failure.
- The same benchmark measured the source's marker convention being written
  **once in eighty trials**. Prompt-side paperwork does not happen without a
  machine backstop.
- The bare seven-word critic prompt nearly matched the full artefact on size —
  and was the **only arm that dropped a safety guard** (the lines it saved were
  a path-traversal check). Consequence: what is worth shipping is not the ladder
  text but *the ladder with the floors routed*, and the benchmark must include a
  bare-principle arm so the floors' contribution is measured rather than
  asserted. A size metric is never a scored target.

## Late arrival — two further research rounds, folded in without a second council

A further inbox file landed **mid-task**, carrying rounds 3 and 4 of the same
minimalism analysis. It changes **no council decision**: it proposes no new
roadmap, contradicts no rejection, and enriches exactly one of the three
roadmaps. Convening a second council for an in-roadmap enrichment would be
process theater — and the source's own closing advice is that further planning
rounds violate the first rung. Folded in directly, recorded here:

- **Round 3 (KISS) — the load-bearing addition.** KISS is not YAGNI: YAGNI is
  the **scope** axis ("must it exist?"), KISS the **shape** axis ("of what must
  exist, the simplest form"). The drafts covered scope thoroughly and shape
  barely. That gap matters because minimalism has a **second** failure mode
  beside dropping a guard: **golfing** — fewer lines, denser, harder to read.
  It is measured, not theorised (LLM code is shorter but denser, higher Halstead
  volume), and **a lines-of-code metric actively rewards it**. So the size claim
  becomes a **metric pair**: lines down *without* median cognitive complexity per
  changed function going up; lines down + complexity up fails the size criterion
  outright. Cognitive complexity is deterministic, per-stack tooled, and
  retro-fittable onto completed runs from preserved workspaces — the anti-golfing
  gate is nearly free. This arrives **independently at the same conclusion** as
  the council's round-2 dissent (a size metric is a proxy), from the opposite
  direction, which is why both are now constraints rather than opinions.
- **Round 3 also supplies the missing precedence rule:** floors → explicit
  user-fenced scope → shape → scope → de-duplication, with Rule of Three as the
  de-duplication gate. Every principle collection in the wild omits this, which
  is exactly why parallel per-principle injection produces contradictory
  simultaneous instructions.
- **Round 4 — the admission gate.** Rather than collecting more principles, the
  round applied a test (**disjoint axis + measurable + maps onto existing
  infrastructure**) and admitted six: Chesterton's Fence (the missing *deletion*
  side — agents are documented as especially fence-blind, so every deletion
  finding now carries a why-did-this-exist line), the Beyoncé rule (test coverage
  of the deleted path as the deterministic fence signal), two-way-door
  reversibility (when laziness is allowed at all — and a deferred cut is valid
  only on a reversible one, else it is a decision), Hyrum's Law (interface
  minimalism rationale + deletion caution), the second-system effect (rewrite
  contexts are peak over-build risk), and profiler-gated optimisation
  (performance complexity is a claim needing evidence).
- **Round 4's best result is a rejection.** The **Boy Scout Rule** is an
  *anti-borrow*: excellent for humans, and in agent hands institutionalised scope
  creep that collides head-on with `minimal-safe-diff`. Also rejected with
  reasons recorded so they do not return: Occam / NIH-avoidance / Muntzing
  (restatements), least-astonishment / CUPID / "idiomatic" (already carried),
  Postel's Law (inverted by modern security guidance), SOLID / Law of Demeter as
  rules (linter territory), worse-is-better / Wirth / grug (not checkable; grug
  licensed as persona *tone* only). **The admission table is now the scope
  boundary** — further principles enter only through its test.
- **One process borrow:** a routing-collision check in CI (no two rules/skills
  colliding on trigger sets) as an acceptance criterion for the overlap sweep, so
  disjointness is machine-checked rather than asserted in prose.
- **Next candidate axis, explicitly parked:** duplication as a measured endpoint
  (a copy-paste detector, not a DRY slogan) — not before the benchmark has run,
  because a fourth axis on an unmeasured rule is planning instead of executing.

## See also

- [`road-to-runtime-encoding-hardening`](../../roadmaps/archive/road-to-runtime-encoding-hardening.md)
- [`road-to-governance-invariants`](../../roadmaps/archive/road-to-governance-invariants.md)
- [`road-to-solution-minimalism`](../../roadmaps/archive/road-to-solution-minimalism.md)
