#!/usr/bin/env tsx
/**
 * Stage-4 gate for curated self-improvement proposals.
 *
 * Ported from the retired Python `src/scripts/check_proposal.py` (ADR-088, Phase 4 /
 * Wave 4a). The CLI contract pins the historical contract exactly — same
 * positional `path` arg, same `--format` flag, same exit codes, same
 * stdout/stderr split, byte-identical finding messages, same check order.
 * No behaviour changes — latent bugs are replicated and flagged in the
 * porting report, not fixed.
 *
 * Validates a proposal doc produced by the pipeline documented in
 * `guidelines/agent-infra/self-improvement-pipeline.md`. A proposal is
 * only eligible to advance to `stage: gated` if every check here passes.
 *
 * Gate checks (all hard):
 *   1. Frontmatter complete — proposal_id, type, scope, stage, author,
 *      created, last_updated.
 *   2. Type / scope / stage values are from the documented vocabulary.
 *   3. Evidence block — ≥2 entries under `evidence:`, each with distinct
 *      `ref` value. At least two distinct hosts/repos/paths.
 *   4. No "TODO" / "TBD" / "xxx" markers in the draft body.
 *   5. Required sections all present (1..10 per template).
 *   6. Success signal — Section 7 has a concrete metric, target, and
 *      evaluation date.
 *   7. A `scope: package` proposal at `stage: gated` declares `changed_files:`
 *      and names a passing `ratification_record:` and an `owner_authorization:`,
 *      both bound to the digest of those files (ADR-281 as amended) — see
 *      `_checkGatedRecord` for what this can and cannot prove.
 *
 * Exit codes: 0 = pass, 1 = gate failure, 2 = PyYAML missing, 3 = internal error.
 *
 * Usage:
 *     check_proposal agents/proposals/my-proposal.md
 *     check_proposal --format json path/to.md
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { asOf } from './_lib/as_of.js';
import {
    isRatified,
    RATIFICATION_DIR,
    readRatification,
    readRequiredProviders,
} from './_lib/ratification_artifact.js';
import {
    assertContained,
    DEFAULT_REVISION,
    fileAtRevision,
    GatedSubjectRefusal,
    resolveRevision,
    subjectOf,
} from './_lib/ratification_subject.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

/** This script's own tree: the quorum policy is read from here, never from the proposal's. */
const REPO = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..', '..');
const POLICY_PATH = 'src/config/ratification-policy.json';

type Severity = 'error' | 'warning';

