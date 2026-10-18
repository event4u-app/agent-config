## Acceptance Criteria

- [x] AC-1 — The tree holds exactly three brand sources — tokens,
      `design-system.json`/`DESIGN.md`, the `brand-voice` slot — and no persisted
      index or registry file beside them.
- [x] AC-2 — No authored surface names `.tokens.json` as the file to write, and
      `BRAND_TOKEN_PATHS` is declared once.
- [x] AC-3 — A ghostwriter profile at either documented path is ignored by git
      and scanned by the source lint, and no tracked file under either path is
      a real-person profile.
- [x] AC-4 — `brand:status` never reports a malformed or shadowed file as the
      brand, and names every source with its hash.
- [x] AC-5 — No stable DTCG 2025.10 value reaches CSS as `[object Object]`; an
      unrepresentable value fails with its token path and a non-zero exit.
- [x] AC-6 — A planted banned term or unbacked claim in a finished draft from
      ghostwriter, post-as, humanizer or brand review produces a located finding;
      a quoted one does not.
- [ ] AC-7 — A non-brand task in a fully branded project carries zero brand
      bytes, before and after any carrier.
- [x] AC-8 — `brand-source-of-truth` names its checker in `enforced_by`, or says
      `instruction-only`, and no file calls `brand-consistency` a gate.
- [ ] AC-9 — A runtime carrier exists only if the recorded read-rate
      measurement missed its pre-registered bar.
