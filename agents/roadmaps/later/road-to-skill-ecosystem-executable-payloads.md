---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
family_cap_state: not-blocked
---

# Road to executable skill payloads — a skill that only describes work cannot be measured doing it

<!-- Intake note, 2026-08-26. This file is repeatedly re-proposed by incoming
     bundles because from outside the estate it looks unowned. It is not.
     The family cap is NOT what is holding it: `lint_roadmap_family_cap.ts:42`
     sets CAP = 2 (reason: ADR-215 § D2, kept at 2 by AI council 2026-08-26,
     2/2 convergent), and `./scripts-run src/scripts/lint_roadmap_family_cap`
     reads 0/2 slot(s) used — all three `road-to-skill-ecosystem-*` roadmaps sit
     in later/, so no slot is occupied and none needs to free.
     What actually holds this file is the Blocked-until condition below: the
     three Phase-0 spike results. A null counts.
     Registered as owner decision 8 in stubs/road-to-owner-authority-decisions.md. -->

> Close the one axis where an external skill estate beats this one: deterministic
> work belongs in code with a declared runtime, a machine-readable output, and a
> code-level injection guard — without importing any of the governance debt that
> estate carries.

> **Blocked until:** `agents/evidence/analysis/skill-payload-phase0-spikes.md`
> records the S0.1 invocation rate, the S0.2 median token delta and the S0.3
> detection result — a null counts as a recorded result.
> **Why the bar is stated inside the condition and not beside it:** an earlier
> draft of this note put it in a sibling field so the resume probe would see a
> bare existence test and decide the note. That works, and that is the objection:
> `_truncateAtNextField` cuts the condition at the next bolded label, so neither
> the compound guard nor the existence guard sees a bar moved one field down, and
> the probe would have reported FIRED on an empty file at this path. Field
> placement flipping a verdict is a bypass, so the bar sits where it belongs and
> the probe correctly reports `undecidable` — a conjunction it can only
> half-weigh is exactly what it should refuse.
> **Why:** all 14 open steps are downstream of blocker
> `phase-0-spikes-need-a-live-host-session` (class 3, human-only, spend-bearing,
> and the trigger-style eval hard-aborts under automation), so zero of them is
> agent-workable. The file is live rather than dead — 6 steps shipped, its
> counts are current — which is `later/`, not `archive/`.
> **Parked** 2026-08-19 by `road-to-estate-drawdown` Phase 2 batch 1, verdict
> PARK-PROBEABLE.

