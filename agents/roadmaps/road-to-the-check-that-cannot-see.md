---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-live-app-verdict
    relation: disjoint
    note: >
      Phase 3 here rewrites that roadmap's stated REASON — it cites a contract
      that is `stability: superseded` — and touches neither its status nor its
      two-conjunct trigger. The live-app arm itself stays parked there.
estate_offset_exempt: "Cannot be offset. All ten active roadmaps are unstarted — six landed 2026-09-04 in PR #1839, three on 2026-09-03, one is a carrier a recorded verdict forbids closing — so any archive would be archiving unfinished work. The nearest sibling by shape, road-to-defect-population-sweeps, sweeps three named defect classes across their populations; folding a five-defect repair of one gate into it would replace its subject rather than extend it."
estate_growth_exempt: "Adds one active roadmap against a floor of 10. Every defect below was reproduced against this tree, and the headline one is a check that reports `passed` on input it cannot see — eight of nine checks answer binary with no undecided path. The gate also has zero non-test consumers, so nothing has ever exercised it in anger. Parking it leaves a silent-green instrument in the tree that a future release process is expected to trust."
---
# Road to the check that cannot see

> **Source:** `agents/tmp.old/inbox-2026-09-g/` — a proposal round on web
> release checks. The round's own architecture is declined (see § What this
> roadmap is NOT); what survives is its defect list, re-verified here against
> `main@bd7dc08d8`, with one of its claims corrected by the reproduction.

## Goal

`check_web_launch_readiness` cannot report `passed` for a check whose input
carries no evidence, cannot silently lose a region escalation because a consumer
declared nothing, and has at least one consumer that is not a test.

## Reproduced, against this tree

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| D10 | `UNDECIDABLE` covers 1 of 9 checks; the other eight answer binary even when blind | **still-true** | `check_web_launch_readiness.ts:784-786` holds exactly one entry, `analytics-and-consent-wiring`; `src/config/web-launch-readiness.json` carries 9 checks |
| D1 | the gate has zero consumers | **still-true** | `grep -rn check_web_launch_readiness src/ tests/ Taskfile.yml taskfiles/ .github/ docs/` returns only its own two test files and its config's prose. No skill, rule, subagent, flow, mission or workflow calls it |
| D12 | region and site-type are CLI-only; a consumer with `enabled: true` silently loses the DE escalation | **still-true** | `enabled()` (`:341-361`) reads only `web_launch_readiness.enabled`; `--site-type` / `--region` are parsed at `:943-944` with `region` defaulting to `unspecified` |
| D9 | no test enforces the accounting invariant | **still-true, and the proposal states it wrong** | see below |
| D13 | stale prose says "the one implemented check" while nine are implemented | **still-true, with a measured consequence** | `check_web_launch_readiness.ts:363`, `tests/scripts/check_web_launch_readiness.test.ts:3` — both say one; `IMPLS` (`:794-803`) holds eight plus `staging-noindex-leftover`. A sibling analysis in this same round read that prose and built an entire phase on the false premise |
| D3 | a superseded contract is cited as the live-app blocker's reason | **still-true** | `docs/contracts/no-runtime-boundary.md` is `stability: superseded` (by ADR-249, 2026-08-27); `agents/roadmaps/later/road-to-live-app-verdict.md:36-37` cites it |
| D8 | the config's own counter says "Currently 7" while `checks` holds 9 | **still-true** | `src/config/web-launch-readiness.json:168` |

**Correction 1 (`corrected-from-reproduction`) — the invariant has five buckets,
not three.** The proposal states it as `applicable = findings ∪ undecided ∪
passed`. The renderer carries `unimplemented` too, printed as
`NOT YET IMPLEMENTED (applicable, not audited)` (`:928`). And the existing test
is itself already incomplete: `tests/scripts/check_web_launch_readiness.test.ts:90`
unions `[findings, passed, unimplemented, skippedIds]` and **omits `unknown`**.
So the step below carries the five-bucket form. A three-way invariant would not
have landed, and the four-way one would have reproduced the test's own gap.

