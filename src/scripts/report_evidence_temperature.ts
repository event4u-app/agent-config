#!/usr/bin/env tsx
/**
 * Classify every tracked file in the evidence tree as hot, warm or cold —
 * by reference, never by age.
 *
 * `road-to-an-evidence-tree-with-a-cold-half` Phase 1.1 and 3.2. The tree is
 * 32 MB over 1,300-odd files and its retention is `permanent`, so the question
 * "which of these does anything still read" has to be answerable by a rule a
 * reader can check, not by a judgement someone made once.
 *
 * THE RULE, stated before the code so it can be argued with:
 *
 *   cold  — no tracked file anywhere in the repository references its path or,
 *           when the filename is unique repo-wide, its bare filename.
 *   warm  — referenced only by archived or skipped roadmaps, or only by other
 *           files that are themselves inside the evidence tree.
 *   hot   — referenced by at least one live tracked file outside the evidence
 *           tree, OR sitting under a directory a gate enumerates as its corpus.
 *
 * Two properties of that rule carry the whole instrument.
 *
 * FIRST, cold means zero inbound references from ANYWHERE, including from
 * inside the evidence tree. The weaker reading — "nothing outside evidence
 * cites it" — would class a file that a hot analysis document links to as cold,
 * and moving it would break `check_references`, which scans all of `agents/`.
 * Zero-inbound is the only definition under which the cold set is safe to move
 * without rewriting a single link.
 *
 * SECOND, matching is deliberately PERMISSIVE and the error direction is
 * deliberately one-way. A citation form this misses classes a live file cold,
 * which is the expensive mistake; a loose match classes a dead file hot, which
 * only means it stays where it is. So tokens are harvested from prose, from
 * JSON values and from code alike — not only from backticks or markdown links —
 * and a bare filename counts whenever no other tracked file in the repository
 * shares it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It never deletes, never moves, never
 * refuses. Exit is 0 even when the cold set grows, because a census that can
 * fail is a gate, and a gate over a corpus nobody has pruned yet would be a
 * refusal with no remedy behind it. `--since` names what became cold since a
 * previous report; it still exits 0.
 *
 * Usage:
 *   ./scripts-run src/scripts/report_evidence_temperature
 *   ./scripts-run src/scripts/report_evidence_temperature --write
 *   ./scripts-run src/scripts/report_evidence_temperature --json
 *   ./scripts-run src/scripts/report_evidence_temperature --since <report.md>
 *   ./scripts-run src/scripts/report_evidence_temperature --write --since latest
 *
 * Exit codes: 0 always, except 2 for a usage error.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The tree this census is about, repo-relative and POSIX-separated. */
export const EVIDENCE_ROOT = 'agents/evidence';

/** Where `--write` puts the report, relative to the repository root. */
export const REPORT_DIR = 'agents/evidence/analysis';

/** Reports of this family are excluded from the reference index — see `isSelfReport`. */
const REPORT_PREFIX = 'evidence-temperature-';

/** File extensions a path token may end in. Anything else is not a path to us. */
const PATH_EXTENSIONS = [
    'md',
    'json',
    'jsonl',
    'yaml',
    'yml',
    'csv',
    'txt',
    'patch',
    'sh',
    'mjs',
    'ts',
    'tsx',
    'py',
    'png',
    'svg',
    'html',
] as const;

const TOKEN_RE = new RegExp(
    String.raw`(?:[A-Za-z0-9_.@+-]+\/)*[A-Za-z0-9_.@+-]+\.(?:${PATH_EXTENSIONS.join('|')})(?![A-Za-z0-9])`,
    'g',
);

/** Largest file this will read looking for references. Bigger ones are skipped. */
const MAX_READ_BYTES = 8 * 1024 * 1024;

