/**
 * `agent-config adr:effective ADR-NNN` — the effective state of one decision.
 *
 * Step 2.2 of `road-to-evidence-based-adr-governance`, Phase 2 — surfacing
 * only. Nothing here gates, permits, or denies anything: the verb reports what
 * a record says about itself and exits 1 only when the record contradicts its
 * OWN amendment, which is a defect in the document, never a verdict about
 * whether a transition may proceed.
 *
 * ## The defect it closes
 *
 * A long ADR is read linearly, so a reader meets whichever half comes first.
 * `adr-layout § Amendments` records the measured cost twice over: ADR-035
 * asserted in two places a rejection ADR-232 had reopened, and the contract
 * paragraph naming that failure was itself stale by the time it was read. The
 * live fixture is ADR-020, whose 2026-07-13 amendment retired the committed
 * bridge marker while its Decision still mandates writing one and its
 * Consequences still narrate it as a live failure mode.
 *
 * ## Why a declaration and not an inference
 *
 * "Which clauses did this amendment supersede" is a semantic question, and this
 * roadmap's own architecture forbids answering it by guess — an agent grading
 * its own homework is the failure round 5 refused one layer up. So the record
 * declares it, in two literals that read as prose and parse deterministically:
 *
 * ```markdown
 * ## Amendment — 2026-07-13 · bridge marker retired
 *
 * > retires: `agents/.event4u-bridge.yml`, `bridge marker`
 *
 * ... elsewhere, in the clause the amendment overtook:
 *
 * **(Superseded by the 2026-07-13 amendment — the marker is not written.)**
 * ```
 *
 * A marked clause is reported as superseded. A clause in an ASSERTIVE section
 * naming a retired token with no marker is a contradiction. Absent a `retires:`
 * declaration the verb reports amendments, axes and trigger state and claims
 * nothing about clauses — which is the honest output for the 17 other amended
 * records, not a silent pass.
 *
 * ## Why only the assertive sections
 *
 * `Context`, `Alternatives considered` and `References` describe the situation
 * as it stood when the decision was taken; a retired term appearing there is
 * the history the ADR exists to keep, not a live claim. `adr-layout` frames the
 * defect the same way — "an ADR whose top half still asserts what its own
 * amendment reversed" — so the scan covers `Decision`, `Consequences` and
 * earlier amendment blocks, and says so rather than reporting the whole file
 * and burying the three lines that matter.
 *
 * Exit codes: 0 clean · 1 a contradiction, or the ref resolved nowhere · 2 usage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    adr_files,
    amendment_blocks,
    normalise_ref,
    parse_frontmatter,
    trigger_state,
    type TriggerState,
} from '../adr_cite_check.js';
import {
    authorityBasisOf,
    evidenceOf,
    provenanceOf,
    readAdrFrontmatter,
} from '../_lib/adr_frontmatter.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');

/**
 * Sections whose clauses are read as live assertions.
 *
 * Matched on the `## ` heading's leading word so the three amendment
 * conventions in the corpus (`## Amendment N (date)`, `## Amendment — date ·
 * topic`, plus the `**Amended <date> —` inline form) all land in the set.
 */
export const ASSERTIVE_SECTIONS = ['decision', 'consequences', 'amendment'] as const;

/** `> retires: \`a\`, \`b\`` — the tokens an amendment block declares retired. */
const RETIRES_RE = /^>?\s*retires:\s*(.+)$/i;

/**
 * A clause-level supersession marker.
 *
 * `Superseded`, `Narrowed` and `Reopened` are all accepted: the corpus already
 * carries the third (`ADR-035:47`, `**(Reopened by ADR-232 — see the banner
 * above.)**`) and inventing a fourth spelling for the same act would leave that
 * marker unread by the one tool written to read markers.
 */
const CLAUSE_MARKER_RE = /\*\*\((?:Superseded|Narrowed|Reopened) by ([^—)]+?)\s*(?:—[^)]*)?\)\*\*/;

export interface AmendmentBlock {
    /** The heading line, verbatim minus the leading `#`s. */
    heading: string;
    /** 1-based line number of the heading. */
    line: number;
    /** Tokens this block declares retired, verbatim (backticks stripped). */
    retires: string[];
    /** 1-based line range the block spans, end inclusive. */
    range: [number, number];
}

