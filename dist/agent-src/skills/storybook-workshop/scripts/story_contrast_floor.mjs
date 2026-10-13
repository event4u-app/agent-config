// src/skills/storybook-workshop/scripts/story_contrast_floor.ts
import * as fs from "node:fs";
var AA_NORMAL = 4.5;
var AA_LARGE = 3;
var clamp01 = (n) => n < 0 ? 0 : n > 1 ? 1 : n;
var luminance = (hex) => {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (m === null) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => `${c}${c}`).join("");
  const channel = (pair) => {
    const v = clamp01(parseInt(pair, 16) / 255);
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(h.slice(0, 2));
  const g = channel(h.slice(2, 4));
  const b = channel(h.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
var contrastRatio = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) return null;
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};
var declaredPairs = (source) => {
  const out = [];
  const exportRe = /export\s+const\s+([A-Za-z0-9_]+)\s*:[^=]*=\s*\{([\s\S]*?)\n\};/g;
  for (const m of source.matchAll(exportRe)) {
    const story = m[1];
    const body = m[2];
    const fg = /(?:color|fg|foreground)\s*:\s*['"](#[0-9a-fA-F]{3,6})['"]/.exec(body);
    const bg = /(?:background|bg|backgroundColor)\s*:\s*['"](#[0-9a-fA-F]{3,6})['"]/.exec(body);
    if (fg?.[1] !== void 0 && bg?.[1] !== void 0) {
      out.push({ story, fg: fg[1], bg: bg[1] });
    }
  }
  return out;
};
var checkStoryFile = (file, floor = AA_NORMAL) => {
  let source = "";
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out = [];
  for (const { story, fg, bg } of declaredPairs(source)) {
    const ratio = contrastRatio(fg, bg);
    if (ratio === null || ratio >= floor) continue;
    out.push({
      rule: "color-contrast",
      // The story is the addressable unit here — there is no DOM to select into.
      selector: `story:${story}`,
      severity: "error",
      ratio: Math.round(ratio * 100) / 100
    });
  }
  return out;
};
var selfTest = () => {
  let failed = 0;
  const check = (label, cond) => {
    if (!cond) {
      process.stderr.write(`\u274C  ${label}
`);
      failed += 1;
    }
  };
  const r = contrastRatio("#000000", "#ffffff");
  check("black on white is the maximum 21:1", r !== null && Math.abs(r - 21) < 0.01);
  check("a colour on itself is 1:1", Math.abs((contrastRatio("#777777", "#777777") ?? 0) - 1) < 0.01);
  check("an unreadable colour is null, not 0", contrastRatio("nope", "#fff") === null);
  check("shorthand hex is expanded", contrastRatio("#000", "#fff") !== null);
  process.stdout.write(failed === 0 ? "\u2705  story_contrast_floor: self-test passed\n" : `\u274C  ${String(failed)} failure(s)
`);
  return failed === 0 ? 0 : 1;
};
var main = () => {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();
  const files = argv.filter((a) => !a.startsWith("--"));
  const violations = files.flatMap((f) => checkStoryFile(f));
  process.stdout.write(`${JSON.stringify({ violations }, null, 2)}
`);
  return violations.length > 0 ? 1 : 0;
};
if (process.argv[1] !== void 0 && process.argv[1].includes("story_contrast_floor")) {
  process.exit(main());
}
export {
  AA_LARGE,
  AA_NORMAL,
  checkStoryFile,
  contrastRatio,
  declaredPairs,
  luminance
};
