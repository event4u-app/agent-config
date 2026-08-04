# existing-ui-audit — output and pitfalls

> Section-level entry point of the `existing-ui-audit` skill (progressive
> disclosure, 2026-08-04). Content moved VERBATIM from SKILL.md —
> load this file when the section index in SKILL.md routes here.

## Output format

1. **`state.ui_audit.components`** — array of component/template descriptors (path, name, kind, exports)
2. **`state.ui_audit.design_system`** — single string identifying the dominant system or `custom-or-none`
3. **`state.ui_audit.design_tokens`** — object grouped by category (colors, spacing, radius, font, shadow, breakpoint, other)
4. **`state.ui_audit.shadcn_inventory`** — object with version, style, base_color, primitives (only when stack is `react-shadcn`; `null` otherwise)
5. **`state.ui_audit.patterns`** — object with forms, tables, modals, empty_states, navigation, data_display arrays
6. **`state.ui_audit.candidates`** — top-5 similarity matches for the current input (may be empty)
7. **`state.ui_audit.greenfield`** — boolean; when true, `greenfield_decision` MUST also be set before the dispatcher advances
8. **`state.ui_audit.a11y_baseline`** *(optional)* — array of `{rule, selector, severity?}` entries documenting pre-existing a11y violations the review gate should treat as informational. Omit the key entirely when no baseline applies; do not write `[]` for "I checked and there are none" — that disables the gate's filter for every future run.

**Design-system export (current-repo source):** when the goal is to seed
`DESIGN.md` from *this* repo, emit the inventory as a `design-system.json`
artifact (the import contract in
[`design-system-capture`](../design-system-capture/reference/design-system-json.md))
and hand it to `design-system-capture` — the same shape an external extraction
tool produces, so the import path is uniform.

## Gotcha

- The model tends to skip the audit and start designing straight from the request — the dispatcher gate at `directives/ui/audit.ts` enforces "no design without audit findings". Never treat this skill as optional for non-trivial UI.
- The model tends to misidentify a single Tailwind utility as a "design token" — tokens come from the config or `:root`, not from class strings in templates.
- Don't assume a Radix-only `package.json` means shadcn — shadcn requires `components.json` at repo root.
- `state.ui_audit.shadcn_inventory.version` is often missing; the shadcn CLI does not always pin itself in `package.json`. Record `null` rather than guessing.
- Greenfield is detected, not assumed — a project with one Blade layout and no components is still greenfield only if tokens AND design system markers AND components are all empty.
- **There is no mtime cache.** An earlier revision told you to cache by
  `(composer.json mtime, package.json mtime)` and re-audit when either changed.
  No code implemented it, and the key was the wrong one anyway: `apply` adds
  components without touching a manifest, so a manifest-keyed cache never
  invalidates on the change that matters. What the engine does is simpler and
  stricter — `audit.ts` returns SUCCESS unconditionally once `audit_path` is
  `high_confidence` or `ambiguous`, so the inventory is computed **once per
  state-file** and never refreshed.
- **What that means in practice.** A single request is one pass, so the
  inventory is fresh where it matters. The bounded gap is a run that reuses one
  state-file across several component additions: components written earlier in
  that run are absent from the inventory the later ones are checked against.
  Adding a second component in the same run → re-read the component directories
  directly rather than trusting `state.ui_audit.components_found`.

## Anti-slop cross-reference

When the audit inventory reveals an existing aesthetic direction (dominant color
scheme, border-radius convention, motion patterns), cross-check the findings
against
[`docs/guidelines/design-antipatterns.md`](../../../docs/guidelines/design-antipatterns.md).
If the existing UI already uses a listed anti-pattern, surface it as a design-debt
finding (separate from the reuse inventory) — flag by entry ID and severity.

**What the design step may then do depends on whose aesthetic it is.** These
are two different situations and the sentence that used to cover both was
wrong about one of them:

| The anti-pattern lives in… | The design step may… |
|---|---|
| **The consumer's own legacy UI** (inventoried from the repo) | continue it for consistency, **or** propose a corrective direction change. Both are legitimate; it is their codebase and their debt. |
| **A supplied spec** (a handed-over artifact, a `design-system.json`, a registered brand token) | **neither.** Build it as given. The finding is recorded as informational, marked `artifact_covered`, and no polish round acts on it. |

A corrective direction change against a supplied spec is not a design
improvement, it is overriding a decision the user already made — the failure
[`design-fidelity`](../../rules/design-fidelity.md) exists to prevent, arriving
through the audit's side door. Precedence and its exact scope:
[`design-fidelity-mechanics`](../../../docs/guidelines/design-fidelity-mechanics.md)
§ Provided-artifact precedence. Where the two sources disagree, surface the
conflict rather than picking (fixture `daf-slop-vs-provided`).
