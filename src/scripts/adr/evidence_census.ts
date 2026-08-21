#!/usr/bin/env tsx
/**
 * ADR evidence census — a PROPOSAL-ONLY pre-grader for `provenance` + `evidence`.
 *
 * It reads every ADR record, greps for evidence markers, and emits a *proposed*
 * `provenance.kind` and `evidence.strength` per record with the matched
 * `file:line` for each marker. That is the whole output. It writes no ADR
 * frontmatter, and it is not a gate.
 *
 * ## Why proposal-only, and why that constraint is the point
 *
 * `adr-layout § Provenance and evidence` closes with "a census may **propose** a
 * value; it never writes one", and the `No bulk classification` clause exists
 * because an agent grading its own homework unreviewed is the failure mode the
 * corpus already paid for once: 44 engine-shaped REJECT records accumulated
 * under a council-carried interpretation, and only a measurement disposed of
 * the feature (`engine-reclassification-2026-07.md`;
 * `claims:code-graph-retrieval-null`, recall 0.365 vs disciplined grep 0.797).
 * A tool that both assigns a grade and lands it in the tree reproduces that
 * failure with better metadata. So the output is one review artifact plus
 * stdout, and a human moves any of it into a record.
 *
 * ## Two absolute rules, taken straight from the contract
 *
 * 1. **A council marker alone never raises the grade above E0.** Council
 *    consensus is not evidence — it is correlated agreement. Implemented
 *    structurally rather than as a special case: the grade is computed from the
 *    NON-council marker set only, so no amount of council signal can move it.
 * 2. **Defaults are conservative.** `provenance: unknown`, `strength: E0`,
 *    `discovery: incomplete`.
 *
 * ## `discovery` is ALWAYS `incomplete`, by construction
 *
 * The contract permits `complete` only "until a defined evidence search has run
 * and found nothing". This script runs a marker grep over the record's own text.
 * That is not a defined exhaustive search of the tree, the claims ledger, the
 * benchmark corpus, or the external sources a record might have cited
 * elsewhere — so the honest value is `incomplete` for every record, at every
 * grade, and this script has no code path that emits `complete`. If a future
 * version wants `complete`, it must first state in code what exhaustive search
 * justified it.
 *
 * ## `E4` is never proposed
 *
 * E4 is an external constraint — protocol compatibility with real consumers, a
 * legal obligation, a demonstrated security invariant. None of those are
 * decidable from marker presence: whether a consumer actually exists is a fact
 * about the world, not about the text. The ceiling here is E3.
 *
 * ## The grades are heuristic — biased LOW, EXCEPT for two classes biased HIGH
 *
 * A marker is a proxy for a citation, not the citation. For most classes the
 * bias direction was chosen deliberately downward: nothing acts on these numbers
 * (no authority is derived from a grade — `adr-layout`, and the roadmap's
 * Architecture table), so an under-graded proposal costs a reviewer one upgrade,
 * while an over-graded one would put unearned "this is measured" text into the
 * tree. `measurement` needs a figure or a dated verb; `repeated` needs something
 * measured to compare; `prereg` needs a benchmark corpus beside it; `owner` and
 * `council` raise nothing at all.
 *
 * **Two classes are biased HIGH by construction, and the sentence above is false
 * for them.** `claim` and `external_standard` short-circuit to `E3` — the
 * second-highest grade in the scale, and the highest this script proposes at
 * all — on a bare textual match, ahead of every other rule and with no
 * companion marker required. Both are the FIRST and THIRD branches of
 * `proposeStrength`, so they pre-empt the measurement
 * rules rather than competing with them. `EXTERNAL_STANDARD_RE` in particular
 * matches a plain word-bounded `GDPR`, so naming a regulation as the SUBJECT of
 * a decision reads identically to citing it as the evidence FOR one.
 *
 * Worked example, checkable against the corpus: `ADR-107` line 35 writes
 * "EU DPA / GDPR Art. 28" to scope which legal domain its eval fixtures cover.
 * The census proposes `E3 — cites a named external standard or vendor guidance`;
 * the tranche reviewer reading the same line adjudicated `E2`. The grading rules
 * are deliberately UNCHANGED — this paragraph exists so the artifact's own
 * description of its bias is not contradicted by two of its own rules, and so a
 * reviewer knows to check an `E3` sourced from `claim` or `external_standard`
 * DOWNWARD rather than upward. Every proposal carries its matched lines so a
 * reviewer checks the claim rather than the grade.
 *
 * Usage:
 *   ./scripts-run src/scripts/adr/evidence_census                 # write the artifact
 *   ./scripts-run src/scripts/adr/evidence_census --json          # machine output
 *   ./scripts-run src/scripts/adr/evidence_census --check         # scan-completeness only
 *   ./scripts-run src/scripts/adr/evidence_census --out <path>
 *
 * Exit codes: 0 ok · 1 the scan could not complete (an unreadable record, or an
 * empty corpus) · 2 usage error. Never non-zero on a grade — a report is not a
 * gate.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from '../_lib/gate_ledger.js';
import { assertScanned, DeadScopeError } from '../_lib/scan_scope.js';
import {
    type AdrFrontmatter,
    evidenceOf,
    provenanceOf,
    readAdrFrontmatter,
} from '../_lib/adr_frontmatter.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');
const FLAT_DIR = path.join('docs', 'decisions');
const AREA_DIR = path.join('docs', 'adrs');

export const DEFAULT_OUT = path.join(
    'agents',
    'evidence',
    'analysis',
    'adr-evidence-census-2026-08.md',
);

// ---------------------------------------------------------------------------
// Marker taxonomy
// ---------------------------------------------------------------------------

/**
 * The marker classes. `council` is listed with the others and then excluded
 * from grading — keeping it in the taxonomy is what makes "this record's only
 * support is agreement" a *reportable* state rather than an absence.
 */