export interface ClauseFinding {
    /** 1-based line number of the clause's first line. */
    line: number;
    /** The `## ` heading the clause sits under, or `(frontmatter)`. */
    section: string;
    /** The retired token, or the marker's referent for a marked clause. */
    subject: string;
    /** The clause's first line, trimmed — enough to locate it by eye. */
    excerpt: string;
}

export interface EffectiveState {
    ref: string;
    resolved: boolean;
    file?: string;
    status?: string;
    date?: string;
    decision?: string;
    provenance_kind?: string;
    evidence_strength?: string;
    evidence_discovery?: string;
    authority_basis?: string;
    review_trigger?: string;
    trigger_state: TriggerState;
    amended_by?: string;
    amendments: AmendmentBlock[];
    /** Retired tokens declared across every amendment block, deduplicated. */
    retired_tokens: string[];
    /** Clauses carrying a supersession marker. */
    superseded_clauses: ClauseFinding[];
    /** Assertive clauses naming a retired token with no marker. */
    contradictions: ClauseFinding[];
    /** The Decision section, verbatim, as the effective text to read. */
    effective_decision: string[];
}

interface Clause {
    line: number;
    section: string;
    text: string;
}

/** Strip backticks and surrounding whitespace off one declared token. */
function cleanToken(raw: string): string {
    return raw.trim().replace(/^`+|`+$/g, '').trim();
}

/** The heading a line sits under, `(preamble)` before the first one. */
function sectionOf(headings: { line: number; text: string }[], line: number): string {
    let current = '(preamble)';
    for (const h of headings) {
        if (h.line > line) break;
        current = h.text;
    }
    return current;
}

function isAssertive(section: string): boolean {
    const first = section.toLowerCase().replace(/^#+\s*/, '').split(/[\s·—-]/)[0] ?? '';
    return (ASSERTIVE_SECTIONS as readonly string[]).includes(first);
}

/**
 * Split a document body into clauses.
 *
 * A clause ends at a blank line OR at the start of the next list item, and the
 * second half is load-bearing: a run of bullets with no blank line between them
 * is one contiguous block, so paragraph-only splitting would let a marker on
 * one bullet clear the bullet below it.
 */
export function splitClauses(lines: string[], headings: { line: number; text: string }[]): Clause[] {
    const out: Clause[] = [];
    let start = -1;
    let buf: string[] = [];
    const flush = (): void => {
        if (start === -1) return;
        out.push({ line: start, section: sectionOf(headings, start), text: buf.join('\n') });
        start = -1;
        buf = [];
    };
    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i] as string;
        const num = i + 1;
        if (raw.trim() === '') {
            flush();
            continue;
        }
        if (/^\s*(?:[-*+]\s|\d+\.\s)/.test(raw)) flush();
        if (start === -1) start = num;
        buf.push(raw);
    }
    flush();
    return out;
}

/** Every `## `/`### ` heading, plus the inline `**Amended <date>` convention. */
function headingsOf(lines: string[]): { line: number; text: string }[] {
    const out: { line: number; text: string }[] = [];
    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i] as string;
        if (/^#{2,3}\s+/.test(raw)) out.push({ line: i + 1, text: raw.replace(/^#+\s*/, '').trim() });
    }
    return out;
}

/** Amendment blocks with their extents and declared retirements. */
export function amendmentsOf(lines: string[]): AmendmentBlock[] {
    const headings = headingsOf(lines);
    const out: AmendmentBlock[] = [];
    for (let h = 0; h < headings.length; h += 1) {
        const heading = headings[h] as { line: number; text: string };
        if (!/^amend/i.test(heading.text)) continue;
        const next = headings[h + 1];
        const end = next === undefined ? lines.length : next.line - 1;
        const retires: string[] = [];
        for (let i = heading.line; i < end; i += 1) {
            const m = RETIRES_RE.exec((lines[i] as string).trim());
            if (m?.[1] === undefined) continue;
            for (const part of m[1].split(',')) {
                const token = cleanToken(part);
                if (token !== '') retires.push(token);
            }
        }
        out.push({ heading: heading.text, line: heading.line, retires, range: [heading.line, end] });
    }
    return out;
}

/** The verbatim `## Decision` section, or `[]` when the record has none. */
export function decisionSection(lines: string[]): string[] {
    const headings = headingsOf(lines);
    for (let h = 0; h < headings.length; h += 1) {
        const heading = headings[h] as { line: number; text: string };
        if (!/^decision\b/i.test(heading.text)) continue;
        const next = headings[h + 1];
        const end = next === undefined ? lines.length : next.line - 1;
        return lines.slice(heading.line, end).filter((l, idx, all) => !(l.trim() === '' && all[idx + 1] === undefined));
    }
    return [];
}