/**
 * Directories inside the evidence tree that a gate enumerates as its corpus.
 *
 * Membership is the point: these gates do not merely happen to read a file they
 * were handed, they walk the directory and derive a verdict from what is in it.
 * A file that left one of these roots would leave the gate scanning fewer files
 * and still exiting green, which is the gate-that-scans-nothing shape this
 * repository refuses elsewhere. So every file beneath them is hot by that fact
 * alone, whatever cites it — this is Phase 1.2's clause that a gate relying on a
 * file reclassifies it hot, applied mechanically instead of by hand.
 *
 * `agents/` as a whole is NOT in this list even though `check_references` scans
 * it, because that gate validates the links a file contains rather than
 * requiring the file to exist: moving a file to another directory under
 * `agents/` keeps it inside that scan root and changes nothing for it.
 */
export const GATE_SCAN_ROOTS: ReadonlyArray<{
    readonly dir: string;
    readonly gates: readonly string[];
    readonly loses: string;
}> = [
    {
        dir: 'reviews',
        gates: [
            'check_review_dispositions',
            'check_review_schema',
            'check_completion_review',
            'probe_review_binding_drift',
            'lint_judge_prompt_expectation',
        ],
        loses:
            'Archived round records are validated in place — a finding left open after it was fixed ' +
            'is caught only by walking this directory. Five gates read it, one of them specifically ' +
            'for the archived rounds, so a file leaving the root is coverage leaving with it.',
    },
    {
        dir: 'release-findings',
        gates: ['check_review_schema', 'check_release_pr_shape', 'release_publication'],
        loses:
            'Per-release ledgers are read by version, and the release PR shape check asserts one is ' +
            'present. A missing ledger is indistinguishable from a release that produced no findings.',
    },
    {
        dir: 'archived-skills',
        gates: ['lint_archived_skills'],
        loses: 'The archive note for a retired skill is the record that it was retired rather than lost.',
    },
    {
        dir: 'ratifications',
        gates: ['_lib/ratification_artifact'],
        loses: 'A governance diff is pushed only against a ratification artefact found in this directory.',
    },
];

/** Paths that are structural rather than evidential — an index or a directory keeper. */
function isStructural(rel: string): boolean {
    const base = path.posix.basename(rel);
    return base === '.gitkeep' || base === 'README.md';
}

/** True for the census reports themselves, which name every cold file and would otherwise warm them all. */
export function isSelfReport(rel: string): boolean {
    return path.posix.basename(rel).startsWith(REPORT_PREFIX);
}

export type Temperature = 'hot' | 'warm' | 'cold';
export type ReferrerClass = 'live' | 'archived' | 'evidence';
export type Reason = 'scan-root' | 'structural' | 'live-citation' | 'historical-citation' | 'uncited';

/**
 * Which kind of thing a referring file is.
 *
 * `archived` is the class that makes warm a useful word: an archived or skipped
 * roadmap is a record of work that finished, so a citation from one says the
 * file mattered once, not that anything reads it now.
 */
export function referrerClass(rel: string): ReferrerClass {
    if (rel.startsWith(`${EVIDENCE_ROOT}/`)) return 'evidence';
    if (rel.startsWith('agents/roadmaps/archive/')) return 'archived';
    if (rel.startsWith('agents/roadmaps/skipped/')) return 'archived';
    if (rel.startsWith('agents/tmp.old/')) return 'archived';
    return 'live';
}

/** Strip leading `./` and `../` segments so a relative link and an absolute path share one key. */
export function normaliseToken(token: string): string {
    const parts = token.split('/').filter((p) => p !== '' && p !== '.' && p !== '..');
    return parts.join('/');
}

/** Every path-shaped token in a blob of text, normalised, deduplicated. */
export function extractPathTokens(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(TOKEN_RE)) {
        const norm = normaliseToken(m[0]);
        if (norm !== '') out.add(norm);
    }
    return [...out];
}

/** The keys under which a tracked path may be cited: the full path and each of its suffixes. */
export function citationKeys(rel: string): string[] {
    const parts = rel.split('/');
    const keys: string[] = [];
    for (let i = 0; i < parts.length; i += 1) keys.push(parts.slice(i).join('/'));
    return keys;
}