export type MarkerClass =
    | 'claim'
    | 'benchmark'
    | 'prereg'
    | 'measurement'
    | 'repeated'
    | 'external_standard'
    | 'external_citation'
    | 'council'
    | 'owner';

/** Council markers carry provenance signal and never contribute to the grade. */
const COUNCIL_CLASSES: ReadonlySet<MarkerClass> = new Set<MarkerClass>(['council']);

export interface Marker {
    cls: MarkerClass;
    /** 1-based line number in the record. */
    line: number;
    /** The matched text, trimmed — evidence for the proposal. */
    excerpt: string;
}

/** A `docs/CLAIMS.md` reference or a `claim:`/`claims:` id. */
const CLAIM_RE = /docs\/CLAIMS\.md(?:#[a-z0-9-]+)?|\bclaims?:\s?[a-z][a-z0-9-]{3,}/i;

/** A benchmark corpus or report path. */
const BENCHMARK_RE = /docs\/benchmark\.md|\binternal\/(?:bench|reports)\/[\w./-]*|\bPREREG[\w.-]*/;

/** Pre-registration language — the discipline, not the artifact. */
const PREREG_RE = /\bpre-?regist(?:er|ered|ration)\b|\bpre-?registered\b/i;

/**
 * A named external standard. Deliberately separate from a bare URL: the
 * contract's E3 row names "established community standard" and "applicable
 * vendor guidance", and a link is not by itself either of those.
 */
const EXTERNAL_STANDARD_RE =
    /\bPSR-\d+\b|\bRFC\s?\d{3,4}\b|\bWCAG\b|\bISO[\s-]?\d{4,5}\b|\bOWASP\b|\bPHP-FIG\b|\bMADR\b|\bSemVer\b|\bDTCG\b|\bC2PA\b|\bGDPR\b|\bconforms to the [\w -]*standard\b/;

/** A bare external citation — real, weaker than a named standard. */
const EXTERNAL_CITATION_RE = /https?:\/\/\S+/;

/**
 * Council / multi-model agreement, including bare model ids.
 *
 * The model-id patterns are family-scoped, not prefix-scoped. A bare
 * `claude-[\w.-]+` matched `claude-code`, `.claude-plugin/marketplace.json`,
 * `claude-desktop.md` and `claude-code-rules-dir-contract.md` — host names and
 * file paths, none of which is a model that decided anything. Measured: it put
 * 8 records into `agentic`/`mixed` on a filename.
 */
const COUNCIL_RE =
    /\bAI council\b|\bcouncil (?:pass|passes|session|verdict|ruling|seat|seats|convergen\w*)\b|\bboth seats\b|\btwo-seat\b|\bconvergen\w+\b|\b(?:anthropic|openai|google)\/[\w.-]+|\bclaude-(?:sonnet|opus|haiku|fable|instant|\d)[\w.-]*|\bgpt-[\do][\w.-]*/i;

/**
 * An owner / maintainer / operator decision. Matched on a DECLARATION, never on
 * the bare noun: the contract names "the word 'maintainer' appears in
 * Consequences" as the false positive to avoid, so `maintainer` alone is not a
 * marker and Consequences sections are excluded from this class entirely (see
 * `sectionOf`).
 */
const OWNER_RE =
    /\b(?:owner|maintainer|maintainer's|operator|operator's)\s+(?:decision|directive|instruction|ruling|requirement|intent|call|choice)\b|\bOwner decision\b|\bthe (?:owner|maintainer|operator) (?:decided|ruled|directed|instructed|requires|required)\b|\bowner-reserved ruling\b|\bauthority_basis:\s*owner_intent\b/i;

/**
 * Repeated / comparative language. On its own this proves nothing, so E2
 * additionally requires a measurement, benchmark, or claim marker — which is
 * what the contract's E2 row actually says ("reproducible comparison, multiple
 * independent incidents, bounded A/B"): the comparison has to be OF something.
 *
 * `sweep` is QUALIFIED rather than bare, and the qualifier is the whole point.
 * In this tree the word covers two unrelated things: a parameter sweep (`docs/
 * benchmark.md § Cost-factor sweep` — multiple measured points, genuinely
 * comparative) and a corpus pass (`ADR-214`'s "package-wide consistency sweep",
 * `ADR-216`'s `adoption-anchor sweep`), which compares nothing. Measured: a bare
 * `\bsweep\b` put 7 records into E2 on a naming coincidence.
 */
const REPEATED_RE =
    /\bmeasured (?:twice|three times|four times|\d+ times)\b|\bre-?measured\b|\breproducib\w+\b|\btwo independent\b|\bmultiple independent\b|\bA\/B\b|\bboth arms\b|\bacross (?:two|three|four|\d+) (?:runs|sessions|incidents|hosts|repos|repositories)\b|\bcomparative\b|\b(?:parameter|cost-factor|factor|benchmark|measurement|token|threshold|band)[\s-]sweep\b/i;

/**
 * A digit that opens a QUANTITY rather than sitting inside an identifier.
 *
 * `\b` before `\d` matches inside one, so `Tier-3 host`, `P3.2 ADR` and
 * `ADR-098` all read as figures ("3 host", "2 ADR"). Measured on the corpus:
 * that shape put `ADR-001` and `ADR-071` at E1 on a tier label and a table cell.
 */
const NOT_IDENTIFIER = String.raw`(?<![\w.-])`;

/**
 * A percentage or a percentage-point figure.
 *
 * The `\b` sits INSIDE the alternation, on `pp` only, and that placement is the
 * whole pattern. A trailing `\b` after `(?:%|pp)` made this regex dead code: `%`
 * is a non-word character, so a boundary after it requires the NEXT character to
 * be a word character — and a percentage is followed by a space, a `)`, or a
 * `*` essentially always. `10 %`, `(179.1 %)` and `3.1 % of its allowance` all
 * failed, which is why the corpus's percentage tables were being detected (when
 * they were detected at all) through the unit and ratio patterns instead. `pp`
 * keeps its boundary because `pp` is word characters and `450 ppm` is not a
 * percentage-point figure.
 */
const PERCENT_RE = new RegExp(`${NOT_IDENTIFIER}\\d+(?:\\.\\d+)?\\s?(?:%|pp\\b)`);

/** A ratio or multiplier: `11.7x`, `0.365 vs 0.797`, `4 of 12`. */
const RATIO_RE = new RegExp(
    [
        `${NOT_IDENTIFIER}\\d+(?:\\.\\d+)?\\s?x\\b`,
        `${NOT_IDENTIFIER}\\d+(?:\\.\\d+)?\\s+vs\\.?\\s+\\d+(?:\\.\\d+)?\\b`,
        `${NOT_IDENTIFIER}\\d+\\s+of\\s+\\d+\\b`,
    ].join('|'),
);

/**
 * A figure with a counted unit. The unit list is closed on purpose: an open
 * `\d+\s+\w+` matched version strings (`6.0.0-D`), section numbers, and dates,
 * so every one of those became a "measurement".
 */
const UNIT_RE = new RegExp(
    `${NOT_IDENTIFIER}(?:~|\u2248|>|<|\u2265|\u2264)?\\s?\\d[\\d,]*\\s+` +
        '(?:commands?|rules?|skills?|ADRs?|records?|files?|lines?|chars?|characters?|tokens?|' +
        'sessions?|runs?|entries|hosts?|seats?|jobs?|gates?|checks?|PRs?|consumers?|projects?|' +
        'packages?|incidents?|minutes?|seconds?|hours?|days?|ms|MB|KB|GB|occurrences?|' +
        'violations?|findings?)\\b',
    'i',
);

/**
 * A measurement VERB, for a line that reports an observation without printing a
 * figure. Needs a dated / PR'd / sha'd anchor nearby to count.
 *
 * Two exclusions, both from corpus false positives. `\b` before `measur` makes
 * `unmeasured` a non-match — "the redundancy assumption is unmeasured"
 * (`ADR-106:38`) is the ABSENCE of a measurement, and must never grade as one.
 * `(?!-)` after the verb makes `measure-then-decide` and `measure-first` a
 * non-match: those name a GATE that has not run yet, which is the same absence
 * wearing a different suffix (`ADR-100:15`).
 */
const MEASURE_VERB_RE =
    /\bmeasur(?:e|ed|es|ing|ement|ements)\b(?!-)|\bbenchmarked\b|\brecall\b|\bprecision\b|\blatency\b|\bthroughput\b|\bobserved\b|\bcounted\b/i;

/**
 * The co-location anchors that date a bare measurement VERB: an ISO date, a PR
 * number, or a commit sha / run id.
 */
const ANCHOR_RE = /\b\d{4}-\d{2}-\d{2}\b|\bPR\s?#?\d{3,5}\b|#\d{3,5}\b|\b[0-9a-f]{9,40}\b/;

/**
 * How many lines either side of a measurement verb may carry the date / PR /
 * sha anchor.
 *
 * Two, not zero: real records put the provenance on the sentence's first line
 * and the reference on its second (`ADR-229:52-53` — "**measured twice** on
 * this repository (PR" then "#1277/#1280 and #1280/#1281"). A same-line
 * requirement read that as undated.
 */
export const ANCHOR_WINDOW = 2;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Which `## Heading` a line sits under, lower-cased. Used only to exclude
 * Consequences from the owner class — the contract's named false positive.
 */
export function sectionOf(lines: readonly string[], index: number): string {
    for (let i = index; i >= 0; i -= 1) {
        const line = lines[i];
        if (line === undefined) continue;
        const m = /^#{2,3}\s+(.*)$/.exec(line);
        if (m?.[1] !== undefined) return m[1].trim().toLowerCase();
    }
    return '';
}

function anchoredNear(lines: readonly string[], index: number): boolean {
    const from = Math.max(0, index - ANCHOR_WINDOW);
    const to = Math.min(lines.length - 1, index + ANCHOR_WINDOW);
    for (let i = from; i <= to; i += 1) {
        const line = lines[i];
        if (line !== undefined && ANCHOR_RE.test(line)) return true;
    }
    return false;
}

function excerpt(line: string): string {
    const t = line.trim();
    return t.length <= 120 ? t : `${t.slice(0, 117)}\u2026`;
}

/**
 * The 0-based index of the line AFTER the closing `---`, or 0 when there is no
 * frontmatter.
 *
 * Measurement detection starts here rather than at line 0, and that boundary
 * fixed a false positive class: `decision: recursive-verification-benchmark-gate`
 * (`ADR-106:5`) matched the benchmark verb, and the `date:` two lines above it
 * supplied the anchor, so a SLUG graded as a dated measurement. A slug names the
 * decision; it reports nothing. Every other marker class still scans the whole
 * file, because a `basis:` list citing `docs/CLAIMS.md` and an
 * `authority_basis: owner_intent` line are both real signal and both live in
 * frontmatter.
 */
export function bodyStart(lines: readonly string[]): number {
    if (lines[0] !== '---') return 0;
    for (let i = 1; i < lines.length; i += 1) {
        if (lines[i] === '---') return i + 1;
    }
    return 0;
}

/** Every evidence marker in one record, with its 1-based line number. */
export function detectMarkers(text: string): Marker[] {
    const lines = text.split('\n');
    const body = bodyStart(lines);
    const out: Marker[] = [];

    lines.forEach((line, index) => {
        const push = (cls: MarkerClass): void => {
            out.push({ cls, line: index + 1, excerpt: excerpt(line) });
        };

        // Whole-file classes CITE a source or DECLARE an authority, and both
        // legitimately appear in frontmatter — a `basis:` list pointing at
        // `docs/CLAIMS.md`, an `authority_basis: owner_intent` line.
        if (CLAIM_RE.test(line)) push('claim');
        if (BENCHMARK_RE.test(line)) push('benchmark');
        if (PREREG_RE.test(line)) push('prereg');
        if (EXTERNAL_STANDARD_RE.test(line)) push('external_standard');
        if (EXTERNAL_CITATION_RE.test(line)) push('external_citation');
        if (OWNER_RE.test(line) && !sectionOf(lines, index).startsWith('consequence')) {
            push('owner');
        }

        // Body-only classes DESCRIBE how the work was done, and a slug or a
        // `phase:` name is a label rather than a description. Measured:
        // `ADR-216`'s `phase: … adoption-anchor sweep` (`:8`) matched the
        // repeated/comparative class from frontmatter alone, which would have
        // priced a naming coincidence as a comparison.
        if (index < body) return;
        if (COUNCIL_RE.test(line)) push('council');
        if (REPEATED_RE.test(line)) push('repeated');

        // A FIGURE — a percentage, a ratio, or a closed-list counted unit — is a
        // quantified observation on its own. It does NOT need a date beside it:
        // the record's own `date:` dates it, and requiring a second, adjacent
        // date deleted real measurements rather than filtering noise. Measured
        // on the corpus: `ADR-227` prints exact-BPE token counts against a
        // 106,704 baseline (`:37`), a `179.1 %` figure (`:40`), `25 of 116`
        // (`:66`) and a three-row percentage table (`:107-109`) — and every one
        // of them was dropped, because that record's only dates are its
        // frontmatter and its Status line. It graded E0. The literal
        // co-location rule was the defect, so it now binds only the verb case
        // below, where there is no figure to quantify anything.
        //
        // The noise the anchor was supposed to stop is stopped by the figure
        // patterns instead: a percentage, an `Nx` / `N vs M` / `N of M` ratio,
        // and a number followed by one of a CLOSED unit list. An open
        // `\d+\s+\w+` matched version strings (`6.0.0-D`), phase numbers, and
        // dates, which is why the list is closed rather than inferred.
        if (PERCENT_RE.test(line) || RATIO_RE.test(line) || UNIT_RE.test(line)) {
            push('measurement');
            return;
        }
        // A verb with no figure reports an observation without printing one, so
        // it still needs a date / PR / sha nearby to be a dated observation
        // rather than the word "measured" in a sentence about measuring.
        if (MEASURE_VERB_RE.test(line) && anchoredNear(lines, index)) push('measurement');
    });

    return out;
}

// ---------------------------------------------------------------------------
// Proposal
// ---------------------------------------------------------------------------

export interface Proposal {
    provenance: string;
    agenticMode: string | null;
    strength: string;
    discovery: 'incomplete';
    rationale: string;
}

function classes(markers: readonly Marker[]): Set<MarkerClass> {
    return new Set(markers.map((m) => m.cls));
}

/**
 * Why a marker class that IS present still raised nothing.
 *
 * Four classes can be detected and grade to E0 on their own, because every rule
 * that reads them requires a companion: `repeated` needs something measured to
 * compare, `prereg` needs a benchmark corpus, `benchmark` needs a measurement or
 * a pre-registration, and `owner` is a provenance input that the grading path
 * never reads at all. Before this table existed those records printed
 * "no evidence marker found" beside a Matched-markers cell that listed markers
 * — 12 of 186 rows in the shipped artifact, `ADR-032` / `056` / `085` / `093` /
 * `101` / `104` / `108` / `111` / `112` / `130` / `211` / `230`. The grade was
 * right and the sentence was false, which is worse than a wrong grade: a
 * reviewer who trusts the rationale stops reading the citation column.
 */
const UNGRADED_REASON: Readonly<Partial<Record<MarkerClass, string>>> = {
    owner: 'an owner or maintainer declaration is provenance, not evidence',
    repeated: 'comparative language with nothing measured to compare (E2 needs a measurement or a benchmark)',
    prereg: 'pre-registration language with no benchmark corpus beside it (E3 needs both)',
    benchmark: 'a benchmark path with no measurement or pre-registration beside it (E2 needs one)',
};

/**
 * The ungraded classes, named, in first-appearance order — `classes()` builds
 * its Set from the marker list, so the order is the record's own and is stable
 * across runs.
 */
export function describeUngraded(present: ReadonlySet<MarkerClass>): string {
    const parts = [...present]
        .filter((cls) => !COUNCIL_CLASSES.has(cls))
        .map((cls) => `${cls} (${UNGRADED_REASON[cls] ?? 'no rule raises the grade on this class alone'})`);
    return parts.join('; ');
}

/**
 * Propose `evidence.strength` from the NON-council marker set.
 *
 * The council exclusion is the structure, not a branch: `present` is built from
 * a filtered list, so rule 1 ("a council marker alone never raises the grade
 * above E0") cannot be defeated by adding another council pattern later.
 */
export function proposeStrength(markers: readonly Marker[]): { strength: string; rationale: string } {
    const graded = markers.filter((m) => !COUNCIL_CLASSES.has(m.cls));
    const present = classes(graded);
    const councilOnly = graded.length === 0 && markers.length > 0;

    if (present.has('claim')) {
        return { strength: 'E3', rationale: 'cites a CLAIMS.md claim id (pre-registered and hash-bound in this repo)' };
    }
    if (present.has('prereg') && present.has('benchmark')) {
        return { strength: 'E3', rationale: 'pre-registered benchmark' };
    }
    if (present.has('external_standard')) {
        return { strength: 'E3', rationale: 'cites a named external standard or vendor guidance' };
    }
    if (present.has('repeated') && (present.has('measurement') || present.has('benchmark'))) {
        return { strength: 'E2', rationale: 'repeated or comparative measurement' };
    }
    if (present.has('measurement') && (present.has('benchmark') || present.has('prereg'))) {
        return { strength: 'E2', rationale: 'measurement against a benchmark or pre-registered threshold' };
    }
    if (present.has('measurement')) {
        return { strength: 'E1', rationale: 'one dated local observation' };
    }
    if (present.has('external_citation')) {
        return { strength: 'E1', rationale: 'one external citation, no named standard' };
    }
    if (councilOnly) {
        return {
            strength: 'E0',
            rationale: 'council / agreement markers only — consensus is not evidence',
        };
    }
    // Markers WERE found and none of them is graded by any rule above. This
    // branch exists because the fall-through used to claim the opposite; see
    // `UNGRADED_REASON`.
    if (graded.length > 0) {
        return {
            strength: 'E0',
            rationale: `markers present, none graded: ${describeUngraded(present)}`,
        };
    }
    return { strength: 'E0', rationale: 'no evidence marker found' };
}

/**
 * Propose `provenance.kind`.
 *
 * Owner and council markers are the only two inputs, and `reopen_policy: owner`
 * is deliberately NOT one of them: the contract's own Iron Law says an ADR's
 * historical decision-maker does not determine its reopen venue, and reading
 * that backwards — venue implies author — is the same conflation in the other
 * direction.
 */
export function proposeProvenance(markers: readonly Marker[]): {
    provenance: string;
    agenticMode: string | null;
} {
    const present = classes(markers);
    const human = present.has('owner');
    const agent = present.has('council');
    const mode = agent ? 'council' : null;

    if (human && agent) return { provenance: 'mixed', agenticMode: mode };
    if (human) return { provenance: 'human', agenticMode: null };
    if (agent) return { provenance: 'agentic', agenticMode: mode };
    return { provenance: 'unknown', agenticMode: null };
}

export function propose(markers: readonly Marker[]): Proposal {
    const { strength, rationale } = proposeStrength(markers);
    const { provenance, agenticMode } = proposeProvenance(markers);
    return { provenance, agenticMode, strength, discovery: 'incomplete', rationale };
}

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

export interface CensusRecord {
    /** Repo-relative path. */
    record: string;
    surface: 'flat' | 'area';
    /** `present`, or `absent` with what stands in for it. */
    frontmatter: 'present' | 'absent';
    /** What the record carries today on the two axes, for the diff column. */
    current: string;
    proposed: Proposal;
    markers: Marker[];
}

export interface CensusResult {
    scanned: number;
    records: CensusRecord[];
    /** Records that could not be read at all — the only `--check` failure. */
    unreadable: { record: string; error: string }[];
}

/** Enumerate the corpus: 177 flat `ADR-*.md` plus the per-area `NNNN-*.md`. */
export function enumerateRecords(root: string = REPO_ROOT): string[] {
    const out: string[] = [];

    const flat = path.join(root, FLAT_DIR);
    if (fs.existsSync(flat)) {
        for (const name of fs.readdirSync(flat).sort()) {
            if (/^ADR-.*\.md$/.test(name)) out.push(path.join(FLAT_DIR, name));
        }
    }

    const areas = path.join(root, AREA_DIR);
    if (fs.existsSync(areas)) {
        const walk = (dir: string, rel: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
                const abs = path.join(dir, entry.name);
                const next = path.join(rel, entry.name);
                if (entry.isDirectory()) {
                    walk(abs, next);
                    continue;
                }
                // Every `README.md` is excluded — an area index is not a record.
                if (entry.name === 'README.md') continue;
                if (/^\d+.*\.md$/.test(entry.name)) out.push(next);
            }
        };
        walk(areas, AREA_DIR);
    }

    return out;
}

