#!/usr/bin/env node
/**
 * ai_tells_rules — deterministic AI-writing-tell registry for prose deliverables.
 *
 * Data + matchers for the mechanically detectable subset of the AI-writing
 * pattern catalog in `src/skills/humanizer/data/patterns.md` (root source:
 * Wikipedia "Signs of AI writing", WikiProject AI Cleanup). Mirrors the
 * `design_slop_rules.ts` split: this file is the registry, `detect_ai_tells.ts`
 * is the CLI. Scope is GENERATED DELIVERABLE PROSE (ghostwriter drafts, posts,
 * articles) — NEVER repo docs; this repo's own documentation style (em dashes,
 * bold inline headers) is intentional and exempt by scope, not by allowlist.
 *
 * Severity model (encodes the source catalog's false-positive guidance —
 * "clusters are a confession, isolated hits are not"):
 *   hard    — a single hit counts against `--max-hard` (chat artifacts,
 *             knowledge-cutoff disclaimers, emoji headings, ` -- ` asides).
 *   cluster — hits contribute `weight` to a per-500-words score gated by
 *             `--max-score` (AI vocabulary, filler, hedging, sycophancy, …).
 *   Em/en dashes are a DENSITY rule (per-500-words cap, default 2 — CP1
 *   parity from design-antipatterns), never hard-zero: council 2026-07-11
 *   rejected the zero-dash rule; a captured voice fingerprint that
 *   legitimately uses dashes wins (suppression happens at the call site).
 *
 * Dependency-free by design (npx-shipped package) — pattern analysis only.
 */

export type TellSeverity = "hard" | "cluster";
export type TellGroup =
  | "content"
  | "language"
  | "style"
  | "communication"
  | "filler";
/** "any" = language-agnostic (typography / structure tells). */
export type TellLanguage = "en" | "de" | "any";

/**
 * A rule whose decision is not expressible as "this regex matched". Receives
 * the already-exempt-stripped scan text plus the resolved language, and returns
 * the same `{count, samples}` shape `countMatches` produces, so the caller does
 * not branch on rule kind beyond choosing the source.
 */
export interface RawOccurrence {
  /** Character offset into the scanned text. */
  index: number;
  text: string;
}

export interface MatchResult {
  count: number;
  samples: string[];
  occurrences: RawOccurrence[];
}

export type TellMatcher = (text: string, language: "en" | "de") => MatchResult;

/**
 * A pattern is USED CONSISTENTLY, not repeated by accident, when it occurs at
 * least this many times and spans at least `MIN_CONSISTENT_SPREAD` of the
 * document. Two occurrences in adjacent sentences is a repetition; four spread
 * from the opening to the close is a habit, and a habit is evidence of style.
 */
export const MIN_CONSISTENT_OCCURRENCES = 3;
export const MIN_CONSISTENT_SPREAD = 0.6;

export interface TellRule {
  id: string;
  group: TellGroup;
  severity: TellSeverity;
  language: TellLanguage;
  /** cluster weight per hit; ignored for hard rules */
  weight: number;
  description: string;
  patterns: RegExp[];
  /** When present, REPLACES `patterns` — a rule too context-dependent for one. */
  match?: TellMatcher;
}

/** Em/en-dash density cap per 500 words (CP1 parity). */
export const DEFAULT_MAX_DASH_DENSITY = 2;
/** Weighted cluster-score cap per 500 words. */
export const DEFAULT_MAX_CLUSTER_SCORE = 3;
/** Hard-hit cap. */
export const DEFAULT_MAX_HARD = 0;

const w = (
  id: string,
  group: TellGroup,
  severity: TellSeverity,
  language: TellLanguage,
  weight: number,
  description: string,
  patterns: RegExp[],
  match?: TellMatcher,
): TellRule => ({
  id, group, severity, language, weight, description, patterns,
  ...(match ? { match } : {}),
});

