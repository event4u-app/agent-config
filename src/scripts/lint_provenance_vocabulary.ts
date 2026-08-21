#!/usr/bin/env tsx
/**
 * Provenance-vocabulary linter — the S3.2/S3.3 backstop for
 * road-to-provenance-and-license-governance Phase 3.
 *
 * Gate G0 (S0.3) missed both its false-positive and rename-only-recall
 * thresholds, so no CI-facing similarity/duplication detector exists — see
 * `docs/CLAIMS.md#provenance-detector-transformation-sensitivity` and
 * `#provenance-gate-effectiveness`. What ships is a license-policy derivation
 * (`detect_target_license.ts`) plus a strict own-records ledger linter
 * (`lint_provenance.ts`). This linter enforces the honesty floor on top of
 * that shipped reality across user-facing prose surfaces:
 *
 *   1. Banned phrases — "copyright-safe" and close variants — NEVER appear,
 *      anywhere, even hedged. A line quoting the ban itself (negation words,
 *      or the phrase inside a quoted/backtick span used to NAME the ban) is
 *      exempt, mirroring `lint_legal_pack`'s NEG_EXAMPLE_RE carve-out.
 *   2. Co-location — a file using approved vocabulary ("provenance-governed",
 *      "license-policy-enforced", "audited borrow trail") MUST carry a
 *      `<!-- provenance-scope-box -->` anchor immediately followed by a
 *      "Scope & limits" heading, and that box MUST state: (a) unconscious
 *      training-data reproduction is not detectable at this layer, (b)
 *      detection covers a knowledge base of known OSS only, (c) there is no
 *      CI-facing detection gate, (d) rename-only laundering is not detected,
 *      and (e) at least one measured N/D figure.
 *   3. Number cross-check — every N/D figure inside a scope box MUST also
 *      appear, verbatim, somewhere in `docs/CLAIMS.md` — a box number that
 *      drifts from the ledger is a build failure, not a doc nit.
 *   4. Permanence language — an ADR record MUST NOT assert that its decision
 *      is permanent in a load-bearing position (its `# ` title, its
 *      `decision:` slug, its `## Decision` section, an `Addendum`). ADR-239
 *      § 6 is the doctrine and ADR-208 the standing demonstration: its title
 *      says the tree is kept forever, its Decision says KEEP permanently, and
 *      its own frontmatter carries the conditions under which it is reopened.
 *      A record cannot be both. Two escapes, both enforced here: permanence
 *      scoped to an EXTERNAL invariant with the condition under which that
 *      invariant stops applying stated in the same section, or an owner
 *      purpose statement recorded as `authority_basis: owner_intent`.
 *      Describing positions — `## Alternatives considered`, `## Consequences`,
 *      `## Context`, an `## Amendment`, a quoted open question, a table
 *      rationale cell — are NOT violations.
 *
 * Scan surfaces: README.md + every `docs/**\/*.md` file (recursive). No
 * marketing/install-output text file carries this vocabulary today — this is
 * the single place to widen SCAN_ROOTS when one does. Rule 4 adds no root: it
 * filters the already-walked `docs/**` set down to ADR records
 * ({@link isAdrRecord}) rather than widening the walk, which is why it lives
 * here instead of in a new gate script (a new gate costs seven wiring
 * surfaces for the same coverage).
 *
 * Two verdicts. Rules 1-3 hard-fail. Rule 4 is a RATCHET against
 * `lint_provenance_vocabulary:permanence-language` in
 * `src/config/gate-violation-baselines.json`, because the corpus carries real
 * violations today and a gate that lands as five instant blockers is a shape
 * this repository has already refused. A new record still hard-fails.
 *
 * Exit codes: 0 clean · 1 violations found (either verdict).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkRatchet } from './_lib/gate_baseline.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CLAIMS_LEDGER_REL = 'docs/CLAIMS.md';

/** User-facing prose surfaces this linter watches. Widen here, not ad hoc. */
export const SCAN_ROOTS: readonly string[] = ['README.md', 'docs'];

// ---------------------------------------------------------------------------
// 1. Banned phrases
// ---------------------------------------------------------------------------

/**
 * "copyright-safe" and its near variants. Each pair is two words joined by a
 * hyphen or a space, whole-word matched, case-insensitive — deliberately
 * narrow (mirrors `lint_readme_jargon`'s watchlist approach) so the gate
 * catches the overclaim shape without flooding on unrelated "clean"/"safe"
 * prose elsewhere in the docs.
 */
export const BANNED_PHRASE_PAIRS: ReadonlyArray<readonly [string, string]> = [
    ['copyright', 'safe'],
    ['copyright', 'proof'],
    ['copyright', 'clean'],
    ['ip', 'safe'],
    ['ip', 'clean'],
    ['legally', 'safe'],
];