**Correction 2 — D10 is larger than the proposal measured.** The eight binary
checks are the count; the mechanism is worse. `isPage()` (`:478`) is
`/\.html?$/i`, and **five checks skip every non-HTML file through it**
(`:499`, `:536`, `:568`, `:586`, `:612`). On a Vue, JSX, Svelte or Blade build
whose only `.html` artefact is an app shell, each of those five iterates zero
files and returns `[]`.

The file's own `Impl` contract (`:482-489`) states the rule that forbids exactly
this, in its own words:

> *"Returning an EMPTY array means 'applied and found nothing' — which is a
> pass. A check that cannot decide must not return an empty array; it must not
> be in `IMPLEMENTED` at all… **That is the one rule keeping the silent-green
> defect out of this table.**"*

Five checks violate that contract by construction, and `audit()` (`:865-868`)
converts each empty array to `passed`. The gate does not merely lack undecided
paths — it documents the rule it breaks.

**Why D1 is the same shape this repository already knows.** A primitive with no
consumers outside its own test is exactly the `attest_artifact` finding carried
by `road-to-decided-but-not-done` Phase 2, and the `check_web_launch_readiness`
header justifies its command form by saying `production-validator` "can call it
directly" — `src/subagents/production-validator.md` never mentions it, and that
subagent is `discovery.visible: false` with `requires_capability: claude_subagents`
(`:34-36`), so even a call there would reach one host.

## What this roadmap is NOT

The round proposes a "Web Assurance layer": a PREVENT/OBSERVE/GATE architecture
over a third-party legal graph covering GDPR, TDDDG/ePrivacy, GDPR Chapter V
transfers, licensing, consumer law and accessibility law, in 3,895 lines. It is
declined as authored, on four grounds, each recorded so it is not re-proposed:

1. **The seed was never obtained.** The round's own transcript records it:
   *"eine öffentlich auffindbare Kopie des konkreten Skills habe ich bei der <!-- md-language-check: ignore -->
   Suche nicht gefunden"* and *"Der TikTok-Skill selbst bleibt aktuell 'nicht <!-- md-language-check: ignore -->
   öffentlich gefunden'"*. The 25-repository corpus is a substitute the agent <!-- md-language-check: ignore -->
   chose, and the expansion to a layer was decided in the agent's **first reply**,
   before any instruction to expand existed — citing *"unsere gestrige
   Web-Quality-Roadmap"*, an agenda that predates the seed.
2. **The legal floor would not fire on it, which is worse than a collision.**
   [`legal-safety-floor`](../../src/rules/legal-safety-floor.md) is pack-gated —
   `packs: [legal-review-prep]`, *"Auto-activates when `pack-legal-review-prep`
   is installed"* — and its triggers are contract/NDA/DPA words, not `Impressum`,
   `BFSG`, `cookie` or `font`. A web-assurance run in a project without that pack
   activates **none** of its machinery: not the consent gate, not the council
   gate, not the RDG § 2(1) STOP, not `lint_legal_jurisdiction_tag`. The
   proposals are careful in substance — both forbid a compliance verdict, and v5
   even specifies a safe-wording test — but a `compliance_verdict: prohibited`
   line in frontmatter is read by nothing: `grep -rn 'legal_posture'` over
   `src/scripts/` and `docs/contracts/` returns zero. Building a DE/EU legal
   corpus **outside** the pack its floor is attached to is the structural
   problem, and no roadmap step fixes it — it is a pack-boundary decision.
3. **The runtime arm needs a classification this repository has not made.**
   ADR-124's Class-C prohibits a network build path; a browser/HTTP prober needs
   an explicit Class-A ruling first, and that is a decision, not a step.
4. **The measured negative is already recorded.** The round's own note:
   *"'überall anwenden' per Prosa erhöht nur die Payload und greift nachweislich <!-- md-language-check: ignore -->
   nicht (harness-native-Befund, 0/299 Skills mit `context: fork`)"* — the naive <!-- md-language-check: ignore -->
   form of process-wide mounting is measured not to work.

