#!/usr/bin/env tsx
/**
 * Harvest-ledger linter — the knowledge-side sibling of lint_provenance.ts.
 *
 * `provenance/borrows.jsonl` records borrowed CODE. `provenance/harvests.jsonl`
 * records borrowed IDEAS: an externally-sourced heuristic, number, or mechanism
 * that some skill, rule, or roadmap in this tree now asserts as doctrine. The
 * `code-provenance` rule binds the obligation — cite a `harvest_id` or label the
 * statement as own analysis — and this gate audits the ledger that obligation
 * points at.
 *
 * Like its sibling it is strict from day one, because it checks OUR OWN RECORDS
 * rather than running a similarity detector: a malformed row is a defect in the
 * record, not a probabilistic call. And like its sibling it CANNOT catch an
 * unrecorded harvest — no gate can see a citation nobody wrote. Saying so here
 * is deliberate; claiming otherwise would inflate the coverage this repo
 * reports.
 *
 * Naming, stated because the collision is live: `check_claims.ts` and
 * `docs/CLAIMS.md` also use the word "claim", for the opposite direction of
 * travel — public claims this package makes ABOUT ITSELF. This gate is named
 * after `lint_provenance`, its actual sibling, so a reader who greps either
 * name lands in the right family.
 *
 * Checks:
 *   1. Schema — the closed 6-field shape (harvest_id, stated_in, source_ref,
 *      evidence_locator, harvested_at, verdict), every field format-checked.
 *   2. Uniqueness — a duplicate harvest_id makes a citation ambiguous.
 *   3. Dead rows — every `stated_in` path exists and stays inside the repo.
 *   4. Pinning — `source_ref` carries a revision or is explicitly opaque; a
 *      bare URL is rejected because it cannot be re-verified later.
 *   5. Orphan citations — every `<!-- harvest:<id> -->` marker under the
 *      scanned roots resolves to a ledger row.
 *
 * An EMPTY ledger with zero markers is a legitimate pass and is reported as
 * such on stdout. A gate that scans nothing and exits green silently is
 * indistinguishable from a broken one, so the green path always prints what it
 * actually examined.
 *
 * Usage:
 *     ./scripts-run src/scripts/lint_harvest_provenance
 *     ./scripts-run src/scripts/lint_harvest_provenance --quiet
 *
 * Exit codes: 0 = clean · 2 = any finding OR usage error (mirrors
 * lint_provenance — both mean "this run produced nothing trustworthy").
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _FILE = fileURLToPath(import.meta.url);
const _HERE = path.dirname(_FILE);
// src/scripts/lint_harvest_provenance.ts → two levels up is the repo root.
const REPO = path.resolve(_HERE, '..', '..');
const LEDGER_REL = 'provenance/harvests.jsonl';

/** Roots scanned for citation markers. Markdown-bearing authored surfaces. */
export const CITATION_SCAN_ROOTS: readonly string[] = [
    'src/skills',
    'src/rules',
    'src/agent-src',
    'src/domains',
    'agents/roadmaps',
];

// ─── field formats ───────────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
    'harvest_id', 'stated_in', 'source_ref', 'evidence_locator',
    'harvested_at', 'verdict',
] as const;
const VERDICT_VALUES: ReadonlySet<string> = new Set(['adopt', 'adapt']);
const HARVEST_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EVIDENCE_MIN_LENGTH = 3;

/**
 * A pinned public source: any http(s) or git URL carrying an `@<revision>`
 * suffix. The revision is 7-64 hex chars — the same shape `borrows.jsonl`
 * accepts for `source_sha`, kept identical so the two ledgers do not disagree
 * about what "pinned" means.
 */
const PINNED_URL_RE = /^(https?:\/\/\S+|git@\S+)@[0-9a-fA-F]{7,64}$/;
/** An opaque reference, for a source `source-confidentiality` keeps untracked. */
const OPAQUE_REF_RE = /^(opaque:[\w.-]+|ENC1:\S+)$/;

/** Citation marker as it appears in an authored artefact. */
export const CITATION_MARKER_RE = /<!--\s*harvest:([a-z0-9-]+)\s*-->/g;

// ─── types ───────────────────────────────────────────────────────────────────

export interface HarvestRecord {
    readonly harvest_id: string;
    readonly stated_in: string;
    readonly source_ref: string;
    readonly evidence_locator: string;
    readonly harvested_at: string;
    readonly verdict: 'adopt' | 'adapt';
}

export interface Finding {
    /** Ledger line number, or 0 for findings that belong to no single row. */
    readonly line: number;
    readonly rule: 'schema' | 'uniqueness' | 'dead-row' | 'pinning' | 'orphan-citation';
    readonly message: string;
}