/** Lines that discuss the ban itself (negation, or a quoted/backtick name of
 *  the banned term) are exempt — otherwise this file's own README section
 *  ("no 'copyright-safe' language anywhere") would fail its own gate. */
const NEG_EXAMPLE_RE = /(never|avoid|forbidden|banned|do not|don'?t|no\b.{0,20}language|instead|rather than)/i;
const QUOTED_PHRASE_RE = /["'`][^"'`]*["'`]/g;

function _escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _bannedPhraseRegex(a: string, b: string): RegExp {
    return new RegExp(
        `(?<![A-Za-z0-9])${_escapeRegExp(a)}[- ]${_escapeRegExp(b)}(?![A-Za-z0-9])`,
        'gi',
    );
}

/** Strip fenced ``` code blocks (line-level, matching lint_readme_jargon). */
function _stripFences(lines: readonly string[]): string[] {
    const out: string[] = [];
    let inFence = false;
    for (const raw of lines) {
        if (/^\s*```/.test(raw)) {
            inFence = !inFence;
            out.push('');
            continue;
        }
        out.push(inFence ? '' : raw);
    }
    return out;
}

export interface Violation {
    file: string;
    rule: string;
    msg: string;
}

/** A line is exempt from the banned-phrase scan when it names the ban rather
 *  than committing it: a negation word anywhere on the line, or the phrase
 *  sitting inside a quoted/backtick span used to introduce the term. */
function _isNegatedLine(line: string, hitIndex: number): boolean {
    if (NEG_EXAMPLE_RE.test(line)) return true;
    return _isQuotedSpan(line, hitIndex);
}

/** True when `hitIndex` on `line` falls inside a quoted/backtick span — used
 *  to exempt a term that is being NAMED (a citation, an enumeration of the
 *  vocabulary itself) rather than USED as a live user-facing claim. Without
 *  this, a doc that lists the approved-vocabulary terms in quotes to explain
 *  the rule (e.g. an ADR citing `("provenance-governed", "license-policy-
 *  enforced", "audited borrow trail")`) would itself be forced to carry a
 *  scope box for a sentence that isn't making a claim at all. */
function _isQuotedSpan(line: string, hitIndex: number): boolean {
    QUOTED_PHRASE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = QUOTED_PHRASE_RE.exec(line)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        if (hitIndex >= start && hitIndex < end) return true;
    }
    return false;
}

/** Global-consequence-bound wording (S3.2/S3.3): baked into every finding so
 *  the failure message states the stake, not just the syntax error. */
const GLOBAL_CONSEQUENCE_BOUND =
    'global consequence bound: a published surface asserting copyright/IP safety ' +
    'voids the provenance claim and pulls the surface — no tool here sees model ' +
    'training data and detection covers a knowledge base of known OSS only, so ' +
    'nothing this package ships may claim "safe" or "proof" against copying';

export function bannedPhraseViolations(text: string, file: string): Violation[] {
    const violations: Violation[] = [];
    const lines = _stripFences(text.split('\n'));
    lines.forEach((line, idx) => {
        for (const [a, b] of BANNED_PHRASE_PAIRS) {
            const re = _bannedPhraseRegex(a, b);
            let m: RegExpExecArray | null;
            while ((m = re.exec(line)) !== null) {
                if (!_isNegatedLine(line, m.index)) {
                    violations.push({
                        file,
                        rule: 'banned-phrase',
                        msg:
                            `line ${idx + 1}: banned phrase "${m[0]}" — ${GLOBAL_CONSEQUENCE_BOUND} ` +
                            `(context: ${line.trim().slice(0, 90)})`,
                    });
                }
                if (m.index === re.lastIndex) re.lastIndex += 1;
            }
        }
    });
    return violations;
}

// ---------------------------------------------------------------------------
// 2 + 3. Co-location + number cross-check
// ---------------------------------------------------------------------------

export const APPROVED_TERMS: readonly string[] = [
    'provenance-governed',
    'license-policy-enforced',
    'audited borrow trail',
];

export const SCOPE_BOX_ANCHOR = '<!-- provenance-scope-box -->';
const HEADING_RE = /^(#{1,6})\s+.*$/;
const SCOPE_BOX_HEADING_RE = /^#{1,6}\s*.*Scope\s*&\s*limits/i;
// How many lines after the anchor the required heading must appear within —
// tolerates a blank line between the HTML comment and the Markdown heading.
const HEADING_SEARCH_WINDOW = 5;

/** Required substrings inside a scope-box body (case-insensitive). Each is a
 *  separate, independently-failing check so one missing element names itself. */
const REQUIRED_BOX_SUBSTRINGS: ReadonlyArray<{ id: string; re: RegExp; msg: string }> = [
    {
        id: 'unconscious-training-data',
        re: /unconscious training-data reproduction/i,
        msg: 'missing the unconscious-training-data-reproduction statement',
    },
    {
        id: 'not-detectable',
        re: /not detectable at this layer/i,
        msg: 'missing the "not detectable at this layer" statement',
    },
    {
        id: 'known-oss',
        re: /known oss/i,
        msg: 'missing the known-OSS knowledge-base scope statement',
    },
    {
        id: 'no-ci-gate',
        re: /no ci-facing detection gate/i,
        msg: 'missing the "no CI-facing detection gate" statement (Gate G0 / K1)',
    },
    {
        id: 'rename-only-undetected',
        re: /rename-only/i,
        msg: 'missing a "rename-only" laundering statement',
    },
    {
        id: 'rename-only-not-detected',
        re: /not detected/i,
        msg: 'missing the "not detected" clause for rename-only laundering',
    },
];

const FRACTION_RE = /\b\d+\/\d+\b/g;

function _approvedTermRegex(term: string): RegExp {
    // Multi-word terms (spaces) are matched literally; hyphenated terms use
    // the same word-boundary discipline as the banned-phrase scan.
    return new RegExp(`(?<![A-Za-z0-9])${_escapeRegExp(term)}(?![A-Za-z0-9])`, 'gi');
}

interface ScopeBox {
    anchorLine: number;
    headingLine: number;
    body: string;
}

/** Locate every `<!-- provenance-scope-box -->` anchor in `lines`, verify a
 *  "Scope & limits" heading follows within the search window, and return the
 *  box's body text (heading's own section, up to the next heading of equal
 *  or shallower level, or EOF). Anchors with no following heading are
 *  reported as a violation and excluded from the returned list. */
function _findScopeBoxes(lines: readonly string[], file: string, violations: Violation[]): ScopeBox[] {
    const boxes: ScopeBox[] = [];
    lines.forEach((line, idx) => {
        if (!line.includes(SCOPE_BOX_ANCHOR)) return;
        let headingLine = -1;
        let headingLevel = 0;
        for (let j = idx + 1; j <= Math.min(idx + HEADING_SEARCH_WINDOW, lines.length - 1); j++) {
            const candidate = lines[j] ?? '';
            if (candidate.trim() === '') continue;
            if (SCOPE_BOX_HEADING_RE.test(candidate)) {
                headingLine = j;
                headingLevel = (HEADING_RE.exec(candidate)?.[1] ?? '#').length;
            }
            break; // first non-blank line decides it, matching the anchor
        }
        if (headingLine === -1) {
            violations.push({
                file,
                rule: 'co-location',
                msg:
                    `line ${idx + 1}: "${SCOPE_BOX_ANCHOR}" found but no "Scope & limits" ` +
                    `heading within ${HEADING_SEARCH_WINDOW} lines`,
            });
            return;
        }
        let end = lines.length;
        for (let j = headingLine + 1; j < lines.length; j++) {
            const m = HEADING_RE.exec(lines[j] ?? '');
            if (m && (m[1] ?? '').length <= headingLevel) {
                end = j;
                break;
            }
        }
        boxes.push({ anchorLine: idx, headingLine, body: lines.slice(headingLine, end).join('\n') });
    });
    return boxes;
}

/** Co-location (S3.3): a file using approved vocabulary must carry >=1 valid
 *  scope box, and every box found must state all five required elements. */
export function coLocationViolations(text: string, file: string): Violation[] {
    const violations: Violation[] = [];
    const lines = text.split('\n');
    const strippedLines = _stripFences(lines);

    const usedTerms: string[] = [];
    strippedLines.forEach((line) => {
        for (const term of APPROVED_TERMS) {
            const re = _approvedTermRegex(term);
            let m: RegExpExecArray | null;
            while ((m = re.exec(line)) !== null) {
                if (!_isQuotedSpan(line, m.index)) usedTerms.push(term);
                if (m.index === re.lastIndex) re.lastIndex += 1;
            }
        }
    });

    const boxes = _findScopeBoxes(lines, file, violations);

    if (usedTerms.length > 0 && boxes.length === 0) {
        violations.push({
            file,
            rule: 'co-location',
            msg:
                `approved vocabulary [${[...new Set(usedTerms)].join(', ')}] used without a ` +
                `co-located "${SCOPE_BOX_ANCHOR}" scope box (S3.2 global consequence bound)`,
        });
    }

    for (const box of boxes) {
        for (const req of REQUIRED_BOX_SUBSTRINGS) {
            if (!req.re.test(box.body)) {
                violations.push({
                    file,
                    rule: 'scope-box-content',
                    msg: `scope box at line ${box.headingLine + 1}: ${req.msg}`,
                });
            }
        }
        if (!FRACTION_RE.test(box.body)) {
            violations.push({
                file,
                rule: 'scope-box-content',
                msg: `scope box at line ${box.headingLine + 1}: missing a measured N/D figure (e.g. "12/16")`,
            });
        }
        FRACTION_RE.lastIndex = 0;
    }
    return violations;
}

/** Number cross-check (S3.3): every N/D figure inside a scope box must also
 *  appear, verbatim, somewhere in `docs/CLAIMS.md` — the ledger is the single
 *  source of truth for measured numbers; a box that drifts from it fails. */
export function scopeBoxNumberMismatches(text: string, file: string, claimsText: string): Violation[] {
    const violations: Violation[] = [];
    const lines = text.split('\n');
    const boxes = _findScopeBoxes(lines, file, []); // co-location already reports missing-heading
    for (const box of boxes) {
        const seen = new Set<string>();
        let m: RegExpExecArray | null;
        FRACTION_RE.lastIndex = 0;
        while ((m = FRACTION_RE.exec(box.body)) !== null) {
            seen.add(m[0]);
        }
        for (const fraction of seen) {
            if (!claimsText.includes(fraction)) {
                violations.push({
                    file,
                    rule: 'number-drift',
                    msg:
                        `scope box at line ${box.headingLine + 1}: figure "${fraction}" does not appear in ` +
                        `${CLAIMS_LEDGER_REL} — the box has drifted from the ledger`,
                });
            }
        }
    }
    return violations;
}

export function lintFile(text: string, file: string, claimsText: string): Violation[] {
    return [
        ...bannedPhraseViolations(text, file),
        ...coLocationViolations(text, file),
        ...scopeBoxNumberMismatches(text, file, claimsText),
    ];
}

// ---------------------------------------------------------------------------
// 4. Permanence language in ADR records
// ---------------------------------------------------------------------------

/**
 * ADR record roots.
 *
 * Both already sit under `docs`, which {@link SCAN_ROOTS} walks — these roots
 * do NOT widen the walk, they IDENTIFY which of the already-read files is an
 * ADR record. Every other `docs/**` file is untouched by this rule.
 */
export const ADR_RECORD_ROOTS: readonly string[] = ['docs/decisions', 'docs/adrs'];

/** Ratchet key in `src/config/gate-violation-baselines.json`. */
export const PERMANENCE_GATE = 'lint_provenance_vocabulary:permanence-language';

/**
 * True for a flat `docs/decisions/ADR-*.md` record or a per-area
 * `docs/adrs/<area>/<n>-*.md` record. A per-area `README.md` is an index, not
 * a record, and is excluded on both surfaces — so are the non-ADR documents
 * that share `docs/decisions/` (sweep artifacts, reclassification logs).
 */
export function isAdrRecord(rel: string): boolean {
    const posix = rel.split(path.sep).join('/');
    const base = posix.slice(posix.lastIndexOf('/') + 1);
    if (!base.endsWith('.md') || base === 'README.md') return false;
    if (posix.startsWith('docs/decisions/')) return /^ADR-/.test(base);
    if (posix.startsWith('docs/adrs/')) return /^\d/.test(base);
    return false;
}

/**
 * The four positions where a permanence claim is LOAD-BEARING — the record is
 * asserting permanence rather than describing, historicising, or rejecting it.
 *
 * - `title` — the `# ` heading; it is the record's name in every citation.
 * - `slug` — the `decision:` frontmatter value; machine-visible, so a
 *   permanence claim there is carried by every tool that reads the field.
 * - `decision` — the `## Decision` section's own prose.
 * - `addendum` — an `Addendum` heading at any level. Both corpus instances
 *   (ADR-122, ADR-124) assert a permanently-off default, which is the same
 *   claim shape as ADR-208's Decision, so they are in scope. `Amendment` is
 *   deliberately NOT: an amendment revises or historicises an earlier claim.
 *
 * Everything else is out of scope by construction: `## Alternatives
 * considered` rejects a permanence option, `## Consequences` reports one,
 * `## Context` recounts one, and an `## Open question` quotes one. Scoping is
 * the whole gate — the same word list applied to whole files matches 41 lines
 * across 30 records, and the large majority of them are legitimate.
 */
export type PermanenceRegion = 'title' | 'slug' | 'decision' | 'addendum';

interface Region {
    kind: PermanenceRegion;
    /** First line index of the region (0-based, inclusive). */
    start: number;
    /** Last line index of the region (0-based, inclusive). */
    end: number;
}

const FM_DELIM_RE = /^---[ \t]*$/;
const ANY_HEADING_RE = /^#{1,6}[ \t]+/;
const H1_RE = /^#[ \t]+/;
const DECISION_KEY_RE = /^decision:/;
// `## Decision`, `## Decisions`, `## Decision — GO`, `## Decision (Reading B)`,
// `### Decision`. Deliberately NOT `### Decision matrix` / `### Decision owner`
// / `### The owner's decision`: the word has to BE the heading, not open it.
const DECISION_HEADING_RE = /^#{2,6}[ \t]+Decisions?[ \t]*(?:[—–(:\-]|$)/i;
const ADDENDUM_HEADING_RE = /^#{2,6}[ \t]+Addendum\b/i;

/**
 * Escape 2 — an owner purpose statement, keyed on the SCHEMA field.
 *
 * This originally matched a bare `owner_intent: currently binding` key, which
 * the roadmap's own draft prose named and which no schema declares anywhere in
 * the tree (`grep -rn owner_intent docs/ src/` found it only in that prose). It
 * was usable — nothing rejects an unknown frontmatter key — and that is exactly
 * what made it wrong: a lint reading a field the validator does not know is a
 * second vocabulary for one concept, and the tree would have taught two.
 *
 * `authority_basis: owner_intent` is the declared field
 * (`adr-layout § Provenance and evidence`, validated by
 * `check_adr_frontmatter.check_descriptive_axes`), and it already carries the
 * temporal meaning the phrase was reaching for: the burden table reads it as
 * "binding until the owner changes it". So one field, already validated, rather
 * than a phrase that only this lint could see.
 */
const OWNER_INTENT_ESCAPE_RE = /^[ \t]*authority_basis:[ \t]*owner_intent[ \t]*$/m;

/** The literal an owner purpose statement writes instead of "forever". */
export const OWNER_INTENT_ESCAPE = 'authority_basis: owner_intent';

/** The YAML frontmatter block, or '' when the record carries none. */
function _frontmatterText(lines: readonly string[]): string {
    if (lines.length === 0 || !FM_DELIM_RE.test(lines[0] ?? '')) return '';
    for (let i = 1; i < lines.length; i++) {
        if (FM_DELIM_RE.test(lines[i] ?? '')) return lines.slice(1, i).join('\n');
    }
    return '';
}

/**
 * Single permanence words. `permanent` is matched only in a **predicative**
 * position (see {@link PROSE_WORD_RES}) because attributively it names a
 * thing, not the decision: "two permanent regression fixtures" (ADR-126) and
 * "permanent migration stubs" (ADR-057) are objects that happen to persist.
 */
export const PERMANENCE_WORDS: readonly string[] = ['forever', 'permanently', 'permanent'];

/**
 * Multi-word equivalents. The first three are named by ADR-239 § 6;
 * `now or in the future` is the corpus instance that made the list necessary
 * (ADR-108's Decision statement says it instead of "forever"). `in perpetuity`
 * and `for all time` have zero corpus hits today and are listed because they
 * are the standard idioms for the same claim.
 */
export const PERMANENCE_PHRASES: readonly string[] = [
    'never revisit',
    'never reconsider',
    'settled forever',
    'now or in the future',
    'in perpetuity',
    'for all time',
];

/** Prose matchers. `forever` / `permanently` reject a trailing hyphen so a
 *  compound modifier ("forever-incomplete", "permanently-parked") describing
 *  something else is not read as a permanence claim about the decision. */
const PROSE_WORD_RES: readonly RegExp[] = [
    /(?<![A-Za-z0-9])forever(?![A-Za-z0-9-])/gi,
    /(?<![A-Za-z0-9])permanently(?![A-Za-z0-9-])/gi,
    /(?<![A-Za-z0-9])permanent(?=[ \t]*(?:[.,;:!?)*\]]|$))/gi,
];

const PHRASE_RES: readonly RegExp[] = PERMANENCE_PHRASES.map(
    (p) =>
        new RegExp(
            `(?<![A-Za-z0-9])${p.split(' ').map(_escapeRegExp).join('[ \\t]+')}(?![A-Za-z0-9])`,
            'gi',
        ),
);

/** A hyphen-joined slug carries its words without spaces, so the slug region
 *  matches on hyphen boundaries too (`dist-agent-src-keep-forever`). */
const SLUG_RE = /(?<![A-Za-z0-9])(?:forever|permanent(?:ly)?)(?![A-Za-z0-9])/gi;

const TABLE_ROW_RE = /^[ \t]*\|/;
const LIST_ITEM_RE = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]/;
// A sentence break, tolerating a bold/paren/backtick close after the stop.
const SENTENCE_SPLIT_RE = /(?<=[.!?][)*"'\]`]{0,3})[ \t]+(?=[A-Z*`[("'])/g;

/**
 * Negation and conditional markers that make a permanence word DESCRIPTIVE.
 *
 * Deliberately short. A wider list was tried and rejected against the corpus:
 * `would` kills ADR-107's live claim ("commercial ship **would** require …"
 * sits two sentences from "the suite is open-source forever"), and a bare `no`
 * kills ADR-108's ("There is **no** commercial tier … now or in the future").
 * Both are real violations, so a marker that silences them is worse than the
 * noise it removes.
 */
const NEGATION_RE =
    /\b(?:cannot|can't|could not|couldn't|does not|doesn't|do not|don't|did not|is not|isn't|are not|aren't|was not|were not|no longer|rather than|instead of|not a|not an|not the|neither)\b/i;
const CONDITIONAL_RE = /(?:^|[\s(*_"'`])(?:if|unless)\b/i;

/** Escape 1, half one: the permanence is scoped to an EXTERNAL invariant. */
const EXTERNAL_INVARIANT_RE =
    /\b(?:protocol|api compatibility|wire format|statutory|regulatory|legal obligation|licen[sc]e|licensing|contractual|upstream|external constraint|standards? body|rfc[ \t]*\d+)\b/i;
/** Escape 1, half two: the condition under which that invariant stops. */
const STOP_CONDITION_RE =
    /\b(?:stops? applying|no longer applies|ceases? to apply|until|reopen(?:s|ed)?[ \t]+when|revisit(?:ed)?[ \t]+(?:if|when)|is[ \t]+retired|is[ \t]+withdrawn|expires?)\b/i;

const PERMANENCE_CONSEQUENCE_BOUND =
    'a record cannot both assert permanence and carry the conditions under which it ' +
    'is reopened (ADR-239 § 6; ADR-208 is the standing demonstration). Two escapes: ' +
    'scope the permanence to an external invariant AND state in the same section when ' +
    `that invariant stops applying, or record an owner purpose statement as \`${OWNER_INTENT_ESCAPE}\``;

/** Split a record into its load-bearing regions. */
export function permanenceRegions(lines: readonly string[]): Region[] {
    const regions: Region[] = [];
    let bodyStart = 0;

    if (lines.length > 0 && FM_DELIM_RE.test(lines[0] ?? '')) {
        let close = -1;
        for (let i = 1; i < lines.length; i++) {
            if (FM_DELIM_RE.test(lines[i] ?? '')) {
                close = i;
                break;
            }
        }
        if (close > 0) {
            bodyStart = close + 1;
            for (let i = 1; i < close; i++) {
                if (!DECISION_KEY_RE.test(lines[i] ?? '')) continue;
                // A folded value (`decision: >-`) continues on indented lines.
                let end = i;
                for (let j = i + 1; j < close; j++) {
                    if (!/^[ \t]+\S/.test(lines[j] ?? '')) break;
                    end = j;
                }
                regions.push({ kind: 'slug', start: i, end });
                break;
            }
        }
    }

    let open: Region | null = null;
    for (let i = bodyStart; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (!ANY_HEADING_RE.test(line)) continue;
        if (open !== null) {
            open.end = i - 1;
            regions.push(open);
            open = null;
        }
        if (H1_RE.test(line)) {
            regions.push({ kind: 'title', start: i, end: i });
            continue;
        }
        if (DECISION_HEADING_RE.test(line)) {
            open = { kind: 'decision', start: i, end: lines.length - 1 };
            continue;
        }
        if (ADDENDUM_HEADING_RE.test(line)) {
            open = { kind: 'addendum', start: i, end: lines.length - 1 };
        }
    }
    if (open !== null) regions.push(open);
    return regions;
}

/**
 * The sentence containing the hit.
 *
 * Hard-wrapped prose puts a sentence's start on a previous line (ADR-055's
 * "If Step 8 slips," is one line above its "permanent"), so the paragraph is
 * rejoined first. The walk stops at a list-item start in both directions: the
 * corpus writes numbered Decision clauses one item per line, and merging them
 * imports a neighbour's markers into this item's verdict.
 */
function _sentenceAround(
    lines: readonly string[],
    region: Region,
    lineIdx: number,
    col: number,
): string {
    let top = lineIdx;
    while (
        top > region.start &&
        !LIST_ITEM_RE.test(lines[top] ?? '') &&
        (lines[top - 1] ?? '').trim() !== '' &&
        !ANY_HEADING_RE.test(lines[top - 1] ?? '') &&
        !TABLE_ROW_RE.test(lines[top - 1] ?? '')
    ) {
        top -= 1;
    }
    let bottom = lineIdx;
    while (
        bottom < region.end &&
        (lines[bottom + 1] ?? '').trim() !== '' &&
        !ANY_HEADING_RE.test(lines[bottom + 1] ?? '') &&
        !LIST_ITEM_RE.test(lines[bottom + 1] ?? '') &&
        !TABLE_ROW_RE.test(lines[bottom + 1] ?? '')
    ) {
        bottom += 1;
    }

    let joined = '';
    let hitOffset = 0;
    for (let i = top; i <= bottom; i++) {
        const raw = lines[i] ?? '';
        const sep = joined === '' ? '' : ' ';
        if (i === lineIdx) {
            const lead = raw.length - raw.trimStart().length;
            hitOffset = joined.length + sep.length + Math.max(0, col - lead);
        }
        joined += sep + raw.trim();
    }

    const parts: Array<{ text: string; start: number }> = [];
    let cursor = 0;
    let m: RegExpExecArray | null;
    SENTENCE_SPLIT_RE.lastIndex = 0;
    while ((m = SENTENCE_SPLIT_RE.exec(joined)) !== null) {
        parts.push({ text: joined.slice(cursor, m.index), start: cursor });
        cursor = m.index + m[0].length;
    }
    parts.push({ text: joined.slice(cursor), start: cursor });
    for (const p of parts) {
        if (hitOffset >= p.start && hitOffset < p.start + p.text.length) return p.text;
    }
    return joined;
}

interface RawHit {
    term: string;
    index: number;
}

function _hits(line: string, res: readonly RegExp[]): RawHit[] {
    const out: RawHit[] = [];
    for (const re of res) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
            out.push({ term: m[0], index: m.index });
            if (m.index === re.lastIndex) re.lastIndex += 1;
        }
    }
    return out;
}

/**
 * Rule 4: permanence language in an ADR record's load-bearing positions.
 *
 * Returns [] for a file {@link isAdrRecord} rejects, so a caller may hand it
 * any prose file.
 */
export function permanenceViolations(text: string, file: string): Violation[] {
    if (!isAdrRecord(file)) return [];

    const rawLines = text.split('\n');
    // Fence-stripped, index-preserving: a `## Decision` inside a code fence is
    // an example, not a section, and must not open a region.
    const prose = _stripFences(rawLines);
    const regions = permanenceRegions(prose);
    const ownerIntentEscape = OWNER_INTENT_ESCAPE_RE.test(_frontmatterText(rawLines));

    const violations: Violation[] = [];
    for (const region of regions) {
        // The slug is machine-visible in every citation and hyphen-joined, so
        // it takes the unconditional match and neither escape: a field cannot
        // qualify a name that tools print without reading the field.
        if (region.kind === 'slug') {
            for (let i = region.start; i <= region.end; i++) {
                for (const hit of _hits(prose[i] ?? '', [SLUG_RE])) {
                    violations.push({
                        file,
                        rule: 'permanence-language',
                        msg:
                            `line ${i + 1}: permanence language "${hit.term}" in the \`decision:\` slug — ` +
                            `${PERMANENCE_CONSEQUENCE_BOUND} (the slug takes neither escape)`,
                    });
                }
            }
            continue;
        }

        const regionText = prose.slice(region.start, region.end + 1).join('\n');
        const hasStopCondition = STOP_CONDITION_RE.test(regionText);

        for (let i = region.start; i <= region.end; i++) {
            const line = prose[i] ?? '';
            const isProseRegion = region.kind === 'decision' || region.kind === 'addendum';
            // A table cell is a per-row detail with its own rationale column,
            // not the decision statement (ADR-074's "probing forever" is a
            // failure mode being bounded, in the rationale column).
            if (isProseRegion && TABLE_ROW_RE.test(line)) continue;

            for (const hit of _hits(line, [...PROSE_WORD_RES, ...PHRASE_RES])) {
                if (_isQuotedSpan(line, hit.index)) continue;
                if (isProseRegion) {
                    if (ownerIntentEscape) continue;
                    const sentence = _sentenceAround(prose, region, i, hit.index);
                    if (NEGATION_RE.test(sentence) || CONDITIONAL_RE.test(sentence)) continue;
                    if (hasStopCondition && EXTERNAL_INVARIANT_RE.test(sentence)) continue;
                }
                violations.push({
                    file,
                    rule: 'permanence-language',
                    msg:
                        `line ${i + 1}: permanence language "${hit.term}" in the record's ${region.kind} — ` +
                        `${PERMANENCE_CONSEQUENCE_BOUND} (context: ${line.trim().slice(0, 90)})`,
                });
            }
        }
    }
    return violations;
}

// ---------------------------------------------------------------------------
// Filesystem walk + CLI
// ---------------------------------------------------------------------------

function _collectMd(absRoot: string): string[] {
    if (!fs.existsSync(absRoot)) return [];
    const st = fs.statSync(absRoot);
    if (st.isFile()) return absRoot.endsWith('.md') ? [absRoot] : [];
    const out: string[] = [];
    for (const name of fs.readdirSync(absRoot).sort()) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        out.push(..._collectMd(path.join(absRoot, name)));
    }
    return out;
}

export function lintProvenanceVocabulary(repoRoot: string = REPO_ROOT): Violation[] {
    const claimsAbs = path.join(repoRoot, CLAIMS_LEDGER_REL);
    const claimsText = fs.existsSync(claimsAbs) ? fs.readFileSync(claimsAbs, 'utf-8') : '';
    const violations: Violation[] = [];
    const files = new Set<string>();
    for (const root of SCAN_ROOTS) {
        for (const f of _collectMd(path.join(repoRoot, root))) files.add(f);
    }
    // `_collectMd` returns [] for a root that is not there, so a moved docs
    // tree turns the honesty floor into a no-op that still prints its ✅ line.
    // Counted over every markdown file walked — the banned-phrase scan reads
    // all of them, long before any approved-vocabulary filtering.
    assertScanned({
        gate: 'lint_provenance_vocabulary',
        scanned: files.size,
        units: 'prose file(s)',
        roots: SCAN_ROOTS,
    });
    for (const abs of [...files].sort()) {
        const rel = path.relative(repoRoot, abs);
        const text = fs.readFileSync(abs, 'utf-8');
        violations.push(...lintFile(text, rel, claimsText));
    }
    return violations;
}

/**
 * Rule 4 over the ADR corpus.
 *
 * Separate from {@link lintProvenanceVocabulary} because the two carry
 * different verdicts: rules 1-3 hard-fail, rule 4 is ratcheted against
 * `${PERMANENCE_GATE}` in `src/config/gate-violation-baselines.json` because
 * the corpus contains real violations today (ADR-107, ADR-108, ADR-122,
 * ADR-124, ADR-208) and a gate that lands as five instant blockers is a shape
 * this repository has refused before. A NEW record still hard-fails: the
 * ratchet only turns one way.
 */
export function lintAdrPermanence(repoRoot: string = REPO_ROOT): Violation[] {
    const records: string[] = [];
    for (const root of ADR_RECORD_ROOTS) {
        for (const abs of _collectMd(path.join(repoRoot, root))) {
            const rel = path.relative(repoRoot, abs);
            if (isAdrRecord(rel)) records.push(abs);
        }
    }
    // A `## Decision`-scoped rule that read zero ADR records would print a
    // green line while enforcing nothing — the exact failure the shared
    // scope-assert exists for.
    assertScanned({
        gate: PERMANENCE_GATE,
        scanned: records.length,
        units: 'ADR record(s)',
        roots: ADR_RECORD_ROOTS,
    });
    const violations: Violation[] = [];
    for (const abs of records.sort()) {
        const rel = path.relative(repoRoot, abs);
        violations.push(...permanenceViolations(fs.readFileSync(abs, 'utf-8'), rel));
    }
    return violations;
}

function _print(quiet: boolean, msg: string): void {
    if (!quiet) process.stdout.write(`${msg}\n`);
}

export function main(): number {
    const quiet = process.argv.slice(2).includes('--quiet');
    let violations: Violation[];
    let permanence: Violation[];
    try {
        violations = lintProvenanceVocabulary();
        permanence = lintAdrPermanence();
    } catch (e) {
        // 1 is the only failure code this gate defines, so a dead scan root and
        // a real violation share it — the message distinguishes them.
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌ ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    let failed = false;
    if (violations.length > 0) {
        for (const v of violations) {
            process.stderr.write(`❌ [${v.rule}] ${v.file}: ${v.msg}\n`);
        }
        process.stderr.write(`\n❌ provenance-vocabulary — ${violations.length} violation(s)\n`);
        failed = true;
    }

    // Rule 4 reports every finding either way: at baseline they are the known
    // debt this ratchet is walking down, and printing them is what makes the
    // next lowering possible.
    const verdict = checkRatchet({
        gate: PERMANENCE_GATE,
        actual: permanence.length,
        repoRoot: REPO_ROOT,
    });
    if (!verdict.ok) {
        for (const v of permanence) {
            process.stderr.write(`❌ [${v.rule}] ${v.file}: ${v.msg}\n`);
        }
        process.stderr.write(`\n❌ ${verdict.message}\n`);
        failed = true;
    } else if (!quiet) {
        for (const v of permanence) {
            process.stdout.write(`   [${v.rule}] ${v.file}: ${v.msg}\n`);
        }
        _print(quiet, `✅ ${verdict.message}`);
    }

    if (failed) return 1;
    _print(quiet, '✅ provenance-vocabulary — no banned phrases, every approved-term use is co-located with a valid scope box, every box figure matches docs/CLAIMS.md, no new permanence language in an ADR record');
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