Nothing here forbids the layer. It is an owner-scale product decision, and the
verified defects below do not wait on it.

## Phase 1 — No pass on input the check cannot see

- [x] **1.1 Give the eight binary checks an `Undecide` function for their known
      blind spot.** `image-alternative-text` on a tree that renders images only
      through framework components sees zero `<img>` and returns `passed`;
      `document-head-basics` on an app with a head manager sees no `<title>`.
      Each check gets the input shape it cannot decide, and returns `undecided`
      there.
      verify: one fixture per check that forces `undecided`; each fixture returns
      `passed` when its `Undecide` entry is removed, which is what proves the
      entry is doing the work.
      DONE — nine probes, keyed to FOUR evidence surfaces rather than one shared
      predicate (`check_web_launch_readiness.ts` § `UNDECIDABLE`). An AI council
      (2026-09-04, 2/2, anthropic + openai) rejected the single "no HTML page"
      predicate: honest for a check reading rendered markup, semantically wrong
      for one matching route paths, where absent HTML does not establish an
      absent route surface. Surfaces: anything-read · a rendered page · readable
      code · an inspectable route surface (page ∪ sitemap.xml ∪ routes//pages/
      ∪ router module). Reversibility is executed, not asserted — `audit()` takes
      the probe table as a defaulted parameter, and the test deletes each entry
      in turn and requires that check back in `passed`/`findings` (7 reversals,
      count asserted so a neutered table cannot pass vacuously). Council also
      asked for a mixed-evidence tree — HTML present, no 404 and no legal page —
      where the two route checks must FIND rather than abstain; it is pinned.
      One behaviour was added beyond the step: a surface-blind probe SUPPRESSES
      its own check's findings, because `custom-error-route` otherwise printed
      "no 404.html in the build output" as HIGH and, two lines lower, that the
      absence establishes nothing — two contradictory sentences from one read.
- [x] **1.2 The accounting invariant, in its five-bucket form, inside
      `audit()`.** For every fixture:
      `|applicable| = |findings ∪ undecided ∪ passed ∪ unimplemented ∪ unknown|`
      and `|skipped| = |checks| − |applicable|`. The existing assertion at
      `tests/scripts/check_web_launch_readiness.test.ts:90` omits `unknown` and
      must gain it. A break fails the report itself, not only the test — a
      criterion that lands nowhere reads as silent green, and a test is not
      present in a consumer's run.
      verify: the check goes red when a check is removed from `audit()`, red
      again when one is made to return nothing, and red on a synthetic report
      whose `unknown` bucket is non-empty while the old four-way union passes.
      DONE — `assertEveryCheckAccounted()`, called from `audit()` before it
      returns, throwing `DeadScopeError` (council 2026-09-04, 2/2: option A over
      a report field — exposing the gap as data makes the consumer responsible
      for noticing what it cannot detect). Compared by check ID, not by
      cardinality, because duplicates can make two counts agree while a check
      vanishes; the error carries the missing ids AND the buckets built so far,
      so a diagnosis does not lose computed findings. The union is a COVER, not
      a partition — `findings` and `unknown` legitimately overlap — and the test
      asserts the old four-way union would have called the `unknown`-only case
      unaccounted.

## Phase 2 — A consumer, and a declaration that cannot be lost

- [x] **2.1 Bind the gate to something that is not a test.** One consumer is
      enough to stop it being a dark instrument; three is what the proposal asked
      for and is more than this phase needs. Pick the binding whose host coverage
      is widest and say why the others were not taken — `production-validator` is
      the one the script's own header names and the one that reaches a single host.
      verify: `grep -rl check_web_launch_readiness src/flows src/subagents src/scripts/hooks`
      is non-empty, and the chosen consumer's own file names the gate.
      DONE — `src/subagents/production-validator.md`, as step 5 of its own
      procedure, with the exit-code table and the rule that an `UNDECIDED` block
      is missing evidence rather than a clearance. The step's own hint that
      "widest host coverage" should pick the binding was CORRECTED by the
      council (2/2, both seats independently): the hook reaches more hosts and
      cannot know the build directory, so it could only nudge, and the flow
      schema resolves commands and skills rather than scripts — neither would
      consume the gate at all. Coverage is one host and the file says so.