function isValidCalendarDate(s: string): boolean {
    if (!ISO_DATE_RE.test(s)) return false;
    const [y, mo, d] = s.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Strip an optional `:<line>` suffix from a `stated_in` value. */
export function stripLineSuffix(statedIn: string): string {
    const m = /^(.*):(\d+)$/.exec(statedIn);
    return m ? (m[1] as string) : statedIn;
}

// ─── record validation ───────────────────────────────────────────────────────

/** Validate one parsed ledger line against the closed schema. */
export function validateRecord(raw: unknown, line: number, repoRoot: string): Finding[] {
    const findings: Finding[] = [];

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return [{ line, rule: 'schema', message: 'record is not a JSON object' }];
    }
    const rec = raw as Record<string, unknown>;

    for (const k of Object.keys(rec)) {
        if (!(REQUIRED_FIELDS as readonly string[]).includes(k)) {
            findings.push({
                line,
                rule: 'schema',
                message: `unexpected field '${k}' — the ledger schema is closed to exactly [${REQUIRED_FIELDS.join(', ')}]`,
            });
        }
    }
    for (const k of REQUIRED_FIELDS) {
        if (!(k in rec)) {
            findings.push({ line, rule: 'schema', message: `missing required field '${k}'` });
        }
    }

    if ('harvest_id' in rec && (typeof rec.harvest_id !== 'string' || !HARVEST_ID_RE.test(rec.harvest_id))) {
        findings.push({
            line,
            rule: 'schema',
            message: `harvest_id must be a kebab-case slug, got ${JSON.stringify(rec.harvest_id)}`,
        });
    }

    if ('stated_in' in rec) {
        if (typeof rec.stated_in !== 'string' || rec.stated_in.trim().length === 0) {
            findings.push({ line, rule: 'schema', message: 'stated_in must be a non-empty repo-relative path' });
        } else {
            const rel = stripLineSuffix(rec.stated_in);
            const resolved = path.resolve(repoRoot, rel);
            const withinRepo = resolved === repoRoot || resolved.startsWith(repoRoot + path.sep);
            if (path.isAbsolute(rel) || !withinRepo) {
                findings.push({
                    line,
                    rule: 'schema',
                    message: `stated_in '${rel}' escapes the repo root — must be a repo-relative path`,
                });
            } else if (!fs.existsSync(resolved)) {
                findings.push({
                    line,
                    rule: 'dead-row',
                    message: `stated_in '${rel}' does not exist — the artefact asserting this harvest is gone, so the row cites nothing`,
                });
            }
        }
    }

    if ('source_ref' in rec) {
        const ref = rec.source_ref;
        if (typeof ref !== 'string' || ref.trim().length === 0) {
            findings.push({ line, rule: 'schema', message: 'source_ref must be a non-empty string' });
        } else if (!PINNED_URL_RE.test(ref) && !OPAQUE_REF_RE.test(ref)) {
            findings.push({
                line,
                rule: 'pinning',
                message:
                    `source_ref ${JSON.stringify(ref)} is neither a revision-pinned URL ('<url>@<sha>') ` +
                    "nor an opaque token ('opaque:<id>' / 'ENC1:<payload>'). An unpinned reference cannot be " +
                    're-verified later, which is the whole point of recording it',
            });
        }
    }

    if ('evidence_locator' in rec) {
        const loc = rec.evidence_locator;
        if (typeof loc !== 'string' || loc.trim().length < EVIDENCE_MIN_LENGTH) {
            findings.push({
                line,
                rule: 'schema',
                message: `evidence_locator must be at least ${EVIDENCE_MIN_LENGTH} characters — a claim whose evidence cannot be located again is not a citation`,
            });
        }
    }

    if ('harvested_at' in rec && !(typeof rec.harvested_at === 'string' && isValidCalendarDate(rec.harvested_at))) {
        findings.push({
            line,
            rule: 'schema',
            message: `harvested_at must be an ISO-8601 date (YYYY-MM-DD), got ${JSON.stringify(rec.harvested_at)}`,
        });
    }

    if ('verdict' in rec && (typeof rec.verdict !== 'string' || !VERDICT_VALUES.has(rec.verdict))) {
        findings.push({
            line,
            rule: 'schema',
            message:
                `verdict must be 'adopt' or 'adapt', got ${JSON.stringify(rec.verdict)} — a reject/already/unclear ` +
                'finding has no artefact citing it and belongs in the analysis document, not the ledger',
        });
    }

    return findings;
}

