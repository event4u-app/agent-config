#!/usr/bin/env node
/**
 * design_slop_rules — the deterministic anti-slop rule registry.
 *
 * Data + matchers for the aesthetic-PROVENANCE tells that make a UI "look like
 * an AI made it" — the layer `lint_design_quality` deliberately does NOT cover
 * (it owns the OBJECTIVE floors: contrast, font-size, line-length, reduced-motion,
 * heading hierarchy, focus). This registry is the deterministic backing for the
 * PROSE catalog in `docs/guidelines/design-antipatterns.md`; every rule cites its
 * catalog id (V1, C2, …) so prose ↔ rule stay traceable.
 *
 * DESIGN CONSTRAINT (why no postcss/@babel): this package ships to consumers via
 * `npx` and is dependency-free by design (see lint_design_quality header). Heavy
 * parsers (postcss/@babel/tailwind resolver) would bloat the install and break
 * portability. The Phase-0 tells are all detectable by pattern analysis on
 * CSS/HTML/JSX text without a cascade — we follow lint_design_quality's proven
 * dependency-free approach. Council 2026-06-28 assumed those libs were present;
 * for THIS package, pattern-based is the correct, frugal adaptation.
 *
 * WHAT THE NEGATIVE FIXTURES ARE NOT: each rule ships one positive and one
 * negative fixture, and the suite asserts both exist. That is a PRESENCE guard —
 * "this regex stays quiet on one clean snippet crafted for it" — and it is NOT a
 * false-positive RATE. Nineteen green negatives say nothing about how often a
 * rule fires on clean UI it has never seen. Reading them as an FP measurement is
 * the mistake that makes the registry look better-evidenced than it is; the rate
 * is measured against the clean corpus under `internal/bench/corpora/`, not here.
 *
 * Severity is a REBUTTABLE PRESUMPTION, never a hard block:
 *   P0 — objective failure (none here; those live in lint_design_quality)
 *   P1 — high-confidence tell (e.g. the side-stripe signature)
 *   P2 — confident tell
 *   P3 — co-occurrence / lower-confidence heuristic
 * A rule is suppressed when the consumer's DESIGN.md declares the pattern as
 * intentional (the context gate), via inline-ignore, or via .design-quality.json.
 */

export type Severity = "P0" | "P1" | "P2" | "P3";
/**
 * `render` reads the computed-style rows `ui:render` writes (`*.styles.json`,
 * with box, visibility and ancestor chain), never a screenshot — the input
 * class for tells only a rendered page shows (road-to-tells-a-near-miss-can-
 * refute 2.3).
 */
export type Engine = "css" | "html" | "jsx" | "copy" | "render";

/** One element of a `ui:render` styles capture. */
export type StyleRow = Record<string, string>;

export interface RawHit {
  line: number;
  snippet: string;
}

export interface DesignContext {
  /** lowercased DESIGN.md text, or "" when absent */
  raw: string;
  /**
   * True when DESIGN.md DECLARES one of the keywords as intentional: in a
   * frontmatter `intent:` list or an `## Intentional` section, word-bounded,
   * never inside a negated sentence. A mention elsewhere is not a declaration.
   */
  has(...keywords: string[]): boolean;
  /**
   * The pre-0.2 free-text test (a raw substring anywhere in DESIGN.md), kept for
   * one minor version so a run can report what it WOULD have suppressed. It
   * suppresses nothing. Absent on a hand-built context.
   */
  legacyHas?(...keywords: string[]): string | null;
}

export interface RuleInput {
  content: string;
  lines: string[];
  ext: string; // e.g. ".css"
  ctx: DesignContext;
  /** Present for the `render` engine only: the captured rows of one viewport. */
  rows?: StyleRow[];
}

