---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to Demand-Gate Audience

**Goal.** The demand gate stops recommending *defer* for work that has no market
by design — by naming the addressee the package currently has no word for, while
leaving the public-market path byte-identical.

Source: `agents/tmp.old/adaptions-fix.txt`

## Context

A downstream consumer project reported that agent-written roadmaps for a
**single-user private tool** carried a demand-measurement phase, a
pre-registered threshold of "external installations with write activity", a
30-day post-release measurement window, and a gate that held a 33-step roadmap
closed until that threshold was met. The roadmap would have stayed closed
permanently: the opening condition required a user population the project
intends never to have.

The cause is one section. `src/rules/improve-before-implement.md`
(`workspaces: [engineering]`, `packs: [engineering-base]`) routes to
`docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md`, whose
`### 8-pre. Demand gate` (line 104) maps a request onto an L0–L4 ladder whose
two build-levels are defined **exclusively over third-party users**:

| Level | Signal | Recommendation |
|---|---|---|
| L3 | Blocks activation/retention for a real segment | **Build** |
| L4 | Users are churning / deals lost without it | **Build now** |

A tool with one user cannot reach either — not because it is bad, but because
the scale has no value for it. Its ceiling is L0 ("founder/agent anxiety"),
whose recommendation is **Defer**. A product-demand hierarchy sits inside an
engineering rule and knows exactly one addressee: the external market.

The guideline says "never block" (line 109) and "This is advisory" (line 128),
and in conversation that holds. In an **artefact** it does not: when a roadmap
needs a falsifiable opening condition, the agent reaches for the only vocabulary
it has for "should this exist", and an advisory ladder becomes a number, then a
gate.

Sibling: `road-to-demand-gate-audience-followup.md` (draft) carries the two
items this roadmap deliberately does not execute — see **Non-goals**.

## Verification of the source note (all claims re-checked at `26c575f66`)

The note was drafted against `c3e75c6a5` (2026-08-12 02:44), ~2 h before the
handover. Every load-bearing claim was re-read against the current tree; the
relevant lines are unchanged, so the **overtaken** fraction is zero.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | `improve-before-implement` is `workspaces: [engineering]`, `packs: [engineering-base]`, routes to the guideline | still-true | `src/rules/improve-before-implement.md:11,17,18` |
| 2 | `### 8-pre` at line 104; L0 row 121; L4 row 125; "Build only at L3–L4" 127 | still-true | `docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md:104,121,125,127` |
| 3 | `activation-design` is `workspaces: [product]` | still-true | `src/skills/activation-design/SKILL.md` frontmatter |
| 4 | No `audience` key exists in the settings template | still-true | `grep audience src/config/agent-settings.template.yml` → no match |
| 5 | The product cluster is cleanly scoped, incl. `validate-feature-fit: [product]` | **never-true (partial)** | `validate-feature-fit` is `workspaces: [engineering]`. `rice-prioritization`, `retention-loops`, `funnel-analysis`, `activation-design` are `[product]` as claimed |
| 6 | `rule_workspaces` includes `engineering`, so removing `product` changes nothing here | still-true | `src/config/agent-settings.template.yml:80` |
| 7 | "three-question advisor, NOT a product-management framework" / "never block" / "This is advisory" | still-true | guideline `:107,109,128` |
| 8 | `lint_roadmap_complexity` already carries gate analysis | still-true | `src/scripts/lint_roadmap_complexity.ts:216–218,319–372` (`_check_human_gate_*`) |
| 9 | `strategy-safety-floor` demands a "named decision owner" | still-true, **not a defect** | `src/rules/strategy-safety-floor.md:84` — the row fires only on *"Public-facing positioning (PR, fundraise narrative)"*, which is a genuinely public context. Correctly scoped; no change needed |
| 10 | Note § 9: external-user semantics may sit elsewhere ("a sweep belongs in the same rework") | performed, single-site | `grep -rln "real segment\|users are churning\|deals lost\|market demand\|demand evidence" src/rules/ src/skills/ docs/guidelines/` returns **exactly one** file — the guideline above |

