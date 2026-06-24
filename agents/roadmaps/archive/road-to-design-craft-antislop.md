---
complexity: structural
status: ready
---

# Road to design-craft / anti-slop enforcement

> From a deep-dive of three external design-taste references (Source A / B / C
> below) + **two** AI deep-council debates (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 3 rounds each, 2026-06-24). The references all attack the same
> failure: AI agents ship **generic, recognizably-AI-generated UI ("slop")**.
> We already ship a broad design surface (`design-intelligence`, `fe-design`,
> `design-review`, `existing-ui-audit`, `typography-system`, `iconography`,
> `accessibility-auditor`, `motion-choreographer`, `ui-component-architect`, the
> `brand-*` cluster; rules `design-fidelity`, `brand-source-of-truth`,
> `brand-consistency`). The delta is **concrete, enumerated, override-aware
> anti-defaults**, **forced articulation**, **cross-task design memory**, and
> **objective enforcement** — none of which our prose-only design skills have.

> **Optimization-function change (round 2 of council).** The first debate gated
> several items on *single-maintainer maintenance cost + token cost*. The owner
> then **explicitly lifted both objections**: "if it makes the package better, I
> want it; maintenance is irrelevant; more tokens is fine — but the rich skills
> must be *allowed* to spend the tokens (the frugality machinery must not
> suppress them), and a global setting must govern that (on / off / ask, default
> on, wizard-configurable; on `ask`, surface an estimated **token** delta first —
> tokens, not dollars)." Under that function the council re-ranked: the only
> valid rejects are **architectural incompatibility** or **genuine redundancy**,
> never cost.

> **Provenance (encrypted per `source-confidentiality`).** Sources named only as
> A / B / C; real links are maintainer-recoverable ENC1 tokens.
> - Source A — `ENC1:DdvGdFl5xJ23a9Ia1Ao3BnRoCLquLJHBpnwpIwQsgjhuPZ2jie2SqL14zYdY/rEkRj45gQEvcvGqqTcoxUcX2w==`
> - Source B — `ENC1:5Mu+RpxGAQZ7P9brsv96LXF3X0+mPuEFN6SZDp16oPPAb2fRZBOqE8HuVJgAbaW1EKh+9bKCx6W9JMylIwd9Gg==`
> - Source C (repo) — `ENC1:OFLOJ8NoCmdOH2kjRkY/wsfjObE4d0BTUgteF9iv+paT+IbEHeRVGTHrNS4ajX6pl4gwhBDDGnVGk62tRucU5A==`
> - Source C (site) — `ENC1:hn9HBNKh0yoUOKeQhrIW9RM5RazC1wWTXXMvWaFb7qjjgxwLQTC6vYIeLRIEcChGC7V+SmezjBbafUQwNgNjIg==`
> - Council sessions (gitignored, 7-day TTL — convergence inlined, not linked):
>   `agents/runtime/council/responses/taste-disposition-result.md/`,
>   `agents/runtime/council/responses/taste-reeval-result.md/`.

> **Authoring discipline.** Every skill/rule/guideline/setting this roadmap
> *creates* is authored under `artifact-drafting-protocol` (Understand → Research
> → Draft, numbered-options). Stack-specific content (hex, cubic-beziers, OKLCH,
> Tailwind class lists) is **framework-scoped** per
> `framework-neutrality-in-generic-skills` — carve-outs (`fe-design`,
> `tailwind-engineer`, `motion-choreographer`, `design-review`) or a
> framework-scoped reference guideline, never a generic always-on artifact.
> **CI-step discipline** per `roadmap-ci-steps-policy`: only targeted
> verifications (single-skill lint, single trigger-eval, `check-refs`), never a
> full `task ci` per-step probe.

## Phase 1 — The enumerated anti-slop catalog (the foundation)

> The single highest-quality lever (both debates agreed). Converts our prose
> design advice into a concrete, override-aware, lazy-loaded what-not-to-do list.

- [x] Author a lazy-loaded reference guideline `design-antipatterns` under `docs/guidelines/` (framework-scoped, NOT a generic always-on skill). Schema per entry: `Pattern | Why it reads as AI-generated | Override condition`. Seed from Source C's categorized slop-tell taxonomy + Source A's "AI Tells" — Visual, Typography, Color, Layout, Motion, Copy. ~60–80 entries, each with a concrete override.
- [x] Include the threshold-specific entries verbatim where stack-agnostic and falsifiable (OKLCH cream/sand body-bg band, ≥ −0.04em display-tracking floor, 65–75ch line-length, 12–16px small-card radius cap, body ≥ 16px / ≥ 1.3 line-height / contrast ≥ 4.5:1 floors). Mark as "guidance, agent self-checks" — the *enforceable* subset of these becomes the Phase-5 detector, not a rule here.
- [x] Cross-link the catalog from `design-intelligence`, `fe-design`, `design-review`, `existing-ui-audit` as a "pull before proposing/reviewing UI" pointer (do not inline — size-enforcement + lazy-load).
- [x] Add an `evals/triggers.json` stub (5 should-pull + 5 should-not) per `skill-writing`.
- [x] Verify: `lint-skills` on the new guideline green; `check-refs` confirms cross-links; trigger-eval on the new fixture passes.