- [x] **2.2 Read site-type and region from settings, and say when they are
      absent.** `enabled()` reads one key; the two axes that decide severity come
      only from `--site-type` and `--region`, with `region` defaulting to
      `unspecified`. Add them to the settings section, and when a value is absent
      the report carries its own line — *"region unspecified → DE escalation not
      active"* — rather than a quieter result.
      verify: a fixture with `enabled: true` and no declaration produces that
      line; a fixture declaring `region: de` escalates `required-legal-pages`.
      DONE — `readSettings()` reads `enabled`, `site_type` and `region`;
      resolution is CLI → settings → default, and an ABSENT key stays
      `undefined` rather than collapsing into the string `unspecified`, because
      "nobody said" and "no jurisdiction" are different facts. Observed both
      directions with no CLI axis flag at all: no declaration → the report
      carries `region unspecified → DE escalation not active` and
      `required-legal-pages` is SITUATIONAL; `region: de` in the file alone →
      `escalated by region: required-legal-pages situational → critical`.
- [x] **2.3 Do not add a new state.** Four states exist (`Finding`, `Skipped`,
      `Undecided`, `passed`) plus the `unimplemented` render bucket. Anything the
      new paths need is a reason class on `undecided`
      (`instrument-limit`, `declaration-missing`), never a fifth state.
      verify: an enum test; no state outside the existing set.
      DONE — `UndecidedReason = 'instrument-limit' | 'declaration-missing'` as a
      field on the existing `Undecided`. The enum test asserts the union is
      closed, that the report still carries exactly five buckets and ten
      top-level fields, and that BOTH members have a real user reached from a
      real audit rather than asserted from the type: `instrument-limit` from the
      nine probes, `declaration-missing` from the one case where the answer
      depends on the caller — a tree carrying the generic legal pair and not the
      DE pair with no region declared, which the matcher passes at every region
      while `--region de` owes an Impressum by name.

## Phase 3 — Two stale sentences

- [x] **3.1 Stop citing a superseded contract as a live reason.**
      `later/road-to-live-app-verdict.md:36-37` justifies its park with
      `docs/contracts/no-runtime-boundary.md`, which is `stability: superseded`.
      The trigger and the status do not change — only the reason, which becomes
      the Class-A form under ADR-124 § 4 and `resident-process-governance.md`.
      verify: that file references no superseded contract, and its two-conjunct
      trigger and `status: later` are byte-identical.
      DONE, and the step undercounted: there were TWO citations, at `:36` and at
      `:47`, not one. Both now cite `resident-process-governance.md` (P1/P2 and
      the four governance conditions) plus ADR-124 § 1 Class A. `grep -c
      no-runtime-boundary` on that file is 0; the trigger block and `status:
      later` are untouched — the diff contains no line from either.
- [x] **3.2 Stop retyping a number.** `web-launch-readiness.json:168` says
      "Currently 7"; `checks` holds 9. The repository already learned this class
      and wrote the lesson down — *"A number a human retypes on every ledger edit
      will drift; the only fix is to stop retyping it"*
      (`src/scripts/check_claims.ts:1119-1120`) — and did not sweep for it. The
      prose names the ceiling and stops naming the count.
      verify: `grep -c 'Currently' src/config/web-launch-readiness.json` is 0, and
      the existing `checks.length < 50` assertion is unchanged.
      DONE — 0, and `web_launch_readiness_config.test.ts` has no diff at all.

- [x] **3.3 Correct the "one implemented check" prose (D13).** Two places say
      the gate ships one check: `check_web_launch_readiness.ts:363` and
      `tests/scripts/check_web_launch_readiness.test.ts:3`. Nine are implemented.
      This is not cosmetic — a sibling analysis in this same round read that
      prose and planned a whole phase around implementing checks that already
      exist. Name the count nowhere; assert it instead, in the shape 3.2 uses.
      verify: neither file states a check count in prose, and a test asserts
      `Object.keys(IMPLS).length + 1 === checks.length`.
      DONE — both sites reworded and the assertion added, with the count-in-prose
      pattern ASSEMBLED at runtime because written as a literal it matched its
      own source. The guard did real work before it went green: it caught two
      live instances, one of them a comment written in this same step.
