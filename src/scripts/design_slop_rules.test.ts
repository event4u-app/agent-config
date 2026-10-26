import { describe, expect, it } from "vitest";
import { SLOP_RULES, type DesignContext } from "./design_slop_rules.js";
import { ALL_SLOP_RULES, scanRender } from "./design_slop_render_rules.js";
import { scanFile } from "./lint_design_slop.js";
import type { StyleRow } from "./design_slop_rules.js";

// Context with no DESIGN.md → all gates OFF, every rule active.
const NO_CTX: DesignContext = { raw: "", has: () => false };
const ctxWith = (raw: string): DesignContext => ({
  raw: raw.toLowerCase(),
  has: (...ks: string[]) => ks.some((k) => raw.toLowerCase().includes(k.toLowerCase())),
});

/**
 * Calibration corpus (Phase 4). One positive (must fire) + one negative (must be
 * clean) per rule. `ext` drives the engine class. No untested tell — the guard
 * below asserts every registry rule appears here.
 */
const FIXTURES: Record<string, { ext: string; positive: string; negative: string }> = {
  "slop-v1-side-stripe": {
    ext: "css",
    // three positives: the original side stripe, the current four-sided colored
    // card border, and a gradient border-image (which carries no width token).
    positive:
      ".card { border-left: 4px solid #6c5ce7; padding: 16px; }\n" +
      ".panel { border: 3px solid #6c5ce7; padding: 16px; }\n" +
      ".hero { border-image: linear-gradient(90deg, #6c5ce7, #00b894) 1; }",
    // negatives, all of which must stay clean: a 1px side rule, a 1px
    // four-sided neutral border, a border-color-only focus treatment, and the
    // two placeholder colors at an accent width.
    negative:
      ".card { border-left: 1px solid #eee; padding: 16px; }\n" +
      ".panel { border: 1px solid var(--border-strong); padding: 16px; }\n" +
      ".input:focus-visible { border-color: var(--accent); }\n" +
      ".tab { border: 2px solid transparent; }\n" +
      ".icon-btn { border: 2px solid currentColor; }",
  },
  "slop-c2-gradient-text": {
    ext: "css",
    positive: ".h { background: linear-gradient(90deg,#f00,#00f); -webkit-background-clip: text; color: transparent; }",
    negative: ".h { color: #111; }",
  },
  "slop-c5-cream-palette": {
    ext: "css",
    positive: "body { background: #f5f1ea; } .a { color: #b08947; }",
    negative: "body { background: #ffffff; } .a { color: #111111; }",
  },
  "slop-t4-eyebrow-overuse": {
    ext: "html",
    positive:
      '<section><span class="uppercase">Features</span></section><section><span class="uppercase">Pricing</span></section><section><h2>Contact</h2></section>',
    negative:
      '<section><span class="uppercase">Features</span></section><section><h2>Pricing</h2></section><section><h2>Contact</h2></section>',
  },
  "slop-t6-crushed-tracking": {
    ext: "css",
    positive: ".display { letter-spacing: -0.05em; }",
    negative: ".display { letter-spacing: -0.02em; }",
  },
  "slop-t7-default-fonts": {
    ext: "css",
    positive: "body { font-family: 'Inter', sans-serif; }",
    negative: "body { font-family: 'Söhne', sans-serif; }",
  },
  "slop-l4-numbered-markers": {
    ext: "html",
    positive: "<div>01</div><div>02</div><div>03</div>",
    negative: "<div>Discover</div><div>Build</div><div>Ship</div>",
  },
  "slop-l8-zindex-magic": {
    ext: "css",
    positive: ".modal { z-index: 9999; }",
    negative: ".modal { z-index: 400; }",
  },
  "slop-m4-transition-all": {
    ext: "css",
    positive: ".x { transition: all 200ms ease-out; }",
    negative: ".x { transition: transform 200ms ease-out; }",
  },
  "slop-m2-animate-layout": {
    ext: "css",
    positive: ".x { transition: width 200ms ease; }",
    negative: ".x { transition: transform 200ms, opacity 200ms; }",
  },
  "slop-cp1-em-dash": {
    ext: "md",
    // ≥80 words is the rule floor; positive carries 4 em-dashes (well over the
    // ~2-per-500 density), negative carries one across the same length.
    positive:
      "We build tools — fast, focused tools — that teams genuinely love using every single day of the working week. " +
      "The product is calm and clear and useful, and people return to it daily because it respects their time — and their attention — and never wastes a single click of effort or a moment of their busy day, and that quiet reliability is the whole point of the thing we set out to make together, and the team keeps shipping the small improvements that matter most to the people who rely on it.",
    negative:
      "We build tools, fast and focused tools, that teams genuinely love using every single day of the working week. " +
      "The product is calm and clear and useful, and people return to it daily because it respects their time and their attention and never wastes a single click of effort or a moment of their busy day — and that quiet reliability is the whole point of the thing we set out to make together, and the team keeps shipping the small improvements that matter most to the people who rely on it.",
  },
  "slop-v8-lock-shape": {
    ext: "css",
    positive: ".a{border-radius:4px}.b{border-radius:8px}.c{border-radius:12px}.d{border-radius:20px}",
    negative: ".a{border-radius:8px}.b{border-radius:12px}",
  },
  "slop-l9-section-monotony": {
    ext: "html",
    // 8 identical media+text sections → 1 distinct layout family (< 4)
    positive: '<section><div class="grid"><img src="x"><h2>A</h2><p>t</p></div></section>'.repeat(8),
    // 8 sections, 4 distinct signatures → not monotonous
    negative: (
      '<section><div class="grid"><img src="x"><h2>A</h2></div></section>' +
      "<section><h2>B</h2><p>t</p></section>" +
      '<section><div class="flex"><p>c</p></div></section>' +
      '<section><img src="y"></section>'
    ).repeat(2),
  },
  "slop-l10-zigzag": {
    ext: "html",
    // 3 consecutive media+text two-column sections → run > 2
    positive: '<section><div class="grid"><img src="x"><h2>A</h2><p>t</p></div></section>'.repeat(3),
    // only 2 consecutive → within cap
    negative: '<section><div class="grid"><img src="x"><h2>A</h2><p>t</p></div></section>'.repeat(2),
  },
  "slop-v4-over-rounded": {
    ext: "css",
    // 24px radius on an 80px chip — mid-range rounding on a small surface
    positive: ".chip{width:80px;border-radius:24px;background:#1f5f9c}",
    // a deliberate pill is a shape decision, not over-rounding
    negative: ".chip{width:80px;border-radius:9999px;background:#1f5f9c}",
  },
  "slop-c3-dark-glow": {
    ext: "css",
    // zero-offset saturated glow inside a declared dark surface
    positive: ".dark .btn{background:#0b0f14;box-shadow:0 0 18px #22d3ee}",
    // same dark surface, ordinary offset depth — not a glow
    negative: ".dark .btn{background:#0b0f14;box-shadow:0 2px 8px #22d3ee}",
  },
  "slop-t9-uppercase-body": {
    ext: "css",
    positive: "article p{text-transform:uppercase;font-size:16px}",
    // a short field label is the legitimate home of uppercase
    negative: ".field-label{text-transform:uppercase;font-size:12px}",
  },
  "slop-t10-wide-tracking-body": {
    ext: "css",
    positive: "article p{letter-spacing:0.12em;font-size:16px}",
    negative: "article p{letter-spacing:0.01em;font-size:16px}",
  },
  "slop-t12-swap-without-metric-fallback": {
    ext: "css",
    positive: '@font-face{font-family:"Brand";src:url(/f/brand.woff2) format("woff2");font-display:swap}',
    negative:
      '@font-face{font-family:"Brand";src:url(/f/brand.woff2) format("woff2");font-display:swap}\n' +
      '@font-face{font-family:"Brand Fallback";src:local("Arial");size-adjust:104%;ascent-override:92%;descent-override:24%}',
  },
  "slop-m6-scroll-reveal": {
    ext: "jsx",
    positive:
      "useEffect(() => { const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible'))); document.querySelectorAll('section').forEach((s) => io.observe(s)); }, []);",
    // lazy-loading: the observer only sets a src
    negative:
      "useEffect(() => { const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSrc(props.src); }); io.observe(ref.current); }, []);",
  },
  "slop-m8-hover-fade": {
    ext: "css",
    positive: ".btn:hover { opacity: 0.7; }",
    negative: ".btn:hover { background: var(--accent-hover); }\n.btn:disabled:hover { opacity: 0.45; }",
  },
  "slop-v9-grain-over-gradient": {
    ext: "css",
    positive:
      ".hero { background-image: url(\"data:image/svg+xml,%3Csvg%3E%3CfeTurbulence/%3E%3C/svg%3E\"), linear-gradient(135deg, #1e1b4b, #7c3aed); }",
    negative: ".paper { background-color: #f4efe6; background-image: url(\"data:image/svg+xml,%3CfeTurbulence/%3E\"); }",
  },
  "slop-m3-img-hover-transform": {
    ext: "css",
    positive: ".tile:hover img{transform:scale(1.05)}",
    negative: ".tile:hover .tile__title{color:#16202b}",
  },
};

