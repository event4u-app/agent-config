/**
 * Deterministic fact diff for a rewrite (road-to-tells-a-near-miss-can-refute
 * 5.3). A humanizing pass changes how something is said, never what is true;
 * this extracts the parts of a text that carry truth a reword must not move —
 * URLs, code spans, currency amounts, dates, numbers and capitalised
 * multi-word names — and reports any one that the rewrite lost or added.
 *
 * Four further classes carry truth without a digit (road-to-rewrites-that-keep-
 * their-facts 2.1): a unit-bound number word ("eleven days"), a status or
 * qualifier ("draft", "over 70"), a negation or hedge ("not", "may"), and the
 * attribution subject — a "we" that became an "I" claims different work.
 *
 * Deliberately literal: "three" and "3" are different facts here, and so is a
 * name the rewrite merely re-cased. A false alarm costs one look; a moved
 * number that passes silently is the defect this exists to catch.
 */

export type FactKind =
  | "url"
  | "code"
  | "currency"
  | "date"
  | "number"
  | "name"
  | "numword"
  | "status"
  | "negation"
  | "modality"
  | "attribution";

export interface Fact {
  kind: FactKind;
  value: string;
}

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December|" +
  "Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember";

const LITERALS: Array<[FactKind, RegExp]> = [
  ["url", /\bhttps?:\/\/[^\s)\]>"']+/g],
  ["code", /`[^`\n]+`/g],
];

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|" +
  "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|" +
  "zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|vierzig|fünfzig|hundert|tausend";
const UNITS =
  "days?|weeks?|months?|years?|hours?|minutes?|seconds?|sprints?|quarters?|releases?|times|percent|" +
  "people|persons?|engineers?|developers?|customers?|users?|teams?|" +
  "Tagen?|Tage|Wochen?|Monaten?|Monate|Jahren?|Jahre|Stunden?|Minuten?|Sekunden?|Sprints?|Quartalen?|Quartale|Prozent|Mal|" +
  "Leuten?|Personen|Entwickler(?:innen|n)?|Kunden|Kundinnen|Nutzer(?:innen|n)?|Teams?";
const STATUS =
  "draft|proposal|proposed|planned|pilot|beta|alpha|preview|experimental|tentative|preliminary|provisional|pending|" +
  "adopted|approved|ratified|in force|final|deprecated|unreleased|released|launched|generally available|" +
  "Entwurf|Vorschlag|vorgeschlagen|geplant|Pilot\\p{L}*|vorläufig|beschlossen|verabschiedet|freigegeben|veröffentlicht|in Kraft|abgekündigt";
const QUALIFIERS =
  "about|around|roughly|approximately|nearly|almost|over|more than|less than|fewer than|under|up to|at least|at most|" +
  "etwa|rund|ungefähr|fast|knapp|über|mehr als|weniger als|bis zu|mindestens|höchstens";

/** Lexical facts: counted as a multiset, never consumed — they overlap the literal kinds. */
const LEXICAL: Array<[FactKind, RegExp, (hit: string) => string]> = [
  ["numword", new RegExp(`(?<![\\p{L}])(?:${NUMBER_WORDS})[^\\S\\n]+(?:${UNITS})(?![\\p{L}])`, "giu"), (h) => h.toLowerCase().replace(/\s+/g, " ")],
  ["status", new RegExp(`(?<![\\p{L}])(?:${STATUS})(?![\\p{L}])`, "giu"), (h) => h.toLowerCase().replace(/\s+/g, " ")],
  ["status", new RegExp(`(?<![\\p{L}])(?:${QUALIFIERS})(?=[^\\S\\n]+(?:\\d|(?:${NUMBER_WORDS})(?![\\p{L}])))`, "giu"), (h) => h.toLowerCase().replace(/\s+/g, " ")],
  ["negation", /(?<![\p{L}])(?:not|never|no|none|nothing|nobody|neither|nor|without|cannot|nicht|nie|niemals|kein\p{L}*|ohne|weder)(?![\p{L}])|n't\b/giu, (h) => (/^(?:nicht|nie|niemals|kein|ohne|weder)/i.test(h) ? "nicht" : "not")],
  ["modality", /(?<![\p{L}])(?:may|might|could|would|should|must|likely|unlikely|possibly|probably|perhaps|maybe|vielleicht|wahrscheinlich|möglicherweise|voraussichtlich|könnte\p{L}*|sollte\p{L}*|müsste\p{L}*|dürfte\p{L}*|würde\p{L}*)(?![\p{L}])/giu, (h) => h.toLowerCase()],
];

/** Presence, not count: one rewritten sentence must not change who did the work twice over. */
const ATTRIBUTION: Array<[string, RegExp]> = [
  ["we", /(?<![\p{L}])(?:[Ww]e|[Oo]urs?|us|[Ww]ir|[Uu]nser\p{L}*|[Uu]ns)(?![\p{L}])/u],
  ["I", /(?<![\p{L}])(?:I|[Mm]y|[Mm]ine|[Mm]e|[Ii]ch|[Mm]ein\p{L}*|[Mm]ich|[Mm]ir)(?![\p{L}])/u],
];

const EXTRACTORS: Array<[FactKind, RegExp]> = [
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
  for (const [kind, re] of LITERALS) {
    rest = rest.replace(re, (hit) => {
      facts.push({ kind, value: hit.trim() });
      return " ";
    });
  }
  for (const [kind, re, norm] of LEXICAL) {
    for (const m of rest.matchAll(re)) facts.push({ kind, value: norm(m[0]) });
  }
  for (const [value, re] of ATTRIBUTION) {
    if (re.test(rest)) facts.push({ kind: "attribution", value });
  }
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