/**
 * Minimum word count below which a per-500-words density is not computed.
 *
 * `cluster_score_per_500` and `dash_density_per_500` are ratios extrapolated to
 * 500 words. Under a small denominator the extrapolation is the artifact: six
 * words carrying one em dash score 83.33 per 500 and fail a cap of 2, which
 * says nothing about the prose. Below this floor both densities are reported as
 * `null` and neither threshold is applied; hard rules are unaffected, because a
 * hard hit is a count and not a rate.
 *
 * 50 is the largest floor compatible with the bound the repair was specified
 * against — a 60-word text carrying three dashes must still be evaluated and
 * must still fail. It does NOT make the metric meaningful everywhere above it:
 * at a cap of 2 per 500 words no document under ~250 words can carry a single
 * dash and pass. That residual is measured and published in
 * `internal/bench/reports/prose-tells-fp-v1.md` rather than repaired here — the
 * cap itself is a council decision of 2026-07-11 and is not this floor's to move.
 */
export const MIN_DENSITY_WORDS = 50;

/** Morphology that marks a common noun as abstract, per language. */
const ABSTRACT_SUFFIX_EN =
  /(?:tions?|sions?|ities|ity|ness(?:es)?|ments?|ances?|ences?|isms?|ships?|hoods?|ancy|ency|ics|ures?|ologies|ology|th|ings?|acy)$/;
const ABSTRACT_SUFFIX_DE =
  /(?:ungen|ung|heiten|heit|keiten|keit|schaften|schaft|tionen|tion|itäten|ität|ismus|tum|nis|barkeit)$/;

/**
 * Common abstract nouns this repo authored by hand because they carry no
 * abstract morphology. Deliberately short: every entry is a word whose
 * abstractness a suffix test cannot see, never a convenience list of tells.
 * Authored here — no word list is imported from any external source.
 */
const ABSTRACT_STEMS_EN = new Set([
  "speed", "trust", "scale", "impact", "focus", "value", "risk", "craft",
  "reach", "vision", "care", "rigor", "rigour", "worth", "pace", "flair",
]);

/** A member is abstract when it is a common noun with abstract morphology. */
export function isAbstractNoun(word: string, language: "en" | "de"): boolean {
  if (/\d/.test(word)) return false;
  const lower = word.toLowerCase();
  if (language === "de") {
    // German commons are capitalised, so capitalisation cannot separate a name
    // from a noun; the morphology has to carry the whole decision.
    return ABSTRACT_SUFFIX_DE.test(lower);
  }
  // A capitalised member is a name (or sentence-initial), never counted.
  if (/^[A-Z]/.test(word)) return false;
  return ABSTRACT_SUFFIX_EN.test(lower) || ABSTRACT_STEMS_EN.has(lower);
}

/** A declarative short enough to read as a staccato beat. */
const STACCATO_MAX_WORDS = 5;
/** A run of this many consecutive staccato beats is the tell. */
const STACCATO_RUN = 4;
/** A run of this many identically-shaped bold-header bullets is the tell. */
const UNIFORM_BULLET_RUN = 4;

/**
 * `tell-staccato-run` — the `anti-aiisms.md` bound "≤ 3 short declaratives in a
 * row", implemented rather than merely claimed (step 1.4). Four or more
 * consecutive declaratives of at most five words each is the manufactured
 * punchline rhythm; three is ordinary emphasis and scores nothing.
 *
 * Questions and exclamations break a run: a short question is a rhetorical
 * device the catalog does not treat as a beat.
 */
