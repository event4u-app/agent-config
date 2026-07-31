# Zero-ceremony inbox — the roadmap cut (2026-07-31)

> Durable record of the evidence audit and council convergence that turned an
> **eight-document externally-drafted release plan into three active roadmaps,
> two deferred ones, and five explicit refusals**. Cite this file — not the
> transient inbox files, not the council response directory.

## What arrived

One inbox set (8 documents + a chat transcript + a zip), consumed from the local
inbox and archived to `agents/tmp.old/road-to-v10/` — gitignored, so this record
is the only tracked account of what arrived. It was drafted in a session
that had the repo's **tree** but not its **decision memory**: no ADR index, no
council locks, no honest-null records. The drafts are strong on direction and
stale on fact — the same failure shape recorded in
[`elder-ponytail-harvest-cut`](elder-ponytail-harvest-cut.md).

| Draft | Proposed | Disposition |
|---|---|---|
| master orchestrator | decision ledger D1–D12, waves W0–W5, "this arc IS the major" | **CUT as a document** — version framing violates roadmap template rule 13; waves re-cut below |
| findings record | F0–F6 leverage ranking + external evidence | **KEEP as evidence**, re-based; F2c and F6 refused |
| zero-config detection | one read-only detector, detection-based availability, `doctor` | **KEEP** → detection roadmap |
| cli-first transport | one `transport.mode`, billing untangled from transport | **KEEP + upgrade** (a live bug found) → detection roadmap |
| one-minute install | zero-prompt init, door consolidation, emitter unification | **KEEP, split** → install roadmap; emitter unification downgraded |
| just-in-time settings | no shipped template, sparse decision file, A/B/C classes | **KEEP** → settings roadmap |
| native model primitives | per-host emission of native routing knobs | **DEFER** (adoption-gated) → `later/` |
| cross-profile dispatch | role-pinned subagent lanes across Claude profiles | **DEFER + correct premise** → `later/` |

## Verified findings that override the drafts (measured in-tree 2026-07-31)

Every item below was checked against the live tree. The drafts assert the
opposite or assert novelty where the mechanism already exists.

### 1. Consumer rule filtering already shipped — the headline number is not ours to claim

The drafts' load-bearing exhibit is "consumers install **94/95 rules
unfiltered**; scoping identified ~32 as relevant; the **82.6%** measured saving
finally lands where users are." Three separate errors:

- **Filtering shipped 2026-07-13 and is on by default.** `rule_workspaces` in
  `src/config/agent-settings.template.yml` lists every consumer workspace;
  **15 of 110** rules are excluded from a consumer install. `src/install/rule_scope.ts`
  delegates to the projection predicate so *install semantics cannot drift from
  projection semantics* — the divergence the drafts want to fix by unifying
  emitters is, for the rule layer, already fixed by a shared predicate.
- **The `~32`-relevant figure was superseded in-tree.** The audit corrected the
  maintainer-only set from 63 rules to **16 rules ≈ 13.9k tokens**; the measured
  flip delta is **15 rules / 9,880 GPT tok / 13.1%**. `~32` survives only in a
  stale goal line.
- **The 82.6% belongs to a different, DISABLED lever.** It measures *thin
  projection*, not install-time scoping — a three-stage pipeline whose stages
  have independent inputs and failure modes. Thin failed a pre-registered 48%
  win-rate floor at **36.2%**; the length-neutral rerun was inconclusive
  (κ=0.46); and the replacement deterministic instrument recorded its own
  **honest null on 2026-07-31** (inter-evaluator κ=0.700 against a registered
  0.800 floor — failing on the *easiest* fixtures, with 0 of 255 `must_include`
  anchors carrying a literal token). Presenting 82.6% as a consumer benefit is
  precisely the claims-ledger violation the house law forbids.

**Consequence:** the "one pipeline / 94→32" release criterion is deleted. What
survives is number hygiene: **82.6% / 81.6% / 65.6% all circulate in-tree for
this one lever** — one measurement, one citation, everywhere.

### 2. `doctor` is not new