/**
 * Superseded clauses and contradictions, from the declarations alone.
 *
 * A clause inside the amendment block that declares the retirement is skipped:
 * naming the thing it retires is what an amendment does.
 */
export function clauseFindings(
    lines: string[],
    amendments: AmendmentBlock[],
): { superseded: ClauseFinding[]; contradictions: ClauseFinding[] } {
    const headings = headingsOf(lines);
    const clauses = splitClauses(lines, headings);
    const superseded: ClauseFinding[] = [];
    const contradictions: ClauseFinding[] = [];

    for (const clause of clauses) {
        const marker = CLAUSE_MARKER_RE.exec(clause.text);
        const excerpt = (clause.text.split('\n')[0] ?? '').trim();
        if (marker?.[1] !== undefined) {
            superseded.push({
                line: clause.line,
                section: clause.section,
                subject: marker[1].trim(),
                excerpt,
            });
            continue;
        }
        if (!isAssertive(clause.section)) continue;
        for (const amendment of amendments) {
            const inDeclaringBlock =
                clause.line >= amendment.range[0] && clause.line <= amendment.range[1];
            if (inDeclaringBlock) continue;
            for (const token of amendment.retires) {
                if (!clause.text.includes(token)) continue;
                contradictions.push({
                    line: clause.line,
                    section: clause.section,
                    subject: token,
                    excerpt,
                });
                break;
            }
        }
    }
    return { superseded, contradictions };
}

/** Resolve one reference to a decision file on a scanned surface. */
export function resolveAdrFile(ref: string, repoRoot: string): string | null {
    const parsed = normalise_ref(ref);
    if (parsed === null) return null;
    const files = adr_files(repoRoot);
    const { area, num } = parsed;
    const match =
        area === null
            ? files.find((f) => new RegExp(`(^|/)ADR-0*${num}[-.]`, 'i').test(f))
            : files.find((f) => new RegExp(`/docs/adrs/${area}/0*${String(Number(num))}-`, 'i').test(f));
    return match ?? null;
}

export function effectiveState(ref: string, repoRoot: string = REPO_ROOT): EffectiveState {
    const parsed = normalise_ref(ref);
    const id = parsed?.id ?? ref;
    const match = resolveAdrFile(ref, repoRoot);
    if (match === null) {
        return {
            ref: id,
            resolved: false,
            trigger_state: 'none',
            amendments: [],
            retired_tokens: [],
            superseded_clauses: [],
            contradictions: [],
            effective_decision: [],
        };
    }

    const text = fs.readFileSync(match, 'utf-8');
    const scalars = parse_frontmatter(text) ?? {};
    const structured = readAdrFrontmatter(text);
    const provenance = structured === null ? null : provenanceOf(structured);
    const evidence = structured === null ? null : evidenceOf(structured);
    const basis = structured === null ? null : authorityBasisOf(structured);

    const bodyStart = text.indexOf('\n---\n', 4);
    const frontmatterLines = bodyStart === -1 ? 0 : text.slice(0, bodyStart + 5).split('\n').length - 1;
    const lines = text.split('\n');
    const amendments = amendmentsOf(lines).filter((a) => a.line > frontmatterLines);
    const { superseded, contradictions } = clauseFindings(lines, amendments);
    const retired = [...new Set(amendments.flatMap((a) => a.retires))];

    return {
        ref: id,
        resolved: true,
        file: path.relative(repoRoot, match),
        ...(scalars['status'] !== undefined ? { status: scalars['status'] } : {}),
        ...(scalars['date'] !== undefined ? { date: scalars['date'] } : {}),
        ...(scalars['decision'] !== undefined ? { decision: scalars['decision'] } : {}),
        ...(provenance?.kind != null ? { provenance_kind: provenance.kind } : {}),
        ...(evidence?.strength != null ? { evidence_strength: evidence.strength } : {}),
        ...(evidence?.discovery != null ? { evidence_discovery: evidence.discovery } : {}),
        ...(basis !== null ? { authority_basis: basis } : {}),
        ...(scalars['review_trigger'] !== undefined && scalars['review_trigger'] !== ''
            ? { review_trigger: scalars['review_trigger'] }
            : {}),
        trigger_state: trigger_state(scalars),
        ...(scalars['amended_by'] !== undefined && scalars['amended_by'] !== '—'
            ? { amended_by: scalars['amended_by'] }
            : {}),
        amendments,
        retired_tokens: retired,
        superseded_clauses: superseded,
        contradictions,
        effective_decision: decisionSection(lines),
    };
}