export function matchStaccatoRun(text: string): MatchResult {
  const occurrences: RawOccurrence[] = [];
  let offset = 0;
  for (const para of text.split(/\n\s*\n/)) {
    const flat = para.replace(/\n/g, " ");
    let run: string[] = [];
    let runStart = 0;
    let cursor = 0;
    const flush = (): void => {
      if (run.length >= STACCATO_RUN) {
        occurrences.push({ index: offset + runStart, text: run.join(" ") });
      }
      run = [];
    };
    for (const raw of flat.split(/(?<=[.!?])\s+/)) {
      const at = flat.indexOf(raw, cursor);
      cursor = at + raw.length;
      const sentence = raw.trim();
      if (sentence === "") continue;
      const words = sentence.split(/\s+/).filter(Boolean).length;
      const isBeat = /\.$/.test(sentence) && words > 0 && words <= STACCATO_MAX_WORDS;
      if (isBeat) {
        if (run.length === 0) runStart = at;
        run.push(sentence);
      } else {
        flush();
      }
    }
    flush();
    offset += para.length + 2;
  }
  return {
    count: occurrences.length,
    samples: occurrences.slice(0, 3).map((o) => o.text.slice(0, 60).trim()),
    occurrences,
  };
}

/**
 * `tell-uniform-bullet-run` — the `anti-aiisms.md` bound "merge a run of ≥ 4
 * identically-shaped `- **X:** …` bullets", implemented rather than claimed
 * (step 1.4). Distinct from `tell-bold-header-list`, which fires on a SINGLE
 * such bullet: the bound is about a run, and a three-item definition list is
 * ordinary reference prose.
 */
export function matchUniformBulletRun(text: string): MatchResult {
  const occurrences: RawOccurrence[] = [];
  let run = 0;
  let first = "";
  let firstIndex = 0;
  let offset = 0;
  const flush = (): void => {
    if (run >= UNIFORM_BULLET_RUN) occurrences.push({ index: firstIndex, text: first });
    run = 0;
    first = "";
  };
  for (const line of text.split("\n")) {
    if (/^\s*[-*]\s+\*\*[^*\n]{2,60}:?\*\*:?/.test(line)) {
      if (run === 0) {
        first = line.trim();
        firstIndex = offset;
      }
      run += 1;
    } else if (line.trim() !== "") {
      // A blank line inside a list does not end the run — the shape survives it.
      flush();
    }
    offset += line.length + 1;
  }
  flush();
  return {
    count: occurrences.length,
    samples: occurrences.slice(0, 3).map((o) => o.text.slice(0, 60).trim()),
    occurrences,
  };
}

