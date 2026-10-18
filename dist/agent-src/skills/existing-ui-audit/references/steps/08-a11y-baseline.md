# 8. (Optional) Capture an a11y baseline

The R4 visual-review-loop contract reads `state.ui_audit.a11y_baseline`
when present; the review gate then filters incoming
`state.ui_review.a11y.violations` against it so pre-existing
violations stay informational and only NEW or CHANGED entries block
the polish loop. Without a baseline the gate sees every violation as
actionable — fine for greenfield, noisy for legacy surfaces.

Capture the baseline when:

- The audit covers components with known a11y debt the project does
  not intend to fix in this run (legacy templates, third-party
  embeds, vendor widgets).
- The user says "don't block on existing a11y issues" or similar.

Skip the baseline (omit the key, leave `state.ui_audit.a11y_baseline`
unset) when:

- The surface is greenfield — the review gate should treat every
  violation as new.
- The project's a11y posture is "zero known violations" and any
  finding is by definition actionable.

Shape (each entry must carry at least `rule` + `selector`; severity
is optional but recommended so the review gate's severity-floor
filter behaves the same on replay):

```
state.ui_audit.a11y_baseline = [
  {rule: "color-contrast", selector: ".legacy-tab", severity: "moderate"},
  {rule: "label",          selector: "form#search input[type=search]"},
  ...
]
```

Producer parity: the review skill that writes
`state.ui_review.a11y.violations` MUST use the same `(rule, selector)`
shape, otherwise the engine's de-dup will miss matches and pre-existing
violations will surface as new findings on every run.
