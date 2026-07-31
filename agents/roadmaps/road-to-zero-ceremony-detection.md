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

- [ ] Add `src/scripts/_lib/environment_detector.ts`: pure, read-only, cached
      per process, zero network, zero spend. Records: `hosts` (id, binary path,
      version), `auth` (provider, source ∈ `cli-subscription | cli-api-key |
      key-file | env-key`, evidence path — presence only, never a validity
      claim), `keys` (provider, ref).
      <!-- verify: npx vitest run tests/scripts/_lib/environment_detector.test.ts -->
- [ ] Compose existing signals instead of re-implementing them; record in the
      module header which existing probe each field absorbs, so the "no third
      probe shape" property is auditable.
- [ ] Fixture suite over synthetic machines: bare · cli-only · keys-only ·
      mixed · unreadable-credential-file.
      <!-- verify: npx vitest run tests/scripts/_lib/environment_detector.test.ts -->
- [ ] Static property check: the module imports nothing that performs network
      I/O or spawns a billable call.
      <!-- verify: npx vitest run tests/scripts/_lib/environment_detector.test.ts -->
- [ ] Per-host `--version` extraction with output shapes fixture-pinned; an
      unparseable version degrades to `unknown`, never throws.

**Exit criteria:** the fixture suite is green on all five synthetic machines;
the static check fails when a network import is added.
**Rollback:** no consumers yet — delete the file.

## Phase 2 — Make the documented transport default actually load

This phase is a bugfix plus one additive value. It does not remove a key, a
transport, or a precedence layer.

- [ ] Pin the precedence chain in a test that FAILS against today's code:
      invocation flag > per-member `mode` > `defaults.mode` > built-in.
      <!-- verify: npx vitest run tests/scripts/ai_council/modes.test.ts -->
- [ ] Fix the key read so the council path consults `ai_council.defaults.mode`.
      <!-- verify: npx vitest run tests/scripts/ai_council/modes.test.ts -->
- [ ] Reconcile the built-in fallback: the config contract says `api`, the pure
      resolver says `manual`. Pick one, state it in the contract, pin it.
      <!-- verify: npx vitest run tests/scripts/ai_council/modes.test.ts -->
- [ ] Add `auto` as a fourth accepted VALUE of the existing `mode` key
      (`api | manual | cli | auto`). `auto` resolves per provider per
      invocation: binary resolves AND authenticated → cli; else a key resolves
      → api; else unavailable with a one-line reason. `manual` is never part of
      the `auto` chain — explicit opt-in only. Per-member `mode` keeps
      overriding it.
      <!-- verify: npx vitest run tests/scripts/ai_council/transport_resolver.test.ts -->
- [ ] Classify **billing** from (provider, detected auth source), never from
      transport; unknown source ⇒ per-token ⇒ over-gated. Pin as a static check
      that the resolver's inputs carry no transport-derived billing term — this
      is what keeps the existing per-provider rules (vendor-official CLI
      unbilled, community CLI billed) intact under `auto`.
      <!-- verify: npx vitest run tests/scripts/ai_council/transport_resolver.test.ts -->
- [ ] Failure-class-gated mid-flight fallback: binary-missing, auth-rejected,
      and cli-unsupported fall through to the api rung once within the same
      invocation; timeouts and 5xx do **not**. Pin both directions — a
      half-completed CLI call must never be double-spent.
      <!-- verify: npx vitest run tests/scripts/ai_council/transport_resolver.test.ts -->
- [ ] Populate `cli_call_budget` in the template with a conservative default:
      it is the quota guard for the path `auto` prefers, and shipping that path
      unguarded would be the whole point missed.
- [ ] Decide `auto`'s status as a *default* separately from its existence as a
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

- [ ] `doctor` reports, per provider: detected · authenticated · auth source ·
      billing class · enabled-in-config — so the gap between "could work" and
      "allowed to spend" is visible rather than mysterious.
      <!-- verify: npx vitest run tests/scripts/_cli/cmd_doctor.test.ts -->
- [ ] When a provider is detected but not enabled, `doctor` prints the exact
      one-line command that enables it. Discovery becomes zero-effort; consent
      stays explicit.
- [ ] Resolve the template's self-contradiction: the shipped values
      (`enabled: true`, `participate_low_impact: true`) and the comments
      claiming both default to false cannot both be right. Make them agree and
      pin the shipped default.
      <!-- verify: npx vitest run tests/scripts/ai_council/config.test.ts -->
- [ ] Fix the dangling pointer: the settings template references a council
      example file that npm does not ship. Either add it to the allowlist or
      stop pointing at it.
      <!-- verify: npx vitest run tests/scripts/install/files_allowlist.test.ts -->
- [ ] Rewrite the council template's framing from "enable and configure each
      member" to "detection fills this in; you decide what may spend". Record
      the before/after line count as the shipped metric.
- [ ] Open the availability-semantics question as a blocker rather than
      answering it in a roadmap step.

