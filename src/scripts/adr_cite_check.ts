#!/usr/bin/env tsx
/**
 * ADR cite-check — evaluate a decision BEFORE citing it as a reason not to act.
 *
 * The defect this closes is one of ordering, not of permission. Measured across
 * 26 days of transcripts: in at least 13 passages a change was parked or refused
 * citing a named ADR, and in zero cases did the agent refuse an explicit
 * overturn instruction. The lock held, the owner had to notice and void it
 * retroactively, and only then did the work resume. Nothing in the tree turned
 * "this ADR blocks the change" into "is this ADR still true?".
 *
 * So this tool answers exactly that question, and only from what is mechanically
 * decidable:
 *
 *   - **status** — a `superseded` / `deprecated` ADR is not a live lock at all.
 *     This alone resolves a class of blockage with certainty. `rejected` is
 *     deliberately excluded: on an ADR it records a rejected PROPOSAL, so the
 *     rejection is the live decision.
 *   - **successors and predecessors** — `superseded_by` / `supersedes`, plus the
 *     `amended_by` / `amends` pair.
 *   - **amendment blocks in the body** — three unreconciled conventions exist in
 *     the corpus, so all three are matched.
 *   - **back-references** — other ADRs that name this one. A decision reopened
 *     by a later ADR that never linked back is invisible from the ADR's own file
 *     (measured: ADR-035 still asserts a rejection ADR-232 reopened).
 *   - **review_trigger** — verbatim, plus a state.
 *
 * `indeterminate` is a FIRST-CLASS trigger result, not a failure. Every
 * `review_trigger` in the corpus is a semantic condition ("reopen when the
 * capacity premise changes", "if a fifth band appears"), so forcing them to a
 * boolean would convert uncertainty into either permission or blockage. Both
 * council seats (2026-08-19) independently rejected building a machine-readable
 * trigger grammar as a prerequisite for exactly this reason. An `indeterminate`
 * result means: this may not be presented as an unqualified lock — route it.
 *
 * Usage:
 *   ./scripts-run src/scripts/adr_cite_check ADR-211
 *   ./scripts-run src/scripts/adr_cite_check ADR-001 ADR-035 --json
 *
 * Exit codes: 0 every reference resolved · 1 at least one did not · 2 usage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');

/**
 * The surfaces a decision can live on. Six exist in this tree; this tool reads
 * the two that carry numbered ADRs and can therefore be cited as `ADR-NNN`.
 *
 * Deliberately NOT covered, stated rather than silently skipped:
 * `docs/contracts/adr-*.md` (15 files) and `agents/settings/contexts/adr-*.md`
 * (6) are named-slug contracts with their own status vocabulary (`Decided`,
 * `locked`) and no ADR number, so a numeric reference can never resolve to one;
 * `agents/decisions/` is a ledger of rows, not of files. A tool that silently
 * saw one of six surfaces would report a real lock as unknown, which reads as
 * "no constraint" and is worse than the stall it replaces — so the gap is
 * printed in `--json` under `surfaces_not_scanned` and named here.
 *
 * The per-area surface took two passes to get honest. Its files are
 * `<area>/NNNN-<slug>.md` with no `ADR-` prefix, so the flat filename pattern
 * could never match one — the directory was listed as scanned and resolved
 * nothing, which is the same false "not found" the paragraph above warns
 * about, committed by this very file. It resolves by path and by the
 * `ADR-<area>-NNNN` citation form now; a BARE number still cannot address one,
 * because per-area numbering restarts per area and five files here are `0001`.
 * See `PARTIAL_COVERAGE` for what a per-area hit does and does not carry.
 */
export const ADR_DIRS = ['docs/decisions', 'docs/adrs'] as const;

export const SURFACES_NOT_SCANNED = [
    'docs/contracts/adr-*.md — slug-named contracts, no ADR number to resolve against',
    'agents/settings/contexts/adr-*.md — shadow notes, own status vocabulary',
    'agents/decisions/ — row ledger, not per-decision files',
] as const;

/**
 * Partial coverage, stated because a silent partial is the failure this tool
 * exists to avoid: `docs/adrs/<area>/` resolves by PATH and by the
 * `ADR-<area>-NNNN` citation form, but those files carry a quote-block header
 * rather than YAML frontmatter, so `status` / `review_trigger` / the link
 * fields read as absent. A per-area result is an accurate location and an
 * honestly empty metadata set — never a claim that the fields are empty in the
 * document.
 */
