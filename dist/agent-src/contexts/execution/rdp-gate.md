# RDP Gate — Table-Free Cost Gate

Shared mechanic for the **Reasoning Discipline Protocol**. Loaded by the RDP
artifacts (the `notes-first-reasoning` rule, the `reasoning-orchestrator` skill,
and the Phase-5 extensions of `think-before-action` / `improve-before-implement` /
`adversarial-review` / `subagent-orchestration` / `autonomous-execution`) when
deciding **whether to engage the discipline at all**. Design rationale +
sourcing: `docs/guidelines/agent-infra/frontier-reasoning-operating-profile.md`
and roadmap decisions L1/L10/L17.

## The one rule

```
RDP NEVER ENGAGES BY DEFAULT ON EVERY TURN.
IT ENGAGES ONLY WHERE IT PAYS — DECIDED BY TABLE-FREE SIGNALS.
NO RUNTIME MODEL -> BAND TABLE EXISTS (ADR-035).
```

`model_tier` (ADR-035, `lite|medium|high`) is the **skill's** needed model band,
**not** the host's reasoning strength. RDP must never reuse it for gating, never
maintain a model list, and never ship heavy/light content variants (two variants
*are* a hidden band table).

## Three signals (all table-free)

1. **User settings** — read the `reasoning:` block in `.agent-settings.yml`:
   - `enabled: false` → the whole layer is inert. Stop here.
   - per-component switch off (e.g. `components.verifier_default: false`) → that
     component never fires.
   - `auto_gate: false` → skip signal 3 (self-assessment); gate on signal 2 only.
2. **Task signal** (knowable per turn, no model lookup):
   - **Skip** RDP when the task is trivial / short / fully-specified (rename,
     typo, format, one-line edit, list files, bump a version).
   - **Engage** when the task is complex / ambiguous / multi-component /
     long-horizon / stateful / irreversible.
3. **Host reasoning strength** (agent self-assessment — introspection, no
   maintained list; same pattern as `provider-lifecycle-discipline` and
   `media-governance-routing`):
   - A **strong-reasoning** host applies the discipline **lightly / as a
     suggestion** (it self-coordinates; heavy scaffolding wastes tokens and can
     degrade it — see the dossier's `reasoning_extraction` + over-prescription
     evidence).
   - A **standard** host applies it **fully**.

## One constraint-light scaffold + expand on request (L1)

Every RDP artifact ships **one** constraint-light version. There is no heavy
variant. A standard host that needs more **asks for it at turn time** ("give me
the explicit alternative-enumeration" / "spell out the file-size bounds") rather
than selecting a pre-written heavy file. This keeps the surface DRY, table-free,
and vendor-neutral.

## Verifier has its own gate (L12)

The fresh-context verifier subagent is the most expensive primitive (a full extra
inference pass). On top of the three signals above it fires **only** when the task
shows **≥ 2 of**: branching/conditional logic · ≥ 3 explicit must/must-not
constraints · stateful operations · irreversibility flag — **and** the estimated
work is **≥ ~1k tokens**. Token length alone is never the trigger.

## What this gate does NOT touch

- **No frontmatter field.** The gate is read at runtime; RDP artifacts need no
  new schema key, so there is **no projection/condensation change** and nothing
  new compiles into `dist/router.json`.
- **No kernel change.** RDP artifacts are tier-2 (router-loaded on match); the
  always-on kernel stays the same size.
- **No model list.** If a new model ships tomorrow, nothing here goes stale.

## How an RDP artifact cites this

Open with a one-line gate check, e.g.: *"Engage per `contexts/execution/rdp-gate.md`
(settings + task-signal + host self-assessment); skip on trivial tasks and apply
lightly on a strong-reasoning host."* Then the artifact's own body assumes it has
already been cleared to engage.