Claim 5 is the consequential one: the note's **Stufe 3** proposes moving `8-pre`
into `validate-feature-fit` so that `rule_workspaces` would gate it. That
artefact is engineering-scoped, so the move would not gate anything. Recorded
under Non-goals rather than executed on a falsified premise.

## Gap-table — what of the note is adopted

| Note item | Verdict | Where |
|---|---|---|
| Stufe 1 — an `L-self` row + an honest sentence scoping the ladder to market demand | **KEEP** | Phase 1 |
| Stufe 2 — a `project.audience` settings key read by `8-pre` | **KEEP** | Phase 2 |
| Stufe 2 — the roadmap-authoring consequence ("at self/internal no gate may rest on an external population") | **KEEP** | Phase 2 + Phase 3 |
| Stufe 2 — default `internal` rather than `public` | **CUT (this roadmap)** | Non-goals — consumer-facing default flip |
| Stufe 3 — move `8-pre` into the product workspace | **CUT (this roadmap)** | Non-goals — premise falsified (claim 5) |
| § 7 — a plausibility check for roadmap gates resting on a population the project cannot produce | **FOLD** into `lint_roadmap_complexity` as a warning | Phase 3 |
| § 8 check 1 + 2 — regression and counter-test | **KEEP**, as artefact-level tests | Phase 4 |
| § 9 — sweep for other external-user presuppositions | **KEEP**, already executed | Claim 10 above; no further work |

## Non-goals — deliberately not executed here

1. **Flipping the default to `internal`.** The note argues today's *de facto*
   default is `public` and that most repos running this package are not products
   with a market. That is a reasonable argument and a **consumer-facing default
   flip**: it changes behaviour for every existing install, including installs
   whose maintainers never read this change. The key therefore ships with
   `public` — today's behaviour, byte-identical, no regression for anyone — and
   the flip is the user's decision. This also keeps the note's own check 2
   trivially satisfiable.
2. **Moving `8-pre` into the product workspace (Stufe 3).** The premise is
   falsified (claim 5) and the change restructures rule→guideline routing, which
   is an architectural change to the workspace mechanism. It belongs to a rework
   that touches that mechanism anyway.

Both are carried verbatim into `road-to-demand-gate-audience-followup.md`.

## Prerequisites

- `docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md` § 8-pre exists at line 104.
- `project:` section exists in `src/config/agent-settings.template.yml` and in `src/server/schemas/settings.ts`.
- `docs/contracts/settings-classes.md` carries the per-key table the lint reads.

## Phase 1 — Make the scale honest (no configuration required)

The acute damage is fixed here, and this phase alone satisfies the note's
check 1 without any consumer touching a settings file.

- [x] Add an `L-self` row to the § 8-pre ladder: the maintainer needs it for their own work → **Build**. Place it above L0 so the table reads self-first, then ascending market signal.
- [x] Add one sentence scoping the ladder honestly: L0–L4 measures **market demand** and applies only where a market is intended; a project with no intended user population is classified `L-self`.
- [x] Rewrite "Build only at **L3–L4**" so it admits `L-self` without weakening the market path: build at `L-self` **or** L3–L4; L0–L2 keep the defer/validate recommendation with the one missing evidence named.
- [x] Add the artefact-consequence sentence: an `L-self` or `L-internal` classification forbids writing a roadmap gate whose opening condition names an external user population, a market, or an external measurement.

**Exit criteria (agent-decidable).** `grep -c "L-self" docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md` ≥ 3, and `grep -q "Build only at \*\*L3–L4\*\*"` returns non-zero (the absolute wording is gone) while `grep -q "L3–L4"` still returns zero exit (the market path survives).

## Phase 2 — Name the addressee (`project.audience`)

