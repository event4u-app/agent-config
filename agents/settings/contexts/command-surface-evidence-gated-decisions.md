# Command-Surface Evidence-Gated Decisions

> Durable home for command-surface changes that were **deliberately not
> actioned** pending a concrete evidence signal. Promoted out of
> `road-to-command-surface-refactor-residuals` Phase 3 (ADR-092 / ADR-092 era)
> when that roadmap closed, so the obligations stay visible in a stable layer
> rather than vanishing with the archived roadmap.
>
> These are **conditional monitoring obligations, not queued work.** Each entry
> stays dormant until its named trigger fires; the trigger is what re-opens the
> decision, not a calendar. Partitioned by signal type because the three have
> independent owners and timelines — re-evaluate one when ITS trigger fires, not
> all three together.

## 1 — External-dependency signal

### Physical demotion of introspection commands (`skill-preview`, `skills-discover`)

- **Decision:** Not actioned. Keep the introspection commands where they are.
- **Why deferred:** The 6.2.0 attempt to demote them into the `agent-admin`
  platform surface was blocked by a slug-collision-suppression +
  description-matcher dependency. Forcing the move without that dependency
  reintroduces the collision the suppression exists to prevent.
- **Gating signal / re-eval trigger:** A PR that resolves the
  slug-collision-suppression + description-matcher dependency, **or** any future
  PR that touches `skill-preview` / `skills-discover` ownership or the
  `.claude/skills` slug-collision logic. When that lands, re-evaluate the
  demotion here.
- **Owner layer:** CLI / discovery internals.

## 2 — Telemetry signal

### Flows as the runtime primary surface

- **Decision:** Not actioned. Flows remain the data-model + `surface-map.yaml`
  classification backbone; they are **not** yet wired as the primary CLI/help
  navigation surface.
- **Why deferred:** Promoting the flow view to the primary navigation surface is
  only justified if users actually reach it. No flow-usage telemetry exists, so
  the promotion would be speculative supply-before-demand.
- **Gating signal / re-eval trigger:** Flow-usage telemetry is wired AND shows
  the flow view is reached in real sessions. Wire the telemetry signal first
  (its own scoped task), then decide the surface promotion here.
- **Owner layer:** Telemetry + CLI navigation.

## 3 — Design-decision signal

### Re-evaluate the `roadmap:process-phase` variant

- **Decision:** Not actioned. Keep `create` / `step` / `phase` / `full` as-is.
- **Why deferred:** The reviewer asked to trim the mental model to
  `create` / `step` / `full` (drop `phase`). Low priority, and the call should
  follow the broader product-surface decision rather than pre-empt it.
- **Gating signal / re-eval trigger:** The product-surface decision (which
  command clusters are first-class vs. trimmed) is settled. If that decision
  already implies the `phase` variant's fate, apply it then.
- **Owner layer:** Product / design.

## See also

- [`ADR-057`](../../../docs/decisions/ADR-057-consolidation-evidence-gate-outcomes.md)
  — the consolidation-evidence-gate outcomes that first deferred these.
- [`ADR-092`](../../../docs/decisions/ADR-090-visibility-command-frontmatter-field.md)
  — the `visibility:` field (Phase 1 of the residuals roadmap).
- [`ADR-092`](../../../docs/decisions/ADR-091-split-meta-capability-packs.md)
  — the `meta`-pack split (Phase 2 of the residuals roadmap).
- `docs/contracts/command-surface-tiers.md` — the surfacing contract these
  decisions live under.