const REQUIRED_FRONTMATTER: ReadonlySet<string> = new Set([
    'proposal_id',
    'type',
    'scope',
    'stage',
    'author',
    'created',
    'last_updated',
]);
const VALID_TYPES: ReadonlySet<string> = new Set(['rule', 'skill', 'command', 'guideline']);
const VALID_SCOPES: ReadonlySet<string> = new Set(['project', 'package']);
const VALID_STAGES: ReadonlySet<string> = new Set([
    'captured',
    'classified',
    'proposed',
    'gated',
    'upstream',
]);
const REQUIRED_SECTIONS: ReadonlyArray<readonly [RegExp, string]> = [
    [/^##\s+1\.\s+Learning\b/m, '1. Learning'],
    [/^##\s+2\.\s+Classification\b/m, '2. Classification'],
    [/^##\s+3\.\s+Evidence\b/m, '3. Evidence'],
    [/^##\s+4\.\s+Proposed artefact\b/m, '4. Proposed artefact'],
    [/^##\s+5\.\s+Quality gate expectations\b/m, '5. Quality gate expectations'],
    [/^##\s+6\.\s+Replacement justification\b/m, '6. Replacement justification'],
    [/^##\s+7\.\s+Success signal\b/m, '7. Success signal'],
    [/^##\s+8\.\s+Risks and alternatives rejected\b/m, '8. Risks and alternatives rejected'],
    [/^##\s+9\.\s+Gate verdict\b/m, '9. Gate verdict'],
    [/^##\s+10\.\s+Upstream PR\b/m, '10. Upstream PR'],
];
const BAD_MARKERS = /\b(TODO|TBD|FIXME|XXX)\b/;
const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n/;

class Finding {
    constructor(
        readonly severity: Severity,
        readonly section: string,
        readonly message: string,
    ) {}
}

type Frontmatter = Record<string, unknown>;

/**
 * Python-compatible JSON serializer (json.dumps(..., indent=2),
 * ensure_ascii=True default).
 */
function pyJsonDumps(value: unknown): string {
    return escapeNonAscii(JSON.stringify(value, null, 2));
}

function escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

function _loadFrontmatter(text: string): Frontmatter {
    const match = FRONTMATTER_PATTERN.exec(text);
    if (!match) {
        return {};
    }
    const parsed = parseYaml(match[1] as string) as unknown;
    if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
    }
    return parsed as Frontmatter;
}

function _bodyAfterFrontmatter(text: string): string {
    const match = FRONTMATTER_PATTERN.exec(text);
    return match ? text.slice(match.index + match[0].length) : text;
}

function _checkFrontmatter(fm: Frontmatter, findings: Finding[]): void {
    const present = new Set(Object.keys(fm));
    const missing: string[] = [];
    for (const key of REQUIRED_FRONTMATTER) {
        if (!present.has(key)) {
            missing.push(key);
        }
    }
    missing.sort();
    for (const key of missing) {
        findings.push(new Finding('error', 'frontmatter', `missing: ${key}`));
    }
    const type = fm['type'];
    if (type && typeof type === 'string' && !VALID_TYPES.has(type)) {
        findings.push(new Finding('error', 'frontmatter', `invalid type '${type}'`));
    }
    const scope = fm['scope'];
    if (scope && typeof scope === 'string' && !VALID_SCOPES.has(scope)) {
        findings.push(new Finding('error', 'frontmatter', `invalid scope '${scope}'`));
    }
    const stage = fm['stage'];
    if (stage && typeof stage === 'string' && !VALID_STAGES.has(stage)) {
        findings.push(new Finding('error', 'frontmatter', `invalid stage '${stage}'`));
    }
}

function _checkSections(body: string, findings: Finding[]): void {
    for (const [pattern, name] of REQUIRED_SECTIONS) {
        if (!pattern.test(body)) {
            findings.push(new Finding('error', 'sections', `missing section: ${name}`));
        }
    }
}

function _extractEvidenceRefs(body: string): string[] {
    const refs: string[] = [];
    const evMatch = /^##\s+3\.\s+Evidence\b([\s\S]+?)(?=^##\s)/m.exec(body);
    if (!evMatch) {
        return refs;
    }
    for (const line of (evMatch[1] as string).split('\n')) {
        const m = /^\s*-?\s*ref:\s*(\S+)/.exec(line);
        if (m) {
            refs.push((m[1] as string).trim());
        }
    }
    return refs;
}

function _checkEvidence(body: string, findings: Finding[]): void {
    const refs = _extractEvidenceRefs(body);
    if (refs.length < 2) {
        findings.push(new Finding('error', 'evidence', `need ≥2 evidence refs, found ${refs.length}`));
        return;
    }
    // Independence — two distinct hosts OR two distinct paths.
    const hosts = new Set(refs.map((r) => _urlNetloc(r) || r));
    // NOTE: the Python `paths` set computation is dead — its value is never
    // used in the condition below. Replicated verbatim (and unused) to keep
    // behaviour identical. Flagged as a latent-bug / divergence candidate.
    const firstSegPairs = new Set(
        refs.map((r) => _urlPath(r).replace(/^\/+|\/+$/g, '').split('/').slice(0, 2).join('\0')),
    );
    if (hosts.size < 2 && firstSegPairs.size < 2) {
        findings.push(new Finding('warning', 'evidence', 'evidence refs look similar — verify independence'));
    }
}

/** Mirror urllib.parse.urlparse(...).netloc. */
function _urlNetloc(ref: string): string {
    try {
        const u = new URL(ref);
        // netloc = host[:port]; URL.host already includes the port.
        return u.host;
    } catch {
        return '';
    }
}

/** Mirror urllib.parse.urlparse(...).path. */
function _urlPath(ref: string): string {
    try {
        const u = new URL(ref);
        return u.pathname;
    } catch {
        // urlparse on a non-URL string puts the whole thing in `.path`.
        return ref;
    }
}

function _stripHtmlComments(text: string): string {
    return text.replace(/<!--[\s\S]*?-->/g, '');
}

function _checkMarkers(body: string, findings: Finding[]): void {
    const stripped = _stripHtmlComments(body);
    const lines = stripped.split('\n');
    lines.forEach((line, idx) => {
        const lineNo = idx + 1;
        if (line.trimStart().startsWith('//')) {
            return;
        }
        if (BAD_MARKERS.test(line)) {
            findings.push(
                new Finding('error', 'markers', `draft placeholder on line ${lineNo}: ${line.trim().slice(0, 60)}`),
            );
        }
    });
}

function _checkSuccessSignal(body: string, findings: Finding[]): void {
    const m = /^##\s+7\.\s+Success signal\b([\s\S]+?)(?=^##\s)/m.exec(body);
    if (!m) {
        return;
    }
    const sect = m[1] as string;
    for (const label of ['Metric:', 'Baseline:', 'Target:', 'Evaluation date:']) {
        if (!sect.includes(label)) {
            findings.push(new Finding('error', 'success-signal', `missing '${label}' entry`));
        }
    }
}

function _checkOriginatingProject(body: string, fm: Frontmatter, findings: Finding[]): void {
    // Section 10 must name the originating project once stage=upstream.
    if (fm['stage'] !== 'upstream') {
        return;
    }
    const m = /^##\s+10\.\s+Upstream PR\b([\s\S]+?)(?:^##\s|$(?![\s\S]))/m.exec(body);
    const sect = m ? (m[1] as string) : '';
    if (!sect.includes('Originating project:')) {
        findings.push(
            new Finding(
                'error',
                'originating-project',
                "Section 10 must include 'Originating project: <slug>' when stage=upstream",
            ),
        );
        return;
    }
    const line = /Originating project:\s*(.*)/.exec(sect);
    const value = line ? (line[1] as string).trim() : '';
    if (!value || value.startsWith('<') || ['-', '…', 'TBD'].includes(value)) {
        findings.push(
            new Finding(
                'error',
                'originating-project',
                'Originating project slot is empty or left as template placeholder',
            ),
        );
    }
}

function _proposalRateWarning(p: string, findings: Finding[], limit = 6, windowDays = 90): void {
    // Soft cap: warn if the proposals/ directory already holds `limit`
    // proposals authored within the last `window_days`. Never a hard block.
    const parent = require_dirname(p);
    if (basename(parent) !== 'proposals') {
        return;
    }
    const cutoff = _todayMinusDays(windowDays);
    let recent = 0;
    let names: string[];
    try {
        names = fs.readdirSync(parent);
    } catch {
        names = [];
    }
    for (const name of names) {
        if (!name.endsWith('.md')) {
            continue;
        }
        const md = joinPath(parent, name);
        if (_resolvePath(md) === _resolvePath(p)) {
            continue;
        }
        let text: string;
        try {
            text = fs.readFileSync(md, 'utf-8');
        } catch {
            continue;
        }
        const fmM = FRONTMATTER_PATTERN.exec(text);
        if (!fmM) {
            continue;
        }
        const createdM = /^created:\s*(\S+)/m.exec(fmM[1] as string);
        if (!createdM) {
            continue;
        }
        const created = _dateFromIso((createdM[1] as string).trim());
        if (created === null) {
            continue;
        }
        if (_compareYmd(created, cutoff) >= 0) {
            recent += 1;
        }
    }
    if (recent >= limit) {
        findings.push(
            new Finding(
                'warning',
                'rate-limit',
                `${recent} proposals in the last ${windowDays}d — consider bundling or pruning; the package is a public good, not a per-project scratchpad`,
            ),
        );
    }
}

// --- date helpers (mirror datetime.date arithmetic) -------------------------

interface Ymd {
    year: number;
    month: number;
    day: number;
}

function _dateFromIso(s: string): Ymd | null {
    // Mirror datetime.date.fromisoformat — strict YYYY-MM-DD (Python <3.11
    // semantics; the project targets that strict form). Returns null on
    // anything else, mirroring the ValueError catch.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
        return null;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }
    // Validate the day-of-month the way date() would (rejects 2026-02-30).
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
        return null;
    }
    return { year, month, day };
}

function _todayMinusDays(days: number): Ymd {
    const now = asOf();
    const base = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const d = new Date(base - days * 86_400_000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function _compareYmd(a: Ymd, b: Ymd): number {
    const av = a.year * 10000 + a.month * 100 + a.day;
    const bv = b.year * 10000 + b.month * 100 + b.day;
    return av < bv ? -1 : av > bv ? 1 : 0;
}

// --- path helpers ----------------------------------------------------------

function require_dirname(p: string): string {
    return nodePath.dirname(p);
}
function basename(p: string): string {
    return nodePath.basename(p);
}
function joinPath(a: string, b: string): string {
    return nodePath.join(a, b);
}
function _resolvePath(p: string): string {
    return nodePath.resolve(p);
}

/**
 * The digest a package proposal's review and approval must both carry: one
 * digest over EVERY file the proposal declares as its change, read from Git
 * objects at `revision`.
 *
 * Not the gate's `subject`, on purpose. The gate digests only the GATED subset
 * of a diff, and a learning usually changes a skill or rule body the gate does
 * not watch — over such a change the gate's digest covers nothing and is the
 * same for every proposal, so a record bound to it would be bound to no
 * content. ADR-281 as amended requires a digest-bound review for every
 * learning-originated package change, so the binding has to cover what the
 * proposal changes. It reuses the subject module's ONE hashing loop and
 * serialisation, by handing the declared files in as the closure it treats as
 * covered, rather than growing a second loop that could drift from the first.
 */
export function proposalSubjectOf(
    root: string,
    files: readonly string[],
    revision: string = DEFAULT_REVISION,
): string {
    return subjectOf(root, files, files, revision).digest;
}

/** The Git work tree a proposal file sits in, or `null` outside one. */
function _repoRootOf(proposalPath: string): string | null {
    const env = { ...process.env };
    // A GIT_DIR inherited from a hook would answer for the hook's repository.
    for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[k];
    const dir = nodePath.dirname(nodePath.resolve(proposalPath));
    const res = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', env });
    return res.status === 0 ? res.stdout.trim() : null;
}

/**
 * A package-scoped proposal reaches `stage: gated` only on a council record
 * bound to its own change AND an owner authorization bound to the same digest.
 *
 * The ORDER is ADR-281's amendment of 2026-10-07: the council record is the
 * REVIEW, the owner's authorization is the APPROVAL, and a favourable verdict is
 * advisory until the second exists. A record alone is refused, naming what is
 * missing.
 *
 * WHAT THIS CANNOT PROVE, said before what it can. The authorization is a file
 * the proposal names and a digest that file carries; nothing here establishes
 * that the owner wrote it. ADR-281 § 5 makes the owner's route his own recorded
 * act on the forge, which leaves no artifact a script can authenticate. What
 * IS established is narrower: the review and the authorization name the SAME
 * content as the proposal's declared change, read at one commit, so neither can
 * be carried over from another change, and the review is a record the
 * ratification reader accepts against the committed provider policy.
 *
 * A `scope: project` proposal, and any stage before `gated`, is checked exactly
 * as before.
 */
function _checkGatedRecord(fm: Frontmatter, findings: Finding[], repoRoot: string | null): void {
    if (fm['stage'] !== 'gated' || fm['scope'] !== 'package') {
        return;
    }
    const refuse = (message: string): void => {
        findings.push(new Finding('error', 'gated', message));
    };
    if (repoRoot === null) {
        refuse('stage=gated with scope=package is checked against Git objects, and this proposal is not inside a Git work tree');
        return;
    }

    const changed = fm['changed_files'];
    const files = Array.isArray(changed)
        ? changed.filter((f): f is string => typeof f === 'string').map((f) => f.trim()).filter((f) => f !== '')
        : [];
    if (files.length === 0 || !Array.isArray(changed) || files.length !== changed.length) {
        refuse(
            'stage=gated with scope=package needs `changed_files:` — a non-empty list of the paths ' +
                'this proposal declares as its change, which its review and approval are bound to',
        );
        return;
    }

    // One commit for the whole check: the digest and both named files are read
    // from the same resolved revision, never from a name resolved twice.
    let commit: string;
    let expected: string;
    try {
        commit = resolveRevision(repoRoot, DEFAULT_REVISION);
        expected = proposalSubjectOf(repoRoot, files, commit);
    } catch (err) {
        if (!(err instanceof GatedSubjectRefusal)) {
            throw err;
        }
        refuse(`the declared change cannot be digested: ${err.message}`);
        return;
    }

    const requiredProviders = readRequiredProviders(_readOrNull(joinPath(REPO, POLICY_PATH)));
    for (const [key, what] of [
        ['ratification_record', 'the council’s review'],
        ['owner_authorization', 'the owner’s approval'],
    ] as const) {
        const named = fm[key];
        if (typeof named !== 'string' || named.trim() === '') {
            refuse(
                `stage=gated with scope=package needs \`${key}:\` — ${what}, bound to this ` +
                    'proposal’s own change (ADR-281 as amended 2026-10-07)',
            );
            continue;
        }
        const rel = named.trim();
        let bytes: Buffer | null;
        try {
            assertContained(rel);
            bytes = fileAtRevision(repoRoot, commit, rel);
        } catch (err) {
            if (!(err instanceof GatedSubjectRefusal)) {
                throw err;
            }
            refuse(`${key} names \`${rel}\`: ${err.message}`);
            continue;
        }
        if (bytes === null) {
            refuse(`${key} names \`${rel}\`, which is not a committed regular file at HEAD`);
            continue;
        }
        const text = bytes.toString('utf8');
        if (key === 'ratification_record') {
            if (!rel.startsWith(`${RATIFICATION_DIR}/`) || !rel.endsWith('.md')) {
                refuse(`${key} \`${rel}\` is not a record under \`${RATIFICATION_DIR}/\``);
                continue;
            }
            const reading = readRatification(text, requiredProviders, expected);
            if (!isRatified(reading)) {
                const why = reading.problems.map((pr) => pr.message);
                if (reading.artifact !== null && !why.length) {
                    why.push(`verdict is \`${reading.artifact.verdict}\``);
                }
                refuse(`${key} \`${rel}\` does not pass for this change: ${why.join('; ')}`);
            }
            continue;
        }
        const found = /^subject:\s*([0-9a-f]{64})\s*$/m.exec(text);
        if (found === null) {
            refuse(`${key} \`${rel}\` carries no \`subject:\` digest, so it is bound to no change`);
        } else if (found[1] !== expected) {
            refuse(
                `${key} \`${rel}\` is bound to \`${String(found[1]).slice(0, 12)}…\`, not to this ` +
                    `proposal’s change (\`${expected.slice(0, 12)}…\`)`,
            );
        }
    }
}

function _readOrNull(p: string): string | null {
    try {
        return fs.readFileSync(p, 'utf8');
    } catch {
        return null;
    }
}

export function _runChecks(text: string, p: string | null = null, repoRoot?: string | null): Finding[] {
    const findings: Finding[] = [];
    const fm = _loadFrontmatter(text);
    _checkFrontmatter(fm, findings);
    const body = _bodyAfterFrontmatter(text);
    _checkSections(body, findings);
    _checkEvidence(body, findings);
    _checkMarkers(body, findings);
    _checkSuccessSignal(body, findings);
    _checkOriginatingProject(body, fm, findings);
    _checkGatedRecord(fm, findings, repoRoot !== undefined ? repoRoot : p === null ? null : _repoRootOf(p));
    if (p !== null) {
        _proposalRateWarning(p, findings);
    }
    return findings;
}

interface ParsedArgs {
    path: string;
    format: string;
}

function _parseArgs(argv: string[]): ParsedArgs {
    let pathArg: string | null = null;
    let format = 'text';
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--format') {
            format = _checkChoice(argv[++i], ['text', 'json'], '--format');
        } else if (a.startsWith('--format=')) {
            format = _checkChoice(a.slice('--format='.length), ['text', 'json'], '--format');
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: check_proposal [-h] [--format {text,json}] path\n');
            process.exit(0);
        } else if (a.startsWith('-') && a !== '-') {
            process.stderr.write(`check_proposal: error: unrecognized arguments: ${a}\n`);
            process.exit(2);
        } else if (pathArg === null) {
            pathArg = a;
        } else {
            process.stderr.write(`check_proposal: error: unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    if (pathArg === null) {
        process.stderr.write('check_proposal: error: the following arguments are required: path\n');
        process.exit(2);
    }
    return { path: pathArg, format };
}

function _checkChoice(value: string | undefined, choices: string[], flag: string): string {
    if (value === undefined || !choices.includes(value)) {
        process.stderr.write(
            `check_proposal: error: argument ${flag}: invalid choice: '${value ?? ''}' (choose from ${choices.map((c) => `'${c}'`).join(', ')})\n`,
        );
        process.exit(2);
    }
    return value;
}

function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    const p = args.path;
    if (!fs.existsSync(p)) {
        process.stderr.write(`error: ${p} not found\n`);
        return 3;
    }
    const text = fs.readFileSync(p, 'utf-8');
    // No corpus walk: this gate's scope is the single document named on argv.
    // The unit is therefore the content lines actually read — every check below
    // is a search over this text, so a zero-byte target makes the negative ones
    // ("no TODO/TBD markers") vacuously true against nothing.
    try {
        assertScanned({
            gate: 'check_proposal',
            scanned: text.split('\n').filter((l) => l.trim() !== '').length,
            units: 'content line(s)',
            roots: [p],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 1 = gate failure, which is what an unusable proposal already
            // returns today (3 is reserved for the not-found path above).
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    const findings = _runChecks(text, p);
    const errors = findings.filter((f) => f.severity === 'error');
    if (args.format === 'json') {
        process.stdout.write(
            `${pyJsonDumps({
                findings: findings.map((f) => ({
                    severity: f.severity,
                    section: f.section,
                    message: f.message,
                })),
            })}\n`,
        );
    } else {
        for (const f of findings) {
            const icon = f.severity === 'error' ? '❌' : '⚠️';
            process.stdout.write(`  ${icon}  [${f.section}]  ${f.message}\n`);
        }
        const warnings = findings.filter((f) => f.severity === 'warning').length;
        process.stdout.write(`\nSummary: ${errors.length} error(s), ${warnings} warning(s)\n`);
        process.stdout.write(`Verdict: ${errors.length > 0 ? 'BLOCK' : 'PASS'}\n`);
    }
    return errors.length > 0 ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(nodePath.resolve(process.argv[1])).href;
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
        const argv = fs.realpathSync(nodePath.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _isMain =
    _isCliEntry();
if (_isMain) {
    process.exit(main());
}

export { main };
