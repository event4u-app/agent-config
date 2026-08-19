---
complexity: structural
execution:
  mode: autonomous
---

# Road to council api fallback — the contract promised a retry no path performed

> **Source:** external analysis session, 2026-08-18
> (`agents/tmp.old/long-horizon/road-to-council-api-fallback.md`), drafted
> against `origin/main` @ `851568b5cd756450488e0b7fb2f6eb1bcd4cd230`
> (Merge PR #1418). Phase 0 shipped as
> `agents/tmp.old/long-horizon/mid-flight-cli-api-fallback.patch` from the same
> session. Re-verified 2026-08-19 against `3d5bf5945` (14.3.0): every file the
> patch touches is byte-unchanged across the 41 intervening commits, and the
> patch applies clean. Every file:line in § 1 refers to the PRE-patch tree;
> post-patch references name the patch.

---

## 0. The defect, stated first

When the cli council stops working mid-pass, the seat is simply lost — even
when a working api key sits right there. Three distinct defects compose into
that outcome:

### D-1 — The mid-flight fallback was a ghost ship

`MidFlightFallback`, `isFallbackEligible`, `classifyCliFailure` shipped as a
complete, tested module with **zero call sites outside the module and its
tests** — the code said so itself ("HONEST SCOPE",
`transport_resolver.ts:385–392`). Meanwhile
`docs/contracts/ai-council-config.md:176–182` described the fall-through
**normatively**, as behaviour. Contract promised, code declined to perform:
an inverted direction of proof in the project's own primary contract document.

### D-2 — Two quota shapes collapsed into one blanket exclusion

`quota_exhausted` was excluded from fallback eligibility with the rationale
"the quota is a cap the user deliberately set" (`transport_resolver.ts:370–375`).
That rationale is true for exactly ONE of the two shapes the code itself
distinguishes via `metadata.quota_source` (`cli_call_budget.ts:44`):

- **local `cli_call_budget`** — the operator's own cap, refused pre-spawn
  ("nothing sent, nothing booked", `clients.ts:1449–1463`);
- **provider-side plan quota** — the PROVIDER's limit, stderr-classified
  (`clients.ts:1625–1626`), rejected at the request boundary.

Both satisfy the no-double-charge property the eligible set is built on. The
real gate is billing class (unmetered subscription → metered USD), which is an
operator decision — not a fault class.

### D-3 — Runtime failures silently shrink the pass

A CLI call failing mid-flight (auth expired, quota, timeout) tags the
response with `error` and the loop moves on (`orchestrator.ts:762–781` at the
pin). The static `auto` chain (`transport_resolver.ts:199–235`) covers only
construction time — a member that resolved to `cli` and then lost the
transport mid-pass had no path back to the api rung it would have resolved to
had the failure been visible one step earlier.

## 1. Verified provenance

Verified 2026-08-18 against `origin/main` @ `851568b` (fresh clone, live tree).
Re-verified 2026-08-19 against `3d5bf5945` — the four source files carry zero
diff since the pin, so the line numbers still resolve.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Static auto chain cli → api → ∅ exists and is wired | **true** | `transport_resolver.ts:199–235`; consumed via `resolveMemberTransport` at `council_cli.ts:787` |
| 2 | `MidFlightFallback` / `isFallbackEligible` have zero production call sites | **true** | `transport_resolver.ts:385–392` (self-declared); grep at `3d5bf5945`: only `tests/scripts/ai_council/transport_resolver.test.ts` |
| 3 | Contract describes mid-flight fallback as behaviour | **true** | `docs/contracts/ai-council-config.md:176–182` |
| 4 | `quota_exhausted` blanket-excluded from eligibility | **true** | `transport_resolver.ts:370–375` |
| 5 | Local budget refusal happens pre-spawn (no double-spend) | **true** | `clients.ts:1449–1463`, `quota_source: LOCAL_BUDGET` |
| 6 | Provider quota classified from stderr, distinct shape | **true** | `clients.ts:1617–1626`; `cli_call_budget.ts:44` |
| 7 | Orchestrator loop surfaces CLI failure as `error`, no retry | **true** | `orchestrator.ts:762–781` (pin); exceptions → `_excTag`, loop continues |
| 8 | Loader default is `auto` unconditionally | **true** | `config.ts:1563` (`_build_defaults`); contract "Loader value" row |
| 9 | `run_debate` / stance-repair / chairman synthesis reuse `_run_round` / `consult` with their own opts | **true** | `orchestrator.ts` `_run_round` callers at 1401/1430/613 (post-patch numbering); chairman `consult([client])` at `council_cli.ts:1518` (pin) |
| 10 | Three `build_members` callsites: `cmd_estimate`, `cmd_run`, `cmd_debate` | **true** | post-patch `council_cli.ts:1795 / 2539 / 3079` |
| 11 | `classifyCliFailure` DOES have production call sites, unlike its two siblings | **true** | `quorum_wiring.ts:175`, `council_cli.ts:2708/3246` at `3d5bf5945` — row 2 is a claim about the other two symbols only |

## 2. Honest scope of Phase 0 (the shipped patch)

The patch wires the fallback for **`cmd_run`'s consult rounds only**. Debate
rounds, peer review, stance-repair calls, and the chairman synthesis pass all
route through `_run_round`/`consult` with opts objects that do NOT carry
`cli_fallback` — they behave byte-identically to before. The config key is
read leniently off the raw settings dict; it is not yet a first-class,
schema-declared key. No events are emitted; the fallback is visible only in
response metadata. These are Phases 1–3, stated as gaps, not glossed.

## 3. Council input on the Phase 1 decisions — one seat, not convergence

Run 2026-08-19, `mode=prompt`, 2 rounds, $0.0421 actual. **1 of 2 seats
answered**: the openai/codex seat returned `os_error: ENOBUFS` and is in
`absent_members`. So this is a single model's opinion and is labelled one
everywhere it is cited — it is not council convergence, and no gate rests on
it.

| Question | Verdict | Adopted |
|---|---|---|
| Ledger scope for `run_debate` | one ledger per invocation, **conditional on the escalation being visible** | yes — plus F-1's twin map, without which the pick's own premise is false |
| Stance repair may fall back | yes — transport health and structural validity are independent failure modes | yes, departing from this roadmap's original recommendation |
| Chairman synthesis may fall back | yes — no redundancy behind it, unlike a seat | yes, matching the original recommendation |

The condition attached to the first verdict — *"fallback should never be
silent"* — is discharged in this same change-set: every fallen-back response
carries `fallback_from` / `fallback_reason`, reuses are marked
`fallback_sticky`, and Phase 3.0 emits the event.

## Phases

### Phase 0 — Core wiring

- [x] **0.0** `FallbackPolicy { apiOnQuota }` + `isFallbackEligibleUnder`;
      base classes policy-independent, `quota_exhausted` opt-in only,
      `timeout`/5xx ineligible under EVERY policy (no key exists to override).
      `verify:` `npx vitest run tests/scripts/ai_council/transport_resolver.test.ts` — 67 green.
- [x] **0.1** `ConsultOptions.cli_fallback`; one `MidFlightFallback` ledger
      per `consult()` invocation spanning all rounds; retry runs its OWN
      projected-spend gate (breach → original failure +
      `fallback_skipped: cost_budget`); twin response replaces the seat
      index-aligned with `fallback_from` / `fallback_reason` /
      `fallback_original_error`; realized cost, daily ledger and transport
      stamp run on the twin.
      `verify:` `npx vitest run tests/scripts/ai_council/orchestrator.test.ts` — 62 green.
- [x] **0.2** `build_members` out-param `fallback_out` (quorum_out
      convention); lazy api-twin factory enforcing the SAME strict
      `api_key_ref` contract as the api branch (`CouncilDisabledError` →
      `null`); lenient read of `ai_council.fallback.api_on_quota`
      (default `false`); wired into `cmd_run`.
      `verify:` `npx vitest run tests/scripts/council_cli.test.ts` — 26 green.
- [x] **0.3** Contract section rewritten: wiring named, quota opt-in
      documented with YAML example, `model_unservable` added to the stated
      eligible set (it was already in the code's set).
- [ ] **0.4** Land on `main` via the PR this roadmap ships in; the PR body
      names the behaviour change as opt-in-gated (default path
      byte-identical: no `cli_fallback` opts → no retry, pinned by test).

### Phase 1 — Remaining call paths

- [x] **1.0** `cmd_debate`: `fallback_out` into its `build_members` call,
      `cli_fallback` threaded into `run_debate`, and ONE ledger per
      `run_debate` invocation spanning the restate pass, every round, and
      the gate repairs. **Decision: one ledger per invocation** (council
      2026-08-19, single anthropic seat — see § 3), on the ground that the
      eligible classes are durable and a per-round ledger re-spawns the
      dead binary once per round.
      `verify:` `npx vitest run tests/scripts/ai_council/orchestrator.test.ts` — 70 green.
- [x] **1.1** Stance repair **and** chairman synthesis both fall back.
      Synthesis matches the original recommendation; **stance repair
      departs from it** on the council's argument that transport health and
      structural validity are independent failure modes, so refusing the
      retry discards salvageable work for an unrelated reason. Both
      rationales, including the counter-arguments, are recorded at the
      call sites rather than only here.
      `verify:` `npx vitest run tests/scripts/ai_council/orchestrator.test.ts` — 70 green.
- [x] **1.2** `cmd_estimate`: decided non-goal, recorded as a docblock on
      the function so the three-site `build_members` census does not
      re-open it. It prices members and never calls one, so there is no
      mid-flight failure to fall back from.

#### What Phase 1 found — two defects the wiring exposed

Both were discovered by writing the multi-round test the roadmap's own
`verify:` line asked for, and both are fixed in this phase.

- **F-1 — invocation scope was strictly worse than round scope.**
  `MidFlightFallback.attempt` grants `'api'` at most once per provider, and
  nothing substituted the twin afterwards. So under an invocation-wide
  ledger round 2 called the dead binary again, failed again, was refused by
  the ledger, and lost the seat for the rest of the pass. The scope was
  chosen for a property the mechanism did not have. **Fix:** a per-invocation
  twin map; a fallen-back provider is substituted BEFORE the call from the
  next round on, so the binary is spawned once, the twin is built once, and
  the ledger keeps guarding the one spend-bearing establishment.
- **F-2 — the fallback was unreachable for every vendor CLI.** `CliClient`
  is `billable = false`; the non-billable branch of `_run_round` returns
  before the retry block. Only `XAICliClient` and `PerplexityCliClient`
  (`billable = true`, they consume an API key) could ever reach it — never
  anthropic, openai, or gemini. Phase 0's tests passed because they mock a
  billable cli seat. This is D-1 one layer down: shipped, tested,
  never executed. **Fix:** the establishing retry runs in the non-billable
  branch and rejoins the metered path, so the twin is projected, gated,
  booked and stamped as the api member it is. Pinned by a named regression
  test.

### Phase 2 — Config as a first-class key

- [x] **2.0** The loader tolerates the block (it rejects unknown keys in
      exactly two places, neither top-level) — but tolerance was the wrong
      question, and asking only it would have shipped **F-3**: the key is
      now MODELLED (`FallbackConfig`, `_build_fallback`) because the
      runtime never sees the file. A malformed block reads as off; a
      malformed `api_on_quota` VALUE is refused, because that is an
      operator authorising spend and neither reading may be guessed.
      `verify:` `npx vitest run tests/scripts/ai_council/config.test.ts` — 91 green.
- [x] **2.1** Declared in the wizard's council payload schema
      (`src/server/routes/wizard.ts` — the actual GUI surface;
      `src/server/schemas/settings.ts` carries no council block), read back
      by `extractCouncilConfig`, with the billing-class rationale in the
      docblock. Required adding the block to the shipped template too:
      `replaceScalar` returns the body unchanged when the path is absent,
      so a key the template omits is silently unwritable.
      **The roadmap's stated reason for this step is refuted** — the GUI
      could not have stripped the key, because the write path is a
      comment-preserving surgical edit and never a full dump. The real gap
      was that the one billing-class decision was hand-edit-only.
      `verify:` `npx vitest run tests/server/wizard.aiCouncil.test.ts` — 4 green.
- [x] **2.2** `council:status` prints one line per cli seat (would fall
      back to api / no api rung) plus one line for the quota opt-in, in
      both the text and `--json` surfaces. A seat not on the cli rung is
      skipped rather than printed as `none`: it has nothing to fall back
      FROM, and `none` would read as a missing capability. The posture is
      derived from the same two facts the twin factory uses, so the line
      and the retry cannot disagree.
      `verify:` `npx vitest run tests/scripts/council_cli.test.ts` — 26 green.

#### F-3 — the third dropped key, and the one with money attached

`council_cli.ts::load_settings` does not hand `build_members` the config
file; it hands it a block **synthesized** from `CouncilConfig`. The lenient
read added in Phase 0 therefore read a key that block never carried, so
**no config file could turn `api_on_quota` on** — while the contract
section, the roadmap, and the unit tests all described a switch that
worked. Fixed by modelling the key and forwarding it.

Two comments already standing at that synthesizer describe the identical
defect for `quorum` and `quorum_min_present`. This is its third instance,
which makes it a defect of the SHAPE rather than three accidents: any key
validated by the loader and absent from the synthesizer is enforced at load
and invisible at runtime. Worth a lint; not built here, and named as not
built rather than left implied.

### Phase 3 — Observability

- [x] **3.0** New `transport_fallback` action in `events_log`, carrying
      provider, failure class, `outcome` ∈ `retried | no_twin |
      cost_budget`, and the `api_on_quota` posture. One line per
      ESTABLISHING escalation, not per substituted call. The sink is wired
      in `council_cli.ts` via an `on_event` callback rather than by
      importing `events_log` into the orchestrator — that module's header
      declares it a pure library with no stdout and no disk, and this
      would have been the first thing to break it.
      `verify:` `npx vitest run tests/scripts/ai_council/orchestrator.test.ts` — 76 green.
- [x] **3.1** `render()`'s member meta line names the transport that
      actually answered, and distinguishes the escalating round ("fell
      back from cli") from a reuse ("cli lost earlier this pass") so a
      reader does not count two escalations from two rendered lines.
      `verify:` `npx vitest run tests/scripts/ai_council/orchestrator.test.ts` — 76 green.
- [x] **3.2** Pinned, in both directions: a seat answered by the twin
      counts PRESENT, and a seat whose retry was refused by the budget
      (`fallback_skipped: cost_budget`) still counts absent. The reading
      was already correct; the test exists because nothing else in the
      tree would fail if attendance started keying on the declared
      member's transport instead of on the response.
      `verify:` `npx vitest run tests/scripts/ai_council/council_cli.test.ts` — 51 green.

### Phase 4 — Falsifiability gate (blocker for default-on of anything)

- [x] **4.0** End-to-end from a real config file: loader →
      `_synthesize_ai_council_block` → `build_members(fallback_out)` →
      `consult` → api twin → rendered artefact, with a dead cli seat shaped
      like the real thing (`billable: false`, `transport: 'cli'`). Both
      quota directions, the base auth class with the opt-in OFF, a
      provider with no api rung, and a key rotated between construction
      and retry.
      The transport is stubbed AFTER the real factory has built and been
      asserted on — the first draft called the real client and came back
      with a 401 from Anthropic. A unit test that reaches the network is a
      flake, not a gate.
      `verify:` `npx vitest run tests/scripts/ai_council/council_cli.test.ts` — 56 green.
- [x] **4.1** `claim: council-fallback-loses-zero-seats` registered in
      CLAIMS.md, `status: backed`, evidence in `exec:` form so the suite
      re-derives it rather than an existence check resolving forever.
      `api_on_quota` STAYS default-off — flipping it is out of scope here
      and needs its own cost-impact evidence.
      `verify:` `./scripts-run src/scripts/check_claims` — green, ledger 48 backed.

#### F-4 — the gate paid for itself on its first run

Writing 4.0 surfaced a fourth defect: the twin factory caught
`CouncilDisabledError` and `CliClientError` but not `CouncilConfigError` —
which is precisely what `resolve_api_key` throws when a referenced env var
is unset or a key file has moved. A key rotated between construction and
the retry therefore threw out of the factory, out of `_run_round`, out of
`consult`, and took down the whole pass. A mechanism that converts a
recoverable seat loss into a total loss is worse than no mechanism. Now
caught, and pinned by the rotated-key case.

### Phase 5 — Optional refinement (proposal, not committed)

- [~] **5.0** *(P-QUOTA-SOURCE-SPLIT — proposal)* Split the opt-in by
      quota_source: `api_on_quota: local | provider | both | false`. Only
      if real operation shows the operator wants provider-quota
      fall-through but not local-cap fall-through, or the reverse. Do not
      build ahead of that evidence. **Deferred by design** — the roadmap's
      own text forbids building it now; the deferral IS the decision, not
      a delay, and it does not gate archival.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An unmetered subscription call silently becomes a metered USD call | product | The point of the fallback is routing around a dead CLI transport, and the api rung bills in dollars where the CLI rung billed nothing. An operator who never opted in could see spend appear. | `api_on_quota` ships default-off; the retry runs its own projected-spend gate and abandons to the original failure on breach; base eligibility covers only classes rejected at the request boundary. | Phase 0 |
| 2 | A double charge on a partially generated response | implementation | Falling back after a `timeout` or a 5xx cannot know whether the first call generated tokens. | `timeout` and `server_error` are ineligible under EVERY policy and no config key exists that could enable them. | Phase 0 |
| 3 | The contract keeps describing behaviour the code declines to perform | product | The defect this roadmap closes is exactly an inverted direction of proof; a partial wiring re-creates it one call path down. | § 2 states the shipped scope as gaps rather than glossing them, and Phase 1 closes the remaining call paths before Phase 4 registers any claim. | Phase 1 |
| 4 | The index-aligned seat replacement breaks the quorum contract | implementation | The twin response substitutes for a seat mid-pass; a mis-aligned write would corrupt attendance accounting. | The replacement is index-aligned by construction and 3.2 pins the quorum reading with a test rather than trusting it. | Phase 3 |
| 5 | The lenient config read masks a strict-loader rejection | implementation | The key is read off the raw settings dict; a strict loader elsewhere could refuse the same file and the failure would surface at an unrelated command. | 2.0 probes every command that loads the file before 2.1 declares the key. | Phase 2 |
| 6 | A fallback seat reads as a native api seat in analysis | product | Without an event, attendance analysis cannot separate "saved by fallback" from "always was api", which makes the mechanism's value unmeasurable. | Phase 3 emits the event and surfaces the transport in the rendered artefact before any default is reconsidered. | Phase 3 |