## Phase 2 — Forced design articulation as a self-check (not a blocking gate)

> Self-check in guidance captures the value (forced articulation, anti-default
> discipline) with no exception-logic to own and no Goodhart-ritualization.

- [x] Add a "Design Read" self-check to `design-intelligence` / `fe-design`: before proposing UI the agent emits one line — `Reading this as: <page-kind> for <audience>, <vibe> language, leaning <design-system>` — + an **Anti-Default Discipline** mini-list. Self-documenting escape: "if context incomplete, state and proceed exploratory."
- [x] Add the **honesty / real-system grounding** rule (Source A): map a brief to an official design system, install the real package, link canonical docs — never hand-recreate its CSS, never label an approximation as official. Fold into `design-intelligence` (cross-link `source-discovery-gate`).
- [x] Verify: trigger-eval on `design-intelligence` / `fe-design` green; `lint-skills` green; spot-check it reads as guidance, not a hard gate.

## Phase 3 — Output discipline + the zero-false-positive output linter

- [x] Author an `output-discipline` rule (or sub-clause of `verify-before-complete` / `downstream-changes`): ban placeholder-prose output (`// rest of component`, "for brevity", "rest follows the same pattern"); on budget overflow emit a clean `[PAUSED — section X of Y complete]` breakpoint instead of an ellipsis truncation.
- [x] Build `lint_output_slop` — **≤ 6 zero-false-positive regex rules**: `Lorem ipsum`/`dolor sit amet`, bracket placeholders, implementation-placeholder comments (`// TODO.*implement`, `// rest of component`, `// ... (unchanged)`), ellipsis-as-truncation in emitted code/markdown. Exit non-zero on match. Provider-agnostic, no parse. Document the eslint-style inline-ignore escape.
- [x] Verify: green on a clean fixture, red on a slop fixture, zero false positives across `src/` (run once locally per `verify-before-complete` carve-out — new gate).

## Phase 4 — Token-permission governance (frontmatter field + global setting)

> The owner's explicit ask, two layers. The **frontmatter** marks *which* skills
> are intentionally token-rich; the **setting** governs *whether* the consumer
> permits the extra spend globally. This is the prerequisite for every rich item
> below — build it before the rich content lands.