function findingsFor(ruleId: string, content: string, ext: string, ctx = NO_CTX) {
  return scanFile(content, `fixture.${ext}`, ctx).filter((f) => f.rule === ruleId);
}

describe("design-slop rule registry", () => {
  it("every rule has a unique id + a catalog id", () => {
    const ids = ALL_SLOP_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of ALL_SLOP_RULES) {
      expect(r.id).toMatch(/^slop-/);
      expect(r.catalogId).toMatch(/^[A-Z]+\d+$/);
      expect(r.engines.length).toBeGreaterThan(0);
    }
  });

  it("no untested tell — every registry rule has a +/- fixture", () => {
    for (const r of ALL_SLOP_RULES) {
      const fixture = r.engines.includes("render") ? RENDER_FIXTURES[r.id] : FIXTURES[r.id];
      expect(fixture, `missing fixture for ${r.id}`).toBeDefined();
    }
    // and no orphan fixtures
    const ids = new Set(ALL_SLOP_RULES.map((r) => r.id));
    for (const k of Object.keys(FIXTURES)) {
      expect(ids.has(k), `orphan fixture ${k}`).toBe(true);
    }
  });

  describe("positive fixtures fire, negative fixtures are clean", () => {
    for (const r of SLOP_RULES) {
      const fx = FIXTURES[r.id];
      if (!fx) continue;
      it(`${r.id} (${r.catalogId})`, () => {
        expect(findingsFor(r.id, fx.positive, fx.ext).length, "positive must fire").toBeGreaterThan(0);
        expect(findingsFor(r.id, fx.negative, fx.ext).length, "negative must be clean").toBe(0);
      });
    }
  });
});