export interface SlopRule {
  id: string; // e.g. "slop-v1-side-stripe"
  catalogId: string; // e.g. "V1"
  severity: Severity;
  engines: Engine[];
  description: string;
  /** human-facing note on what to do — printed with the finding */
  message: string;
  /** suppress the rule entirely for this file when DESIGN.md declares intent */
  gated?: (ctx: DesignContext) => boolean;
  /**
   * Extensions this rule reads beyond its engines' own. The global engine map
   * stays closed to `.ts` / `.js` (widening it put CP1 on code comments,
   * measured 2026-10-26); a rule whose signal is code — an observer, a
   * handler — opts in here (road-to-tells-a-near-miss-can-refute 2.4).
   */
  alsoExts?: string[];
  detect: (input: RuleInput) => RawHit[];
}

// ---------------------------------------------------------------------------
// Shared helpers (pattern-based, dependency-free)
// ---------------------------------------------------------------------------

/** Split CSS-ish text into naive `selector { body }` blocks with the line of `{`. */
export function cssBlocks(content: string): Array<{ selector: string; body: string; line: number }> {
  const blocks: Array<{ selector: string; body: string; line: number }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    // The match starts right after the previous `}`, newline included; the
    // block's line is where its selector starts.
    const sel = m[1] ?? "";
    const line = lineOf(content, m.index + sel.length - sel.trimStart().length);
    blocks.push({ selector: (m[1] ?? "").trim(), body: m[2] ?? "", line });
  }
  return blocks;
}

function lineOf(content: string, index: number): number {
  return (content.slice(0, index).match(/\n/g) ?? []).length + 1;
}

/**
 * True when a selector's SUBJECT is body-length text — the last compound of any
 * member of a selector list, read as an element (p, li, blockquote, article,
 * body) or a class that names a body region (`prose`, `body`, `content`,
 * `copy`, or one ending in `-body` / `__body`, `-content`, `-copy`, `-prose`).
 *
 * Tuned 2026-10-26 on the near-miss corpus (road-to-tells-a-near-miss-can-
 * refute 1.6): the old test matched `article` anywhere in the selector, so
 * `.article-pullquote` (display type) and `.article-body abbr` (small caps)
 * were judged as body text.
 */
export function isBodySubject(selector: string): boolean {
  return selector.split(",").some((member) => {
    const subject = member.trim().split(/\s*[\s>+~]\s*/).pop() ?? "";
    if (/^(?:p|li|blockquote|article|body)(?=$|[.#:[])/i.test(subject)) return true;
    return [...subject.matchAll(/\.([\w-]+)/g)].some(
      (m) => /^(?:prose|body|content|copy)$|[-_](?:body|content|copy|prose)$/i.test(m[1] ?? ""),
    );
  });
}

/** Visible text from HTML/JSX/Markdown: strip tags, code fences, attributes. */
export function visibleText(content: string, ext: string): string {
  let t = content;
  if (ext === ".md" || ext === ".mdx") {
    t = t.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  }
  // strip HTML/JSX tags and JSX expression braces
  t = t.replace(/<[^>]+>/g, " ").replace(/\{[^}]*\}/g, " ");
  return t;
}

/** Coarse HSL hue bucket (0–11, 30° each) from a #rgb/#rrggbb hex; null if grayscale/near-black/near-white (not an accent). */
export function hueBucket(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1] ?? "";
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.25 || l < 0.12 || l > 0.95) return null; // grayscale / near-black / near-white
  let hue = 0;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return Math.floor(hue / 30) % 12;
}

/** Approximate `<section>` bodies for layout-cap rules (no recursion; coarse, deterministic). */
export function sectionBodies(content: string): string[] {
  const starts: number[] = [];
  const re = /<section\b|<Section\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) starts.push(m.index);
  if (starts.length === 0) return [];
  const bodies: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1]! : content.length;
    bodies.push(content.slice(starts[i]!, end));
  }
  return bodies;
}

/** Coarse structural signature of a section body (for monotony / zigzag caps). */
function sectionSignature(body: string): { sig: string; mediaText: boolean } {
  const img = /<img\b|<picture\b|<Image\b|background-image/i.test(body);
  const grid = /\b(flex|grid|grid-cols|col-span|md:flex|lg:grid)\b/i.test(body);
  const heading = /<h[1-6]\b/i.test(body);
  const text = heading || /<(p|li)\b/i.test(body);
  const blocks = Math.min((body.match(/<div\b/gi) ?? []).length, 5);
  return { sig: `${img ? "I" : ""}${grid ? "G" : ""}${heading ? "H" : ""}${blocks}`, mediaText: img && text && grid };
}