/**
 * The per-area metadata line, which is a blockquote rather than frontmatter:
 * `> Area: \`cost\` · Status: accepted · Date: 2026-05-16 · Type: retrospective`.
 *
 * Read for the report's "current" column only. A sibling change is converting
 * these to real frontmatter; until it lands, reporting the blockquote is more
 * useful than reporting nothing, and it is labelled as blockquote-derived so
 * nobody mistakes it for a parsed axis.
 */
export function blockquoteMeta(text: string): string | null {
    for (const line of text.split('\n').slice(0, 12)) {
        if (/^>\s*Area:/.test(line)) return line.replace(/^>\s*/, '').trim();
    }
    return null;
}

/** Render what the record carries on the two axes today. */
function currentAxes(fm: AdrFrontmatter | null, text: string): string {
    if (fm === null) {
        const meta = blockquoteMeta(text);
        return meta === null
            ? 'no frontmatter, no blockquote metadata'
            : `no frontmatter; blockquote: ${meta}`;
    }
    const prov = provenanceOf(fm);
    const ev = evidenceOf(fm);
    const parts: string[] = [];
    parts.push(prov?.kind === undefined || prov?.kind === null ? 'provenance: —' : `provenance: ${prov.kind}`);
    parts.push(ev?.strength === undefined || ev?.strength === null ? 'evidence: —' : `evidence: ${ev.strength}`);
    const basis = fm.scalars['authority_basis'];
    if (basis !== undefined && basis !== '') parts.push(`authority_basis: ${basis}`);
    return parts.join(' · ');
}