export interface Reference {
    readonly from: string;
    readonly cls: ReferrerClass;
}

export function classify(
    refs: readonly Reference[],
    scanRoot: string | null,
    structural: boolean,
): { temperature: Temperature; reason: Reason } {
    if (scanRoot !== null) return { temperature: 'hot', reason: 'scan-root' };
    if (structural) return { temperature: 'hot', reason: 'structural' };
    if (refs.some((r) => r.cls === 'live')) return { temperature: 'hot', reason: 'live-citation' };
    if (refs.length > 0) return { temperature: 'warm', reason: 'historical-citation' };
    return { temperature: 'cold', reason: 'uncited' };
}

/** The gate scan root a path sits under, or null. */
export function scanRootFor(rel: string): string | null {
    for (const root of GATE_SCAN_ROOTS) {
        if (rel.startsWith(`${EVIDENCE_ROOT}/${root.dir}/`)) return root.dir;
    }
    return null;
}

export interface EvidenceFile {
    readonly path: string;
    readonly bytes: number;
    readonly addedOn: string | null;
    readonly temperature: Temperature;
    readonly reason: Reason;
    readonly referrers: readonly string[];
}

export interface Census {
    readonly generatedAt: string;
    readonly commit: string;
    readonly files: readonly EvidenceFile[];
}

