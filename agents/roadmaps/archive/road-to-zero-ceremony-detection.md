---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
related_roadmaps: [road-to-zero-ceremony-install]
related_adrs: [ADR-049, ADR-104, ADR-123]
related_contracts: [ai-council-config]
---

# Road to zero-ceremony detection — detection reports, consent still decides

> One read-only, spend-free detector becomes the single input for transport
> selection and the existing `doctor` surface, and the council's documented
> transport default starts actually being read — without weakening a single
> spend gate.

## Goal

Reduce the configuration a working setup requires to the decisions that carry
consent, by making everything *detectable* visible and pre-filled: after this
roadmap, `doctor` explains every available and unavailable capability with a
reason and a fix, transport resolves itself, and the only thing a user must
still say "yes" to is spending money.

## Prerequisites

- [x] `doctor` command family exists (4 commands; the main module already
      performs a read-only `auth.json` probe).
- [x] A pure transport-mode resolver exists (`src/scripts/ai_council/modes.ts`).
- [x] Host-presence signal table exists for 23 hosts
      (`src/install/toolDetection.ts`, test-pinned).
- [x] `cli_call_budget` is implemented in the loader and consumed by council and
      team dispatch — commented out in the template only.

## Context

Source: an external planning set, audited against the tree on 2026-07-31. The
disposition table, the refused items, and the corrected numbers live in
[`zero-ceremony-inbox-cut`](../settings/contexts/zero-ceremony-inbox-cut.md).
Read it first — it is why this roadmap is smaller than the source draft and why
its centrepiece is a bugfix.

Verified starting position:

- **Nothing named `environment_detector.ts` exists** — greenfield.
  `toolDetection.ts` ("is the tool installed on this machine") and `detect.ts`
  ("does this project carry a bridge dir") deliberately answer different
  questions; the new module composes them and replaces neither.
- **`doctor` is not new.** The visible surface exists and is large. Extend it;
  a parallel status command is out of scope.
- **A live two-clocks bug:** `src/scripts/council_cli.ts` reads
  `ai_council.mode` while the template ships `ai_council.defaults.mode`, so on
  that path the documented `api` default is never consulted and resolution
  falls through to the built-in `manual`. The contract and the pure resolver
  also disagree on the built-in fallback (`api` vs `manual`).

  > **Premise corrected during execution (2026-07-31).** The bug is real but
  > NARROWER than stated above, and the correction matters because it changes
  > what the fix has to cover. `council_cli.ts:481`
  > (`_synthesize_ai_council_block`) **flattens** the loader's `defaults.mode`
  > onto a top-level `mode` key, and `build_members` reads that flat key — so on
  > the normal path (a `.ai-council.yml` exists) the documented default IS
  > consulted. The key is never read only when a **raw**, nested-shape dict
  > reaches `build_members` — which is reachable, because `build_members` is on
  > the exported surface (the MCP tool path, embedders, tests). The failing test
  > this phase ships exercises exactly that path and resolved `manual` instead of
  > the configured `cli` before the fix.
  >
  > The fallback disagreement is also two facts, not one: `config.ts:1425`
  > defaults `defaults.mode` to `api` (what every real config observes) while
  > `modes.ts:26` defaults the resolver to `manual` (reached only when no layer
  > supplies a mode at all). Both were right about different layers; the docs
  > conflated them. Resolution: keep both, name them separately, pin each.