/**
 * Render-engine rules read `ui:render` rows, so their unit fixtures are rows:
 * no browser, so they run in CI. The rendered corpus lives in
 * `internal/bench/corpora/design-slop-render/` (browser-gated bench).
 */
const row = (i: number, o: Partial<StyleRow> & { rect: string }): StyleRow => ({
  index: String(i),
  selector: "div",
  visible: "1",
  parents: "",
  class: "",
  "background-color": "rgb(255, 255, 255)",
  "border-top-width": "0px",
  "border-left-width": "0px",
  "border-radius": "0px",
  "box-shadow": "none",
  "overflow-x": "visible",
  "overflow-y": "visible",
  position: "static",
  "font-size": "16px",
  ...o,
});
const HTML = row(0, { selector: "html", rect: "0,0,1440,900" });
const card = (i: number, rect: string, parents: string, extra: Partial<StyleRow> = {}) =>
  row(i, { rect, parents, "border-top-width": "1px", "border-radius": "12px", ...extra });

export const RENDER_FIXTURES: Record<string, { positive: StyleRow[]; negative: StyleRow[] }> = {
  "slop-l7-overflow": {
    positive: [HTML, row(1, { rect: "0,0,1600,80", parents: "0" })],
    negative: [
      HTML,
      row(1, { rect: "0,0,800,300", parents: "0", "overflow-x": "auto" }),
      row(2, { selector: "table", rect: "0,0,1600,300", parents: "1,0" }),
      row(3, { selector: "a", rect: "-10000,0,120,20", parents: "0" }),
    ],
  },
  "slop-l6-clipped-popover": {
    positive: [
      HTML,
      row(1, { rect: "40,40,480,56", parents: "0", "overflow-x": "hidden", "overflow-y": "hidden" }),
      row(2, { rect: "308,84,200,180", parents: "1,0", position: "absolute" }),
    ],
    negative: [
      HTML,
      row(1, { rect: "40,40,320,300", parents: "0", "overflow-x": "hidden", "overflow-y": "hidden" }),
      row(2, { rect: "60,90,212,180", parents: "1,0", position: "absolute" }),
      row(3, { rect: "60,90,212,180", parents: "1,0", position: "fixed" }),
    ],
  },
  "slop-v7-nested-cards": {
    positive: [HTML, card(1, "32,32,900,500", "0"), card(2, "56,80,850,400", "1,0"), card(3, "80,130,800,200", "2,1,0")],
    negative: [
      HTML,
      row(1, { rect: "32,32,900,500", parents: "0", "background-color": "rgb(243, 244, 246)", "box-shadow": "0px 0px 0px 1px rgb(0, 0, 0)" }),
      card(2, "56,80,850,400", "1,0", { "background-color": "rgb(229, 231, 235)" }),
      card(3, "80,130,800,200", "2,1,0", { "box-shadow": "rgba(0, 0, 0, 0.1) 0px 2px 8px 0px" }),
    ],
  },
  "slop-l2-identical-cards": {
    positive: [HTML, row(1, { rect: "48,100,1344,200", parents: "0" }), card(2, "48,100,432,180", "1,0"), card(3, "504,100,432,180", "1,0"), card(4, "960,100,432,180", "1,0")],
    negative: [HTML, row(1, { rect: "48,100,300,700", parents: "0" }), card(2, "48,100,300,180", "1,0"), card(3, "48,300,300,180", "1,0"), card(4, "48,500,300,180", "1,0")],
  },
  "slop-l1-hero-metric": {
    positive: [
      HTML,
      row(1, { rect: "0,0,1440,400", parents: "0", "background-image": "linear-gradient(135deg, rgb(79, 70, 229), rgb(147, 51, 234))" }),
      row(2, { selector: "p", rect: "48,48,400,90", parents: "1,0", "font-size": "72px", text: "$48,210" }),
      row(3, { rect: "48,250,120,36", parents: "1,0", "font-size": "28px", text: "1,204" }),
      row(4, { rect: "216,250,120,36", parents: "1,0", "font-size": "28px", text: "98.4%" }),
      row(5, { rect: "384,250,120,36", parents: "1,0", "font-size": "28px", text: "312" }),
    ],
    negative: [
      HTML,
      row(2, { selector: "p", rect: "48,48,400,90", parents: "0", "font-size": "64px", text: "99.95%" }),
      row(3, { rect: "900,60,200,36", parents: "0", "font-size": "28px", text: "412 ms" }),
      row(4, { rect: "900,120,200,36", parents: "0", "font-size": "28px", text: "3" }),
      row(5, { rect: "900,180,200,36", parents: "0", "font-size": "28px", text: "0.02%" }),
    ],
  },
};