- [x] Add `audience: public` to the `project:` block of `src/config/agent-settings.template.yml`, with a comment naming the four values and stating that `public` preserves today's behaviour.
- [x] Add the matching `z.enum(['self','internal','client','public']).default('public')` field to the `project` object in `src/server/schemas/settings.ts` with a describe() string the wizard can render.
- [x] Add a `project.audience` row to the per-key table in `docs/contracts/settings-classes.md` as **class C** — it governs the agent's own reasoning discipline (C-test 4), so the agent never writes it and never asks for it; a human sets it by hand-edit or via the GUI write route.
- [x] Write the four branches into § 8-pre prose: `self` → gate inert, one line stating it was skipped and why · `internal` → only question 2 ("what breaks without it?") survives, the requester is known · `client` → the requester is the client, not a segment · `public` → today's behaviour, unchanged.
- [x] State the enforcement honestly in the same section: the branch selection is **model-carried** — § 8-pre is prose, no gate reads it — and an absent key resolves to `public`, because this package has no defaults layer that would supply one at read time.
- [x] Rebuild the committed install bundle (`npm run build:install-bundle`) and commit the result, because the settings schema changed.

**Exit criteria (agent-decidable).** `npx tsx -e` loading the schema parses `audience` for all four values and rejects a fifth; the template↔schema parity test passes; `lint_settings_classes` exits 0.

## Phase 3 — A gate whose condition the project cannot produce

The note's second, addressee-independent finding: *a gate whose opening
condition depends on a quantity the project cannot generate is not a gate, it is
a permanent no*. Folded into the existing roadmap lint as a **warning**, never a
hard failure — an unmeasured detector does not become a CI blocker in this repo.

- [x] Add a warning check to `src/scripts/lint_roadmap_complexity.ts` that fires when a roadmap's opening condition, exit criterion, or blocker `Resolved when:` names an external population, a market, or an external measurement (installs, downloads, adopters, external users, market demand, churn, signups).
- [x] Route it through the existing `warnings` channel used by `_check_human_gate_*` so it prints and never changes the exit code.
- [x] Word the warning as a question, not a verdict: name the matched phrase and ask whether the project is meant to have that population at all.
- [x] Add fixtures covering both directions — a roadmap gated on "external installations with write activity" warns; a roadmap gated on "`task ci` exits 0" stays silent.

**Exit criteria (agent-decidable).** The new fixtures pass; `lint_roadmap_complexity` still exits 0 over `agents/roadmaps/` (warnings do not fail the gate).

**Measured false-positive rate, first run.** The first wiring matched **4** lines
across the 28-roadmap corpus, all of them the same shape: `adopters` used for an
*internal* count (`"4 adopters"` of the `gate_self_test` helper), not a user
population. Bare `adopters?` was dropped from the pattern — an external adopter
count is already covered by the `external …` alternative — and the corpus now
matches **0**. The figure is recorded rather than smoothed away: it is the
evidence for keeping this warning-only, and the reason it is not a gate.

## Phase 4 — Prove the fix cuts the right thing

The note's § 8 asks for a regression and a counter-test. Both are *prompt-level
behavioural* checks, and live trigger evaluation in this repo is a human gate
that hard-aborts under automation — so they cannot be automated as stated.
The deterministic substitute checks the **artefact** the behaviour reads from,
and is named as the weaker thing it is.