function git(args: readonly string[], root: string): string {
    return execFileSync('git', [...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Earliest add date per path, from one walk of the history. */
export function parseAddDates(log: string): Map<string, string> {
    const dates = new Map<string, string>();
    let current: string | null = null;
    for (const line of log.split('\n')) {
        if (line.startsWith('@')) {
            current = line.slice(1).trim();
            continue;
        }
        const file = line.trim();
        if (file === '' || current === null) continue;
        // git log walks newest-first, so the LAST sighting is the earliest add.
        dates.set(file, current);
    }
    return dates;
}

function readTextOrNull(abs: string): string | null {
    let stat: fs.Stats;
    try {
        stat = fs.statSync(abs);
    } catch {
        return null;
    }
    if (!stat.isFile() || stat.size > MAX_READ_BYTES) return null;
    try {
        return fs.readFileSync(abs, 'utf8');
    } catch {
        return null;
    }
}

export function buildCensus(root: string): Census {
    const tracked = git(['ls-files', '-z'], root)
        .split('\0')
        .filter((p) => p !== '');
    const evidence = tracked.filter((p) => p.startsWith(`${EVIDENCE_ROOT}/`));

    const basenameCount = new Map<string, number>();
    for (const p of tracked) {
        const b = path.posix.basename(p);
        basenameCount.set(b, (basenameCount.get(b) ?? 0) + 1);
    }

    // token -> referring files. Self-reports are excluded at index time, not at
    // lookup time, so a report can never warm the set it was written about.
    const index = new Map<string, Set<string>>();
    for (const rel of tracked) {
        if (isSelfReport(rel)) continue;
        const text = readTextOrNull(path.join(root, rel));
        if (text === null) continue;
        for (const token of extractPathTokens(text)) {
            let bucket = index.get(token);
            if (bucket === undefined) {
                bucket = new Set<string>();
                index.set(token, bucket);
            }
            bucket.add(rel);
        }
    }

    const addDates = parseAddDates(
        git(['log', '--diff-filter=A', '--name-only', '--date=short', '--format=@%ad', '--', EVIDENCE_ROOT], root),
    );

    const files: EvidenceFile[] = [];
    for (const rel of evidence) {
        const keys = citationKeys(rel);
        const bare = keys[keys.length - 1];
        const seen = new Map<string, ReferrerClass>();
        for (const key of keys) {
            // A bare filename counts only when nothing else in the tree shares it.
            if (key === bare && (basenameCount.get(bare) ?? 0) > 1) continue;
            for (const from of index.get(key) ?? []) {
                if (from === rel) continue;
                seen.set(from, referrerClass(from));
            }
        }
        const refs: Reference[] = [...seen].map(([from, cls]) => ({ from, cls }));
        const { temperature, reason } = classify(refs, scanRootFor(rel), isStructural(rel));
        let bytes = 0;
        try {
            bytes = fs.statSync(path.join(root, rel)).size;
        } catch {
            bytes = 0;
        }
        files.push({
            path: rel,
            bytes,
            addedOn: addDates.get(rel) ?? null,
            temperature,
            reason,
            referrers: refs.map((r) => r.from).sort(),
        });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));

    let commit = 'unknown';
    try {
        commit = git(['rev-parse', '--short', 'HEAD'], root).trim();
    } catch {
        commit = 'unknown';
    }
    return { generatedAt: new Date().toISOString().slice(0, 10), commit, files };
}

export interface Totals {
    readonly files: number;
    readonly bytes: number;
}

export function totalsBy(files: readonly EvidenceFile[], key: (f: EvidenceFile) => string): Map<string, Totals> {
    const out = new Map<string, Totals>();
    for (const f of files) {
        const k = key(f);
        const prev = out.get(k) ?? { files: 0, bytes: 0 };
        out.set(k, { files: prev.files + 1, bytes: prev.bytes + f.bytes });
    }
    return out;
}

/** Top-level directory under the evidence root, or `(root)` for a file directly in it. */
export function subtreeOf(rel: string): string {
    const rest = rel.slice(EVIDENCE_ROOT.length + 1);
    const slash = rest.indexOf('/');
    return slash === -1 ? '(root)' : rest.slice(0, slash);
}

function mib(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/**
 * The newest existing report other than `exclude`, or null when there is none.
 *
 * `--since latest` resolves through this so the release pipeline needs no date
 * arithmetic: the names sort lexicographically because they carry an ISO date,
 * and the file about to be written is excluded so a same-day re-run compares
 * against the previous release rather than against itself.
 */
export function latestReportBefore(names: readonly string[], exclude: string): string | null {
    const candidates = names
        .filter((n) => n.startsWith(REPORT_PREFIX) && n.endsWith('.md') && n !== exclude)
        .sort();
    return candidates.length === 0 ? null : candidates[candidates.length - 1];
}

/** The cold paths a previous report listed, read back out of its own fenced block. */
export function coldPathsIn(reportText: string): Set<string> {
    const out = new Set<string>();
    for (const line of reportText.split('\n')) {
        const t = line.trim();
        if (t.startsWith(`${EVIDENCE_ROOT}/`)) out.add(t);
    }
    return out;
}

export function renderReport(census: Census, previousCold: Set<string> | null): string {
    const byTemp = totalsBy(census.files, (f) => f.temperature);
    const cold = census.files.filter((f) => f.temperature === 'cold');
    const warm = census.files.filter((f) => f.temperature === 'warm');
    const all: Totals = { files: census.files.length, bytes: census.files.reduce((s, f) => s + f.bytes, 0) };

    const L: string[] = [];
    L.push('<!-- evidence-type: analysis -->');
    L.push('');
    L.push(`# Evidence temperature census — ${census.generatedAt}`);
    L.push('');
    L.push(
        `Generated by \`./scripts-run src/scripts/report_evidence_temperature --write\` at \`${census.commit}\`. ` +
            'Report-only: it classifies, and refuses nothing.',
    );
    L.push('');
    L.push('## The rule');
    L.push('');
    L.push(
        'Classification is by reference, never by age. An old file a contract cites is load-bearing; ' +
            'a file added last week that nothing reads is not.',
    );
    L.push('');
    L.push('| Class | Definition |');
    L.push('|---|---|');
    L.push(
        '| cold | No tracked file anywhere in the repository references its path, or — when the filename is unique repo-wide — its bare filename. |',
    );
    L.push(
        '| warm | Referenced only by archived or skipped roadmaps, or only by other files that are themselves under the evidence tree. |',
    );
    L.push(
        '| hot | Referenced by at least one live tracked file outside the evidence tree, or sitting under a directory a gate enumerates as its corpus. |',
    );
    L.push('');
    L.push(
        'Cold means zero inbound references from anywhere, the evidence tree included. The weaker reading — ' +
            'nothing outside evidence cites it — would class a file that a live analysis document links to as cold, ' +
            'and moving it would break the reference checker, which scans the whole of `agents/`. Zero-inbound is the ' +
            'only definition under which the cold set moves without rewriting one link.',
    );
    L.push('');
    L.push(
        'Matching is permissive on purpose and the error direction is one-way: a citation form the resolver misses ' +
            'would class a live file cold, which is the expensive mistake, while a loose match only leaves a dead file ' +
            'where it already is. Tokens are therefore read from prose, from JSON values and from code alike, not only ' +
            'from backticks or links.',
    );
    L.push('');
    L.push('## Totals');
    L.push('');
    L.push('| Class | Files | Bytes |');
    L.push('|---|---:|---:|');
    for (const t of ['hot', 'warm', 'cold'] as const) {
        const v = byTemp.get(t) ?? { files: 0, bytes: 0 };
        L.push(`| ${t} | ${v.files} | ${mib(v.bytes)} |`);
    }
    L.push(`| **all** | **${all.files}** | **${mib(all.bytes)}** |`);
    L.push('');
    L.push('## Why each file is where it is');
    L.push('');
    L.push('| Reason | Files | Bytes |');
    L.push('|---|---:|---:|');
    const byReason = totalsBy(census.files, (f) => f.reason);
    for (const [reason, v] of [...byReason].sort((a, b) => b[1].files - a[1].files)) {
        L.push(`| ${reason} | ${v.files} | ${mib(v.bytes)} |`);
    }
    L.push('');
    L.push('## By subtree');
    L.push('');
    L.push('| Subtree | Files | Bytes | hot | warm | cold |');
    L.push('|---|---:|---:|---:|---:|---:|');
    const subtrees = [...new Set(census.files.map((f) => subtreeOf(f.path)))].sort();
    for (const sub of subtrees) {
        const inSub = census.files.filter((f) => subtreeOf(f.path) === sub);
        const bytes = inSub.reduce((s, f) => s + f.bytes, 0);
        const h = inSub.filter((f) => f.temperature === 'hot').length;
        const w = inSub.filter((f) => f.temperature === 'warm').length;
        const c = inSub.filter((f) => f.temperature === 'cold').length;
        L.push(`| ${sub} | ${inSub.length} | ${mib(bytes)} | ${h} | ${w} | ${c} |`);
    }
    L.push('');
    L.push('## Gates that scan the tree, and what each would lose');
    L.push('');
    L.push(
        'A gate below enumerates its directory and derives a verdict from what is in it. Membership is the point, ' +
            'so every file beneath one of these roots is hot by that fact alone — a gate that relies on a file ' +
            'reclassifies it hot, applied mechanically rather than by hand. A file leaving one of these roots would ' +
            'leave its gate scanning fewer files and still exiting green.',
    );
    L.push('');
    L.push('| Scan root | Files | Gates reading it | What leaving the scan root would cost |');
    L.push('|---|---:|---|---|');
    for (const root of GATE_SCAN_ROOTS) {
        const n = census.files.filter((f) => f.path.startsWith(`${EVIDENCE_ROOT}/${root.dir}/`)).length;
        L.push(`| \`${root.dir}/\` | ${n} | ${root.gates.map((g) => `\`${g}\``).join(', ')} | ${root.loses} |`);
    }
    L.push('');
    L.push(
        'Four readers of the tree are deliberately absent from that table. `check_references` scans the whole of ' +
            '`agents/` but validates the links a file contains rather than requiring the file to exist, so a file ' +
            'moved to another directory under `agents/` stays inside its scan root and nothing changes for it. ' +
            '`lint_evidence_artifacts` is diff-scoped against a base ref and fires on files added, not on files ' +
            'present, so it gains and loses nothing from a move either. `check_council_references` and ' +
            '`lint_hidden_unicode` name the analysis directory as an allowed prefix rather than as a corpus; a cold ' +
            'location added beside it would need the same one-line entry in each, and that is the only edit either ' +
            'of them needs.',
    );
    L.push('');
    L.push('## The cold set');
    L.push('');
    L.push(
        `${cold.length} tracked files, ${mib(cold.reduce((s, f) => s + f.bytes, 0))}, referenced by nothing. ` +
            'Listed in full because the move that follows has to be checkable against a list, not against a count.',
    );
    L.push('');
    L.push('```text');
    for (const f of cold) L.push(f.path);
    L.push('```');
    L.push('');
    L.push('## The warm set');
    L.push('');
    L.push(
        `${warm.length} tracked files, ${mib(warm.reduce((s, f) => s + f.bytes, 0))}, cited only by archived work ` +
            'or by other evidence. These are not candidates for a move: a citation inside the evidence tree is a link ' +
            'that would break.',
    );
    L.push('');
    if (previousCold !== null) {
        const newly = cold.filter((f) => !previousCold.has(f.path));
        L.push('## Newly cold since the previous report');
        L.push('');
        L.push(`${newly.length} file(s).`);
        L.push('');
        if (newly.length > 0) {
            L.push('```text');
            for (const f of newly) L.push(f.path);
            L.push('```');
            L.push('');
        }
    }
    return L.join('\n');
}

function usage(): never {
    process.stderr.write(
        'usage: report_evidence_temperature [--write] [--out PATH] [--json] [--since REPORT.md] [--quiet]\n',
    );
    process.exit(2);
}

export function main(argv: readonly string[]): number {
    let write = false;
    let json = false;
    let quiet = false;
    let out: string | null = null;
    let since: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--write') write = true;
        else if (a === '--json') json = true;
        else if (a === '--quiet') quiet = true;
        else if (a === '--out') {
            out = argv[i + 1] ?? null;
            i += 1;
            if (out === null) usage();
        } else if (a === '--since') {
            since = argv[i + 1] ?? null;
            i += 1;
            if (since === null) usage();
        } else usage();
    }

    const census = buildCensus(REPO_ROOT);
    if (json) {
        process.stdout.write(`${JSON.stringify(census, null, 2)}\n`);
        return 0;
    }

    const dest = out ?? path.join(REPORT_DIR, `${REPORT_PREFIX}${census.generatedAt}.md`);

    let previousCold: Set<string> | null = null;
    if (since === 'latest') {
        // No previous report is a legitimate first run, never an error.
        const dir = path.join(REPO_ROOT, REPORT_DIR);
        const names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        const prev = latestReportBefore(names, path.posix.basename(dest));
        previousCold = prev === null ? null : coldPathsIn(fs.readFileSync(path.join(dir, prev), 'utf8'));
    } else if (since !== null) {
        const abs = path.isAbsolute(since) ? since : path.join(REPO_ROOT, since);
        if (!fs.existsSync(abs)) {
            process.stderr.write(`--since: no such report: ${since}\n`);
            return 2;
        }
        previousCold = coldPathsIn(fs.readFileSync(abs, 'utf8'));
    }

    const body = renderReport(census, previousCold);
    if (write) {
        const abs = path.isAbsolute(dest) ? dest : path.join(REPO_ROOT, dest);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, `${body}\n`, 'utf8');
        if (!quiet) process.stdout.write(`wrote ${path.relative(REPO_ROOT, abs)}\n`);
    } else if (!quiet) {
        process.stdout.write(`${body}\n`);
    }

    const byTemp = totalsBy(census.files, (f) => f.temperature);
    const line = (['hot', 'warm', 'cold'] as const)
        .map((t) => `${t}=${(byTemp.get(t) ?? { files: 0, bytes: 0 }).files}`)
        .join(' · ');
    process.stdout.write(`evidence temperature · ${census.files.length} tracked files · ${line}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    // `process.exitCode`, never `process.exit`: the JSON mode writes megabytes
    // and an immediate exit truncates a pipe mid-string.
    process.exitCode = main(process.argv.slice(2));
}