describe("render-engine rules fire on their positive rows and stay clean on the negative", () => {
  for (const [id, fx] of Object.entries(RENDER_FIXTURES)) {
    it(id, () => {
      expect(scanRender(fx.positive, "p", NO_CTX).filter((f) => f.rule === id).length, "positive must fire").toBeGreaterThan(0);
      expect(scanRender(fx.negative, "n", NO_CTX).filter((f) => f.rule === id), "negative must be clean").toEqual([]);
    });
  }
});

describe("context gates suppress when DESIGN.md declares intent", () => {
  it("t7 default-font is suppressed when DESIGN.md adopts Inter", () => {
    const fx = FIXTURES["slop-t7-default-fonts"]!;
    expect(findingsFor("slop-t7-default-fonts", fx.positive, "css", NO_CTX).length).toBeGreaterThan(0);
    expect(
      findingsFor("slop-t7-default-fonts", fx.positive, "css", ctxWith("Body font: Inter (chosen for variable metrics in a data-dense dashboard)")).length,
    ).toBe(0);
  });

  it("c5 cream-palette is suppressed under a declared warm-neutral language", () => {
    const fx = FIXTURES["slop-c5-cream-palette"]!;
    expect(findingsFor("slop-c5-cream-palette", fx.positive, "css", NO_CTX).length).toBeGreaterThan(0);
    expect(
      findingsFor("slop-c5-cream-palette", fx.positive, "css", ctxWith("Palette: warm-neutral, first-party")).length,
    ).toBe(0);
  });
});

describe("inline-ignore", () => {
  it("design-slop-disable-next-line suppresses the next line", () => {
    const css = "/* design-slop-disable-next-line slop-m4-transition-all */\n.x { transition: all 200ms; }";
    expect(findingsFor("slop-m4-transition-all", css, "css").length).toBe(0);
  });

  it("file-scope design-slop-disable suppresses the whole file", () => {
    const css = "/* design-slop-disable slop-l8-zindex-magic */\n.a{z-index:9999}\n.b{z-index:999}";
    expect(findingsFor("slop-l8-zindex-magic", css, "css").length).toBe(0);
  });
});
