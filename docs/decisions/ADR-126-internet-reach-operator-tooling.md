---
adr: 126
status: accepted
date: 2026-07-24
decision: internet-reach-operator-tooling
supersedes: —
superseded_by: —
phase: road-to-internet-reach
type: structural
---

# ADR-126 — Internet reach: operator tooling shipped, router skill cancelled by its own gate

- **Status:** Accepted (2026-07-24)
- **Closes:** `agents/roadmaps/archive/road-to-internet-reach.md`
- **Related:** `docs/contracts/no-runtime-boundary.md` (Class A boundary); ADR-112 (read-only command discipline); ADR-123 (hardened spawn env); ADR-124 (embedded-engine doctrine / Class A–C); `src/rules/lethal-trifecta-guard.md`; `src/rules/source-confidentiality.md`; `src/skills/supply-chain-intake/SKILL.md`; `docs/benchmark.md` § internet-reach.

## Context

The package had no coverage for internet reach: no web-research router, no
upstream-tool health check, no platform-access prescriptions. `CAPABILITIES.yaml`
listed 279 skills across 28 areas with `gaps: 0` — true for the areas the index
tracks, and internet reach was not one of them.

An external capability-layer reference (anonymized per `source-confidentiality`;
provenance retained as an `ENC1:` token in the roadmap) solves this with four
jobs — backend selection, installation, health checking, routing — while
explicitly not wrapping the upstream tools. Three of its mechanism shapes were
worth absorbing: ordered-backend channels (switching a backend is reordering a
list, not editing code), a five-state probe taxonomy with stale-shim detection,
and a tiered access model. Four of its practices were rejected outright:
auto-installation from an unpinned archive, browser-credential harvesting,
an agent-obligating update-check standing rule, and a "MUST USE" trigger with no
published evidence.

The open question was **not** whether those mechanisms are implementable — they
plainly are — but whether a reach layer earns its place next to the host's own
web-search and web-fetch tools. That question was made falsifiable before any
tracked code existed.

## Decision

**1. The reach layer is Class A.** Deterministic, command-invoked probe /
doctor / validation scripts. No LLM call and no network access in the build
path, no resident process, no daemon, no wrapper CLI, no MCP reach server.
Reading and searching itself stays "the agent calls the upstream tool directly".
Every subprocess spawn routes through `hardenedSpawnEnv()` (ADR-123).

**2. Scope was decided by a pre-registered benchmark, before authoring.** 12
credential-free dev-research tasks × 2 arms (host-native tools vs. prototype
reach prescriptions), thresholds and three verdict bands committed before the
run, prescriptions prototyped in gitignored scratch first so both arms were real
at scoring time.

**3. The benchmark returned a null, and the null was honoured.** The native arm
passed 12/12; the reach arm scored **0 outright wins of 12** under the
pre-registered rule (reach wins only where native fails; ties are native wins) →
band `stop`. Therefore **no router skill ships.** The `internet-reach` skill,
its gated-platform prescription set, and the shipped-skill verdict run were
cancelled *pre-authoring* by the gate that was built to cancel them.

**4. The verdict-independent operator tooling ships anyway,** because it answers
a question that does not need a router: *is the upstream tool I already chose to
install healthy, and is its install command pinned?* Concretely: a
schema-validated channel registry, a five-state probe engine with stale-shim
detection, a read-only `reach:doctor`, and a CI gate that fails on any unpinned
install prescription.

**5. Supply chain is prescription-first, mechanized.** No automatic installation
of system packages, no piping a remote script into a shell. The doctor emits an
exact pinned command; a human runs it. "Every prescription passes the intake
gate" is enforced by `check_reach_channels` + `validate_reach_prescriptions` in
CI, not by an honour system — the failure mode the reference itself exhibits.

**6. Two capabilities are refused, not deferred-with-a-wink.** Browser-credential
extraction (a lethal-trifecta leg; the reference documents the account-ban risk
it creates) and CN-market channels (perpetual anti-bot maintenance, no demand
signal in this audience). Re-opening either requires a named demand signal and
its own roadmap.

**7. An adversarial security review ran pre-merge and found a real HIGH — it was
fixed, not documented-around.** The review (`agent-security-review` +
`threat-modeling` over the five reach scripts, the two schemas and the
registration) confirmed the design's strongest property: neither spawn site uses
a shell, no reach script contains a write primitive, no fetched byte reaches any
payload (both spawns discard stdout/stderr, so the only network-derived datum is
an exit code), the credential check stats and never reads, and all three gates are
fail-closed (13/13 negative fixtures non-zero, controls zero). It also found that
`reach:doctor` never validated the registry at runtime while the schema's
`probe_args` denylist leaked — a registry entry of `probe_cmd: sh` +
`probe_args: ["-c", "<payload>"]` passed all three gates with ✅ and was then
executed and reported as healthy under the innocuous backend label. The false
assurance was the defect: the schema asserted a probe "can never install, write,
or authenticate as a side effect", and that was not true. Fixed in the same
change: `collect()` now enforces the schema and refuses on any error-severity
finding (exit 2), `probe_args` became a flag-shaped **allowlist**, `probe_cmd` is
bound to equal its backend `id` (so a row can never label a different binary), the
prototype-chain lookup on the deep-probe table is guarded, the CI refusal moved
from the CLI layer into `collect()`, parse errors no longer echo file content, and
the read-only witness assertion was narrowed to what it actually measures. Two
permanent regression fixtures cover the hostile-registry shape. The schema comment
now states a bounded claim and explicitly declines to promise that every upstream
binary is side-effect-free under every flag — that judgement stays with the human
adding a backend.

