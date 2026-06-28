import { describe, expect, it } from "vitest";
import { SLOP_RULES, type DesignContext } from "./design_slop_rules.ts";
import { scanFile } from "./lint_design_slop.ts";

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
    positive: ".card { border-left: 4px solid #6c5ce7; padding: 16px; }",
    negative: ".card { border-left: 1px solid #eee; padding: 16px; }",
  },
  "slop-v3-ghost-card": {
    ext: "css",
    positive: ".card { border: 1px solid #ddd; box-shadow: 0 8px 24px rgba(0,0,0,.1); }",
    negative: ".card { box-shadow: 0 2px 4px rgba(0,0,0,.1); }",
  },
  "slop-v6-diagonal-stripes": {
    ext: "css",
    positive: ".bg { background: repeating-linear-gradient(45deg,#000,#000 10px,#111 10px,#111 20px); }",
    negative: ".bg { background: linear-gradient(#fff,#eee); }",
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
  "slop-cp2-buzzword": {
    ext: "md",
    positive: "We streamline and empower your robust, world-class workflow.",
    negative: "We cut page load by 40% and remove three steps from checkout.",
  },
};

function findingsFor(ruleId: string, content: string, ext: string, ctx = NO_CTX) {
  return scanFile(content, `fixture.${ext}`, ctx).filter((f) => f.rule === ruleId);
}

describe("design-slop rule registry", () => {
  it("every rule has a unique id + a catalog id", () => {
    const ids = SLOP_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of SLOP_RULES) {
      expect(r.id).toMatch(/^slop-/);
      expect(r.catalogId).toMatch(/^[A-Z]+\d+$/);
      expect(r.engines.length).toBeGreaterThan(0);
    }
  });

  it("no untested tell — every registry rule has a +/- fixture", () => {
    for (const r of SLOP_RULES) {
      expect(FIXTURES[r.id], `missing fixture for ${r.id}`).toBeDefined();
    }
    // and no orphan fixtures
    const ids = new Set(SLOP_RULES.map((r) => r.id));
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