- [x] Add a `token_budget_class` enum (`lean` | `standard` | `rich`) to the skill (and command) frontmatter schema (`src/scripts/schemas/`). `rich` = exempt from telegraph-speak condensation + thin-projector trimming; detailed examples preserved; eager-load eligible. Orthogonal to `model_tier` (capability) — this is *cost class*, not capability band.
- [x] Author a `token-budget-discipline` governance rule + CI lint: a `rich` skill MUST carry a `## Why this skill is rich` justification section (irreducible complexity); **≤ 15 % of skills may claim `rich`** (cap enforced in the skill-manifest test). Amend `telegraph-speak` to except `token_budget_class: rich`.
- [x] Add the global setting `tokens.rich_skills: on | ask | off` to `.agent-settings.yml` (template + schema), **default `on`**. Semantics: `on` = rich skills load in full (permitted); `off` = rich skills fall back to their condensed/`standard` behavior; `ask` = before loading a `rich` skill (or running rich behavior), the agent surfaces an **estimated token delta in tokens, not dollars** (derived from the rich skills' measured size, ≈ chars/4) and asks the user to confirm the extra spend. Cache the per-conversation answer; never re-ask within the session once confirmed.
- [x] Wire the setting into the **browser setup wizard** as a toggle (per `prefer-browser-wizard-for-setup`): "Rich design skills — allow extra token spend for higher-fidelity design output (on / ask / off)", default on.
- [x] Tag the heaviest, irreducible design skills `token_budget_class: rich` with justifications: `design-intelligence`, `typography-system`, `accessibility-auditor`, and (Phase 6) `design-system-capture`. Everything else stays `lean`/`standard`.
- [x] Verify: schema validation green; `lint-skills` enforces the justification + 15 % cap; a fixture confirms `ask` mode surfaces a token estimate and `off` mode falls back; wizard round-trip writes the key.

## Phase 5 — Scoped objective design-quality detector (CI linter)

> ADOPT-SCOPED (both members). NOT the full 44-rule CSS engine — the **objective,
> deterministically-provable subset** where false positives are structurally near-
> impossible. It runs in **CI** (our allowed executable surface — a linter, not an
> app runtime), so it does not conflict with the no-runtime architecture, and it
> is independent of `tokens.rich_skills` (a CI tool spends no per-turn tokens).

- [x] Build `lint_design_quality` — a static HTML/CSS analyzer (real cascade + computed-style resolution; the parse is acceptable now that maintenance cost is not an objection) with **6 objective rules only**: WCAG contrast (< 4.5:1 / < 3:1 large), body `font-size` floor (< ~14px), line-length (> ~75ch unbroken), `@keyframes`/`animation` present without a `prefers-reduced-motion` alternative, skipped heading-level hierarchy (h1→h3), interactive element with no `:focus-visible`/focus indicator. Exit-code-2 on any finding.
- [x] Add eslint-style inline-ignore (`design-quality-disable <rule> -- reason`) + a per-project `.design-quality.json` (`ignoreRules`/`ignoreFiles`) escape — false positives are an accepted, suppressible cost.
- [x] Wire into the CI lint cadence (alongside the other `lint_*` scripts) as opt-in for consumer projects (it analyzes *their* UI, not our `src/`); document the opt-in. The remaining ~38 subjective rules (spacing-multiples, font-weight-count, magic-numbers) are **deferred** — they are design-system opinions, not quality floors.
- [x] Verify: green on a compliant fixture, exit-2 on a fixture with a contrast + reduced-motion violation; inline-ignore suppresses a flagged line; document the opt-in path.

## Phase 6 — DESIGN.md + PRODUCT.md project context-capture (token-rich)

> ADOPT, both together (both members; Sonnet's round-3 argument: they solve
> *parallel* "design-amnesia" gaps — visual decisions vs interaction patterns —
> and `.tokens.json` captures primitives, not usage *decisions*). Token-rich
> frontloaded context that *reduces* net spend (read once vs re-scanning specs
> per task) — gated by the Phase-4 `tokens.rich_skills` setting.

- [x] Author a `design-system-capture` skill (`token_budget_class: rich`) that writes + maintains two project-local files: `DESIGN.md` (visual-system decisions — radius/shadow/motion/spacing strategy + one-line density/formality philosophy, Google-Stitch `design-md` shape for portability) and `PRODUCT.md` (cross-feature interaction patterns — destructive-action handling, optimistic-UI policy, filter persistence, the product's mental model).
- [x] Make the design skills *consume* them: add a "read `DESIGN.md`/`PRODUCT.md` if present" step to `design-intelligence` / `fe-design` / `ui-component-architect` / `existing-ui-audit`, so accumulated decisions are applied, not re-invented. Clarify the boundary vs `brand-to-tokens` (primitives) and `existing-ui-audit` (retrospective snapshot) in the skill body.
- [x] Verify: `lint-skills` green (incl. the `## Why this skill is rich` justification); a fixture confirms a written `DESIGN.md` is read + applied on a follow-up task; `check-refs` on the cross-links.

## Phase 7 — Review-method + rule-framing retrofit (domain-general)

> Source B's method (rationale-per-rule, subtraction-first, Before/After/Why) +
> Source A's binary-anti-hedge framing — low-risk refactors of artifacts we own.

- [x] Retrofit `design-review` with: a **subtraction-first remedial-preference hierarchy** (delete > reduce > fix-easing/origin > make-interruptible > polish); an **"approval is earned, default to flagging"** posture; a **forced Before / After / Why table** with an explicit wrong-format counter-example.
- [x] Retrofit `motion-choreographer` / `typography-system` / `accessibility-auditor` with **rationale-per-rule** (every heuristic states its mechanism) + **decision-tree-gating** where natural (should-it? → why? → which variant? → how much?). Stack-specific values land in the framework carve-outs per framework-neutrality. Note: `motion-choreographer` in this package is a video-AI skill (Veo/Kling/Sora); UI-motion decision-tree added to `fe-design` instead.
- [x] **Binary-anti-hedge audit** of the *design* rules (`design-fidelity`, `brand-consistency`, `icon-consistency`, `ui-audit-gate`): rewrite soft language ("sparingly", "prefer") → binary + explicit exception + one line on *why the soft version failed*. N=3 budget; surface any rule where binary framing would break a legitimate brief. Iron-Law kernel rules out of scope here (own-PR / slow-rollout per `scope-control § kernel-rule-edits`). Audit result: all 4 rules already binary — no changes required.
- [x] Verify: `lint-skills` per touched skill; `rule-compliance-audit` / `check_reply_consistency` green; `preservation-guard` self-check — no override path weakened.

## Phase 8 — Brand-mode vs product-mode discriminator + originality self-test

- [x] Add a `design-modes` reference doc: brand mode ("the impression IS the product", failure = flatness) vs product mode ("design serves the task", failure = strangeness-without-purpose), with a routing note in `design-intelligence` / `brand-source-of-truth` (brand-mode → `brand-identity`/`iconography`/`motion-choreographer`; product-mode → `accessibility-auditor`/`ui-component-architect`/earned-familiarity). Fold the **AI-slop originality self-test** (reject if the aesthetic is guessable from the category alone, then from category+anti-references) into the catalog/`design-review` as a guidance heuristic.
- [x] Verify: `check-refs` green; trigger-eval that the discriminator does not mis-route existing brand/product fixtures.

## Deferred / rejected — explicit non-goals (council-rejected on architecture/redundancy, NOT cost)

> Recorded so these are not relitigated. After the cost-objection was lifted,
> these survive rejection only on architecture or redundancy grounds.

- [-] **Dial-inference config** (Source A `VARIANCE/MOTION/DENSITY` dials + inference tables). REJECT — **genuine redundancy**: the Phase-1 anti-default catalog already gives concrete, higher-fidelity guidance ("use 12/20/32 rhythm") directly; the dials are indirection an agent must interpret *before* reaching the same guidance. No quality lift even with cost free. <!-- skipped: redundant with Phase-1 catalog; no quality lift (cost-independent) -->
- [-] **23-slash-command source architecture** (Source C). REJECT **as source content** — a command is a pointer to a skill; it changes *how the agent finds* a capability, not the design output. Hardcoding 23 command files privileges one host's invocation style and violates single-source→projection. **Phase-2 option (not now):** if a host wants slash-commands, generate them as **projector output** from existing skill metadata — no source rewrite. (gpt-4o argued ADOPT on end-user UX/cognitive-load; that is not the owner's stated axis of design *quality*, so it does not flip the verdict.) <!-- skipped: delivery-shape; belongs in projection output, not source -->
- [-] **Live in-browser editing mode** (Source C subsystem). REJECT — **architectural incompatibility**: requires an app runtime (dev server, HMR, browser connection). The package is no-runtime by design; only CI linters execute. No no-runtime-compatible slice retains the value (instant visual feedback loop). <!-- skipped: violates no-runtime architecture (cost-independent) -->
- [-] **Full 44-rule CSS detector** (the subjective ~38 beyond Phase 5's objective 6). DEFERRED — spacing-multiples / font-weight-count / magic-numbers are design-system opinions, not quality floors; revisit only after Phase 5's objective subset proves a low false-positive rate in real consumer use. <!-- skipped: subjective style-enforcement; revisit after Phase-5 false-positive evidence -->

## Acceptance criteria

- `design-antipatterns` catalog exists — lazy-loaded, framework-scoped, override-aware, cross-linked from the four design skills, trigger-eval green.
- "Design Read" articulation self-check + honesty/grounding rule live in `design-intelligence`/`fe-design` (guidance, no blocking gate).
- `output-discipline` rule + `lint_output_slop` (≤ 6 zero-FP rules) live, zero false positives across `src/`.
- `token_budget_class` frontmatter + `token-budget-discipline` rule (15 % cap + justification) + `tokens.rich_skills: on|ask|off` setting (default on, wizard toggle, `ask` surfaces a token estimate) all live and verified; the heaviest design skills tagged `rich`.
- `lint_design_quality` (6 objective rules, exit-2, inline-ignore + per-project config) live as consumer-opt-in CI.
- `design-system-capture` skill writes/maintains `DESIGN.md`+`PRODUCT.md`; the design skills consume them.
- `design-review`/`motion-choreographer`/`typography-system`/`accessibility-auditor` carry rationale-per-rule + subtraction-first; design rules passed a binary-anti-hedge audit with no override path weakened (preservation-guard clean).
- `design-modes` discriminator + originality self-test documented; routing correct.
- All four deferred/rejected items recorded with their architecture/redundancy rationale; none silently adopted.
- Every authored artifact passed `artifact-drafting-protocol`, `framework-neutrality-in-generic-skills`, `size-enforcement`, `lint-skills`.