export const PARTIAL_COVERAGE = [
    'docs/adrs/<area>/ — resolves, but the header is a quote block, not YAML: metadata reads empty',
] as const;

/** A trigger state. `none` means the ADR never recorded a reopen condition. */
export type TriggerState = 'none' | 'indeterminate' | 'fired' | 'not-fired';

export interface CiteResult {
    ref: string;
    resolved: boolean;
    file?: string;
    status?: string;
    date?: string;
    decision?: string;
    review_trigger?: string;
    trigger_state: TriggerState;
    supersedes?: string;
    superseded_by?: string;
    amends?: string;
    amended_by?: string;
    /** Amendment headings found in the body, any of the three conventions. */
    amendment_blocks: string[];
    /** Other ADR files whose text names this one. */
    referenced_by: string[];
    /** Why this may or may not be cited as a live lock. */
    verdict: string;
}

/**
 * A parsed citation. `area` is null for the flat surface.
 *
 * Per-area numbering restarts at `0001` inside every area, so a bare number
 * cannot address one: five files in this tree are `0001`. A per-area citation
 * must therefore name its area — `ADR-cost-0001`, the form `adr-layout.md`
 * already specifies for cross-surface `supersedes:` values.
 */
export interface ParsedRef {
    id: string;
    area: string | null;
    num: string;
}

/**
 * `ADR-211` · `adr-211` · `211` · a path → the flat surface.
 * `ADR-cost-0001` · a `docs/adrs/<area>/NNNN-…` path → that area.
 */
export function normalise_ref(ref: string): ParsedRef | null {
    const raw = ref.trim();

    // A per-area path carries its area in the directory, and its file never
    // has an `ADR-` prefix — `docs/adrs/cost/0001-hard-stop-hook.md`.
    const byPath = /(?:^|\/)docs\/adrs\/([a-z0-9-]+)\/(\d{1,4})-/i.exec(raw);
    if (byPath?.[1] !== undefined && byPath[2] !== undefined) {
        const num = byPath[2].padStart(4, '0');
        return { id: `ADR-${byPath[1]}-${num}`, area: byPath[1], num };
    }

    // `ADR-<area>-NNNN` — the citation form for a per-area decision.
    const byArea = /^adr-([a-z][a-z0-9-]*?)-(\d{1,4})$/i.exec(raw.replace(/\.md$/i, ''));
    if (byArea?.[1] !== undefined && byArea[2] !== undefined) {
        const area = byArea[1].toLowerCase();
        const num = byArea[2].padStart(4, '0');
        return { id: `ADR-${area}-${num}`, area, num };
    }

    const m = /(?:^|[^0-9])(\d{1,4})(?:[^0-9]|$)/.exec(raw.replace(/^.*\//, ''));
    if (m?.[1] === undefined) return null;
    return { id: `ADR-${m[1].padStart(3, '0')}`, area: null, num: String(Number(m[1])) };
}

function walk_md(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk_md(full));
        // INDEX.md is generated FROM these files and names every one of them, so
        // leaving it in makes every ADR look referenced by one more decision
        // than it is — noise that hides the single real back-reference.
        else if (entry.name.endsWith('.md') && entry.name !== 'INDEX.md') out.push(full);
    }
    return out.sort();
}

/** Every candidate decision file across the scanned surfaces. */
export function adr_files(repo_root: string = REPO_ROOT): string[] {
    return ADR_DIRS.flatMap((d) => walk_md(path.join(repo_root, d)));
}

/**
 * Minimal frontmatter reader — folded (`>-`) values are joined, which the
 * corpus needs: every `review_trigger` in it is a folded multi-line string.
 */