export function runCensus(root: string = REPO_ROOT, ledger?: GateLedger): CensusResult {
    const rels = enumerateRecords(root);
    ledger?.plan(rels);

    const records: CensusRecord[] = [];
    const unreadable: { record: string; error: string }[] = [];

    for (const rel of rels) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch (exc) {
            unreadable.push({ record: rel, error: exc instanceof Error ? exc.message : String(exc) });
            ledger?.fail(rel, 'unreadable');
            continue;
        }
        const fm = readAdrFrontmatter(text);
        const markers = detectMarkers(text);
        records.push({
            record: rel,
            surface: rel.startsWith(FLAT_DIR) ? 'flat' : 'area',
            frontmatter: fm === null ? 'absent' : 'present',
            current: currentAxes(fm, text),
            proposed: propose(markers),
            markers,
        });
        ledger?.complete(rel);
    }

    return { scanned: records.length, records, unreadable };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function distribution(result: CensusResult): {
    strength: Record<string, number>;
    provenance: Record<string, number>;
    frontmatter_absent: number;
} {
    const strength: Record<string, number> = {};
    const provenance: Record<string, number> = {};
    let absent = 0;
    for (const r of result.records) {
        strength[r.proposed.strength] = (strength[r.proposed.strength] ?? 0) + 1;
        provenance[r.proposed.provenance] = (provenance[r.proposed.provenance] ?? 0) + 1;
        if (r.frontmatter === 'absent') absent += 1;
    }
    return { strength, provenance, frontmatter_absent: absent };
}