The detection draft specifies `doctor` as "NEW, the visible surface." Four
doctor-family commands already ship (`doctor`, `doctor-shell`, `hooks:doctor`,
`reach:doctor`); the main module is ~124 KB and already performs a read-only
`auth.json` probe. A transport-mode resolver already exists as a pure function,
and auth probing exists in **two** shapes (a council lazy-probe with cache and
timeout, and doctor's read-only probe). The work is **extension**, not creation
— and a third probe shape must not be added.

### 3. The cross-profile security fence points the wrong way

The draft states that `hardenedSpawnEnv` strips `CLAUDE_CONFIG_DIR`, that the
change needed is "one narrow assignment rule", and that "inheritance from the
orchestrator's environment stays stripped."

Reality: the function is **deny-by-family, not allowlist** — a documented
design choice, because the provider CLIs legitimately need arbitrary env.
`CLAUDE_CONFIG_DIR` matches no deny family, so it is **inherited unchanged
today**, and assignment already works through the overrides path. No test pins
its behaviour either way.

So the draft's "narrow extension" is actually a **new restriction to add**
(strip inherited, permit only a validated assignment), and its stated invariant
is currently false. This inverts the risk conversation: the exposure, such as
it is, exists **today and independently of the deferred feature**.

### 4. `--gui` does not exist

The install draft demotes the wizard "to `--gui`". No such flag exists in any
code path — while `README.md` documents it. Today the wizard is the **default**
on an interactive TTY and is suppressed by `--no-ui` / `AGENT_CONFIG_NO_UI=1` /
CI / non-TTY / any of a dozen flags. So *some* doc↔code convergence is
mandatory regardless of whether the default is inverted.

### 5. A live two-clocks bug in the transport key

`src/scripts/council_cli.ts` reads `ai_council.mode` (top level) while the
template ships `ai_council.defaults.mode`. On that path the key is never
consulted and the effective default falls through to `manual` — not the `api`
the template comment and the config contract both promise. The transport
untangling therefore lands as **a bugfix first**, a default-flip second.

### 6. Smaller premise corrections

- Host-detection table covers **23** hosts, not 24 — test-pinned and
  claim-bound in the proof surface.
- `setup.sh` is **live and CI-smoked**, not a deprecated stub — retiring it is
  real work with a real consumer.
- The marketplace plugin is **not "deliberately empty"**: it carries 6 hook
  dispatch entries that are a hard requirement. Removing it silences
  hot-context, chat-history capture, context-hygiene, no-verify blocking, and
  the roadmap flip-guard.
- Settings template is **1,233** lines and **is** shipped (`src/config/` is in
  the npm `files` allowlist).
- `environment_detector.ts` does **not** exist — greenfield, not an extension
  point. `toolDetection.ts` ("is the tool installed on this machine") and
  `detect.ts` ("does this project have a bridge dir") deliberately answer
  different questions; collapsing them would erase that distinction.
- `settings set` does **not** exist — `settings` is a GUI alias. Greenfield.
- `cli_call_budget` is **fully implemented** and merely commented out in the
  template — populating it is a template edit, not a build.
- `subagents.auto` already defaults to `on`.

## What the drafts got right (kept without change)

The settings template really is 1,233 shipped lines; the council template
really pins stale model IDs and hand-maintained ladders; the README really says
"Three steps. Five minutes." and really carries an `npm error ETARGET`
troubleshooting block **inside** the install instructions; the interactive
install really boots a loopback HTTP server so a human can tick tool
checkboxes; there really are three install doors; there is **no** `npm pack`
size gate anywhere in CI; one skill's bulk data dir is 864 KB of an 8.9 MB
payload.

The staleness exhibit is self-demonstrating: the council debate that reviewed
this cut ran on `claude-sonnet-4-5` and `gpt-4o` — the two stale pins the
settings work deletes.

## Standing decisions each proposal runs into

Audited 2026-07-31. "Lock" below means an accepted ADR, a locked contract, or a
CI-enforced check — not an opinion.

| Proposal | Runs into | Verdict |
|---|---|---|
| Plugins as a content channel | The 2026-07-07 single-surface decision (marketplace-primary explicitly rejected, don't relitigate) · the locked one-canonical-channel-per-tool contract · the machine-checked surface matrix · **a CI lint that FAILS on any repopulated plugin skills list** | **Refused** — R1 |
| Zero-prompt install by default | An accepted ADR making the browser handoff the interactive default · the onboarding-gate rule (tier-1, hook-enforced) naming the wizard the *sole* onboarding surface | **Blocker** — needs a kernel-rule edit under slow rollout |
| Retire the curl door | No ADR conflict · but a declared public-URL contract with 6-leg CI, and it is a real rescue path | **Kept, gated** on covering the npm failure first |
| Ship no settings template | The template↔schema parity gate ("loosen it and the GUI silently drifts") · an installer hard-fail on a missing template · nine further direct readers | **Reframed** — split the template's two jobs |
| Remove `members.*.enabled` | The shipped template's own rationale ("installing a key is not the same as wanting the agent to spend money on it") · the config contract's fail-closed rules and no-silent-skips clause · the ADR requiring a threat model for this class of scope expansion | **Blocker** — it is a spend gate, not ergonomics |
| One global `transport.mode` replacing `defaults.mode` | The three-valued `mode` (the draft's values silently delete `manual`, the safest transport) · the per-member override the per-provider billing rules depend on · and the global knob already exists | **Reduced** to a bugfix plus one added value |
| Delete the static model keys | The tier-mapping ADR, whose rejected-alternatives section names a per-vendor table as the rejected mechanism · the ladder the loader requires for cost downgrade · the judge-model key's Iron-Law status in four judge skills | **Mostly refused**; the real staleness is the pinned IDs |
| One emitter library | No lock against a shared-emitter refactor · but the draft's pipeline labels are not this repo's, and collapsing the projected tree was decided against on scope-discipline grounds | **Reduced** to a divergence audit |
| Cross-profile dispatch, default ON | The subagent-boundary contract's core invariant — *a subagent cannot do what its parent may not* — plus its explicit non-claim about host-spawned subagents | **Deferred**; premise corrected, see below |

A further cross-cutting gate applies to the set as a whole: the subsystem-freeze
ADR forbids starting a new large subsystem — a new platform integration among
them — while any of its unblock conditions is open. Those conditions currently
hold, but one rides a defer that lapses in weeks. The plugin channel is a new
platform integration by that ADR's own definition.

## Cross-profile dispatch — deferred, with its premise corrected and no roadmap file

The design is sound and the drafts' honesty about it is good: it claims
configuration isolation, separate quota pools, and per-lane rate-limit blast
radius, and explicitly refuses a defect-finding quality claim. It is deferred
anyway, for three reasons the drafts could not see:

1. Its security premise is inverted (finding 3) — the fence it calls a narrow
   relaxation is actually a restriction that does not exist yet.
2. Dispatching a child into a different config directory means the child
   resolves a different profile's rules, settings, and floors. The
   subagent-boundary contract's invariant is that a subagent cannot do what its
   parent may not, and it already declines to claim anything about subagents
   spawned by host primitives outside this package's templates. A default-ON
   flip is materially wider than the bounded, N=2 evidence that justified the
   last orchestration default flip.
3. The audience is approximately the maintainer, while the adoption gate is open.

No roadmap file is opened for it: the only part worth doing now is
decision-neutral and has landed as Phase 5 of the detection roadmap — pin the
current inheritance behaviour with a test, write the attack chain and its
counter-argument into the threat model, and route the trade-off to an ADR
amendment. Re-open the feature when the adoption gate exits and that decision
has landed.

## Refusals — items that do not become work

### R1 — Plugins as a content channel: REFUSED, revisit bar not cleared

The drafts propose making marketplace plugins first-class content (a wedge
plugin plus one plugin per pack), calling the prior decision "tipped".

It is not tipped. A 2026-07-07 council converged on *projection-primary, plugin
retired*, explicitly **rejecting** marketplace-primary because SHA-snapshot
staleness would own the only content path and offline installs would be lost.
An accepted ADR independently says *"Keep `source: './'`. Do not restructure
the marketplace source."* Three revisit triggers were pre-registered: the host
changes plugin/marketplace semantics · delisting measurably hurts adoption ·
>40% of installs arrive via marketplace search. **None has fired.**

The new evidence offered is external market data about the *channel* (a
tech-radar "Adopt" rating; ~300k monthly browsing developers; the channel being
publicly unsigned and unaudited, making a provenance-bound plugin an unoccupied
wedge). That is a real argument and it is **orthogonal to the prior decision's
actual reason** — channel attractiveness does not answer content-path
staleness. Per the decision-revisit gate the mechanism must match, so this is
surfaced rather than silently executed, and refused rather than silently
dropped: the honest next step is the **cheap measurement that would produce a
qualifying trigger**, not the build.

### R2 — The 82.6% as a shipped consumer benefit: REFUSED (see finding 1)

### R3 — A rules-budget ADR plus verifier wiring: REFUSED as already-built

`src/scripts/check_always_budget.ts` runs in CI with a 49,000-char total cap,
a per-rule cap, single-rule (12%) and top-3 (30%) concentration caps, and a
`load_context` nesting limit. The draft proposes creating what exists.

### R4 — The 90-minute human gate as new work: REFUSED as duplication

The launch story, the directory listings, the recruited external session, and
`FUNDING.yml` are **already open steps** in `road-to-adoption-without-narrative-debt`,
with a structured `real-external-participant` blocker owned by the user.
Restating them here would create two clocks for one gate. The drafts are right
that this is the highest-leverage item; the correct action is to execute the
existing roadmap, not to re-plan it.

### R5 — A roadmap WIP cap and new governance lint: REFUSED, already decided

19 active roadmaps for a solo maintainer is real debt, and the drafts are right
to name it. But a standing WIP cap was **already proposed and rejected** by
council in the subsystem-freeze ADR: *caps measure concurrency, not doneness;
for a solo maintainer they add accounting without changing behavior.* The
substitute that shipped instead is that ADR's unblock-list freeze. Re-proposing
the rejected mechanism is not new evidence.

`road-to-surface-consolidation` independently carries the governing precedent —
*fold the proposed complexity-budget into an existing checklist, zero new
surface.* Folded there; no new lint, no new roadmap. Adding a mechanism about
roadmap-count while adding roadmaps would also have been self-refuting.

### R6 — The ADR `review_date` sweep: REFUSED by current policy

The drafts call for running the ADR `review_date` sweep. Three review dates are
indeed overdue with no recorded action — but the current policy deprecated
calendar review in favour of event triggers: *ADRs name a revisit condition, not
a cadence; a bare "annually" is rejected — a calendar review is ignored, an
event fires.* The frontmatter gate deliberately does not chase `review_date`,
and grandfathers older ADRs. So the overdue dates are legacy artefacts of a
superseded policy, not a live obligation. What would be worth doing — attaching
`review_trigger` values to the 114 ADRs that carry neither — is a different
task, and one nobody asked for.

## The version framing itself is refused

The master draft is titled around a version, declares "release criteria", marks
where the version "SHIPS", and argues the arc *is* the major. Roadmap template
rule 13 forbids exactly this: roadmaps describe work, not shipping; release and
tag decisions belong to the user and are taken outside the roadmap. The arc is
therefore re-cut around its **outcome** — install and use without ceremony —
and the breaking-change inventory is preserved as a roadmap section rather than
as release notes.

## Council convergence (2026-07-31)

anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, $0.14 actual against a
$0.84 cap projection. The debate ran on the two stale pins the model work
targets — the most direct staleness evidence available.

- **Container.** Round 1 both leaned toward splitting the arc into independent
  releases; round 2 reversed on one specific coupling, and that reversal is the
  session's most useful finding: **retiring the curl door and covering the npm
  failure mode are the same change**, because the door's users are precisely the
  users the failure hits. Adopted as a phase dependency. The members' release
  packaging is dropped — roadmaps describe work, and release decisions are taken
  outside them.
- **Plugins.** One member firmly against reopening (the new evidence is about
  channel *reach*; the prior decision turned on *content-path staleness*, and a
  byte-equality test detects staleness rather than preventing it). The other
  called it reopenable but conditional on proving staleness control. Both
  independently proposed the same cheap qualifying experiment: instrument the
  existing shim's install pointer with a provenance marker, wait, and measure
  the marketplace share of installs — which is exactly the pre-registered
  >40%-via-marketplace trigger. Recorded as the honest next step in R1; not
  scheduled, because it is a measurement the maintainer starts, not agent work.
- **Zero-prompt default.** Both members, both rounds: a default inversion
  requiring the gate, not a small additive delta. One offered a falsifier — *if
  the shipped "Recommended" path was already zero-prompt, it IS just
  make-Recommended-default.* Checked: it is a **two-confirmation** path with
  detection-driven pre-selection and "nothing is written until you confirm".
  So the falsifier does not fire, and the real remaining delta is the browser
  handoff itself, not choice overload.
- **The security correction.** Both members, both rounds: treat it on its own
  timeline rather than riding the deferred feature. The council argued for
  shipping a behaviour fix immediately; the roadmaps ship the pinning test plus
  the documented decision instead, because reversing a considered design belongs
  in an ADR amendment. One member's argument step conflated a skill's bulk data
  directory with the config directory — the conclusion survives, that step does
  not.

## A note for whoever moves these drafts

The inbox drafts cite ADR numbers from an external project as though they were
this repo's (this repo's numbering does not reach them). Copying those citations
into the tracked tree unanonymised would breach the source-confidentiality rule.
Nothing in this cut or the roadmaps it spawned carries them.

## Honest framing of this cut

Two things this record does not establish. First, the install-simplification
arc rests on maintainer judgement plus self-evident defects (a troubleshooting
block inside the quickstart, three doors, a five-minute self-description), not
on measured user friction — the instrument that would measure it is the same
unrecruited external session R4 points at, so this work is sequenced *before*
its own evidence. That is a deliberate, stated trade, not an oversight.
Second, a prior council deferred "simple/expert mode" for want of evidence that
rule-count rather than install ceremony is the adoption blocker; this cut bets
on ceremony without settling that question. If the recruited session says
otherwise, the install roadmap is the one that loses.
