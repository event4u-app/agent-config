# Weak-Host Lift — Default Tier, Host Gating, Multi-Vendor Design (Council Verdict)

> Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-07, 2-round
> debate, ~$0.10). Input evidence: cost-factor sweep pinned in
> `docs/benchmark.md § Cost-factor sweep` (report `2026-07-07T05-35-14Z`,
> claude-haiku-4-5, n=24 pairs/arm): full package 11.7x / lift +0.542;
> kernel+`downstream-changes` 3.3x / lift +0.458 (residual of full over it
> p=0.37, not significant); shipped `balanced` profile 2.9x / lift NULL
> (p=0.81). Maintainer constraints: expensive full load must not be default;
> on/off + ~3x acceptable; strong hosts (Opus/Fable class) should auto-disable;
> non-Claude vendors first-class.

## Converged design

1. **Settings shape — tier enum with auto, not plain on/off.**
   `discipline_profile: auto | off | essential | full` in `.agent-settings.yml`,
   shipped default `auto`.
   - `off` = kernel only (~1x).
   - `essential` = kernel + lift-carrying rules (`downstream-changes` is the
     tier-2 promotion; `scope-control` already kernel) — the measured ~3.3x
     configuration. Named for function, not size ("lean/balanced" size-naming
     is what produced the useless profile).
   - `full` = everything (~11.7x), **opt-in EXPERIMENTAL only** — labeled
     "residual lift over essential not established (p=0.37, n=24, Haiku 4-5)".
     Never default, never recommended until its evidence gate passes.
   - `auto` = host-capability resolution: measured-NULL host → `off`,
     otherwise → `essential`.

2. **Kill the shipped `balanced` router profile.** Measured NULL as cut today
   (lacks `downstream-changes`). Do not rename — delete/re-cut around
   lift-carrying content. Round-2 convergence: both members.

3. **Host-strength gating — evidence-gated NULL-lift disable-list, NOT a
   speculative model taxonomy.** Round 2 rejected a maintained strong/weak
   registry across vendors (speculative classification, unmaintainable at
   model-release cadence, glob false-precision). Converged mechanism:
   ```yaml
   # src/config/host-capabilities.yml
   lift_disabled_models:      # ONLY models with measured NULL-lift
     - claude-sonnet-4-6      # 2026-07-05, n=84, full corpus
   unknown_default: lift_enabled   # fail-safe: unknown → essential
   ```
   - Only empirically measured NULL entries; each carries date/corpus/N (a
     CLAIMS-grade line, auditable).
   - Unknown/new models (GPT, Gemini, open-source, every future release)
     default to `essential` — fail-safe direction: costs ~3x on a strong host
     until measured, never silently drops the lift on a weak one.
   - Opus/Fable-class entries require either a cheap ceiling-confirmation run
     or an explicitly labeled `extrapolated: true` maintainer entry — never an
     unlabeled assumption.

4. **Thin projector is COMPETING, not complementary, for this layer.** The
   measured lift used full-body sysprompt injection; thin projection
   (pointer + on-trigger load) is an unmeasured different mechanism. Defer it
   until `essential` ships and is baseline-measured; if pursued, it becomes a
   sub-mechanism of `essential` and must be re-swept (lift under thin
   projection is unknown).

5. **Evidence gates (phased rollout):**
   - **Phase 1 (blocks the default flip):** full 30-task corpus sweep of the
     `essential` config on Haiku (n≥84 pairs) — confirm the lift generalizes
     beyond the scope/downstream family. Update CLAIMS + benchmark page.
   - **Phase 2 (blocks shipping `auto` as default):** replicate on ≥1
     non-Claude weak host (e.g. gpt-4o-mini or gemini-flash class). Lift
     replicates → `auto` default; fails → `off` default with explicit opt-in.
   - **Phase 3 (full-tier graduation, open-source hypothesis):** full sweep on
     ≥2 weak hosts incl. one open-source model; requires significant residual
     over `essential` (p<0.05, Δ>0.1) on tasks where essential does not
     ceiling. Until then `full` stays experimental opt-in.

## Dissent / narrowed positions

- gpt-4o opened with a maintained two-sided model registry + "complementary"
  thin-projector framing + plain `lift` default; after round-2 rebuttals it
  endorsed the evidence-first structure. Residual difference: gpt-4o leaned
  toward dropping `full` entirely; claude-sonnet-4-5 keeps it as gated
  experimental opt-in (adopted — cheaper to keep behind a label than to
  re-add for the open-source hypothesis).

## Do not relitigate

- `balanced`-as-cut-today is measured useless — no revival without a new
  measurement.
- No speculative multi-vendor strong/weak taxonomy — disable-list entries are
  measurement-gated only.
- `full` is not a default and not a recommendation anywhere until Phase 3
  passes.

## P2 addendum (2026-07-07, second council round — P2-verdict disposition)

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2-round debate, ~$0.10).
The P2 non-Claude replication (gpt-5-mini via codex, n=90 pairs, full corpus)
**FAILED with headroom** — not a ceiling null (trapE vanilla 0.733, kernel-dc
0.667); capability trend negative but n.s. (no harm claimed);
injection-surface confound documented (codex = prompt-prepend, no system
surface). Pinned: `docs/benchmark.md § P2 gate`.

Converged disposition (implemented):

1. **`gpt-5-mini` joins the measured NULL-lift disable-list** (unanimous) —
   failed replication on the shipped surface qualifies regardless of the
   confound; the entry's provenance line explicitly disclaims validated harm.
2. **`unknown_defaults` becomes vendor-granular** (sonnet's r2 synthesis,
   gpt-4o's conservative direction): `anthropic: lift_enabled` (the one
   family with a measured lift) · `default: lift_disabled`. This encodes
   WHERE evidence exists, not a strength taxonomy; it changes only by
   measurement. Missing model id → conservative off.
3. **`balanced` installer preset fills `discipline_profile: auto`** — the
   runtime synthesis of both members' r2 positions (gpt-4o: balanced→auto;
   sonnet: evidence-structure narrowing — implemented at runtime where the
   session model is actually known, instead of sonnet's install-time
   key-detection sketch, which is brittle and contradicts the ONE-runtime-knob
   lock). Net effect: lift only where measured; the failed cluster gets
   off-with-explicit-opt-in, honouring the standing P2 rule's intent.
4. **Confound follow-up is non-gating backlog**: a system-surface experiment
   on a non-Claude host (API-loop harness) may un-confound the reading; it
   does not block the shipped disposition (consumers get the shipped surface,
   not counterfactuals).
5. **Claim wording**: all three hosts reported; failed replication stated
   without claiming either "rules useless on GPT" or harm (capability trend
   is n.s.); no cross-vendor lift claimed anywhere.

Dissent narrowed to mechanism only (auto-preset vs install-time detection);
both members' evidence semantics were identical and are what shipped.

## Do not relitigate (P2 additions)

- gpt-5-mini disable-list entry (measured, n=90).
- Vendor-granular `unknown_defaults` — revisit only with a new measurement
  (e.g. the system-surface experiment or a second non-Claude host).
- No blanket `lift_enabled` for unknowns; no blanket `lift_disabled` that
  drops the measured Claude-weak lift.