/** `docs/decisions/ADR-048-x.md:30 council` — the citation, deduped per class. */
function renderMarkers(markers: readonly Marker[], record: string): string {
    if (markers.length === 0) return '_none_';
    const byClass = new Map<MarkerClass, number[]>();
    for (const m of markers) {
        const seen = byClass.get(m.cls) ?? [];
        if (!seen.includes(m.line)) seen.push(m.line);
        byClass.set(m.cls, seen);
    }
    const base = path.basename(record);
    return [...byClass.entries()]
        .map(([cls, lines]) => `${cls} @ ${lines.slice(0, 6).map((l) => `${base}:${String(l)}`).join(', ')}`)
        .join('<br>');
}

export function renderArtifact(result: CensusResult): string {
    const dist = distribution(result);
    const L: string[] = [];

    // `analysis` per `docs/contracts/evidence-artifact-types.md`: "a
    // measurement, census, investigation, or report … never re-bound". Emitted
    // as line 1 because `lint_evidence_artifacts` fires on any artifact ADDED
    // under `agents/evidence/` that resolves no type, and it reads only the
    // first 40 lines. A generator that writes an undeclared artifact reds that
    // gate on the commit, not on the run — which is exactly the class of defect
    // that is cheap here and expensive later.
    L.push('<!-- evidence-type: analysis -->');
    L.push('');
    L.push('# ADR evidence census — proposed provenance and evidence grades');
    L.push('');
    L.push(
        `Generated by \`src/scripts/adr/evidence_census.ts\`. Records examined: **${String(result.scanned)}** ` +
            `(${String(result.records.filter((r) => r.surface === 'flat').length)} flat, ` +
            `${String(result.records.filter((r) => r.surface === 'area').length)} per-area).`,
    );
    L.push('');
    L.push('## What this artifact is NOT');
    L.push('');
    L.push(
        'It is a **proposal set for human review**. It wrote no ADR frontmatter, and it has no code ' +
            'path that can: `adr-layout § Provenance and evidence` says a census may propose a value and ' +
            'never writes one, and the `No bulk classification` clause is why. The grades are **heuristic** ' +
            '— a marker grep over each record\'s own text, not a citation audit.',
    );
    L.push('');
    L.push('### Which way each class is biased');
    L.push('');
    L.push(
        'Most classes are biased **LOW** on purpose: an under-graded proposal costs a reviewer one ' +
            'upgrade, while an over-graded one puts unearned "this is measured" text into the tree. ' +
            '`measurement` needs a figure or a dated verb, `repeated` needs something measured to compare, ' +
            '`prereg` needs a benchmark corpus beside it, and `owner` / `council` raise nothing at all.',
    );
    L.push('');
    L.push(
        '**Two classes are biased HIGH by construction, and the paragraph above is false for them.** ' +
            '`claim` and `external_standard` short-circuit to `E3` — the second-highest grade in the ' +
            'scale, and the highest this script proposes at all — on a bare textual match, ahead of ' +
            'every other rule and with no companion marker ' +
            'required: they are the first and third branches of `proposeStrength`, so they pre-empt the ' +
            'measurement rules rather than competing with them. The standard pattern matches a plain ' +
            'word-bounded `GDPR`, so naming a regulation as the *subject* of a decision reads identically ' +
            'to citing it as the *evidence for* one.',
    );
    L.push('');
    L.push(
        'Worked example, checkable in this table: `ADR-107` line 35 writes "EU DPA / GDPR Art. 28" to ' +
            'scope which legal domain its eval fixtures cover. This census proposes ' +
            '`E3 — cites a named external standard or vendor guidance`; the tranche reviewer reading the ' +
            'same line adjudicated `E2`. The grading rules are deliberately unchanged — so read an `E3` ' +
            'whose only non-council marker is `claim` or `external_standard` as a **ceiling to check ' +
            'downward**, not as a floor.',
    );
    L.push('');
    L.push(
        '`discovery` is `incomplete` for every row, at every grade, and this script cannot emit ' +
            '`complete`. A marker grep is not the defined exhaustive evidence search the contract requires ' +
            'before absence may be asserted. **E4 is never proposed** — an external constraint is a fact ' +
            'about real consumers, contracts, or law, and marker presence cannot establish one.',
    );
    L.push('');
    L.push(
        'A council marker never raises a grade above `E0`. That is structural here, not a special case: ' +
            'the grade is computed from the non-council marker set, so no future council pattern can move it.',
    );
    L.push('');
    L.push('## Proposed distribution');
    L.push('');
    L.push('| Axis | Value | Records |');
    L.push('|---|---|---|');
    for (const key of ['E0', 'E1', 'E2', 'E3', 'E4']) {
        L.push(`| \`evidence.strength\` | \`${key}\` | ${String(dist.strength[key] ?? 0)} |`);
    }
    for (const key of ['human', 'agentic', 'mixed', 'unknown']) {
        L.push(`| \`provenance.kind\` | \`${key}\` | ${String(dist.provenance[key] ?? 0)} |`);
    }
    L.push(`| frontmatter | absent | ${String(dist.frontmatter_absent)} |`);
    L.push('');

    if (result.unreadable.length > 0) {
        L.push('## Unreadable records');
        L.push('');
        for (const u of result.unreadable) L.push(`- \`${u.record}\` — ${u.error}`);
        L.push('');
    }

    L.push('## Per-record proposals');
    L.push('');
    L.push(
        '| Record | Proposed provenance | Proposed strength | Discovery | Matched markers (file:line) | Current frontmatter |',
    );
    L.push('|---|---|---|---|---|---|');
    for (const r of result.records) {
        const prov =
            r.proposed.agenticMode === null
                ? `\`${r.proposed.provenance}\``
                : `\`${r.proposed.provenance}\` (\`agentic_mode: ${r.proposed.agenticMode}\`)`;
        L.push(
            `| \`${r.record}\` | ${prov} | \`${r.proposed.strength}\` — ${r.proposed.rationale} | ` +
                `\`${r.proposed.discovery}\` | ${renderMarkers(r.markers, r.record)} | ${r.current} |`,
        );
    }
    L.push('');
    return L.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv: string[]): number {
    const asJson = argv.includes('--json');
    const checkOnly = argv.includes('--check');
    const outIndex = argv.indexOf('--out');
    if (outIndex !== -1 && argv[outIndex + 1] === undefined) {
        process.stderr.write('usage: evidence_census [--json] [--check] [--out <path>]\n');
        return 2;
    }
    const outRel = outIndex === -1 ? DEFAULT_OUT : (argv[outIndex + 1] as string);

    const ledger = new GateLedger('adr_evidence_census');
    const result = runCensus(REPO_ROOT, ledger);
    const tally = ledger.finalize();

    try {
        assertScanned({
            gate: 'adr_evidence_census',
            scanned: result.scanned,
            units: 'ADR record(s)',
            roots: [FLAT_DIR, AREA_DIR],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (asJson) {
        process.stdout.write(
            JSON.stringify(
                {
                    scanned: result.scanned,
                    distribution: distribution(result),
                    unreadable: result.unreadable,
                    records: result.records,
                    ledger: tally,
                },
                null,
                2,
            ) + '\n',
        );
        return result.unreadable.length > 0 ? 1 : 0;
    }

    const dist = distribution(result);
    // `path.join(REPO_ROOT, outRel)` silently rewrote an ABSOLUTE `--out` into
    // the repo — `--out /tmp/x.md` wrote `<repo>/tmp/x.md` and then printed
    // `/tmp/x.md`, so the caller was told a path that held nothing. Resolve
    // instead, and print what was actually written. Found in completion review.
    const abs = path.isAbsolute(outRel) ? outRel : path.join(REPO_ROOT, outRel);
    if (!checkOnly) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, renderArtifact(result), 'utf-8');
    }

    process.stdout.write(`scanned: ${String(result.scanned)}\n`);
    process.stdout.write(
        `ADR evidence census: ` +
            (['E0', 'E1', 'E2', 'E3', 'E4'].map((k) => `${k}=${String(dist.strength[k] ?? 0)}`).join(' ')) +
            ` · ` +
            (['human', 'agentic', 'mixed', 'unknown'].map((k) => `${k}=${String(dist.provenance[k] ?? 0)}`).join(' ')) +
            `\n`,
    );
    ledger.report();
    if (!checkOnly) process.stdout.write(`proposal artifact: ${path.relative(REPO_ROOT, abs) || abs}\n`);

    if (result.unreadable.length > 0) {
        for (const u of result.unreadable) {
            process.stderr.write(`    ❌ ${u.record}: ${u.error}\n`);
        }
        process.stderr.write(
            `\n❌  adr_evidence_census: ${String(result.unreadable.length)} record(s) could not be read — the scan is incomplete.\n`,
        );
        return 1;
    }

    // Deliberately never non-zero on a grade. This is a report; the proposals
    // are reviewed by a human, and a low grade is a finding, not a violation.
    process.stdout.write('✅  adr_evidence_census: scan complete (proposals only — nothing was written to any ADR)\n');
    return 0;
}

if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main(process.argv.slice(2)));
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exit(main(process.argv.slice(2)));
        }
    }
}