const DEFAULT_FONTS = [
  "inter",
  "roboto",
  "dm sans",
  "geist",
  "space grotesk",
  "instrument serif",
];

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const SLOP_RULES: SlopRule[] = [
  {
    id: "slop-v1-side-stripe",
    catalogId: "V1",
    severity: "P1",
    engines: ["css"],
    description:
      "Colored accent border > 1px — a side stripe, a four-sided colored border, or a gradient border-image (V1)",
    message:
      "Colored accent border reads as scaffold-default. Remove it, or declare an intentional accent border in DESIGN.md (V1).",
    gated: (ctx) =>
      ctx.has("side stripe", "side-stripe", "stripe accent", "accent border", "card border"),
    detect: ({ content }) =>
      cssBlocks(content)
        // exclude semantic blockquote/quote selectors (legitimate left rule)
        .filter((b) => !/blockquote|\bquote\b|<q>/i.test(b.selector))
        .filter((b) => {
          // A colored value, but never a placeholder one: `transparent` and
          // `currentColor` at > 1px are the layout-reservation and
          // inherit-the-text-color idioms, not an accent decision.
          const COLOR = "(?!transparent|currentcolor|inherit|initial|unset)(?:#|rgb|hsl|oklch|var\\(|[a-z])";
          const WIDTH = "(?:[2-9]|\\d{2,})px";
          // (a) the original side stripe: border-left / border-right
          const stripe = new RegExp(`border-(?:left|right)\\s*:\\s*${WIDTH}\\s+\\w+\\s+${COLOR}`, "i");
          // (b) the current form: a fully colored border on all four sides
          const foursided = new RegExp(`border\\s*:\\s*${WIDTH}\\s+\\w+\\s+${COLOR}`, "i");
          // (c) a gradient border, which carries no width token at all
          const gradient = /border-image\s*:[^;]*(?:linear|conic|radial)-gradient/i;
          return stripe.test(b.body) || foursided.test(b.body) || gradient.test(b.body);
        })
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-c2-gradient-text",
    catalogId: "C2",
    severity: "P2",
    engines: ["css"],
    description: "Gradient text via background-clip: text",
    message:
      "Gradient text via background-clip:text is overused and has cross-platform rendering edges (C2).",
    gated: (ctx) => ctx.has("gradient identity", "gradient-identity", "gradient logo"),
    detect: ({ content }) =>
      cssBlocks(content)
        .filter(
          (b) =>
            /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/i.test(b.body) &&
            /linear-gradient|radial-gradient|conic-gradient/i.test(b.body),
        )
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-c5-cream-palette",
    catalogId: "C5",
    severity: "P3",
    engines: ["css"],
    description: "Cream/sand background + brass/clay/oxblood accent — the 2025 'premium-consumer' AI palette",
    message:
      "Warm cream/sand + brass/clay is the default 'tasteful AI' surface. Confirm it is first-party in DESIGN.md (C5).",
    gated: (ctx) => ctx.has("warm neutral", "warm-neutral", "cream", "sand", "premium consumer"),
    detect: ({ content }) => {
      const cream = /#f[5-9bdf][f0-9a-f]e[0-9a-f]|#fbf8f1|#f7f5f1|#f5f1ea/i.test(content);
      const brass = /#b08947|#b6553a|#9a2436|brass|oxblood|terracotta|clay/i.test(content);
      if (!cream || !brass) return [];
      const idx = content.search(/#f[5-9bdf][f0-9a-f]e[0-9a-f]|#fbf8f1|#f7f5f1|#f5f1ea/i);
      return [{ line: lineOf(content, Math.max(0, idx)), snippet: "cream/sand bg + warm accent co-occur" }];
    },
  },
  {
    id: "slop-t4-eyebrow-overuse",
    catalogId: "T4",
    severity: "P2",
    engines: ["html", "jsx"],
    description: "More than one ALL-CAPS eyebrow per 3 sections, or a pill badge on top of the h1",
    message:
      "Eyebrow/ALL-CAPS labels above every section collapse emphasis; cap is 1 per 3 sections, and a pill badge stacked on the h1 is the template's own (T4).",
    // By position, not by count of the word `uppercase`: an eyebrow is a short
    // label whose next element is a heading. A status chip in a table row or an
    // uppercase button is not one. Fails open on markup the regex cannot pair
    // (a heading built by a component, an eyebrow wrapped twice).
    detect: ({ content }) => {
      const hits: RawHit[] = [];
      const sections = (content.match(/<section\b|<Section\b/gi) ?? []).length;
      const eyebrow =
        /<([a-z][\w.]*)\b[^>]*(?:(?:class|className)=["'][^"']*\buppercase\b[^"']*["']|style=["'][^"']*text-transform\s*:\s*uppercase)[^>]*>[^<]{1,60}<\/\1>\s*<h[1-6]\b/gi;
      const eyebrows = (content.match(eyebrow) ?? []).length;
      const cap = Math.max(1, Math.ceil(sections / 3));
      if (sections >= 3 && eyebrows > cap) {
        hits.push({ line: 1, snippet: `${eyebrows} uppercase eyebrows above headings across ${sections} sections (cap ${cap})` });
      }
      const badge =
        /<([a-z][\w.]*)\b[^>]*(?:class|className)=["'][^"']*\b(?:rounded-full|badge|pill)\b[^"']*["'][^>]*>[^<]{1,60}<\/\1>\s*<h1\b/i.exec(content);
      if (badge) {
        hits.push({ line: content.slice(0, badge.index).split("\n").length, snippet: badge[0].slice(0, 80) });
      }
      return hits;
    },
  },
  {
    id: "slop-t6-crushed-tracking",
    catalogId: "T6",
    severity: "P2",
    engines: ["css"],
    description: "Crushed display letter-spacing below −0.04em",
    message: "letter-spacing tighter than −0.04em makes glyphs collide optically (T6/Q7).",
    detect: ({ lines }) =>
      lines.flatMap((l, i) => {
        const m = /letter-spacing\s*:\s*(-?\d*\.?\d+)\s*em/i.exec(l);
        if (m && m[1] && parseFloat(m[1]) < -0.04) {
          return [{ line: i + 1, snippet: l.trim().slice(0, 80) }];
        }
        return [];
      }),
  },
  {
    id: "slop-t7-default-fonts",
    catalogId: "T7",
    severity: "P2",
    engines: ["css"],
    description: "Default AI font (Inter/Roboto/DM Sans/Geist/Space Grotesk/Instrument Serif) without a stated reason",
    // Register-scoped by the catalog, NOT by this matcher: a CSS text pass carries
    // no register signal, so the scope lives in the rebuttal rather than in the
    // gate. `design-modes.md` sanctions a single reliable family in the PRODUCT
    // register, which makes "product register" a complete reason on its own — the
    // message names it so a product surface knows the rebuttal without reading two
    // guidelines. P2 is a rebuttable presumption (see the header), never a block.
    message:
      "This is a default AI-coding-tool font pick. Declare it with a reason (T7) — in the product register, \"single reliable family\" IS the reason; state it in DESIGN.md or the surface brief.",
    gated: (ctx) => DEFAULT_FONTS.some((f) => ctx.has(f)),
    detect: ({ lines }) =>
      lines.flatMap((l, i) => {
        if (!/font-family\s*:/i.test(l)) return [];
        const lower = l.toLowerCase();
        const hit = DEFAULT_FONTS.find((f) => lower.includes(f));
        return hit ? [{ line: i + 1, snippet: l.trim().slice(0, 80) }] : [];
      }),
  },
  {
    id: "slop-l4-numbered-markers",
    catalogId: "L4",
    severity: "P3",
    engines: ["html", "jsx"],
    description: "Numbered section markers (01 / 02 / 03) as a decorative order device",
    message:
      "Numbered 01/02/03 section markers are a universal generated-landing-page tell (L4).",
    detect: ({ content, ext }) => {
      // Numbers inside an ordered list number its steps — the catalog's own
      // override ("a genuinely numbered process"). Tuned 2026-10-26 on the
      // near-miss corpus: only markers outside <ol> are section decoration.
      const text = visibleText(content.replace(/<ol\b[\s\S]*?<\/ol>/gi, " "), ext);
      const markers = text.match(/(?<![\d/.])0[1-9](?![\d%])/g) ?? [];
      const distinct = new Set(markers.map((s) => s.trim()));
      if (distinct.has("01") && distinct.has("02") && distinct.has("03")) {
        return [{ line: 1, snippet: "decorative 01/02/03 section markers" }];
      }
      return [];
    },
  },
  {
    id: "slop-l8-zindex-magic",
    catalogId: "L8",
    severity: "P2",
    engines: ["css"],
    description: "Magic z-index values (99 / 999 / 9999) with no semantic scale",
    message: "Magic z-index breaks the first time two elements compete. Use a named scale (L8).",
    detect: ({ lines }) =>
      lines.flatMap((l, i) =>
        /z-index\s*:\s*(?:99|999|9999)\b/i.test(l) ? [{ line: i + 1, snippet: l.trim().slice(0, 80) }] : [],
      ),
  },
  {
    id: "slop-m4-transition-all",
    catalogId: "M4",
    severity: "P2",
    engines: ["css"],
    description: "transition: all shorthand",
    message: "transition:all animates layout/color/opacity together — unpredictable + expensive (M4).",
    detect: ({ lines }) =>
      lines.flatMap((l, i) =>
        /transition\s*:\s*all\b/i.test(l) ? [{ line: i + 1, snippet: l.trim().slice(0, 80) }] : [],
      ),
  },
  {
    id: "slop-m2-animate-layout",
    catalogId: "M2",
    severity: "P2",
    engines: ["css"],
    description: "Transitioning layout properties (width/height/top/left/margin/padding)",
    message: "Animating layout props forces reflow; use transform instead (M2).",
    detect: ({ lines }) =>
      lines.flatMap((l, i) =>
        /transition\s*:\s*(?:[^;]*\b)?(?:width|height|top|left|right|bottom|margin|padding)\b[^;]*\d/i.test(l)
          ? [{ line: i + 1, snippet: l.trim().slice(0, 80) }]
          : [],
      ),
  },
  {
    id: "slop-cp1-em-dash",
    catalogId: "CP1",
    severity: "P2",
    engines: ["copy"],
    description: "Em-dash overuse in visible copy (> 2 per 500 words)",
    message: "Em-dash density above ~2 per 500 words is the #1 LLM syntactic tell (CP1).",
    detect: ({ content, ext }) => {
      const text = visibleText(content, ext);
      const words = (text.match(/\S+/g) ?? []).length;
      const dashes = (text.match(/—/g) ?? []).length;
      if (words >= 80 && dashes > Math.max(2, Math.round((words / 500) * 2))) {
        return [{ line: 1, snippet: `${dashes} em-dashes in ~${words} words` }];
      }
      return [];
    },
  },
  {
    id: "slop-v8-lock-shape",
    catalogId: "V8",
    severity: "P2",
    engines: ["css"],
    description: "Shape Lock — too many distinct corner-radius scales",
    message: "Mixed corner-radius scales fragment the shape system; lock one scale (V8 / Shape Lock).",
    gated: (ctx) => ctx.has("shape lock"),
    detect: ({ content }) => {
      const vals = new Set<number>();
      for (const m of content.matchAll(/border-radius\s*:\s*([^;}]+)/gi)) {
        for (const pm of (m[1] ?? "").matchAll(/(\d+(?:\.\d+)?)px/gi)) {
          const v = parseFloat(pm[1] ?? "0");
          if (v > 0 && v < 9990) vals.add(v);
        }
      }
      if (vals.size >= 4) {
        const idx = content.search(/border-radius/i);
        return [
          {
            line: lineOf(content, Math.max(0, idx)),
            snippet: `${vals.size} distinct radius values: ${[...vals].sort((a, b) => a - b).join("/")}px`,
          },
        ];
      }
      return [];
    },
  },
  {
    id: "slop-l9-section-monotony",
    catalogId: "L9",
    severity: "P3",
    engines: ["html", "jsx"],
    description: "Section-layout monotony — too few distinct layout families across many sections",
    message: "Many sections but few distinct layouts → monotonous rhythm; vary the composition (L9).",
    gated: (ctx) => ctx.has("brutalist", "uniform grid", "repetitive grid"),
    detect: ({ content }) => {
      const bodies = sectionBodies(content);
      if (bodies.length < 8) return [];
      const sigs = new Set(bodies.map((b) => sectionSignature(b).sig));
      if (sigs.size < 4) {
        return [{ line: 1, snippet: `${bodies.length} sections, only ${sigs.size} distinct layout families` }];
      }
      return [];
    },
  },
  {
    id: "slop-l10-zigzag",
    catalogId: "L10",
    severity: "P3",
    engines: ["html", "jsx"],
    description: "Zigzag alternation — more than two consecutive media+text two-column sections",
    message: "More than two consecutive image+text two-column sections is the alternating-zigzag tell (L10).",
    gated: (ctx) => ctx.has("brutalist", "uniform grid", "repetitive grid"),
    detect: ({ content }) => {
      const bodies = sectionBodies(content);
      let run = 0;
      let maxRun = 0;
      for (const b of bodies) {
        if (sectionSignature(b).mediaText) {
          run += 1;
          maxRun = Math.max(maxRun, run);
        } else {
          run = 0;
        }
      }
      if (maxRun > 2) return [{ line: 1, snippet: `${maxRun} consecutive media+text sections` }];
      return [];
    },
  },
  // -------------------------------------------------------------------------
  // Catalog thresholds promoted to rules (road-to-design-detector-evidence
  // Phase 3). Each entry below already published its number in
  // docs/guidelines/design-antipatterns.md — the prose is the specification,
  // nothing here is invented, and each was graded per rule against the clean
  // corpus rather than as a batch.
  // -------------------------------------------------------------------------
  {
    id: "slop-v4-over-rounded",
    catalogId: "V4",
    severity: "P3",
    engines: ["css"],
    description: "border-radius > 16px on an element declared under 200px wide",
    message: "Heavy rounding on a small surface reads as scaffold-default; scale the radius to the element (V4).",
    gated: (ctx) => ctx.has("pill", "fully rounded", "soft ui", "claymorphism"),
    detect: ({ content }) =>
      cssBlocks(content)
        .filter((b) => {
          // A pill (9999px / 50% / 999px) and a circle are deliberate shapes,
          // not over-rounding — the tell is a mid-range radius on a small box.
          const r = /border-radius\s*:\s*(\d+)px/i.exec(b.body);
          if (!r?.[1]) return false;
          const radius = parseInt(r[1], 10);
          if (radius <= 16 || radius >= 100) return false;
          // "small" must be declared in the same block; nothing here infers
          // layout, because inferring it would need a cascade.
          const size = /(?:^|[;{\s])(?:max-)?(?:width|height)\s*:\s*(\d+)px/i.exec(b.body);
          return size?.[1] !== undefined && parseInt(size[1], 10) < 200;
        })
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-c3-dark-glow",
    catalogId: "C3",
    severity: "P2",
    engines: ["css"],
    description: "Saturated zero-offset glow (box-shadow / text-shadow) in a dark context",
    message: "A neon glow on dark reads as gaming-UI default rather than a considered accent (C3).",
    gated: (ctx) => ctx.has("glow", "neon", "cyberpunk", "gaming"),
    detect: ({ content, lines }) => {
      // The tell is dark-context-specific, so a file with no dark surface at all
      // is out of scope — a glow on a light page is a different question.
      const darkContext =
        /prefers-color-scheme\s*:\s*dark/i.test(content) ||
        /\.dark\b|\[data-theme=["']?dark/i.test(content) ||
        /background(?:-color)?\s*:\s*#(?:0[0-9a-f]{5}|1[0-9a-f]{5}|000|111)\b/i.test(content);
      if (!darkContext) return [];
      const out: RawHit[] = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i] ?? "";
        // zero-offset + real blur is the glow signature; an offset shadow is depth.
        const m = /(?:box|text)-shadow\s*:\s*0\s+0\s+(\d+)px[^;]*?(#[0-9a-f]{3,8})/i.exec(l);
        if (!m?.[1] || !m[2]) continue;
        if (parseInt(m[1], 10) < 8) continue;
        if (hueBucket(m[2]) === null) continue; // a neutral halo is not a neon accent
        out.push({ line: i + 1, snippet: l.trim().slice(0, 80) });
      }
      return out;
    },
  },
  {
    id: "slop-t9-uppercase-body",
    catalogId: "T9",
    severity: "P3",
    engines: ["css"],
    description: "text-transform: uppercase applied to body-length text",
    message: "All-caps destroys word-shape for sustained reading; reserve it for short labels (T9).",
    gated: (ctx) => ctx.has("all caps", "all-caps", "uppercase display"),
    detect: ({ content }) =>
      cssBlocks(content)
        // Short UI surfaces (labels, buttons, table headers, badges, eyebrows)
        // are the legitimate home of uppercase and are excluded by selector.
        .filter((b) => isBodySubject(b.selector))
        .filter((b) => !/label|button|\bth\b|badge|chip|tag|eyebrow|kicker|caption|nav/i.test(b.selector))
        .filter((b) => /text-transform\s*:\s*uppercase/i.test(b.body))
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-t10-wide-tracking-body",
    catalogId: "T10",
    severity: "P3",
    engines: ["css"],
    description: "letter-spacing above 0.05em on body-length text",
    message: "Wide tracking slows sustained reading; it belongs to display type, not body (T10).",
    gated: (ctx) => ctx.has("wide tracking", "letterspacing", "letter-spacing"),
    detect: ({ content }) =>
      cssBlocks(content)
        .filter((b) => isBodySubject(b.selector))
        .filter((b) => !/label|button|\bth\b|badge|chip|tag|eyebrow|kicker|caption|nav|h[1-6]/i.test(b.selector))
        .filter((b) => {
          const em = /letter-spacing\s*:\s*(\d*\.?\d+)(em|rem)/i.exec(b.body);
          if (em?.[1]) return parseFloat(em[1]) > 0.05;
          const px = /letter-spacing\s*:\s*(\d*\.?\d+)px/i.exec(b.body);
          return px?.[1] !== undefined && parseFloat(px[1]) > 0.8;
        })
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-t12-swap-without-metric-fallback",
    catalogId: "T12",
    severity: "P3",
    engines: ["css"],
    description: "Self-hosted webfont with font-display: swap and no metric-matched fallback @font-face",
    message:
      "swap paints the fallback first; without a local() fallback carrying size-adjust, ascent-override and descent-override, every line reflows at the swap (T12).",
    gated: (ctx) => ctx.has("size-adjust", "metric-matched fallback"),
    detect: ({ content }) => {
      const faces = cssBlocks(content).filter((b) => /^@font-face$/i.test(b.selector));
      // Self-hosted: a url() that is not an absolute http(s) address. A
      // third-party delivery is owned by the webfont-delivery section.
      const swapped = faces.filter(
        (b) =>
          /font-display\s*:\s*swap/i.test(b.body) &&
          /url\(/i.test(b.body) &&
          !/url\(\s*["']?https?:\/\//i.test(b.body),
      );
      if (swapped.length === 0) return [];
      const matched = faces.some(
        (b) =>
          /local\(/i.test(b.body) &&
          /size-adjust\s*:/i.test(b.body) &&
          /ascent-override\s*:/i.test(b.body) &&
          /descent-override\s*:/i.test(b.body),
      );
      return matched ? [] : swapped.map((b) => ({ line: b.line, snippet: b.body.trim().split("\n")[0]?.slice(0, 80) ?? "" }));
    },
  },
  {
    id: "slop-m3-img-hover-transform",
    catalogId: "M3",
    severity: "P3",
    engines: ["css"],
    description: "transform or filter animation on an <img> hover",
    message: "Hover-scaling an image triggers composite plus decode and often shifts layout (M3).",
    gated: (ctx) => ctx.has("image hover", "hover zoom", "ken burns"),
    detect: ({ content }) =>
      cssBlocks(content)
        .filter((b) => /\bimg\b/i.test(b.selector) && /:hover|:focus-within/i.test(b.selector))
        .filter((b) => /(?:^|[;{\s])(?:transform|filter)\s*:/i.test(b.body))
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-m6-scroll-reveal",
    catalogId: "M6",
    severity: "P2",
    engines: ["jsx"],
    alsoExts: [".ts", ".js", ".mjs"],
    description: "IntersectionObserver used to fade or slide content into view on scroll",
    message:
      "A per-section reveal delays what the reader already scrolled to. Keep it only for a stepped narrative or a progress cue (M6).",
    gated: (ctx) => ctx.has("scroll reveal", "stepped narrative"),
    detect: ({ content }) => {
      if (!/\bIntersectionObserver\b/.test(content)) return [];
      // The reveal signature: the observer's effect is a visibility class or an
      // opacity / transform change. Lazy-loading (setting a src) and a
      // table-of-contents highlight set neither.
      const reveal =
        /classList\.(?:add|toggle)\(\s*["'`][\w-]*(?:reveal|visible|in-view|inview|fade|animate|show)[\w-]*["'`]/i.test(content) ||
        /\.style\.(?:opacity|transform)\s*=/.test(content) ||
        /data-(?:reveal|animate|aos)\b/i.test(content);
      if (!reveal) return [];
      const idx = content.search(/\bIntersectionObserver\b/);
      return [{ line: lineOf(content, idx), snippet: "IntersectionObserver driving a reveal" }];
    },
  },
  {
    id: "slop-m8-hover-fade",
    catalogId: "M8",
    severity: "P2",
    engines: ["css"],
    description: "An interactive control that lowers its own opacity on hover",
    message:
      "A hover fade makes the target retreat at the moment of commitment. Respond with colour, weight or elevation instead (M8).",
    detect: ({ content }) =>
      cssBlocks(content)
        .filter((b) => /:hover\b/.test(b.selector))
        // A disabled or dismissed state may fade — the catalog's override.
        .filter((b) => !/:disabled|\[aria-disabled|\[disabled|is-disabled|--disabled|dismiss|removing/i.test(b.selector))
        .filter((b) => /\b(?:a|button|btn|link|\[role=["']?button|input|select|card|tab|chip)\b/i.test(b.selector))
        .filter((b) => {
          const m = /(?:^|[;{\s])opacity\s*:\s*(0?\.\d+|0)\b/i.exec(b.body);
          return m !== null;
        })
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) })),
  },
  {
    id: "slop-v9-grain-over-gradient",
    catalogId: "V9",
    severity: "P3",
    engines: ["css"],
    description: "Noise or grain texture laid over a gradient surface",
    message:
      "Grain over a gradient is the generated-CSS-art 'premium' default. Keep it only as a documented brand surface (V9).",
    gated: (ctx) => ctx.has("grain", "noise texture", "print-inspired"),
    detect: ({ content }) => {
      const grain = /feTurbulence|\bgrain\b|\bnoise\b/i;
      const gradient = /(?:linear|radial|conic)-gradient\s*\(/i;
      return cssBlocks(content)
        .filter((b) => grain.test(b.body) && gradient.test(b.body))
        .map((b) => ({ line: b.line, snippet: b.selector.slice(0, 80) }));
    },
  },
];
