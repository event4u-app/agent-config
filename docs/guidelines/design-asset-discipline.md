# Design Assets & Imagery — ownership, delivery, honesty

> What a visual artifact may ship as an asset, who delivers it, and what counts as fabricated evidence

_Split out of [`design-fidelity-mechanics`](design-fidelity-mechanics.md) § Asset & imagery discipline, which carries the obligation surface and routes here. The split is the per-file depth ceiling doing its job, exactly as it was for [`design-handover-extraction`](design-handover-extraction.md): the mechanics file crossed 16k when the artefact-maturity axis was migrated into it, and compressing this material to fit would have cost the ownership sentence ADR-205 rests on and the fixture ids that make each bullet falsifiable._

Visual artifacts carry **real assets or honest placeholders — never fabricated
brand evidence**. The design-surface instance of the no-invented-facts floor.

- **Copy owned assets through the project's accepted path.** Reference or copy
  project-owned assets (logos, icons, fonts, images) via the target project's
  asset directory/pipeline — never hotlink a design-system's internal URL, never
  bulk-copy a huge source folder. (fixtures: `daf-missing-asset`, `daf-external-asset-url`.)
- **Third-party asset delivery is self-hosted by default — this section owns that
  decision.** An asset whose delivery path crosses a third party (a webfont from
  a font CDN, an icon set from a CDN, a hosted stylesheet) transmits the
  **visitor's IP address** to that third party on every page view. Deliver it
  through the target project's own route instead — the framework's font/asset
  primitive, a bundled package, or a locally-served file. A third-party hotlink
  is emitted **only** on an explicit consumer opt-in, and the opt-in is stated
  with what it transmits — never chosen silently because it is the shorter line.
  A discovery URL is not a delivery URL: keeping a font's browse/share link as
  *where to find it* is fine. Ownership: this bullet is the single owner of the
  third-party delivery decision ([`ADR-205`](../decisions/ADR-205-webfont-delivery-ownership.md));
  emitters (`typography-system`, UI-apply directives, brand-asset paths) are
  consumers and point here rather than restating it. (fixture:
  `daf-webfont-delivery`.)
- **Real imagery where inspection matters.** On visual pages/decks, use actual
  product / place / object / state imagery where the image IS the proof (a
  product screenshot, a real dashboard state). Decorative atmosphere is not proof
  — never pass a stock-like or invented image off as the real product. An
  invented product screenshot is fabricated evidence. (fixture: `daf-invented-screenshot`.)
- **Icons follow the iconography floor** — no emoji-as-icon in serious UI, no
  hand-rolled icon when a set exists; see the `iconography` skill § Iconography floor.
- **Ask before adding material — no unrequested filler.** Never generate copy,
  placeholder sections, or decorative blocks the user did not ask for to "complete"
  a design. Brief silent on a region → surface the gap (`ask-when-uncertain`)
  or leave an honest placeholder; never invent filler to fill space.
