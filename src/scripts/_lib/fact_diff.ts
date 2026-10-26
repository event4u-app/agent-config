/**
 * Deterministic fact diff for a rewrite (road-to-tells-a-near-miss-can-refute
 * 5.3). A humanizing pass changes how something is said, never what is true;
 * this extracts the parts of a text that carry truth a reword must not move —
 * URLs, code spans, currency amounts, dates, numbers and capitalised
 * multi-word names — and reports any one that the rewrite lost or added.
 *
 * Deliberately literal: "three" and "3" are different facts here, and so is a
 * name the rewrite merely re-cased. A false alarm costs one look; a moved
 * number that passes silently is the defect this exists to catch.
 */

export type FactKind = "url" | "code" | "currency" | "date" | "number" | "name";

export interface Fact {
  kind: FactKind;
  value: string;
}

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December|" +
  "Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember";

const EXTRACTORS: Array<[FactKind, RegExp]> = [
  ["url", /\bhttps?:\/\/[^\s)\]>"']+/g],
  ["code", /`[^`\n]+`/g],
  ["currency", /(?:[$€£]\s?\d[\d.,]*\d|\d[\d.,]*\s?(?:€|EUR|USD|GBP)\b|\b\d[\d.,]*\s?(?:dollars|euros?|pounds))/gi],
  ["date", new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b(?:${MONTHS})\\s+\\d{1,2}(?:,\\s*\\d{4})?\\b|\\b\\d{1,2}\\.\\s*(?:${MONTHS})(?:\\s+\\d{4})?\\b`, "g")],
  ["number", /(?<![\w.])\d+(?:[.,]\d+)*%?/g],
  ["name", /\b(?:[A-Z][\p{Ll}]+|[A-Z]{2,})(?:\s+(?:[A-Z][\p{Ll}]+|[A-Z]{2,}))+\b/gu],
];

/** Capitalised only because it starts the sentence — not part of a name. */
const LEADING = /^(?:The|A|An|In|On|At|For|And|But|This|That|Our|We|It|Der|Die|Das|Ein|Eine|Im|Am|Und)\s+/;

export function extractFacts(text: string): Fact[] {
  let rest = text;
  const facts: Fact[] = [];
  for (const [kind, re] of EXTRACTORS) {
    rest = rest.replace(re, (hit) => {
      let value = hit.trim();
      if (kind === "number") value = value.replace(/,(?=\d{3}\b)/g, "");
      if (kind === "name") value = value.replace(LEADING, "");
      if (kind !== "name" || /\s/.test(value)) facts.push({ kind, value });
      return " ";
    });
  }
  return facts;
}

export interface FactDiff {
  lost: Fact[];
  added: Fact[];
}

/** Multiset difference both ways: a fact the rewrite dropped, and one it introduced. */
export function diffFacts(before: string, after: string): FactDiff {
  const key = (f: Fact) => `${f.kind}\u0000${f.value}`;
  const count = (fs: Fact[]) => {
    const m = new Map<string, Fact[]>();
    for (const f of fs) m.set(key(f), [...(m.get(key(f)) ?? []), f]);
    return m;
  };
  const b = count(extractFacts(before));
  const a = count(extractFacts(after));
  const minus = (x: Map<string, Fact[]>, y: Map<string, Fact[]>) =>
    [...x].flatMap(([k, fs]) => fs.slice(y.get(k)?.length ?? 0));
  return { lost: minus(b, a), added: minus(a, b) };
}