const TRIPLET_RE = /\b([\p{L}][\p{L}'’-]*), ([\p{L}][\p{L}'’-]*), (?:and|und) ([\p{L}][\p{L}'’-]*)\b/gu;

/**
 * `tell-rule-of-three`, disarmed (road-to-measured-prose-tells step 1.2).
 *
 * The shipped pattern matched every Oxford-comma triplet, so three ordinary
 * sentences of English scored 39.47 per 500 words and failed a cap of 3. The
 * rule stays and loses its solo effect over ordinary lists:
 *
 * - a triplet counts only when **all three members are abstract common nouns**
 *   — never names, never numbers, never a list of concrete things;
 * - when two or more such abstract triplets share a paragraph, every one of
 *   them counts, because the repeated rhetorical move inside one paragraph is
 *   the tell the rule was written for.
 *
 * A single concrete triplet, and any number of concrete triplets in one
 * paragraph, score zero. Recorded deviation: the step specified the
 * paragraph-cluster arm over "three-item lists" without qualification; applied
 * that way it would fire on the step's own worked example (three ordinary lists
 * in one paragraph, which its acceptance criterion requires to pass), so the
 * abstractness test qualifies both arms and the cluster arm escalates rather
 * than admits.
 */
export function matchRuleOfThree(text: string, language: "en" | "de"): MatchResult {
  const occurrences: RawOccurrence[] = [];
  let offset = 0;
  for (const para of text.split(/\n\s*\n/)) {
    const abstract: RawOccurrence[] = [];
    for (const m of para.matchAll(TRIPLET_RE)) {
      const members = [m[1] ?? "", m[2] ?? "", m[3] ?? ""];
      if (members.every((x) => isAbstractNoun(x, language))) {
        abstract.push({ index: offset + (m.index ?? 0), text: m[0] });
      }
    }
    occurrences.push(...abstract);
    // `+2` restores the blank line the split consumed; an offset off by two
    // characters would misreport a column, which is the whole point of these.
    offset += para.length + 2;
  }
  return {
    count: occurrences.length,
    samples: occurrences.slice(0, 3).map((o) => o.text.slice(0, 60).trim()),
    occurrences,
  };
}

export const TELL_RULES: TellRule[] = [
  // ── hard: communication artifacts pasted into a deliverable ──────────────
  w(
    "tell-chat-artifact",
    "communication",
    "hard",
    "en",
    0,
    "Chatbot correspondence pasted as content (I hope this helps / let me know / would you like…)",
    [
      /\bI hope this helps\b/i,
      /\blet me know if you('| wou)?l?d? like\b/i,
      /\bwould you like me to\b/i,
      /\bwant me to (give|continue|expand)\b/i,
      /\bshould I continue\b/i,
      /\bhere('s| is) (an? )?(overview|breakdown|summary) of\b/i,
    ],
  ),
  w(
    "tell-knowledge-cutoff",
    "communication",
    "hard",
    "en",
    0,
    "Knowledge-cutoff disclaimer or speculative gap-filling presented as fact",
    [
      /\bas of my (last|latest) (update|training)\b/i,
      /\bmy knowledge cutoff\b/i,
      /\bup to my last training update\b/i,
      /\bwhile specific details are (limited|scarce|not extensively documented)\b/i,
      /\bbased on (the )?available information\b/i,
      /\b(maintains a low profile|keeps personal details private)\b/i,
    ],
  ),
  w(
    "tell-emoji-heading",
    "style",
    "hard",
    "any",
    0,
    "Emoji-decorated heading or bold list header",
    [
      /^#{1,6}\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/mu,
      /^\s*[-*]?\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]\s*\*\*/mu,
    ],
  ),
  w(
    "tell-double-hyphen-aside",
    "style",
    "hard",
    "any",
    0,
    "Spaced double hyphen used as an em-dash substitute",
    [/\s--\s/],
  ),

  // ── cluster: post-2023 AI vocabulary & copula avoidance ──────────────────
  w(
    "tell-ai-vocabulary",
    "language",
    "cluster",
    "en",
    1,
    "Overused post-2023 AI vocabulary (delve, tapestry, showcase, pivotal, …)",
    [
      /\bdelve(s|d)?\b/i,
      /\btapestry\b/i,
      /\bshowcas(e|es|ing)\b/i,
      /\btestament to\b/i,
      /\bpivotal\b/i,
      /\bcrucial role\b/i,
      /\bvibrant\b/i,
      /\bintricate\b/i,
      /\binterplay\b/i,
      /\bfostering\b/i,
      /\bgarner(ed|s)?\b/i,
      /\bever-evolving\b/i,
      /\bevolving landscape\b/i,
      /\b(digital|competitive|cultural) landscape\b/i,
      /\bnestled\b/i,
      /\bboasts?\b/i,
      /\bunderscore(s|d)?\b/i,
      /\bgroundbreaking\b/i,
      /\bseamless(ly)?\b/i,
      /\belevate(s|d)? your\b/i,
    ],
  ),
  w(
    "tell-copula-avoidance",
    "language",
    "cluster",
    "en",
    1,
    "Elaborate constructions replacing a simple 'is' (serves as / stands as / represents a)",
    [
      /\bserves as an?\b/i,
      /\bstands as an?\b/i,
      /\bmarks an? (pivotal|significant|key|major)\b/i,
      /\brepresents an? (shift|milestone|step)\b/i,
    ],
  ),
  w(
    "tell-significance-inflation",
    "content",
    "cluster",
    "en",
    1,
    "Inflated significance / legacy framing (pivotal moment, broader trends, setting the stage)",
    [
      /\bpivotal moment\b/i,
      /\bbroader (trend|movement|shift)s?\b/i,
      /\bsetting the stage for\b/i,
      /\bindelible mark\b/i,
      /\bkey turning point\b/i,
      /\bdeeply rooted\b/i,
      /\benduring (legacy|spirit|impact)\b/i,
      /\bplays? a (crucial|vital|key|pivotal) role\b/i,
      /\bunderscores? (its|the) (importance|significance)\b/i,
    ],
  ),
  w(
    "tell-negative-parallelism",
    "language",
    "cluster",
    "en",
    1,
    "Not just X — it's Y constructions and tailing negations",
    [
      /\b(is|it'?s) not (just|only|merely) about\b/i,
      /\bnot (just|only|merely) an?\b[^.!?\n]{3,80}\b(but|it'?s)\b/i,
      /\bisn'?t (just|only|merely)\b/i,
      /,\s*no (guessing|fluff|wasted \w+)[.!]?$/im,
    ],
  ),
  w(
    "tell-false-range",
    "language",
    "cluster",
    "en",
    0.5,
    "'From X to Y' constructions where X and Y are not on a scale",
    [/\bfrom [^,.\n]{3,45} to [^,.\n]{3,45},\s*(?:and\s+)?from\b/i],
  ),
  w(
    "tell-rule-of-three",
    "language",
    "cluster",
    "any",
    0.5,
    "Forced abstract triplets (innovation, inspiration, and collaboration) — " +
      "ordinary lists of names, numbers or concrete things do not count",
    [],
    matchRuleOfThree,
  ),

  // ── cluster: filler, hedging, endings, openers ───────────────────────────
  w(
    "tell-filler-phrase",
    "filler",
    "cluster",
    "en",
    1,
    "Filler phrases (in order to, due to the fact that, it is important to note)",
    [
      /\bin order to\b/i,
      /\bdue to the fact that\b/i,
      /\bat this point in time\b/i,
      /\bin the event that\b/i,
      /\bhas the ability to\b/i,
      /\bit('s| is) (important|worth) (to note|noting) that\b/i,
    ],
  ),
  w(
    "tell-hedging-stack",
    "filler",
    "cluster",
    "en",
    1,
    "Stacked hedges (could potentially, might possibly)",
    [
      /\bcould potentially\b/i,
      /\bmight possibly\b/i,
      /\bit could be argued that\b/i,
      /\bperhaps one of the most\b/i,
    ],
  ),
  w(
    "tell-generic-conclusion",
    "filler",
    "cluster",
    "en",
    1,
    "Generic upbeat endings (the future looks bright, exciting times ahead)",
    [
      /\bthe future (looks|is) bright\b/i,
      /\bexciting times (lie )?ahead\b/i,
      /\bstep in the right direction\b/i,
      /\bjourney (toward|towards)\b/i,
      /\bcontinues? to thrive\b/i,
      /\bpromises? memories\b/i,
    ],
  ),
  w(
    "tell-signposting",
    "filler",
    "cluster",
    "en",
    1,
    "Announcement-style signposting (let's dive in, here's what you need to know)",
    [
      /\blet'?s dive (in|into)\b/i,
      /\blet'?s explore\b/i,
      /\blet'?s break (this|it) down\b/i,
      /\bwithout further ado\b/i,
      /\bhere'?s what you need to know\b/i,
    ],
  ),
  w(
    "tell-authority-trope",
    "filler",
    "cluster",
    "en",
    1,
    "Persuasive authority tropes (the real question is, at its core)",
    [
      /\bthe real question is\b/i,
      /\bat its core\b/i,
      /\bwhat really matters is\b/i,
      /\bthe heart of the matter\b/i,
      /\bthe deeper issue\b/i,
    ],
  ),
  w(
    "tell-sycophancy",
    "communication",
    "cluster",
    "en",
    1,
    "Sycophantic openers (great question, you're absolutely right)",
    [
      /\bgreat question\b/i,
      /\byou'?re absolutely right\b/i,
      /\b(that'?s an? )?excellent point\b/i,
    ],
  ),
  w(
    "tell-vague-attribution",
    "content",
    "cluster",
    "en",
    1,
    "Weasel-word attributions (experts argue, observers have cited, industry reports)",
    [
      /\bexperts (argue|believe|suggest|agree)\b/i,
      /\bobservers have (cited|noted)\b/i,
      /\bindustry reports\b/i,
      /\bsome critics argue\b/i,
      /\bwidely (regarded|considered) as\b/i,
    ],
  ),
  w(
    "tell-aphorism-formula",
    "filler",
    "cluster",
    "en",
    1,
    "Aphorism formulas (X is the language/currency/architecture of Z, X becomes a trap)",
    [
      /\bis the (language|currency|architecture|lifeblood) of\b/i,
      /\bbecomes a trap\b/i,
      /\bis not a tool but a mirror\b/i,
    ],
  ),

  // ── cluster: typography / structure (language-agnostic) ──────────────────
  // ── cluster: the 2.2 recall families, one epoch each ─────────────────────
  //
  // Every pattern below is AUTHORED HERE. The external analysis that exposed
  // these gaps is a corpus, never a rule list: importing its word lists would
  // carry a licence obligation and a plaintext source pin into a tracked file.
  // Each family was promoted only at a zero clean-corpus false-positive count —
  // ledger: internal/bench/corpora/prose-tells-epochs.md.
  w(
    "tell-throat-clearing",
    "filler",
    "cluster",
    "en",
    1,
    "Openers that announce before they say anything (in today's fast-paced …, here's the thing)",
    [
      /\bin (?:today'?s|this) (?:fast-paced|fast paced|digital|modern|ever-changing|rapidly changing) [\w-]+\b/i,
      /\bin an era (?:of|where|when)\b/i,
      /\blet'?s be (?:honest|clear|real)\b/i,
      /^\s*(?:Honestly[,?]|Look,|Here'?s the thing[,.:])/im,
      /\bbefore we (?:dive|get|jump) into\b/i,
    ],
  ),
  w(
    "tell-emphasis-crutch",
    "style",
    "cluster",
    "en",
    1,
    "Intensifier stacks standing in for a reason (cannot be overstated, truly remarkable)",
    [
      /\b(?:truly|really|absolutely|incredibly|extremely) (?:remarkable|powerful|essential|critical|important|unique|transformative)\b/i,
      /\bcannot be overstated\b/i,
      /\bgame[- ]chang(?:er|ing)\b/i,
      /\bnothing short of\b/i,
      /\bmore important than ever\b/i,
    ],
  ),
  w(
    "tell-false-agency",
    "content",
    "cluster",
    "en",
    1,
    "Abstractions given volition (the data tells a story, technology is reshaping how we …)",
    [
      /\bthe data (?:tells|tell) (?:a|the) story\b/i,
      /\b(?:the )?numbers (?:speak for themselves|don'?t lie)\b/i,
      /\b(?:technology|innovation|AI|the market|this shift) (?:is )?(?:reshaping|redefining|transforming) (?:how|the way)\b/i,
      /\bthis (?:approach|framework|mindset|moment) (?:invites|asks|challenges) us to\b/i,
    ],
  ),
  w(
    "tell-narrator-distance",
    "language",
    "cluster",
    "en",
    1,
    "An impersonal narrator hedging at a distance (one might argue, for many teams …)",
    [
      /\bone might (?:argue|say|wonder|ask|note)\b/i,
      /\bit(?:'s| is) worth (?:asking|considering|remembering) (?:whether|that|how|why)\b/i,
      /\bfor many (?:teams|organizations|organisations|companies|people|leaders),/i,
      /\bthere is something (?:to be said for|deeply)\b/i,
    ],
  ),
  w(
    "tell-vague-declarative",
    "content",
    "cluster",
    "en",
    1,
    "A declaration that names nothing (one thing is clear, it all comes down to)",
    [
      /\b(?:one|two|a few) things? (?:is|are) clear\b/i,
      /\bthe answer (?:is|isn'?t) simple\b/i,
      /\bit all comes down to\b/i,
      /\bthat'?s the (?:whole|real) point\b/i,
    ],
  ),
  w(
    "tell-binary-contrast",
    "language",
    "cluster",
    "en",
    1,
    "Binary inversions beyond 'not just' (less about X than about Y, it's not that X — it's that Y)",
    [
      /\bless about\b[^.!?\n]{1,60}\bthan about\b/i,
      /\bthis (?:is|isn'?t) about\b[^.!?\n]{1,60}\bit'?s about\b/i,
      /\bnot (?:a|an) [\w-]+ (?:problem|question|issue)[,.]?\s+(?:but|it'?s)\b/i,
      /\b(?:it'?s )?not (?:that|so much)\b[^.!?\n]{1,60}\bit'?s that\b/i,
    ],
  ),

  w(
    "tell-curly-quotes",
    "style",
    "cluster",
    "any",
    0.25,
    "Curly quotation marks (only meaningful in clusters — editors auto-curl)",
    [/[“”‘’]/],
  ),
  w(
    "tell-bold-header-list",
    "style",
    "cluster",
    "any",
    1,
    "Vertical list items opening with a bolded header + colon",
    [/^\s*[-*]\s+\*\*[^*\n]{2,60}:?\*\*:?\s/m],
  ),
  w(
    "tell-staccato-run",
    "style",
    "cluster",
    "any",
    1,
    "Four or more consecutive declaratives of five words or fewer (manufactured punchline rhythm)",
    [],
    matchStaccatoRun,
  ),
  w(
    "tell-uniform-bullet-run",
    "style",
    "cluster",
    "any",
    1,
    "A run of four or more identically-shaped bold-header bullets",
    [],
    matchUniformBulletRun,
  ),
  w(
    "tell-title-case-heading",
    "style",
    "cluster",
    "en",
    0.5,
    "Title-Case Headings With Every Word Capitalized",
    [/^#{2,6}\s+(?:[A-Z][a-z]+\s+){3,}[A-Z][a-z]+\s*$/m],
  ),
];

// ── German subset (language: de) — added under the de-subset-demand gate ────
export const TELL_RULES_DE: TellRule[] = [
  w(
    "tell-de-filler",
    "filler",
    "cluster",
    "de",
    1,
    "Deutsche Füllphrasen (es ist wichtig zu beachten, im heutigen digitalen Zeitalter)",
    [
      /\bes ist wichtig(,)? zu (beachten|betonen|erwähnen)\b/i,
      /\bim heutigen digitalen Zeitalter\b/i,
      /\bin der heutigen schnelllebigen (Welt|Zeit)\b/i,
      /\bes sei darauf hingewiesen\b/i,
    ],
  ),
  w(
    "tell-de-connector-stack",
    "language",
    "cluster",
    "de",
    1,
    "Konnektoren-Stapel (zudem, darüber hinaus, des Weiteren)",
    [
      /\bzudem\b/i,
      /\bdar(ü|ue)ber hinaus\b/i,
      /\bdes Weiteren\b/i,
      /\bnicht zuletzt\b/i,
    ],
  ),
  w(
    "tell-de-significance",
    "content",
    "cluster",
    "de",
    1,
    "Bedeutungs-Inflation (spielt eine entscheidende Rolle, markiert einen Wendepunkt)",
    [
      /\bspielt eine (entscheidende|zentrale|wichtige|Schl(ü|ue)ssel)rolle\b/i,
      /\bmarkiert einen (Wendepunkt|Meilenstein)\b/i,
      /\bunterstreicht die Bedeutung\b/i,
      /\bein Meilenstein (in|f(ü|ue)r)\b/i,
      /\bnahtlos(e|es|er)?\b/i,
    ],
  ),
  w(
    "tell-de-negative-parallelism",
    "language",
    "cluster",
    "de",
    1,
    "Nicht nur X, sondern Y — und die Form 'es geht nicht um X, sondern um Y'",
    [
      /\bnicht nur\b[^.!?\n]{3,80}\bsondern( auch)?\b/i,
      /\bnicht um\b[^.!?\n]{3,80}\bsondern( um)?\b/i,
    ],
  ),

  // ── the 2.2 families, German half (step 2.3) — authored, not translated ───
  w(
    "tell-de-throat-clearing",
    "filler",
    "cluster",
    "de",
    1,
    "Räuspern vor dem ersten Satz (ehrlich gesagt, mal ehrlich, eins vorweg)",
    [
      /\behrlich gesagt\b/i,
      /\bmal ehrlich\b/i,
      /\beins vorweg\b/i,
      /\bbevor wir (?:eintauchen|loslegen|einsteigen)\b/i,
    ],
  ),
  w(
    "tell-de-signposting",
    "filler",
    "cluster",
    "de",
    1,
    "Ankündigungen statt Aussagen (lass uns eintauchen, das musst du wissen)",
    [
      /\blass(?:t)? uns eintauchen\b/i,
      /\btauchen wir ein\b/i,
      /\bohne (?:lange )?Vorrede\b/i,
      /\bdas musst du wissen\b/i,
    ],
  ),
  w(
    "tell-de-vague-declarative",
    "content",
    "cluster",
    "de",
    1,
    "Feststellungen, die nichts benennen (eines ist klar, letztlich geht es darum)",
    [
      /\beines ist klar\b/i,
      /\bdie Wahrheit ist\b/i,
      /\bletztlich geht es (?:darum|um)\b/i,
      /\bam Ende des Tages\b/i,
    ],
  ),
  w(
    "tell-de-generic-conclusion",
    "filler",
    "cluster",
    "de",
    1,
    "Aufgesetzt positive Schlüsse (die Zukunft sieht rosig aus, spannende Zeiten)",
    [
      /\bdie Zukunft sieht rosig aus\b/i,
      /\bspannende Zeiten\b/i,
      /\bein Schritt in die richtige Richtung\b/i,
      /\bdie Reise geht weiter\b/i,
    ],
  ),
  w(
    "tell-de-emphasis-crutch",
    "style",
    "cluster",
    "de",
    1,
    "Verstärker statt Begründung (nicht hoch genug einschätzen, absolut entscheidend)",
    [
      /\bnicht hoch genug (?:einschätzen|einzuschätzen)\b/i,
      /\b(?:absolut|wirklich|wahrhaft) (?:entscheidend|beeindruckend|einzigartig|unverzichtbar)\b/i,
      /\bwichtiger denn je\b/i,
    ],
  ),
  w(
    "tell-de-false-agency",
    "content",
    "cluster",
    "de",
    1,
    "Abstrakta mit Willen (die Zahlen sprechen für sich, die Daten erzählen)",
    [
      /\bdie Zahlen sprechen für sich\b/i,
      /\bdie Daten erzählen\b/i,
      /\b(?:Technologie|Innovation|KI|der Markt) (?:verändert|prägt|definiert) (?:die Art|neu)\b/i,
    ],
  ),
  w(
    "tell-de-narrator-distance",
    "language",
    "cluster",
    "de",
    1,
    "Unpersönlicher Erzähler auf Distanz (man könnte argumentieren, für viele Unternehmen)",
    [
      /\bman (?:könnte|kann) (?:argumentieren|sagen|fragen)\b/i,
      /\bes lohnt sich zu fragen\b/i,
      /\bfür viele (?:Unternehmen|Teams|Menschen),/i,
    ],
  ),
];

/** Every registry rule, both languages. */
export const ALL_TELL_RULES: TellRule[] = [...TELL_RULES, ...TELL_RULES_DE];

/** Crude language sniff for `--language auto`: DE stopword density. */
export function sniffLanguage(text: string): "en" | "de" {
  const deHits =
    text.match(/\b(und|nicht|eine?|der|die|das|mit|für|ist|wird|auch)\b/gi)
      ?.length ?? 0;
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  return deHits / words > 0.04 ? "de" : "en";
}
