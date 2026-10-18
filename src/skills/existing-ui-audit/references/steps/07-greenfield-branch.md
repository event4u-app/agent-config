# 7. Greenfield branch

If **all** are true:
- `state.ui_audit.components` is empty
- `state.ui_audit.design_system == "custom-or-none"`
- `state.ui_audit.design_tokens` is empty (no Tailwind config customizations, no `:root`)

then set `state.ui_audit.greenfield = true` and emit a halt:

```
> No existing UI surface detected — this looks like greenfield.
>
> 1. Scaffold a minimal token set + a base component primitive folder
>    before building (recommended for projects with >1 planned screen)
> 2. Proceed bare with Tailwind defaults (recommended for one-off prototypes)
> 3. Point me at an external design-system reference (URL or file)
> 4. Scaffold + a granularity convention — as 1, and new components go into
>    named granularity folders you pick the names for; rename or drop it later
>    and nothing here objects

**Recommendation: 1 — Scaffold tokens + primitives** — even one extra screen
benefits from a shared base; the scaffold cost is ~10 min and saves
re-doing every primitive on screen 2. Caveat: flip to 2 if this is a
demo or single-page prototype that will not grow.
```

Option 4 is an **offer**, and the only one made anywhere: a project that already exists is never asked (§ 1b reads what it chose), and a greenfield project picking any other number has declined terminally, because the halt is a no-op once any decision is recorded. It stays one more number in the same block rather than a second question — a single number still answers it, which is what the reply-shape rule requires.

Record the user's pick in `state.ui_audit.greenfield_decision` (`scaffold` | `bare` | `external_reference` | `granularity_convention`). Re-running the skill on the same state-file with `greenfield_decision` set is a no-op for the halt (audit findings stay). `granularity_convention` takes the same scaffold path as `scaffold` — it adds the convention, it does not replace the scaffolding.