- **Auth probing already exists in two shapes** (a council lazy-probe with
  cache and timeout; doctor's read-only `auth.json` probe). A third shape must
  not appear.
- **The council template contradicts itself:** it ships `enabled: true` and
  `participate_low_impact: true` while its own comments claim both default to
  false. The example file is additionally unreachable for consumers — `agents/`
  is absent from the npm `files` allowlist, so the settings template points at
  a file npm never delivers.

### Gap audit against the source draft

| Draft item | Verdict | Why |
|---|---|---|
| One read-only detector module | **KEEP** | Greenfield; consumers named below |
| `doctor` as "the NEW visible surface" | **FOLD** | Already exists — extend, never duplicate |
| Auth-source probes as new work | **FOLD** | Two probe shapes already exist |
| Per-host `--version` extraction | **KEEP** | Needed for `doctor` display and later version gates |
| Billing classified from auth source, never transport | **KEEP** | Correct and additive; becomes a static invariant |
| Failure-class-gated mid-flight fallback | **KEEP** | The double-spend guard |
| `transport.mode` as a NEW global key replacing `defaults.mode` | **CUT → reduce** | The global knob already exists as `defaults.mode`; the draft's three values silently delete `manual` (`billable=False`, the safest transport) and the per-member override the billing rules depend on. Ship `auto` as an added VALUE of the existing key, keep `manual`, keep per-member precedence |
| Remove `members.*.enabled` | **CUT → blocker** | That flag is a spend gate, not ergonomics: the shipped template says "installing a key is not the same as wanting the agent to spend money on it", the config contract fails closed with no enabled member and forbids silent skips, and detection-derived availability is exactly the escalation ADR-049 says needs a threat model, not a product rationale |
| Live-completion test at install time | **CUT** | That is spend at install time; lazy first-use probing stays |

## Phase 1 — The detector module

- [x] Add `src/scripts/_lib/environment_detector.ts`: pure, read-only, cached
      per process, zero network, zero spend. Records: `hosts` (id, binary path,
      version), `auth` (provider, source ∈ `cli-subscription | cli-api-key |
      key-file | env-key`, evidence path — presence only, never a validity
      claim), `keys` (provider, ref).
      <!-- verify: npx vitest run tests/scripts/_lib/environment_detector.test.ts -->
- [x] Compose existing signals instead of re-implementing them; record in the
      module header which existing probe each field absorbs, so the "no third
      probe shape" property is auditable.
- [x] Fixture suite over synthetic machines: bare · cli-only · keys-only ·
      mixed · unreadable-credential-file.
      <!-- verify: npx vitest run tests/scripts/_lib/environment_detector.test.ts -->
- [x] Static property check: the module imports nothing that performs network
      I/O or spawns a billable call.
      <!-- verify: npx vitest run tests/scripts/_lib/environment_detector.test.ts -->
- [x] Per-host `--version` extraction with output shapes fixture-pinned; an
      unparseable version degrades to `unknown`, never throws.

**Exit criteria:** the fixture suite is green on all five synthetic machines;
the static check fails when a network import is added.
**Rollback:** no consumers yet — delete the file.

## Phase 2 — Make the documented transport default actually load

This phase is a bugfix plus one additive value. It does not remove a key, a
transport, or a precedence layer.

- [x] Pin the precedence chain in a test that FAILS against today's code:
      invocation flag > per-member `mode` > `defaults.mode` > built-in.
      <!-- verify: npx vitest run tests/scripts/ai_council/modes.test.ts -->
- [x] Fix the key read so the council path consults `ai_council.defaults.mode`.
      <!-- verify: npx vitest run tests/scripts/ai_council/modes.test.ts -->
- [x] Reconcile the built-in fallback: the config contract says `api`, the pure
      resolver says `manual`. Pick one, state it in the contract, pin it.
      <!-- verify: npx vitest run tests/scripts/ai_council/modes.test.ts -->
- [x] Add `auto` as a fourth accepted VALUE of the existing `mode` key
      (`api | manual | cli | auto`). `auto` resolves per provider per
      invocation: binary resolves AND authenticated → cli; else a key resolves
      → api; else unavailable with a one-line reason. `manual` is never part of
      the `auto` chain — explicit opt-in only. Per-member `mode` keeps
      overriding it.
      <!-- verify: npx vitest run tests/scripts/ai_council/transport_resolver.test.ts -->
- [x] Classify **billing** from (provider, detected auth source), never from
      transport; unknown source ⇒ per-token ⇒ over-gated. Pin as a static check
      that the resolver's inputs carry no transport-derived billing term — this
      is what keeps the existing per-provider rules (vendor-official CLI
      unbilled, community CLI billed) intact under `auto`.
      <!-- verify: npx vitest run tests/scripts/ai_council/transport_resolver.test.ts -->
- [x] Failure-class-gated mid-flight fallback: binary-missing, auth-rejected,
      and cli-unsupported fall through to the api rung once within the same
      invocation; timeouts and 5xx do **not**. Pin both directions — a
      half-completed CLI call must never be double-spent.
      <!-- verify: npx vitest run tests/scripts/ai_council/transport_resolver.test.ts -->
- [x] Populate `cli_call_budget` in the template with a conservative default:
      it is the quota guard for the path `auto` prefers, and shipping that path
      unguarded would be the whole point missed.
- [x] Decide `auto`'s status as a *default* separately from its existence as a
      value, and record the decision: flipping the effective default moves
      existing users' spend from per-token dollars onto subscription quota
      without them editing anything. Until that decision lands, `auto` ships
      opt-in.

**Exit criteria:** the precedence test fails on pre-fix code and passes after;
`auto` resolves correctly on all five fixture machines; a planted
auth-rejection falls back exactly once and a planted timeout does not;
`cost_budget` is untouched on a cli/subscription resolution and still applies
to community-CLI members.
**Rollback:** each step is independently revertable; the bugfix is keepable on
its own even if `auto` is dropped.

## Phase 3 — Detection informs consent; it does not replace it

The draft's deletion of `members.*.enabled` is refused (see the gap audit).
What ships instead removes the *work* of enabling without removing the *record*
of consent.

- [x] `doctor` reports, per provider: detected · authenticated · auth source ·
      billing class · enabled-in-config — so the gap between "could work" and
      "allowed to spend" is visible rather than mysterious.
      <!-- verify: npx vitest run tests/scripts/_cli/cmd_doctor.test.ts -->
- [x] When a provider is detected but not enabled, `doctor` prints the exact
      one-line command that enables it. Discovery becomes zero-effort; consent
      stays explicit.

      > **Shipped as a one-line EDIT, not a command.** No settings-mutation CLI
      > exists — `settings` is a GUI alias and a `settings set` verb is recorded
      > as greenfield in the inbox cut. Printing
      > `agent-config settings set …` would print a command that does not run,
      > which is worse than printing none. What ships is the exact file plus the
      > exact key path:
      > `set \`members.gemini.enabled: true\` in <resolved user-global path>`
      > — which removes the actual work (finding the file and the key in a
      > 481-line config) without inventing a surface. Building a mutation verb
      > is a separate command surface, not a step in a detection roadmap.
- [x] Resolve the template's self-contradiction: the shipped values
      (`enabled: true`, `participate_low_impact: true`) and the comments
      claiming both default to false cannot both be right. Make them agree and
      pin the shipped default.
      <!-- verify: npx vitest run tests/scripts/ai_council/config.test.ts -->
- [x] Fix the dangling pointer: the settings template references a council
      example file that npm does not ship. Either add it to the allowlist or
      stop pointing at it.
      <!-- verify: npx vitest run tests/scripts/install/files_allowlist.test.ts -->
- [x] Rewrite the council template's framing from "enable and configure each
      member" to "detection fills this in; you decide what may spend". Record
      the before/after line count as the shipped metric.

      > **The metric, reported as measured: 414 → 481 lines (+67). It grew.**
      > The reframing itself landed — the `members:` block now opens with
      > "you decide what may spend; detection tells you what is already here"
      > and routes the reader to `doctor --check detection` instead of
      > hand-auditing binaries, key resolution and billing in prose. But the
      > same phase also had to ADD: the `auto` transport semantics, the
      > two-defaults reconciliation, a populated `cli_call_budget` with its
      > sizing rationale, a corrected billing comment (the old one claimed
      > `mode: cli` is never billable, which is false for the two community
      > wrappers), and the consent framing on the master switch. Each of those
      > is a correction or a documented new value, not ceremony.
      >
      > So the roadmap's implied win — detection shrinks the template — is
      > **not demonstrated by this change**, and no reduction is claimed. The
      > honest shipped metrics for this phase are the mechanical ones: a
      > fixture-pinned report shape, a template that now loads with its budget
      > active (verified through the real loader), and a repaired pointer.
      > Shrinking the file is a separate pass that would delete prose rather
      > than correct it.
- [x] Open the availability-semantics question as a blocker rather than
      answering it in a roadmap step.

**Exit criteria:** on a machine with a logged-in provider CLI and no config
file, `doctor` names every detected provider, its billing class, and the
one-line command to allow it; ask-before-spend behaviour is byte-identical.
**Rollback:** the `doctor` section is additive; the template rewrite is a
text-only revert.

## Phase 4 — Extend `doctor`, do not duplicate it

- [x] Add the detection section to the existing `doctor`: hosts + versions, the
      provider → transport → billing-class table, budgets active, and a
      one-line reason plus one-line fix for every unavailable capability.
- [x] Render the first-invocation spend disclosure from the SAME code path as
      that table — one renderer, not two, so the disclosure cannot drift from
      the report.
      <!-- verify: npx vitest run tests/scripts/_cli/cmd_doctor.test.ts -->
- [x] Fixture-pin the `doctor --json` shape for the new section (the agent and
      GUI contract).
      <!-- verify: npx vitest run tests/scripts/_cli/cmd_doctor.test.ts -->

**Exit criteria:** `doctor --json` shape is fixture-pinned; every unavailable
capability in the fixture machines carries a non-empty fix line.
**Rollback:** drop the section; the rest of `doctor` is untouched.

## Phase 5 — Pin the `CLAUDE_CONFIG_DIR` inheritance decision

Co-located here because the detector produces the validated path set any future
assignment rule would draw from. This phase ships **no behaviour change**: it
makes current behaviour explicit and routes the trade-off to the threat model.

- [x] Add a test pinning today's behaviour: the spawn hardening is
      deny-by-family, so an inherited `CLAUDE_CONFIG_DIR` reaches children
      unchanged. Nothing asserts this either way today.
      <!-- verify: npx vitest run tests/scripts/ai_council/spawn_env.test.ts -->
- [x] Add the candidate row to the threat model with its precondition stated
      honestly: an actor who can set the orchestrator's environment
      (compromised CI runner, poisoned shell profile) but cannot write the real
      config dir can redirect a child to a config directory of their choosing,
      and that directory carries instruction-bearing content.
- [x] Record the counter-argument in the same row: deny-by-family is
      deliberate because provider CLIs legitimately need arbitrary env, and
      denying this variable breaks any user who legitimately sets it. Name the
      third option — strip inherited, permit only an assignment drawn from a
      validated set — and what it costs.

**Exit criteria:** behaviour is test-pinned; the threat-model row carries
precondition, counter-argument, and three options; the blocker below is open.
**Rollback:** none needed — a test and a documented row are additive.

## Blockers

### blocker: council-availability-semantics
- **Status:** RESOLVED 2026-07-31 — `members.*.enabled` is **retained by
  decision** (option 1a). No ADR is needed because nothing is superseded.
- **Owner:** maintainer
- **Blocks:** nothing further. Phase 3 ships reporting plus a one-line enable
  edit; the flag stays.
- **Decision:** detection reports capability. It does not confer permission.
  `doctor` surfaces `detected · authenticated · auth source · billing class ·
  enabled-in-config` so the gap between "could work" and "may spend" is
  visible, and prints the one-line edit that closes it. A detected provider
  sitting at `enabled: false` is reported as `ok`, not as a warning — warning on
  a recorded consent decision would train the user to silence their own gate.
- **What the council said (2026-07-31, 2 members / 2 rounds, $0.08):** both
  members independently chose **1a (retain)** in round 1. In round 2 — the
  rebuttal round, where each was asked to attack the other's D1 position — both
  argued for 1b (remove). That reversal is a **debate-structure artefact**, not
  independent convergence: the round-2 prompt assigns the opposing side, so
  "both said 1b" and "both said 1a" are the same two members under different
  instructions. Weighting the independent round is the honest read.
- **Why 1b is refused even on its own terms:** the round-2 construction does not
  eliminate the consent record — it **relocates the writer**. Its mechanism is an
  ask-gate that *learns*: "user choices write to the SAME config file, but as a
  consequence of runtime decision, not a precondition for availability", plus a
  `--skip-confirmation-for=<provider>` persisted flag. That is
  `members.*.enabled` with a different author. So 1b as argued trades an
  explicit, reviewable, version-controllable declaration for an implicitly
  accumulated one, AND requires building a learning ask-gate — a materially
  larger surface than this roadmap, and precisely the scope expansion ADR-049
  says needs a threat model rather than a product rationale.
- **What the council got right, and what shipped because of it:** the friction
  critique is valid — "install a key, then find and flip a flag in a 481-line
  file" is real ceremony, and one member correctly noted that a fix of the form
  "print a command they can paste" concedes the flag adds no *security* on its
  own. Phase 3 ships exactly that mitigation (the one-line edit, printed with
  the resolved path), which is why the remaining cost of retaining the flag is
  one paste rather than a file hunt.
- **Falsifier for reopening:** an ask-gate exists that can express "never offer
  me this provider again" as a **durable, inspectable** record, and a threat
  model covers converting credential-presence into call-permission. Telemetry
  alone does not qualify — one member proposed "how many users install a
  credential and never enable it", and with zero documented external adopters
  that number cannot be gathered honestly today.
- **Resolved when:** ~~an ADR, or recorded as retained~~ — recorded as retained
  by decision, above.

### blocker: transport-auto-default-flip
- **Status:** RESOLVED 2026-07-31 — `auto` ships opt-in; the flip stays closed
  behind a named falsifier (option 2b)
- **Owner:** maintainer
- **Blocks:** ~~making `auto` the effective default~~ — nothing; Phase 2 ships
  `auto` as an opt-in VALUE and the default is untouched
- **Decision:** `auto` is an accepted value of the existing `mode` key. The
  shipped `defaults.mode` stays `api`. The flip is **not** taken now.
- **Why (council 2026-07-31, 2 members / 2 rounds, $0.08):** neither member
  argued for flipping now. One took permanent opt-in (2a); the other took
  opt-in-now-revisit-later (2b) with a concrete falsifier, and named the
  asymmetry that decides it: the surprise is not the price, it is the **pool**.
  A user with a modest plan has budgeted their own interactive quota; council
  usage silently drawing from the same pool can exhaust it for unrelated work,
  and quota exhaustion is a hard cutoff rather than a graduated expense. The
  ask-before-spend gate says "invoke council?" — it does not say "spend 40 of
  your 100 daily messages".
- **The falsifier, checked in-tree:** 2b's stated
  change-my-mind condition was *"proof the shipped config template's CLI call
  guard is applied automatically to existing user configs on upgrade, not just
  new installs"*. It does **not** hold. The council config is user-global and
  copied once from `agents/templates/.ai-council.yml.example`; nothing merges
  template updates into an existing `~/.event4u/agent-config/settings/.ai-council.yml`.
  So an existing user who upgraded would get `auto` **without** the populated
  `cli_call_budget` that makes it safe. That is decisive, and it is why 2b
  collapses onto the same shipped behaviour as 2a for this change.
- **Revisit-if:** an upgrade path exists that merges new `cli_call_budget` keys
  into an already-installed council config (or the wizard re-seeds it), AND the
  dollars→quota trade-off is documented with a worked example. Until then this
  is not reopened.
- **Resolved when:** ~~authorized or recorded permanently opt-in~~ — recorded
  opt-in with the revisit condition above. `cli_call_budget` ships populated in
  this change regardless, because it also guards an explicit `mode: cli`.

### blocker: claude-config-dir-inheritance-decision
- **Status:** RESOLVED 2026-07-31 — **(a) leave inheritance as-is**, recorded as
  accepted risk with a dated rationale. Behaviour unchanged; test-pinned.
- **Owner:** maintainer
- **Blocks:** nothing. Phase 5 shipped the pinning test, `docs/threat-model.md`
  row i, and an ADR-123 follow-up recording the scope.
- **Decision:** (a). `hardenedSpawnEnv` stays deny-by-family with no new entry.
  `docs/threat-model.md` row i carries the precondition, the counter-argument,
  and all three options; `tests/scripts/ai_council/spawn_env.test.ts` pins the
  inheritance both ways so a future change cannot land silently.
- **The council said (3b) — deny the variable — 2/2 members, and it is refused
  on evidence the council did not have.** One member made its own
  change-my-mind condition explicit: *"a concrete user workflow where the
  orchestrator spawns a provider CLI that legitimately needs to load its own
  separate config, distinct from the orchestrator's"*. That workflow exists and
  is shipped: `src/install/agentSwitchProfile.ts` declares
  `PROVIDER_ENV_VARS = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME']`, the integration
  with `@event4u/agent-switch`, which isolates multiple accounts into
  per-account profiles through exactly this variable "so switching accounts
  never requires a re-login". Stripping it sends a spawned council CLI to the
  DEFAULT profile — the wrong account, or an unauthenticated one, silently, on
  the transport whose whole point is using the right subscription. So the
  council's decisive premise ("the cost to the legitimate user is **zero in the
  actual use case**") is false in this repo, and its own falsifier fires.
- **Why not (c) either, yet:** strip-inherited-plus-validated-assignment is the
  only option that closes the gap without breaking agent-switch users, and its
  validation predicate already exists in `agentSwitchProfile.ts`. It is deferred
  rather than rejected: it is still a new restriction that breaks anyone setting
  the variable for a reason agent-switch does not model, and adding one in a
  detection roadmap would be exactly the unexplained security diff this blocker
  was written to prevent.
- **Revisit-if:** a second instruction-bearing config-pointer variable appears,
  or the behavioural-steering path becomes concrete in a real incident. Then (c),
  with an ADR-123 amendment.
- **Also corrected this phase:** row `g`'s Gap cell asserted the consumer-runtime
  surface was "fully hardened". Row i makes that too strong as written, so `g` is
  now scoped to the code-execution families it actually covers.
- **Resolved when:** ~~ADR amendment or accepted-risk row~~ — both landed (row i
  + the ADR-123 2026-07-31 follow-up).

## Acceptance criteria

- The transport precedence test fails against pre-fix code — the bug is
  demonstrated, not asserted — and passes after.
- The contract and the resolver agree on the built-in fallback.
- `auto` exists as an accepted value, resolves correctly on all five fixture
  machines, and does not remove `manual` or the per-member override.
- Billing classification is never derived from transport anywhere (static
  check); vendor-official-CLI and community-CLI billing rules are unchanged.
- A planted auth-rejection falls back exactly once; a planted timeout does not.
- The detector is provably read-only and spend-free; install time never runs a
  completion.
- Ask-before-spend behaviour is byte-identical; no spend gate is removed by any
  step in this roadmap.
- `doctor` names every detected provider with its billing class and, when not
  enabled, the one-line command that enables it; `--json` shape is
  fixture-pinned; the spend disclosure renders from the same code path.
- The council template's shipped values and its comments agree, and its
  example-file pointer either resolves or is removed.
- `CLAUDE_CONFIG_DIR` inheritance is test-pinned and its decision is an open
  blocker, not an unrecorded assumption.
- No claim asserts better answers, better routing, or better judgement. The
  shipped claims are mechanical: a demonstrated bugfix, a spend-free detector,
  template line-count reduction, and a fixture-pinned report shape.

## Gate compliance, stated

The composition-ratchet polish gate is OPEN (the adoption roadmap has 7 open
steps and zero documented external adoptions). Its exceptions are bug fixes,
completing broken first-run flows, and CI/claims infrastructure. Phase 2 is a
bug fix. Phases 1, 4, and 5 are CI/claims infrastructure (a fixture-pinned
report shape, a pinned security behaviour, a documented threat-model row).
Phase 3 is the one that needs the argument: it ships reporting and a one-line
command, not a settings-UI feature, and it removes no gate. If the maintainer
reads Phase 3 as config-management polish, it defers without blocking the rest.

## Provenance

Source: an external planning set delivered through the user inbox, drafted by
an assistant that had the repository tree but not its decision memory. Every
in-tree premise was re-verified on 2026-07-31; corrections and refusals are
recorded in
[`zero-ceremony-inbox-cut`](../settings/contexts/zero-ceremony-inbox-cut.md).

Council 2026-07-31 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds,
$0.14) — relevant convergence: the `CLAUDE_CONFIG_DIR` correction should be
treated on its own timeline rather than riding the deferred cross-profile work
(both members, both rounds). The council argued for shipping a behaviour fix
immediately; this roadmap ships the pinning test and the documented decision
instead, because reversing a considered design belongs in an ADR amendment.
One member's argument step conflated a skill's bulk data directory with the
config directory — the conclusion survives, that step does not.