**Exit criteria:** on a machine with a logged-in provider CLI and no config
file, `doctor` names every detected provider, its billing class, and the
one-line command to allow it; ask-before-spend behaviour is byte-identical.
**Rollback:** the `doctor` section is additive; the template rewrite is a
text-only revert.

## Phase 4 — Extend `doctor`, do not duplicate it

- [ ] Add the detection section to the existing `doctor`: hosts + versions, the
      provider → transport → billing-class table, budgets active, and a
      one-line reason plus one-line fix for every unavailable capability.
- [ ] Render the first-invocation spend disclosure from the SAME code path as
      that table — one renderer, not two, so the disclosure cannot drift from
      the report.
      <!-- verify: npx vitest run tests/scripts/_cli/cmd_doctor.test.ts -->
- [ ] Fixture-pin the `doctor --json` shape for the new section (the agent and
      GUI contract).
      <!-- verify: npx vitest run tests/scripts/_cli/cmd_doctor.test.ts -->

**Exit criteria:** `doctor --json` shape is fixture-pinned; every unavailable
capability in the fixture machines carries a non-empty fix line.
**Rollback:** drop the section; the rest of `doctor` is untouched.

## Phase 5 — Pin the `CLAUDE_CONFIG_DIR` inheritance decision

Co-located here because the detector produces the validated path set any future
assignment rule would draw from. This phase ships **no behaviour change**: it
makes current behaviour explicit and routes the trade-off to the threat model.

- [ ] Add a test pinning today's behaviour: the spawn hardening is
      deny-by-family, so an inherited `CLAUDE_CONFIG_DIR` reaches children
      unchanged. Nothing asserts this either way today.
      <!-- verify: npx vitest run tests/scripts/ai_council/spawn_env.test.ts -->
- [ ] Add the candidate row to the threat model with its precondition stated
      honestly: an actor who can set the orchestrator's environment
      (compromised CI runner, poisoned shell profile) but cannot write the real
      config dir can redirect a child to a config directory of their choosing,
      and that directory carries instruction-bearing content.
- [ ] Record the counter-argument in the same row: deny-by-family is
      deliberate because provider CLIs legitimately need arbitrary env, and
      denying this variable breaks any user who legitimately sets it. Name the
      third option — strip inherited, permit only an assignment drawn from a
      validated set — and what it costs.

**Exit criteria:** behaviour is test-pinned; the threat-model row carries
precondition, counter-argument, and three options; the blocker below is open.
**Rollback:** none needed — a test and a documented row are additive.

## Blockers

### blocker: council-availability-semantics
- **Status:** open
- **Owner:** maintainer
- **Blocks:** any removal of `members.*.enabled` (Phase 3 ships reporting and
  a one-line enable command instead)
- **What to do:**
  1. Read the shipped council template's rationale for the flag ("installing a
     key is not the same as wanting the agent to spend money on it") and the
     config contract's fail-closed rules (at least one enabled member; no
     silent skips; low-impact fast-path as a two-knob opt-in).
  2. Decide whether detection-derived availability is acceptable given that it
     converts "a key exists on this machine" into "this provider may be
     called". Per ADR-049 this class of scope expansion requires a threat
     model, not a product rationale.
  3. If yes, write the ADR that supersedes the contract's enabled-member rules
     and states how the ask-gate alone preserves the no-silent-spend property.
- **Resolved when:** an ADR exists naming the superseded contract sections, or
  this roadmap records the flag as retained by decision.

### blocker: transport-auto-default-flip
- **Status:** open
- **Owner:** maintainer
- **Blocks:** making `auto` the effective default (Phase 2 ships it opt-in)
- **What to do:**
  1. Confirm the intent: a user with both a logged-in CLI and an installed key
     moves from per-token dollars onto subscription quota with no config edit.
  2. If yes, authorize the breaking-change entry and the migration note, and
     confirm `cli_call_budget` ships populated in the same change.
- **Resolved when:** the breaking-change entry is authorized, or `auto` is
  recorded as permanently opt-in.

### blocker: claude-config-dir-inheritance-decision
- **Status:** open
- **Owner:** maintainer
- **Blocks:** any behaviour change to the spawn hardening's handling of
  `CLAUDE_CONFIG_DIR` (Phase 5 ships only the test and the documented row)
- **What to do:**
  1. Read the Phase-5 threat-model row and the ADR that chose deny-by-family
     over an allowlist.
  2. Pick one: (a) leave inheritance as-is, keeping the row as accepted risk;
     (b) deny the variable, accepting that a legitimate setter loses it for
     children; (c) strip inherited and permit only a validated assignment.
  3. If (b) or (c), record an ADR amendment — this reverses a considered
     decision and must not land as an unexplained diff.
- **Resolved when:** an ADR amendment names the chosen option, or the
  threat-model row is marked accepted-risk with a dated rationale.

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