> **Glyph re-classification, 2026-08-13 — maintainer decision, stated rather
> than done quietly.** Fifteen steps carried `[~]` (*deferred*) while their own
> text said *blocked*: "Blocked on S0.1 and S0.2", "Gated on S0.3",
> "Human-gated", "Blocked on Phase 2 producing at least one executable skill".
> All fifteen are now `[ ]`, which — plus the recorded blockers — is what
> *blocked* already means here. The sibling `road-to-inbox-harvest-2026-08-b-ledger-truth`
> made the identical correction and said so out loud; this follows it.
> Two consequences, both intended. The completion figure **falls sharply**,
> because it now counts blocked work as open instead of hiding it as deferred.
> And the Iron-Law-3 condition (`count_open == 0` with any `[~]` left) no longer
> fires, which is what allowed the finished Phase 5 step to be ticked at all —
> the trigger for this decision, and worth naming so nobody reads the
> re-classification as a way of dodging that gate. It is the opposite: the gate
> asked a question the glyphs had been answering wrongly.
> The two items that were arguably parked rather than blocked — the empty-corpus
> injection lint and the trigger-density sweep — moved with the rest, because
> each is held by an external reopen condition ("the moment Phase 2 lands a pilot
> that fetches", "only if a runtime router consumer ships"), which is a blocked
> shape too.

Status: **proposal.** Nothing below is a foundation; every mechanism is
default-off until its gate clears (ADR-202 discipline). Form: inverted harvest
(ADR-211 C/D) — it starts from confirmed defects in this tree and draws sources
in, never pushing sources onto the repo additively.

Source: [`agents/tmp.old/inbox-2026-08-12-skill-payloads/road-to-executable-skill-payloads.md`](../../tmp.old/inbox-2026-08-12-skill-payloads/road-to-executable-skill-payloads.md)
(+ `chat.txt`, the transcript that produced it), analysed via `/analyze:inbox`.
Per `source-confidentiality`, the four external skill estates it compared against
are described here by what they do, never by repo, org, or author name; the raw
named evidence stays in the gitignored path above and never enters the tracked
tree.

## Context

**Family slot.** This roadmap is named into the `road-to-skill-ecosystem-`
family deliberately. It is skill-estate harvest work, so it belongs under the
two-slot capacity cap that `src/scripts/lint_roadmap_family_cap.ts` enforces
(`FAMILY_PREFIX`, `CAP = 2`). One slot was free at drafting
(`road-to-skill-ecosystem-gate-integrity` held the other); naming it outside the
prefix to dodge the cap would be the gate-gaming this package names as a defect.
This consumes the second slot — free one before opening another family roadmap.

**Provenance of the source.** The inbox artifact pinned five live trees on
2026-08-12 and carried `agent-config @ 9c0fe519` (v9.35.0) as its drafting SHA.
That let the staleness window be read mechanically: `9c0fe519..HEAD` is 18
commits, all in unrelated tracks (a turn-end gate, a consultation-rate metric,
an inbox-harvest branch) —
**none touches `src/skills/`, the skill schema, `_lib/`, or the eval layer.** The
defects below are therefore unaffected by the window: they are live, not stale.

**No overlap with the 40-source sweep.** `skill-ecosystem-sweep-2026-08.md`
contains zero references to any of the five source repos, so this is new source
material rather than a re-analysis of settled verdicts.

### Verified defects (the spine)

Each re-verified against the working tree at drafting, not accepted from the
source:

- **D1 — skills are prose, not programs.** 4 of **289** skill directories ship a
  `scripts/` payload (`react-shadcn-ui`, `tailwind-engineer`, `design-tokens`,
  `corpus-grounding`) — identical set at the pinned SHA. 52 declare `execution:`
  and `execution.handler` already admits `shell|node|php|internal|none`
  (`src/scripts/schemas/skill.schema.json:191`), so the mount point exists and
  is unused.
- **D2 — runtime requirements are unstructured.** The only environment field is
  `compatibility`: free text, `maxLength: 500`
  (`skill.schema.json:31`), used by exactly **2** SKILL.md files
  (`docx-authoring`, `pdf-tools`). No structured runtime key — `bins`, `env`, or
  `harness_compat` — exists anywhere in the schema, so `cmd_doctor.ts` and
  `cmd_preflight.ts` — both present in `src/scripts/_cli/` — have nothing
  structured to check.
- **D3 — no per-skill output contract or self-diagnosis.** Zero skills reference
  `--emit=json` or `--diagnose`; no output-contract schema sits beside any
  skill; `cmd_doctor.ts` carries no per-skill flag.
- **D4 — injection hardening stops at the rule layer.** The rule corpus covers
  untrusted input (`untrusted-input-defense`, `lethal-trifecta-guard`,
  `content-quoting-floor`), but the string `untrusted_content` appears **nowhere**
  in `src/scripts/`, there is no `_lib` helper, and no lint requires one at an
  ingestion point. Per ADR-127 that is a promised check that may not run.
- **D5 — no output-quality eval axis.** `src/skills/*/evals/triggers.json` exists
  for **68** skills and `evals.json` for **42**, with `run_skill_evals.ts` and
  `evals.schema.json` — activation and behavioural axes. No harness compares two
  revisions of one skill on pinned inputs with a judge.

### Corrections applied to the source proposal

The source is kept as evidence, not as instructions. Four claims did not survive:

| Source claim | Verdict | What the tree says |
|---|---|---|
| "`triggers.json`, 103 skills" | **never-true** | 68, at HEAD **and** at the source's own drafting SHA. The path is `src/skills/<id>/evals/triggers.json`, not `<id>/triggers.json` — an unanchored count also picks up the `dist/agent-src/` projection and doubles it. |
| "No harness compares two revisions … with a judge" (as a bare gap) | **true, but incomplete** | A large `bench_ab_*` family exists (`bench_ab_run`, `_diff`, `_v2_run`, …). It measures **package impact** on a with/without variant axis, not per-skill revision output. The gap is real; the infrastructure to graft onto is already there, so Phase 4 extends rather than builds. |
| "Backfill mandatory for the 52 skills declaring `execution:`" | **over-scoped** | Only **9** declare `handler: shell`; 21 declare `handler: internal` (no external dependency by definition) and 22 carry no `handler` key at all. A mandate over 52 would demand a declaration from skills that require nothing. Phase 1 narrows to the `shell\|node\|php` set that also declares a `command:`. |
| Phase 5 trigger-density sweep, "measured by `lint_trigger_precision.ts` deltas" | **parked — measures the wrong thing** | `docs/contracts/rule-router.md:27` states NO HOST AGENT PERFORMS A RUNTIME LOOKUP against the router. A lint delta over trigger keywords would move a number in a file nothing reads at runtime, and could not demonstrate an activation change. Parked with the reason rather than dropped. |

### The prior that governs Phase 2, written in rather than discovered later

The measured activation census (`task report-skill-activation`, PR #1214; 59
sessions, 33,654 assistant turns) found **31 skill invocations across 6 distinct
skills of 288 shipped**, 5 of those 6 being slash-commands a human typed. Skills
are effectively never self-selected.

This does **not** kill Phase 1 or Phase 3 — both serve CLI paths (`doctor`,
`preflight`) and script-authoring, neither of which depends on a model choosing a
skill. It bears directly on Phase 2: converting a skill to a thin manual plus a
script pays only if the host invokes the script when the manual says so. S0.1
already gates exactly that, and the census is its stated prior — a spike whose
expected outcome is a kill is still worth running, but it must be run before any
conversion, not after.

## Gap table

| Mechanism from the sources | Verdict | Where it lands |
|---|---|---|
| Thin-manual SKILL.md + deterministic script payload | adopt (pattern) | Phase 2, gated |
| Structured `requires.bins` / `requires.env` / `primary_env` | adapt — native schema under `runtime_requires`, not a vendor namespace and not the reserved `requires` key | Phase 1 |
| `harnesses:` portability list | adapt — structured `harness_compat` replacing free-text | Phase 1 |
| `--emit=json` with a documented output contract | adopt | Phase 2, gated |
| `--diagnose` self-check | adapt — one `doctor --skill=<id>`, not a per-skill flag | Phase 2, gated |
| `<untrusted_content>` tagging at the LLM ingestion point | adopt | Phase 3 |
| Secrets-file permission check (warn on group/other-readable) | adopt | Phase 3 |
| Fail-soft multi-source orchestration (`errors_by_source`, retry-once) | adapt — library, never copied per skill | Phase 2, gated |
| Revision-vs-revision output benchmark with a judge | adapt — third axis on the existing eval/bench layer | Phase 4, gated |
| Weighted RRF fusion, intent-typed rerank hints | parked | no skill needs ranked fusion yet |
| Availability-scored "confidence" metric | **reject** | measures reachability, labels it confidence — honesty-kernel violation |
| Fork-per-locale distribution, copy-per-skill clients | **reject** | counter-example; cite in guidelines, adopt nothing |
| Verbatim description boilerplate across sibling skills | **reject** | negative evidence that `lint_trigger_precision` is load-bearing; change nothing |
| Marketing prose + frozen pricing tables in SKILL.md | **reject** | validates the existing `refresh_trigger` / `sunset_criterion` fields |
| Progressive disclosure of mutating actions to a reference file | adapt | Phase 5 |

## Phase 0 — Falsification spikes

Pre-registered, honest-null publishable. All three are human-gated: they need a
live host session and spend, and a live trigger-style measurement hard-aborts
under automation.

- [ ] **S0.1 host execution reliability.** 20 scripted invocations across 3 pilot
  skills; measure invocation rate and argument fidelity on Claude Code first.
  Prior: the activation census above. *Kill: < 90 % reliable invocation → Phase 2
  stops; Phase 1 and Phase 3 proceed regardless.*
- [ ] **S0.2 token delta.** For 3 candidate skills, current in-context cost of
  the deterministic portion vs. a thin manual plus a script call. *Kill: median
  saving < 30 % → Phase 2 shrinks to net-new skills, no conversions.*
- [ ] **S0.3 requirements-check value.** Inject 5 synthetic missing-dependency
  states; measure whether a requirements-aware `doctor` detects them earlier than
  today's mid-run failure. *Kill: no earlier detection → Phase 1 ships
  schema-only, no doctor wiring.*

## Phase 1 — Structured runtime requirements in the skill schema

Closes D2. Steps 1, 2 and 4 are ungated; step 3 is gated on S0.3.

- [x] Extend `src/scripts/schemas/skill.schema.json` with an optional
  `runtime_requires` object — `bins: string[]`, `env: string[]`,
  `primary_env: string`, `network: string[]` — keeping
  `additionalProperties: false`. **Not** named `requires`: that key is ADR-015
  pack-dependency edges (a list of pack ids, validated in
  `build_discovery_manifest.ts`), and an object there makes every carrying skill
  unassignable in strict mode. The collision cost 13 red CI checks on one root
  cause, because every one of those jobs builds the manifest as a setup step —
  the skill schema declaring no `requires` property was not evidence the name
  was free, since the discovery layer reads frontmatter the schema never declares.
  `verify:` `node -e "JSON.parse(require('fs').readFileSync('src/scripts/schemas/skill.schema.json','utf8'))"` exits 0, `grep -c '"runtime_requires"' src/scripts/schemas/skill.schema.json` is non-zero, and `./scripts-run src/scripts/build_discovery_manifest --write --quiet` exits 0.
- [x] Backfill `runtime_requires` for the skills declaring an **external** handler
  **and an actual `command:`** — 4, not 9. Of the 9 `handler: shell` skills, 5
  (`file-editor`, `quality-tools`, `token-optimizer`, `rtk-output-filtering`,
  `react-shadcn-ui`) declare no `command:` at all: they are advisory prose, and a
  `runtime_requires` block there would be the pro-forma field risk 2 names. The 4 that do
  execute all invoke `./scripts-run`, which needs `bash` and `node` on PATH and
  no egress. Skills with `handler: internal` remain out of scope by definition.
  `verify:` `./scripts-run src/scripts/validate_frontmatter` exits 0 — 436
  artefacts, 0 failing.
- [ ] Wire `cmd_doctor.ts` / `cmd_preflight.ts` to probe declared `bins` on PATH,
  `env` set/unset, and `network` against the egress allowlist. **Gated on S0.3** —
  do not start before that spike publishes.
- [x] Linter rule: an external handler (`shell`/`node`/`php`) **that declares a
  `command:`** without a `runtime_requires` block is an error; `internal`, absent
  handlers, and command-less advisory skills are unaffected.
  `verify:` `missing_runtime_requires` fires on a fixture with `handler: shell` +
  a command and no `runtime_requires`, and stays silent on all three near-misses
  (`internal` + command · `shell` without command · `shell` + command +
  `runtime_requires`). A fifth test pins the collision: a pack-edge `requires:`
  **list** must not satisfy the rule, and a sixth that a flow-style
  `runtime_requires: {…}` does — 6 tests in
  `tests/scripts/skill_linter.test.ts`, 146 pass.
- [x] Deprecate free-text `compatibility` toward a structured `harness_compat`
  enum. **Human-gated:** `compatibility` is a public Agent-Skills spec field and
  2 skills use it; a deprecation is a consumer-visible schema decision, not an
  autonomous edit.

  **Landed 2026-08-14 on the maintainer decision recorded below — option 2 of
  three, additive.** `harness_compat` sits **beside** `compatibility`; the public
  field is kept and marked `deprecated: true`
  (`src/scripts/schemas/skill.schema.json:31-44`), not removed. Both users carry
  the new field additively (`src/skills/docx-authoring/SKILL.md:9`,
  `src/skills/pdf-tools/SKILL.md:9`).

  **Enum: one value, `consumer-installed-deps`, derived not invented.** Both
  declarations assert the identical class — a consumer-installed library/engine,
  zero runtime shipped by this package — and `grep '^compatibility:' src/`
  confirms those two are the complete population, so no second class is
  attested. A `host-native` complement was deliberately **not** added: it is
  implied, never declared. The schema states the growth rule — a value is added
  when a skill attests it.

  **The deprecation notice went to `docs/MIGRATION.md § Scheduled deprecations`,
  NOT to the manifest `deprecations` block, and the reason is checkable.** That
  block is scoped by its own schema to a deprecated *manifest key* still being
  emitted; `compatibility` never reaches the manifest — verified against
  `dist/discovery/discovery-manifest.json`, whose skill entries carry only
  `category/checksum/install/lifecycle/name/packs/path/trust/workspaces`. An
  entry there would announce the deprecation of a key no manifest consumer can
  read. No removal date is pinned (`scope-control`: agents do not pin dates);
  the row reads "next major after the notice".

  A `deprecated_compatibility_field` **warning** (never an error) fires when
  `compatibility` is declared without `harness_compat`, to stop new adoption
  during the window. It matches **0 of 437** artefacts today, so it ships with
  no `pass → pass_with_warnings` regression.
  <!-- verify: ./scripts-run src/scripts/skill_linter --all -->

## Phase 2 — Executable payload pilots

Closes D1 and D3. **Blocked on S0.1 and S0.2** — no step starts before both
publish.

- [ ] Pick 3 pilot skills where determinism dominates; convert to thin manual
  plus a script under the skill's `scripts/`, declared via `execution.handler`.
- [ ] Every pilot ships `--emit=json` with a JSON-Schema output contract checked
  in beside the skill.
- [ ] `--diagnose` implemented as `agent-config doctor --skill=<id>`, never a
  bespoke per-skill flag.
- [ ] Fail-soft contract for any multi-fetch pilot — `errors_by_source`,
  retry-once, render-with-gaps — as a `_lib` module, never copied per skill.
- [ ] *Kill: after 4 weeks of pilot telemetry, invocation rate or output validity
  < 90 % → revert the pilots to prose and publish the null.*

## Phase 3 — Injection hardening at the ingestion point

Closes D4, and is the phase that turns an existing prose rule into a code-level
check. Ungated and independent of every other phase.

- [x] Add `src/scripts/_lib/untrusted_content.ts`: wrap arbitrary text in
  `<untrusted_content>` delimiters with the security notice, and expose a
  secrets-file permission probe that warns on a group/other-readable credential
  file with a `chmod 600` hint. The delimiter carries a per-call random nonce —
  that is the one property careful string concatenation cannot give a caller,
  because it makes the boundary unforgeable from inside the payload.
  `verify:` 9 tests in `src/scripts/_lib/untrusted_content.test.ts`; the
  injection test plants a guessed-nonce closing tag **in the payload** and
  asserts the authoritative tag stays unique and last, and `0o644` / `0o604`
  warn while `0o600` does not.
- [-] Route existing call sites that feed fetched or file-read content into an
  LLM prompt through the helper. **Skipped — zero such call sites exist.**
  Verified rather than assumed: every `await fetch` / `https.request` in
  `src/scripts/` is *outbound* (LLM APIs, GitHub metadata sync, update manifest,
  release health) and none feeds a response back into a prompt; the `gh`-CLI
  users are gates and release tooling; the council's inputs are the operator's
  own roadmap or diff; `second_brain_retrieval.ts` is RAG-shaped but injects
  entries from the committed decision store, which is principal-authored. The
  helper is therefore forward-looking — it exists for the Phase 2 fetching
  pilots and for command-level PR/issue ingestion.
- [ ] Lint (never-silent class) for a call site feeding externally-sourced
  content into an LLM prompt without the helper. **Deferred, with the reason:**
  the population is empty today, and a gate over an empty corpus exits green
  while scanning nothing — the exact defect class the sibling family roadmap
  `road-to-skill-ecosystem-gate-integrity` exists to eliminate. Shipping it now
  would add a gate that cannot fail. Reopen the moment Phase 2 lands a pilot that
  fetches, i.e. when there is a first real call site to guard.

## Phase 4 — Output-quality benchmark axis

Closes D5. **Blocked on Phase 2 producing at least one executable skill** — there
is nothing to benchmark before that.

- [ ] Extend the eval layer with a per-executable-skill `bench.json`: pinned input
  fixtures plus judge config, grafted onto the existing `bench_ab_*` harness
  rather than a new one.
- [ ] Compare working-tree revision against a pinned base ref on identical
  fixtures; pre-register judge verdicts and publish deltas even when null.
- [ ] CI runs the bench on PRs touching an executable skill's `scripts/`;
  advisory first, ratchet only after two consecutive releases show signal.

## Phase 5 — Low-cost sweeps

- [x] **Action-reference guideline.** Codify the split where a SKILL.md declares
  it does not define the mutating workflow and defers write-path steps to a
  reference file behind a precondition; add a linter nudge for skills carrying
  `execution.safety_mode: strict`.
  `verify:` `skill-writing` carries the section and the nudge fires on a fixture.
  **Shipped 2026-08-13.** `skill-writing` § Action-reference split states the two
  allowed shapes (gate inline / defer to `references/`), and `skill_linter` emits
  `strict_mode_missing_write_gate` (warning) when a strict skill's body carries
  neither — pinned by four fixtures in `tests/scripts/skill_linter.test.ts`. The
  tree's one strict skill (`react-shadcn-ui`) passes unchanged, so the nudge
  ships without a ratchet regression.
  A review of the shipped rule recorded two limits worth carrying forward rather
  than burying: the nudge cannot currently fire on anything in the tree (one
  strict skill, and it satisfies both branches), and its phrase list has known
  holes in both directions — a step that says *"Do NOT ask the user first"*
  satisfies it, and *"wait for explicit approval"* does not. It is a warning over
  prose, not a gate, and the section is the actual control.
  <!-- verify: ./scripts-run src/scripts/skill_linter src/skills/react-shadcn-ui/SKILL.md -->
  <!-- verify: grep -n 'Action-reference split' src/skills/skill-writing/SKILL.md -->
  <!-- verify: grep -n 'strict_mode_missing_write_gate' src/scripts/skill_linter.ts -->

- [ ] **Trigger-density sweep — parked, not dropped.** Moving activation
  vocabulary into router `triggers` would be measured by a lint delta over a file
  no host reads at runtime (`rule-router.md:27`). Reopen only if a runtime router
  consumer ships.

## Acceptance Criteria

Each is decidable by a command or by reading a named file — none is satisfied by
an assertion that the work happened.

**Phase 1 (shipped):**

1. `src/scripts/schemas/skill.schema.json` declares a `runtime_requires` object
   with `bins`, `env`, `primary_env`, `network` and `additionalProperties: false`,
   and does **not** redefine `requires` — which is ADR-015 pack edges.
2. `./scripts-run src/scripts/build_discovery_manifest --write --quiet` exits 0.
   This is the criterion the original key choice failed, and it is listed because
   the schema having no `requires` property was mistaken for the name being free.
3. `./scripts-run src/scripts/validate_frontmatter` reports 0 failing.
4. Every skill declaring an external `execution.handler` **and** a `command:`
   carries a `runtime_requires` block; no skill with `handler: internal` or
   without a `command:` is required to.
5. `missing_runtime_requires` **fires** on a fixture with an external handler + a
   command and no `runtime_requires` — including when a pack-edge `requires:`
   **list** is present, since that key satisfies nothing here — and **stays
   silent** on the three legitimate near-misses: `internal` + command, external
   without command, and external + command + a `runtime_requires` declaration in
   either block or flow style.
6. `./scripts-run src/scripts/skill_linter --all` reports 0 fail.

**Phase 3 (shipped):**

7. `src/scripts/_lib/untrusted_content.ts` exports a wrapper whose delimiter
   carries a per-call nonce, and a credential-file permission probe.
8. A payload containing a guessed-nonce closing tag does not terminate the
   wrapper: the authoritative closing tag stays unique and last.
9. The wrapper leaves the payload byte-identical — no sanitising, escaping, or
   truncation of untrusted input.
10. A `0o644` and a `0o604` credential file both report `too-open` with a
    `chmod 600` hint; `0o600` reports `ok`; an absent file reports `missing`.
11. The call-site sweep records a verified count rather than an assumption, and
    the companion lint is deferred **because** that count is zero.

**Roadmap-level:**

12. `lint_roadmap_family_cap` passes with this roadmap inside the
    `road-to-skill-ecosystem-` family — not outside it.
13. `lint_plan_risk_register` passes, and every `Anchored under` reference
    resolves to a real heading.
14. No source repo, org, or author name appears anywhere in the tracked tree —
    `check_no_external_sources` exits 0.
15. Every claim carried over from the source artifact is either re-derived
    against the tree or marked as corrected; no count is reproduced on the
    source's authority alone.

**Explicitly NOT claimed:** that any host invokes a skill-local script (S0.1
gates it, unrun), that a token saving exists (S0.2, unrun), that `doctor`
detects a missing dependency earlier (S0.3, unrun), or that injection is
prevented rather than merely bounded.

## Explicit non-goals

- No adoption of the source distribution model (copy-per-skill, fork-per-locale).
- No availability-based "confidence" metric anywhere in this tree.
- No marketing or pricing prose in any agent-loaded artifact.
- This roadmap does not touch the router-runtime-consumer question beyond what
  Phase 2 pilots surface; that stays owned by `road-to-rule-delivery-integrity`.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 2 builds an executable-payload track the host never invokes | product | The activation census measured 31 invocations of 6 distinct skills across 288 shipped, so a converted skill may simply never run its script — and a conversion is strictly worse than prose if the script is not called, because the manual then describes work nothing performs. | S0.1 gates every conversion and its kill criterion is pre-registered at < 90 % invocation; the census is written into the spike as its prior so a kill is the expected outcome rather than a surprise. | Phase 0 |
| 2 | A mandatory `runtime_requires` block becomes a pro-forma field | product | A schema requirement invites a placeholder that satisfies the validator without declaring anything real, which is the gate-fatigue failure this package has already recorded. | The mandate covers only external handlers (9 skills at drafting), never `internal`; the doctor wiring that gives the field teeth is itself gated on S0.3, so the field is verified by a probe rather than by its own presence. | Phase 1 |
| 3 | The injection lint false-reds across a 466-gate script estate | implementation | A heuristic "externally-sourced variable reaches an LLM prompt" cannot be decided syntactically in general, and an over-broad version would red legitimate call sites and be suppressed wholesale. | Warn-first for one release with the count published, error only after the tree is clean; the helper is a pure addition, so the value lands even if the lint never promotes. | Phase 3 |
| 4 | Deprecating `compatibility` breaks a public-spec surface | implementation | `compatibility` mirrors a public Agent Skills field and two skills use it; replacing it unilaterally would diverge this schema from the spec it cites as intent. | The deprecation step is human-gated and never autonomous; `runtime_requires` lands additively alongside `compatibility` so nothing is removed to gain the structured form. | Phase 1 |
| 5 | The family slot is consumed for a proposal that gets killed | product | Naming this into the capped family spends the last of two slots on work whose largest phase may be killed by S0.1. | Phases 1 and 3 do not depend on S0.1 and deliver on their own, so a killed Phase 2 leaves the roadmap closable rather than stranded; a kill publishes the null and frees the slot immediately. | Phase 0 |

## Blockers

### blocker: phase-0-spikes-need-a-live-host-session

- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** all of Phase 0, Phase 1 step 3, Phase 2 in full, Phase 4 in full.
- **What to do:** S0.1 needs 20 scripted invocations against a live host and
  S0.2 needs a token measurement — both are spend-bearing and a live
  trigger-style evaluation hard-aborts under automation, so they cannot be run
  from an autonomous session. Run them, publish the results (including a null),
  then unblock the dependent phases in their own change.
- **Resolved when:** the S0.1 invocation count and the S0.2 token measurement
  are published as evidence — a null counts — and the dependent phases are
  unblocked in a separate change that cites them.

### blocker: compatibility-deprecation-is-a-consumer-visible-decision

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** decided 2026-08-14 under the blanket in-session maintainer
  grant — **option 2, the additive path**: `harness_compat` lands beside
  `compatibility`, which is kept and marked deprecated rather than removed. The
  eventual removal is approved in principle and scheduled through the consumer-
  notice mechanism (`docs/MIGRATION.md § Scheduled deprecations`), never dropped
  silently and never date-pinned by an agent. The decision record the step cites
  is the schema `$comment` plus that MIGRATION row.
- **Blocks:** Phase 1, the `harness_compat` step.
- **What to do:** decide whether this schema keeps mirroring the public
  Agent-Skills `compatibility` field, adds `harness_compat` beside it
  permanently, or migrates and diverges. `requires` lands additively either way,
  so nothing else waits on this.
- **Resolved when:** the maintainer has recorded which of the three options the
  schema takes, in a decision record the `harness_compat` step can cite.

## Provenance

Source repos were pinned by the inbox artifact on 2026-08-12; the five defect
claims, the four corrections, and every count in this file were re-derived
against the working tree rather than carried over. The source artifact and its
transcript are retained under the gitignored
`agents/tmp.old/inbox-2026-08-12-skill-payloads/`, which is where the named
sources stay.
