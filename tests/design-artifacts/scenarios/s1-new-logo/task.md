# Scenario 1 (a) — a new logo as a true vector, from a brief

**Task text handed to the owner, verbatim:**

> Draw us a logo mark as a real vector. A stylised rising arrow enclosed in a
> rounded square, two brand blues, legible at 16 px. No wordmark, no text.
> Delivery is inline in a React app.

**Inputs:** the brief above. No raster, no reference file.

**Declared by the owner before writing:** delivery `inline`, asset class `mark`.

**What decides the outcome** — the witnesses, never a look:

- 0 `<image>` and 0 `<foreignObject>` in the delivered file.
- No `<text>`: the brief did not ask for one.
- Fill ratio inside the `mark` class threshold from the fixture manifest.
- `lint_svg_asset` reports 0 errors.
- Status `verified` per step 3.5 — a render manifest whose recorded digest
  equals the delivered file's digest on disk.