## Consequences

**Good.**

- The most expensive possible mistake — authoring, projecting, indexing and
  publicly claiming a router skill that loses to tools the user already has —
  was avoided by measurement rather than by taste.
- What shipped is small, deterministic and independently useful; it carries no
  availability promise and no SLA.
- A published null strengthens the package's evidence posture: the benchmark
  surface now contains a case where the package's own proposed feature lost.
- Pinning and lifecycle discipline are machine-checked, so the supply-chain
  claim is falsifiable rather than aspirational.

**Bad / accepted costs.**

- The capability gap for **gated platforms stays open.** The credential-free
  task set (needed for reproducibility) structurally excluded the two cases
  where a reach advantage was hypothesized: video subtitles (backend absent →
  `untested`) and authenticated / rate-limited access. The null is therefore
  narrow: *on public, credential-free dev-research tasks*, a reach layer buys no
  capability the host lacks. Anyone wanting the gated case measured must
  pre-register a credentialed task set with its own thresholds.
- A **measured cost asymmetry is left on the table on purpose.** On all 8 tasks
  both arms solved, the reach arm cost 0.46× the native arm's tokens (0.26× on
  repository metadata, 0.31× on discussion search) — the native arm repeatedly
  paid *discovery overhead* to find the machine-readable endpoint the
  prescription already knows. This is recorded outside the decision: the token
  threshold was authored as a ≤1.5× guardrail, never a win condition, and
  promoting it to one after seeing the data would be precisely the post-hoc
  rigging the bands exist to prevent. Acting on it requires a separate,
  cost-primary pre-registration.
- **Both accepted costs now have a named re-entry point,** so neither stays a
  footnote: `agents/roadmaps/later/road-to-reach-gated-platforms.md` (the
  credential-gated case the keyless task set could not ask) and
  `agents/roadmaps/later/road-to-reach-cost-primary-bench.md` (the cost thesis,
  with a pre-registration whose primary metric is token cost and whose ledger
  includes the maintenance cost of the thing winning). Both are parked in
  `later/` with explicit resume triggers — a named demand signal, a measured
  host-capability regression, or a maintainer decision. Neither may reuse this
  roadmap's task set or thresholds: a capability-shaped corpus must not be
  allowed to decide a cost question, and vice versa.
- The registry carries maintenance weight (upstream tools break at platform
  cadence). Contained by `last_verified` + an offline staleness lint + an
  append-only upstream-change log — not by a scheduled network job, which would
  buy flaky CI and an implicit availability promise.

## Alternatives considered

- **Ship the router anyway and measure later.** Rejected: re-benchmarking an
  already merged, indexed and comparison-table-listed skill documents a decision
  instead of gating it. The gate has to be able to say no.
- **Lower the win threshold until the reach arm passes.** Rejected as rigging.
  Worth recording that the band is *defect-insensitive* here: two reach failures
  were prescription bugs, but repairing them yields ties, and ties are native
  wins — zero native failures means zero possible reach wins regardless of
  prescription quality. There was nothing to salvage by re-running.
- **Promote the token-cost finding into the verdict.** Rejected for this
  roadmap; see the accepted cost above. It is a genuine signal and it deserves
  its own honest experiment, not a retrofitted one.
- **A weekly scheduled job probing every upstream backend.** Rejected: flaky CI
  against third-party endpoints plus an availability promise the package does
  not make. Replaced by staleness metadata + an operator-invoked deep check.
- **A credits/attribution entry naming the reference.** Rejected:
  `source-confidentiality` forbids derivation-attribution in tracked artefacts,
  and the license carve-out covers vendored code only — nothing is vendored.
  Provenance lives anonymized in the roadmap with the link as an `ENC1:` token,
  and the reference's identifying tokens were added to the CI denylist so a
  future accidental attribution fails the build.

## References

- `internal/bench/reach-vs-native/README.md` — pre-registered tasks, thresholds, bands, run protocol.
- `internal/bench/reach-vs-native/VERDICT.md` — tally, per-channel S0a/S0b, `band: stop`, honest limitations.
- `docs/benchmark.md` § internet-reach — the published null.
- `internal/upstream-changes.md` — maintenance log for channel breakage.
- Council: anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-24, 3 rounds — converged on the five structural defects of the first draft (impossible sequencing, rigged threshold, post-facto verdict, unfalsifiable acceptance criteria, unmechanized discipline claims); all five fixed before execution.