// ─── ledger parsing ──────────────────────────────────────────────────────────

export interface ParsedLine {
    readonly line: number;
    readonly value: unknown;
}

/** Split jsonl text into non-blank lines, parsing each as JSON. */
export function parseLedgerText(text: string): { readonly parsed: ParsedLine[]; readonly findings: Finding[] } {
    const parsed: ParsedLine[] = [];
    const findings: Finding[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = (lines[i] ?? '').trim();
        if (raw.length === 0) continue;
        try {
            parsed.push({ line: i + 1, value: JSON.parse(raw) });
        } catch (err) {
            findings.push({ line: i + 1, rule: 'schema', message: `invalid JSON: ${(err as Error).message}` });
        }
    }
    return { parsed, findings };
}

/** Parse + validate every line, then check cross-row uniqueness. */
export function lintLedgerText(
    text: string,
    repoRoot: string,
): { readonly records: HarvestRecord[]; readonly findings: Finding[] } {
    const { parsed, findings } = parseLedgerText(text);
    const records: HarvestRecord[] = [];
    const seen = new Map<string, number>();

    for (const { line, value } of parsed) {
        const recordFindings = validateRecord(value, line, repoRoot);
        findings.push(...recordFindings);
        if (recordFindings.length > 0) continue;

        const rec = value as HarvestRecord;
        const prior = seen.get(rec.harvest_id);
        if (prior !== undefined) {
            findings.push({
                line,
                rule: 'uniqueness',
                message: `duplicate harvest_id '${rec.harvest_id}' (first seen on line ${prior}) — a citation must resolve to exactly one row`,
            });
            continue;
        }
        seen.set(rec.harvest_id, line);
        records.push(rec);
    }
    return { records, findings };
}

// ─── citation scan ───────────────────────────────────────────────────────────

export interface Citation {
    readonly id: string;
    readonly file: string;
}

/** Recursively collect markdown files under a root. */
function collectMarkdown(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
            collectMarkdown(full, out);
        } else if (e.isFile() && e.name.endsWith('.md')) {
            out.push(full);
        }
    }
}

/** Find every `<!-- harvest:<id> -->` marker under the scan roots. */
export function collectCitations(repoRoot: string, roots: readonly string[] = CITATION_SCAN_ROOTS): Citation[] {
    const files: string[] = [];
    for (const r of roots) collectMarkdown(path.join(repoRoot, r), files);

    const citations: Citation[] = [];
    for (const f of files) {
        let text: string;
        try {
            text = fs.readFileSync(f, 'utf-8');
        } catch {
            continue;
        }
        // Fresh lastIndex per file — the regex is module-level and /g is stateful.
        const re = new RegExp(CITATION_MARKER_RE.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            citations.push({ id: m[1] as string, file: path.relative(repoRoot, f) });
        }
    }
    return citations;
}

/**
 * A persona's optional `sources:` frontmatter list is a citation in exactly the
 * sense this gate already checks: an id that must resolve to a ledger row. It
 * is collected here rather than in a second gate so that "a harvest id
 * resolves" has one owner — a persona-side check living elsewhere would be free
 * to disagree with this one.
 *
 * Three states, and only the third produces citations: absent = unscoped,
 * `[]` = explicitly asserts nothing harvested, non-empty = scoped to those ids.
 */
export function collectPersonaSources(repoRoot: string, personaRoot = 'src/agent-src/personas'): Citation[] {
    const files: string[] = [];
    collectMarkdown(path.join(repoRoot, personaRoot), files);

    const citations: Citation[] = [];
    for (const f of files) {
        let text: string;
        try {
            text = fs.readFileSync(f, 'utf-8');
        } catch {
            continue;
        }
        const fm = /^---\n([\s\S]*?)\n---/.exec(text);
        if (!fm) continue;
        // Deliberately a narrow line-scanner rather than a YAML parse: this gate
        // must not fail on a persona whose frontmatter is malformed elsewhere —
        // that is validate_frontmatter's finding to report, and duplicating it
        // here would produce two different error messages for one defect.
        const block = /(^|\n)sources:\s*(\[[^\]]*\]|\n(?:\s*-\s*\S+\n?)*)/.exec(fm[1] as string);
        if (!block) continue;
        const raw = block[2] as string;
        const ids = raw.trim().startsWith('[')
            ? raw.replace(/[[\]]/g, '').split(',')
            : raw.split('\n').map((l) => l.replace(/^\s*-\s*/, ''));
        for (const id of ids.map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)) {
            citations.push({ id, file: path.relative(repoRoot, f) });
        }
    }
    return citations;
}

