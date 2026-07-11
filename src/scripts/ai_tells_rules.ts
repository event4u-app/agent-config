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

export interface TellRule {
  id: string;
  group: TellGroup;
  severity: TellSeverity;
  language: TellLanguage;
  /** cluster weight per hit; ignored for hard rules */
  weight: number;
  description: string;
  patterns: RegExp[];
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
): TellRule => ({ id, group, severity, language, weight, description, patterns });

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
    "Forced triplet groupings (innovation, inspiration, and insights)",
    [/\b\w+(?:ity|ion|ness|ing|s)?, \w+(?:ity|ion|ness|ing|s)?, and \w+/],
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
    "Nicht nur X, sondern Y",
    [/\bnicht nur\b[^.!?\n]{3,80}\bsondern( auch)?\b/i],
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
