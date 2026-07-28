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
 *
 * Scan surfaces: README.md + every `docs/**\/*.md` file (recursive). No
 * marketing/install-output text file carries this vocabulary today — this is
 * the single place to widen SCAN_ROOTS when one does.
 *
 * Exit codes: 0 clean · 1 violations found.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
    for (const abs of [...files].sort()) {
        const rel = path.relative(repoRoot, abs);
        const text = fs.readFileSync(abs, 'utf-8');
        violations.push(...lintFile(text, rel, claimsText));
    }
    return violations;
}

function _print(quiet: boolean, msg: string): void {
    if (!quiet) process.stdout.write(`${msg}\n`);
}

export function main(): number {
    const quiet = process.argv.slice(2).includes('--quiet');
    const violations = lintProvenanceVocabulary();
    if (violations.length > 0) {
        for (const v of violations) {
            process.stderr.write(`❌ [${v.rule}] ${v.file}: ${v.msg}\n`);
        }
        process.stderr.write(`\n❌ provenance-vocabulary — ${violations.length} violation(s)\n`);
        return 1;
    }
    _print(quiet, '✅ provenance-vocabulary — no banned phrases, every approved-term use is co-located with a valid scope box, every box figure matches docs/CLAIMS.md');
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