export function parse_frontmatter(text: string): Record<string, string> | null {
    if (!text.startsWith('---\n')) return null;
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return null;
    const out: Record<string, string> = {};
    let key: string | null = null;
    for (const raw of text.slice(4, end).split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.trimStart().startsWith('#')) continue;
        if (/^\s/.test(line) && key !== null) {
            out[key] = `${out[key]} ${line.trim()}`.trim();
            continue;
        }
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        key = line.slice(0, idx).trim();
        out[key] = line
            .slice(idx + 1)
            .trim()
            .replace(/^["'](.*)["']$/, '$1')
            .replace(/^>-?$/, '');
    }
    return out;
}

/**
 * The three amendment conventions the corpus actually uses. No convention is
 * canonical yet, so all three are matched rather than one being assumed.
 */
export function amendment_blocks(body: string): string[] {
    const found: string[] = [];
    for (const line of body.split('\n')) {
        if (/^#{2,3}\s+Amendment\b/i.test(line) || /^\*\*Amended\b/i.test(line)) {
            found.push(line.trim().replace(/^#+\s*/, '').replace(/\*\*/g, ''));
        }
    }
    return found;
}

/**
 * A trigger's state, from what is mechanically decidable and nothing else.
 *
 * There is no clause that returns `fired` or `not-fired` from prose, and that
 * absence is the design: every trigger in the corpus is semantic. The states
 * exist in the type because a future structured trigger can carry them; today
 * the honest answers are `none` and `indeterminate`.
 */
export function trigger_state(fm: Record<string, string>): TriggerState {
    const t = (fm['review_trigger'] ?? '').trim();
    if (t === '') return 'none';
    return 'indeterminate';
}

/** The one-line answer to "may I cite this as a reason not to act?". */
export function verdict_for(r: Omit<CiteResult, 'verdict'>): string {
    if (!r.resolved) return 'UNRESOLVED — no ADR file carries this number on a scanned surface.';
    const status = (r.status ?? '').toLowerCase();
    // `rejected` is deliberately NOT in this set. On an ADR it means "the
    // proposal was rejected" — the record is a LIVE lock stating that
    // rejection, not a dead decision. Folding it in with `superseded` would
    // make the tool clear a lock that still binds, which is a worse failure
    // than the stall it replaces. Found by running this tool over the eleven
    // ADRs the transcripts show blocking work: ADR-054 came back "not a live
    // lock" and it is one.
    if (status === 'superseded' || status === 'deprecated') {
        const by = r.superseded_by !== undefined && r.superseded_by !== '—' ? ` (by ${r.superseded_by})` : '';
        return `NOT A LIVE LOCK — status is \`${status}\`${by}. Citing it as a blocker is a stale-state claim.`;
    }
    if (status === 'rejected') {
        return (
            'LIVE — status `rejected` records a REJECTED PROPOSAL, so the rejection is the ' +
            'decision and it still binds. Reopening it means showing the premise it rejected on ' +
            'has changed; it does not mean the record is stale.'
        );
    }
    if (r.amendment_blocks.length > 0 || (r.amended_by !== undefined && r.amended_by !== '—')) {
        return 'AMENDED — read the amendment before citing the original decision; the text above it may no longer hold.';
    }
    if (r.trigger_state === 'none') {
        return 'LIVE, NO REOPEN CONDITION — the ADR records no `review_trigger`, so nothing would ever reopen it on its own. Treat that as a defect in the ADR, not as strength of the lock.';
    }
    return 'LIVE, TRIGGER INDETERMINATE — the reopen condition is semantic and this tool cannot decide it. Not an unqualified lock: evaluate the condition against the current tree and route the result.';
}

export function cite_check(refs: string[], repo_root: string = REPO_ROOT): CiteResult[] {
    const files = adr_files(repo_root);
    const contents = new Map<string, string>();
    for (const f of files) contents.set(f, fs.readFileSync(f, 'utf-8'));

    return refs.map((ref) => {
        const parsed = normalise_ref(ref);
        if (parsed === null) {
            const empty: Omit<CiteResult, 'verdict'> = {
                ref,
                resolved: false,
                trigger_state: 'none',
                amendment_blocks: [],
                referenced_by: [],
            };
            return { ...empty, verdict: verdict_for(empty) };
        }
        const { id, area, num } = parsed;

        // Two filename conventions, and the flat one's `ADR-` prefix is exactly
        // what a per-area file does NOT have (`docs/adrs/cost/0001-…`). Matching
        // both against one pattern was the defect: the tool advertised
        // `docs/adrs` as covered and could never resolve a citation to it.
        const match =
            area === null
                ? files.find((f) => new RegExp(`(^|/)ADR-0*${num}[-.]`, 'i').test(f))
                : files.find((f) =>
                      new RegExp(`/docs/adrs/${area}/0*${Number(num)}-`, 'i').test(f),
                  );
        if (match === undefined) {
            const empty: Omit<CiteResult, 'verdict'> = {
                ref: id,
                resolved: false,
                trigger_state: 'none',
                amendment_blocks: [],
                referenced_by: [],
            };
            return { ...empty, verdict: verdict_for(empty) };
        }

        const text = contents.get(match) ?? '';
        const fm = parse_frontmatter(text) ?? {};
        const bodyStart = text.indexOf('\n---\n', 4);
        const body = bodyStart === -1 ? text : text.slice(bodyStart + 5);

        // Back-references: any OTHER decision file naming this number. This is
        // the only way to see a one-sided reopen — the amending ADR links back,
        // the amended one does not.
        // A per-area decision is cited as `ADR-<area>-NNNN`; a flat one by number.
        const cited =
            area === null
                ? new RegExp(`ADR-0*${num}\\b`, 'i')
                : new RegExp(`ADR-${area}-0*${Number(num)}\\b`, 'i');
        const referenced_by = files
            .filter((f) => f !== match && cited.test(contents.get(f) ?? ''))
            .map((f) => path.relative(repo_root, f));

        const partial: Omit<CiteResult, 'verdict'> = {
            ref: id,
            resolved: true,
            file: path.relative(repo_root, match),
            ...(fm['status'] !== undefined ? { status: fm['status'] } : {}),
            ...(fm['date'] !== undefined ? { date: fm['date'] } : {}),
            ...(fm['decision'] !== undefined ? { decision: fm['decision'] } : {}),
            ...(fm['review_trigger'] !== undefined && fm['review_trigger'] !== ''
                ? { review_trigger: fm['review_trigger'] }
                : {}),
            trigger_state: trigger_state(fm),
            ...(fm['supersedes'] !== undefined ? { supersedes: fm['supersedes'] } : {}),
            ...(fm['superseded_by'] !== undefined ? { superseded_by: fm['superseded_by'] } : {}),
            ...(fm['amends'] !== undefined ? { amends: fm['amends'] } : {}),
            ...(fm['amended_by'] !== undefined ? { amended_by: fm['amended_by'] } : {}),
            amendment_blocks: amendment_blocks(body),
            referenced_by,
        };
        return { ...partial, verdict: verdict_for(partial) };
    });
}

function render(results: CiteResult[]): string {
    const lines: string[] = [];
    for (const r of results) {
        lines.push(`\n${r.ref}${r.file !== undefined ? `  ·  ${r.file}` : ''}`);
        if (!r.resolved) {
            lines.push(`  ❌  ${r.verdict}`);
            continue;
        }
        lines.push(`  status           ${r.status ?? '—'}   date ${r.date ?? '—'}`);
        if (r.decision !== undefined) lines.push(`  decision         ${r.decision}`);
        lines.push(`  review_trigger   ${r.review_trigger ?? '— (none recorded)'}`);
        lines.push(`  trigger state    ${r.trigger_state}`);
        if (r.supersedes !== undefined && r.supersedes !== '—') lines.push(`  supersedes       ${r.supersedes}`);
        if (r.superseded_by !== undefined && r.superseded_by !== '—')
            lines.push(`  superseded_by    ${r.superseded_by}`);
        if (r.amends !== undefined && r.amends !== '—') lines.push(`  amends           ${r.amends}`);
        if (r.amended_by !== undefined && r.amended_by !== '—') lines.push(`  amended_by       ${r.amended_by}`);
        if (r.amendment_blocks.length > 0)
            lines.push(`  amendments       ${String(r.amendment_blocks.length)}: ${r.amendment_blocks.join(' · ')}`);
        if (r.referenced_by.length > 0)
            lines.push(`  referenced by    ${String(r.referenced_by.length)} other ADR(s): ${r.referenced_by.join(', ')}`);
        lines.push(`  →  ${r.verdict}`);
    }
    return lines.join('\n');
}

function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    const refs = argv.filter((a) => !a.startsWith('--'));
    if (refs.length === 0) {
        process.stderr.write(
            'usage: adr_cite_check <ADR-NNN> [ADR-NNN …] [--json]\n' +
                '       evaluate a decision before citing it as a reason not to act\n',
        );
        return 2;
    }

    const results = cite_check(refs);
    if (as_json) {
        process.stdout.write(
            JSON.stringify(
                {
                    results,
                    surfaces_not_scanned: SURFACES_NOT_SCANNED,
                    partial_coverage: PARTIAL_COVERAGE,
                },
                null,
                2,
            ) + '\n',
        );
    } else {
        process.stdout.write(render(results) + '\n');
    }

    const unresolved = results.filter((r) => !r.resolved);
    if (unresolved.length > 0) {
        process.stderr.write(
            `\n❌  ${String(unresolved.length)} reference(s) did not resolve on a scanned surface. ` +
                `Not scanned: ${SURFACES_NOT_SCANNED.join(' · ')}\n`,
        );
        return 1;
    }
    return 0;
}

// Main-guard (realpath-compared, mirrors the repo convention).
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