- [x] **3.4 Teach the source gate the names this round used.** The proposal set
      names 25 external repositories plus several vendors as **derivation**
      sources; `check_no_external_sources` passes today because
      `src/scripts/external_sources_denylist.json` carries none of them, so a
      future round could land any of those names silently. Add the derivation-source
      tokens — never the detection-target vendors, which
      [`source-confidentiality`](../../src/rules/source-confidentiality.md)
      explicitly permits naming.
      verify: the gate fails on a planted tracked file naming one of the added
      tokens, and passes on one naming a detection-target vendor.
      **FALSE PREMISE — no token was added, and none could be.** The step asks
      for the round's derivation-source names; they exist in no surviving
      artefact. The source directory this roadmap cites was never tracked and is
      gone from the tree, and this repository's own verification of that round
      records the corpus as unreachable: *"clone and read the 25 external
      repositories | agent | out-of-bound | network"* and *"the corpus is
      irrecoverable — private third-party repositories, a permission fact, not a
      lost file"* (`agents/evidence/analysis/inbox-2026-09-fg-verification.md:187`
      and `:113`). Inventing 25 names to populate a denylist would be
      fabrication, so none were invented. The step's MECHANISM half was executed
      instead and passed both directions on the real gate: a tracked file naming
      a denied derivation source → exit 1 with the token quoted; the same file
      naming only detection-target vendors (which `source-confidentiality`
      permits) → exit 0. The residual risk the step names — a future round
      landing one of those 25 names silently — is real and is NOT closed by this
      roadmap; closing it needs the names, and the names are gone.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The eight `Undecide` functions turn every check undecided | product | The cheapest way to satisfy 1.1 is a broad blindness predicate, and a gate that answers `undecided` everywhere is as useless as one that answers `passed` everywhere — just harder to notice | 1.1 requires each fixture to return `passed` when its own entry is removed, which forces the predicate to be narrow enough to be reversible | Phase 1 — No pass on input the check cannot see |
| 2 | Binding a consumer makes a dark gate a loud one | product | The gate has never run against real consumer input; wiring it into a flow could red work on findings nobody has calibrated | 2.1 takes one consumer rather than three and requires the choice to be justified against host coverage; the gate's own `enabled()` default stays false | Phase 2 — A consumer |
| 3 | The declined layer returns one phase at a time | product | The defect list and the architecture arrived in one file, so each future round can carry one more piece of the layer in as a "small follow-up" | § What this roadmap is NOT records the four grounds with their sources, so a re-proposal has to answer them rather than restate the layer | Phase 1 — No pass on input the check cannot see |

## Acceptance Criteria

- [x] AC-1 — Every one of the nine checks has an `undecided` path for an input it
      cannot decide, and removing any one of those paths turns its fixture green
      again.
- [x] AC-2 — A five-bucket accounting invariant is enforced inside `audit()`,
      includes `unknown`, and fails when a check lands in no bucket.
- [x] AC-3 — `check_web_launch_readiness` has at least one non-test consumer, and
      the reason the others were not taken is recorded.
- [x] AC-4 — Site-type and region resolve from settings, and an absent value
      produces its own report line rather than a quieter verdict.
- [x] AC-5 — No superseded contract is cited as the live-app blocker's reason, and
      no file retypes a check count in prose.
- [~] AC-6 — **PARTIAL, and reported as failed rather than claimed.** The
      polarity half is met and observed: `check_no_external_sources` exits 1 on
      a tracked file naming a denied derivation source and 0 on one naming only
      detection-target vendors. The clause "from this round" is NOT met and
      cannot be: those names survive in no artefact (see 3.4). Carried nowhere —
      there is no receiver, because there is nothing left to give one.