/** Every citation must resolve to a ledger row. */
export function findOrphanCitations(
    citations: readonly Citation[],
    records: readonly HarvestRecord[],
): Finding[] {
    const known = new Set(records.map((r) => r.harvest_id));
    return citations
        .filter((c) => !known.has(c.id))
        .map((c) => ({
            line: 0,
            rule: 'orphan-citation' as const,
            message: `${c.file} cites harvest '${c.id}', which has no row in ${LEDGER_REL}`,
        }));
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

class ExitCode extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

function parseArgs(argv: string[]): { readonly quiet: boolean } {
    let quiet = false;
    for (const a of argv) {
        if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_harvest_provenance [--quiet]\n');
            throw new ExitCode(0);
        } else {
            process.stderr.write(`❌  lint_harvest_provenance: unrecognized argument: ${a}\n`);
            throw new ExitCode(2);
        }
    }
    return { quiet };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const args = parseArgs(argv);
    const ledgerPath = path.join(REPO, LEDGER_REL);

    // An EMPTY ledger is a legitimate state — it is empty today. An ABSENT one
    // is not: without this guard a moved ledger would read as zero harvests and
    // every citation would surface as an orphan, or (with no citations either)
    // the run would report a clean green over a file that no longer exists.
    try {
        assertWatchlistResolves({ gate: 'lint_harvest_provenance', candidates: [LEDGER_REL], repoRoot: REPO });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    const text = fs.readFileSync(ledgerPath, 'utf-8');
    const { records, findings } = lintLedgerText(text, REPO);
    const citations = [...collectCitations(REPO), ...collectPersonaSources(REPO)];
    const orphans = findOrphanCitations(citations, records);
    const allFindings = [...findings, ...orphans];

    // Per-target completeness accounting over the two populations this gate
    // reasons about: the ledger's own rows, and the citations that point at
    // them. Both are legitimately EMPTY today, and that is exactly why the
    // accounting is worth having — a green line over zero rows and a green line
    // over a hundred checked rows read identically without it, which is the
    // failure the success message above already tries to talk its way out of in
    // prose. The ledger states it structurally instead.
    const ledger = new GateLedger('lint_harvest_provenance');
    const known = new Set(records.map((r) => r.harvest_id));
    // The row population is every PARSED ledger line, not `records`: a row that
    // fails validation or uniqueness is `continue`d and never reaches `records`,
    // so planning `records` would plan exactly the rows that passed and account
    // for none of the ones that did not — an accounting that can only ever read
    // 100 %. Lines are the stable key; a Finding already carries one.
    const { parsed } = parseLedgerText(text);
    const badLines = new Set(findings.filter((f) => f.line > 0).map((f) => f.line));
    ledger.plan([
        ...parsed.map((r) => `row:${String(r.line)}`),
        ...citations.map((c) => `citation:${c.id}@${c.file}`),
    ]);
    for (const r of parsed) {
        const id = `row:${String(r.line)}`;
        if (badLines.has(r.line)) ledger.fail(id, 'ledger-row finding');
        else ledger.complete(id);
    }
    for (const c of citations) {
        const id = `citation:${c.id}@${c.file}`;
        if (known.has(c.id)) ledger.complete(id);
        else ledger.fail(id, 'orphan citation — no ledger row carries this harvest id');
    }
    ledger.report();

    if (allFindings.length > 0) {
        for (const f of allFindings) {
            const at = f.line > 0 ? `${LEDGER_REL}:${f.line}` : LEDGER_REL;
            process.stderr.write(`❌  ${at}: [${f.rule}] ${f.message}\n`);
        }
        process.stderr.write(
            `❌  lint_harvest_provenance: ${allFindings.length} finding(s) — checks our own records, strict from day one\n`,
        );
        return 2;
    }

    if (!args.quiet) {
        // Always name what was examined, including the zero case: a green line
        // that does not distinguish "nothing to check" from "everything checked"
        // is the failure mode this repo has already paid for once.
        process.stdout.write(
            `✅  lint_harvest_provenance: ${records.length} ledger row(s) OK · ` +
            `${citations.length} citation(s) resolved across ${CITATION_SCAN_ROOTS.length} scanned root(s)` +
            `${records.length === 0 && citations.length === 0 ? ' — ledger is empty and nothing cites it, which is a legitimate pass' : ''}\n`,
        );
    }
    return 0;
}

/** Robust "am I the entry script?" — realpath-compares argv[1] to this file. */
function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitCode) {
            process.exit(exc.code);
        }
        throw exc;
    }
}

export { REPO, LEDGER_REL, ExitCode };