- [x] Add a test asserting the self-path exists: § 8-pre carries an `L-self` row and the artefact-consequence sentence forbidding external-population gates.
- [x] Add the counter-test asserting the market path survives: the L3 and L4 rows are intact and the `public` branch is documented as unchanged behaviour.
- [x] Add a test asserting all four `audience` values are documented in § 8-pre prose, so a value that validates but has no described behaviour fails.
- [x] Update the `## See also` / cross-reference surface of § 8-pre to name `project.audience`, and check no reference breaks (`task lint-refs` or the repo's reference checker).

**Exit criteria (agent-decidable).** The three new tests pass; the reference checker exits 0.

## Acceptance criteria

1. § 8-pre classifies a single-user private project as `L-self` → **Build**, without any settings change.
2. § 8-pre with `audience: public` (the shipped default) produces exactly today's L0–L4 recommendation set — the market path is unchanged.
3. `project.audience` validates for `self | internal | client | public`, rejects anything else, is recorded class C, and appears in the committed install bundle.
4. A roadmap gate resting on an external population produces a lint warning naming the matched phrase; a gate resting on a command exit code does not.
5. The enforcement claim in § 8-pre is honest: the branch selection is model-carried, and the text says so.

## Quality gates

Quality gates are delegated to remote CI (`quality.local_auto_run` is the
shipped default). Locally, run only the narrow probes named in each phase's exit
criteria plus the changed-files static pass before pushing.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The fix disables the demand gate everywhere instead of scoping it | product | The note names this itself: "a fix that switches the check off everywhere has only inverted the problem". An over-broad `L-self` row, or a branch that swallows the public path, removes the one check that stops speculative feature work in real products | The default stays `public` and is byte-identical to today; Phase 4's counter-test asserts the L3/L4 rows and the unchanged public branch survive, so the market path failing silently is a red test rather than a silent regression | Phase 4 — Prove the fix cuts the right thing |
| 2 | The branch selection is prose, so nothing enforces it | implementation | § 8-pre is a guideline read by the model; no gate reads `project.audience`. A consumer setting `self` may still meet an agent that reaches for the L0–L4 vocabulary out of habit — the exact "advisory becomes a gate on the way into a document" failure the note describes | Not hidden: Phase 2 requires the section to state model-carried enforcement in its own text, and Phase 3 adds the one deterministic backstop that IS reachable — the lint that fires on the artefact where the failure actually lands (a gate resting on an external population) | Phase 3 — A gate whose condition the project cannot produce |
| 3 | The warning misfires on legitimate public-product roadmaps | implementation | Phrases like "churn" and "signups" are normal vocabulary in a roadmap for an actual product; a check that fires on every one of them becomes noise and gets ignored, which is worse than no check | Warning-only through the existing `warnings` channel — exit code never changes — plus both-direction fixtures. If it proves noisy the cost is a printed line, not a blocked pipeline; it is deliberately not promoted to a gate without a measured false-positive rate | Phase 3 — A gate whose condition the project cannot produce |
| 4 | A new settings key ships with a stale install bundle | implementation | Editing `src/server/schemas/settings.ts` without rebuilding `dist/install/install.mjs` reds Install-Aux and Static-Checks in CI, and the failure names the bundle rather than the schema, so the cause reads as unrelated | The rebuild is an explicit step in Phase 2, not an afterthought, and the phase's exit criteria include the parity test that pairs with it | Phase 2 — Name the addressee |
| 5 | `L-self` becomes the escape hatch for every deferral the agent dislikes | product | A build-level reachable by asserting "this is for me" is trivially assertable, and an agent under pressure to proceed can classify almost anything as self-addressed | Bounded by what the classification actually buys: it removes a *defer recommendation*, not any safety floor, and the artefact-consequence sentence constrains it in the one place the damage was measured — roadmap gates. The remaining exposure is a private project building something it did not need, which is the failure mode with the lowest cost in this set | Phase 1 — Make the scale honest |

## Blockers

None. Both human decisions this analysis surfaced — the default flip and the
Stufe-3 workspace move — are Non-goals carried into the sibling draft roadmap
rather than gates on this one, so every step here is agent-executable.

## Provenance

- **Source.** A bug report from a downstream consumer project of this package, delivered as an inbox note (`agents/tmp.old/adaptions-fix.txt`, received 2026-08-12). It is a defect report against this package's behaviour, not a capability harvest from a third-party tool.
- **Verification.** Every claim in the note was re-read against `26c575f66`; results in the table above. One claim is false, one is true-but-not-a-defect, the rest hold.
- **Council.** Not convened. The note is a single-site defect with a verified cause and a reversible fix; the two contested decisions it raises were removed from scope rather than resolved.
