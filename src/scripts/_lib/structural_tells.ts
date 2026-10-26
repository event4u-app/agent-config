/**
 * Structural prose tells (road-to-tells-a-near-miss-can-refute 5.2): families
 * a deterministic matcher can actually read, each promoted under the epoch gate
 * in `internal/bench/corpora/prose-tells-epochs.md`. The ones that need a
 * reader's judgement stay model-judged and are listed so in
 * `src/skills/humanizer/references/anti-aiisms.md`.
 */
import type { MatchResult, RawOccurrence } from "../ai_tells_rules.js";

const result = (occurrences: RawOccurrence[]): MatchResult => ({
  count: occurrences.length,
  samples: occurrences.slice(0, 3).map((o) => o.text.slice(0, 60).trim()),
  occurrences,
});

const STOP = new Set(
  "the a an and or of to in on for with by at from is are was were be this that these those it its how why what when your our we you de die der das und oder ein eine zu im in mit von für ist sind wie warum was".split(
    " ",
  ),
);

const contentTokens = (s: string): string[] =>
  (s.toLowerCase().match(/\p{L}[\p{L}'-]*/gu) ?? []).filter((t) => t.length >= 3 && !STOP.has(t));

/**
 * `tell-heading-echo` — the first sentence under a heading restates it: every
 * content word of a heading of two or more content words reappears in that
 * sentence. A heading of one word ("Usage") is too short to echo.
 */
export function matchHeadingEcho(text: string): MatchResult {
  const out: RawOccurrence[] = [];
  const re = /^#{1,6}\s+(.+)\n+(?!#|[-*]\s|\d+\.\s|```|\|)([^\n]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const heading = new Set(contentTokens(m[1] ?? ""));
    if (heading.size < 2) continue;
    const first = (m[2] ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
    const said = new Set(contentTokens(first));
    if ([...heading].every((t) => said.has(t))) out.push({ index: m.index, text: first });
  }
  return result(out);
}

/**
 * `tell-repeated-openings` — three or more consecutive, different sentences
 * opening on the same two words. A sentence repeated verbatim is duplication,
 * not a forced opening, and breaks the run.
 */
export function matchRepeatedOpenings(text: string): MatchResult {
  const out: RawOccurrence[] = [];
  let offset = 0;
  for (const para of text.split(/\n\s*\n/)) {
    if (/^\s*(?:[-*|>]|\d+\.|```|#)/.test(para)) {
      offset += para.length + 2;
      continue;
    }
    const sentences = para.replace(/\n/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim());
    let run = 1;
    for (let i = 1; i < sentences.length; i += 1) {
      const a = (sentences[i - 1] ?? "").toLowerCase().split(/\s+/).slice(0, 2).join(" ");
      const b = (sentences[i] ?? "").toLowerCase().split(/\s+/).slice(0, 2).join(" ");
      const differ = (sentences[i - 1] ?? "").trim() !== (sentences[i] ?? "").trim();
      run = a === b && differ && a.split(" ").length === 2 ? run + 1 : 1;
      if (run === 3) out.push({ index: offset, text: sentences[i] ?? "" });
    }
    offset += para.length + 2;
  }
  return result(out);
}

/**
 * `tell-repeated-closer` — the same one-line paragraph of at most twelve words
 * closes two or more sections. A shared closer is a sign-off pasted per section.
 */
export function matchRepeatedCloser(text: string): MatchResult {
  const out: RawOccurrence[] = [];
  const seen = new Map<string, number>();
  for (const section of text.split(/^#{1,6}\s.*$/m)) {
    const paras = section.trim().split(/\n\s*\n/);
    const last = (paras[paras.length - 1] ?? "").trim();
    if (paras.length < 2 || last.includes("\n") || /^(?:[-*|>]|\d+\.|```)/.test(last)) continue;
    const words = last.split(/\s+/).length;
    if (words < 3 || words > 12) continue;
    const k = last.toLowerCase().replace(/[^\p{L}\s]/gu, "");
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n === 2) out.push({ index: Math.max(0, text.indexOf(last)), text: last });
  }
  return result(out);
}