export function render(state: EffectiveState): string[] {
    const out: string[] = [];
    out.push(`${state.ref}${state.file !== undefined ? `  ·  ${state.file}` : ''}`);
    if (!state.resolved) {
        out.push('  ❌  UNRESOLVED — no decision record carries this number on a scanned surface.');
        return out;
    }
    out.push(`  status           ${state.status ?? '—'}   date ${state.date ?? '—'}`);
    if (state.decision !== undefined) out.push(`  decision         ${state.decision}`);
    out.push(`  provenance       ${state.provenance_kind ?? '— (no provenance axis)'}`);
    out.push(
        `  evidence         ${state.evidence_strength ?? '— (ungraded)'}` +
            `  ·  discovery ${state.evidence_discovery ?? '—'}`,
    );
    out.push(`  authority_basis  ${state.authority_basis ?? '— (absent → evidence)'}`);
    out.push(`  review_trigger   ${state.review_trigger ?? '— (none recorded)'}`);
    out.push(`  trigger state    ${state.trigger_state}`);
    if (state.amended_by !== undefined) out.push(`  amended_by       ${state.amended_by}`);

    out.push('', '  active amendments');
    if (state.amendments.length === 0) {
        out.push('    — none in the body');
    } else {
        for (const a of state.amendments) {
            const declares =
                a.retires.length > 0 ? `  ·  retires ${a.retires.map((t) => `\`${t}\``).join(', ')}` : '';
            out.push(`    :${String(a.line)}  ${a.heading}${declares}`);
        }
    }

    out.push('', '  superseded clauses');
    if (state.retired_tokens.length === 0 && state.superseded_clauses.length === 0) {
        out.push('    — no amendment declares a `retires:` list and no clause carries a marker,');
        out.push('      so nothing is claimed about this record\'s clauses. Read the amendments.');
    } else if (state.superseded_clauses.length === 0) {
        out.push('    — none marked');
    } else {
        for (const c of state.superseded_clauses) {
            out.push(`    :${String(c.line)}  ${c.section} — superseded by ${c.subject}`);
            out.push(`             ${c.excerpt}`);
        }
    }

    out.push('', '  effective decision');
    if (state.effective_decision.length === 0) {
        out.push('    — no `## Decision` section');
    } else {
        for (const line of state.effective_decision) out.push(`    ${line}`);
    }

    if (state.contradictions.length > 0) {
        out.push('', '  ❌  current-vs-amendment contradiction');
        for (const c of state.contradictions) {
            out.push(`    :${String(c.line)}  ${c.section} asserts \`${c.subject}\`, which an`);
            out.push('             amendment on this record declares retired, and carries no marker.');
            out.push(`             ${c.excerpt}`);
        }
    }
    return out;
}

interface ParsedArgv {
    ok: boolean;
    message?: string;
    refs?: string[];
    json?: boolean;
}

export function parseArgv(argv: readonly string[]): ParsedArgv {
    let json = false;
    const refs: string[] = [];
    for (const a of argv) {
        if (a === '--json') json = true;
        else if (a === '-h' || a === '--help')
            return { ok: false, message: 'usage: agent-config adr:effective <ADR-NNN> [ADR-NNN …] [--json]' };
        else if (a.startsWith('--')) return { ok: false, message: `unknown argument: ${a}` };
        else refs.push(a);
    }
    if (refs.length === 0)
        return { ok: false, message: 'usage: agent-config adr:effective <ADR-NNN> [ADR-NNN …] [--json]' };
    return { ok: true, refs, json };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseArgv(argv);
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message ?? 'usage error'}\n`);
        return 2;
    }
    const states = (parsed.refs ?? []).map((ref) => effectiveState(ref));
    if (parsed.json === true) {
        process.stdout.write(`${JSON.stringify(states, null, 2)}\n`);
    } else {
        for (const state of states) {
            for (const line of render(state)) process.stdout.write(`${line}\n`);
            process.stdout.write('\n');
        }
    }
    const bad = states.filter((s) => !s.resolved || s.contradictions.length > 0);
    return bad.length > 0 ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
