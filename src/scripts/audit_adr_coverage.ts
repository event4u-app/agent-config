#!/usr/bin/env tsx
/**
 * Audit per-area ADR coverage against docs/contracts/ and the canonical
 * AREAS inventory. Contract: docs/contracts/adr-layout.md.
 *
 * Ported from the retired Python `src/scripts/audit_adr_coverage.py` (ADR-200, Phase 8 /
 * Wave 8a). The CLI contract is pinned — the mutually exclusive
 * `--check` / `--regen-area-readme AREA` group (default `--report`), exit
 * codes, the stdout/stderr split, byte-identical messages, AND byte-identical
 * generated `README.md` for `--regen-area-readme`.
 *
 * Modes:
 *   --report   (default) one-shot inventory.
 *   --check    exit 1 on hard failures, 0 with warnings on missing bootstrap
 *              ADRs and dangling references.
 *   --regen-area-readme <area>  rewrite docs/adrs/<area>/README.md. Idempotent.
 *
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 *
 * Record metadata is read by `read_adr_meta`: the shared frontmatter reader
 * (`_lib/adr_frontmatter`) when a `---` block is present, the transitional
 * blockquote header otherwise. The seven per-area records carried only the
 * blockquote until 2026-08-21, so both paths have to work while the two
 * surfaces overlap.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readAdrFrontmatterScalars } from './_lib/adr_frontmatter.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/audit_adr_coverage.ts → parents[2] of the .py file is repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const ADR_ROOT = path.join(ROOT, 'docs', 'adrs');
export const CONTRACT_ROOT = path.join(ROOT, 'docs', 'contracts');

export interface AreaMeta {
    contract: string;
    scope: string;
}

// Canonical area inventory. To add an area: add it here, then run
// `python3 scripts/audit_adr_coverage.py --check` in the same PR.
export const AREAS: Record<string, AreaMeta> = {
    cost: {
        contract: 'cost-enforcement.md',
        scope: 'Budget ladder, hard-stop hook, cost reporting and dashboards.',
    },
    telegraph: {
        contract: 'condensation-default-kill-criterion.md',
        scope: 'Telegraph-speak condensation, decondensation, reversibility guards.',
    },
    schema: {
        contract: 'agents/reference/docs/frontmatter-contract.md',
        scope: 'Frontmatter schemas, v2 rigor, lint behaviour for skills / rules / commands.',
    },
    router: {
        contract: 'rule-router.md',
        scope: 'router.json shape, tier semantics, dispatch precedence.',
    },
    smoke: {
        contract: 'smoke-contracts.md',
        scope: 'Per-tier smoke contracts, baseline locks, regression gates.',
    },
    memory: {
        contract: 'memory-visibility-v1.md',
        scope: 'Memory / knowledge surfaces. RETIRED area — its single ADR is superseded by the agent-memory-layer removal; listed so the directory is audited rather than invisible.',
    },
};

/**
 * Area directories present on disk but absent from `AREAS`.
 *
 * `docs/adrs/memory/` sat on disk unlisted, and therefore unaudited, for an
 * unknown period: the audit iterates a hardcoded inventory and had no way to
 * notice a directory nobody told it about. Adding `memory` fixes the instance —
 * this fixes the class. A coverage audit blind to a whole area is the same defect
 * shape as a gate watching a path that no longer exists.
 */
export function unlistedAreaDirs(adrsRoot: string): string[] {
    try {
        return fs
            .readdirSync(adrsRoot, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .filter((n) => !(n in AREAS))
            .sort();
    } catch {
        return [];
    }
}

// ^(\d{4})-([a-z0-9-]+)\.md$
const NAMED = /^(\d{4})-([a-z0-9-]+)\.md$/;

/**
 * Metadata keys this script recognises in the transitional blockquote header.
 *
 * An allowlist rather than "every `Key: value` pair in a blockquote", because
 * the blockquote block also carries prose that happens to contain colons — the
 * `Roadmap:` pointer, a `Contract:` link, and (on `memory/0001`) a whole
 * supersession banner. Harvesting those would put link markup into the README
 * table. Keys are matched case-insensitively with spaces folded to `_`.
 */
const BLOCKQUOTE_KEYS = new Set([
    'adr',
    'area',
    'status',
    'date',
    'decision',
    'supersedes',
    'superseded_by',
    'type',
]);

interface AdrEntry {
    num: string;
    slug: string;
    path: string;
    [k: string]: string;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** POSIX relative path of `child` under `root`. */
function _relativeToPosix(child: string, root: string): string {
    const rel = path.relative(root, child);
    return rel.split(path.sep).join('/');
}

/** `sorted(area_dir.glob("*.md"))` — direct children only, lexically sorted. */
function _globMdSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

/**
 * Read the leading `---` frontmatter block, `{}` when there is none.
 *
 * Delegates to the one shared reader (`_lib/adr_frontmatter`) rather than
 * keeping this script's own regex: the tree carried three divergent ADR
 * frontmatter parsers plus this one, and the two nested axes (`provenance`,
 * `evidence`) are exactly the shape a `^([a-z_]+):\s*(.+?)$` regex reads as
 * absent.
 *
 * What is preserved: the `{}`-on-absent return, and the scalar keys this
 * script's callers read.
 *
 * What changed, stated because "preserved" was claimed for it and is false:
 * the removed `_stripChars(v, ' "\'')` stripped repeated and unbalanced quote
 * and space characters from both ends (Python `str.strip` semantics), while the
 * shared reader's `stripQuotes` is `/^["'](.*)["']$/` — exactly one balanced
 * pair. Two inputs now differ: `key: "value` keeps its opening quote (was
 * `value`), and `key: ''v''` yields `'v'` (was `v`). No record in the corpus
 * exercises either shape today, and the old behaviour is deliberately NOT
 * restored — one shared reader beats a bug-compatible local copy.
 */
export function parse_fm(text: string): Record<string, string> {
    return readAdrFrontmatterScalars(text) ?? {};
}

/**
 * Read the transitional blockquote metadata header.
 *
 * The seven per-area records predate the frontmatter contract and carry their
 * metadata as a blockquote line instead:
 *
 * ```
 * > Area: `router` · Status: accepted · Date: 2026-05-16 · Type: retrospective
 * ```
 *
 * Two shapes have to be handled and both occur in the tree. Several fields
 * share one line separated by `·`, so the split is on the separator first and
 * the first `:` second. And the value is often wrapped in backticks
 * (`` `router` ``), which are stripped — a table cell showing `` `accepted` ``
 * would not match what the frontmatter path produces for the same record.
 *
 * Scanning stops at the first `## ` heading: everything above it is the
 * metadata header, everything below is body prose whose blockquotes are
 * quotations, not metadata.
 */
export function parse_blockquote_meta(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (line.startsWith('## ')) break;
        if (!line.startsWith('>')) continue;
        for (const part of line.replace(/^>\s*/, '').split('·')) {
            const idx = part.indexOf(':');
            if (idx <= 0) continue;
            const key = part.slice(0, idx).trim().toLowerCase().replace(/\s+/g, '_');
            if (!BLOCKQUOTE_KEYS.has(key)) continue;
            const value = _stripChars(part.slice(idx + 1), ' "\'`');
            if (value === '') continue;
            // First occurrence wins — a later body line never overwrites the header.
            if (!(key in out)) out[key] = value;
        }
    }
    return out;
}

/**
 * One record's metadata: frontmatter when present, the blockquote header
 * otherwise.
 *
 * Frontmatter wins outright rather than merging. During the transition a record
 * carries both, and the blockquote is explicitly the human-readable duplicate —
 * merging would make the authoritative surface depend on which of the two
 * happened to mention a field, and a stale duplicate would then be able to
 * contribute a value the frontmatter had already corrected.
 */
export function read_adr_meta(text: string): Record<string, string> {
    const fm = readAdrFrontmatterScalars(text);
    if (fm !== null && Object.keys(fm).length > 0) return fm;
    return parse_blockquote_meta(text);
}

/** Mirror Python `str.strip(chars)`. */
function _stripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start += 1;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end -= 1;
    }
    return s.slice(start, end);
}

/** Mirror Python `str.title()`: cap first letter of each alphabetic run, lower the rest. */
function _title(s: string): string {
    let out = '';
    let prevIsCased = false;
    for (const ch of s) {
        const isCased = /[A-Za-z]/.test(ch);
        if (isCased) {
            out += prevIsCased ? ch.toLowerCase() : ch.toUpperCase();
        } else {
            out += ch;
        }
        prevIsCased = isCased;
    }
    return out;
}

export function scan_area(area: string): [AdrEntry[], string[]] {
    const areaDir = path.join(ADR_ROOT, area);
    const errs: string[] = [];
    if (!_exists(areaDir)) {
        return [[], errs];
    }
    const adrs: AdrEntry[] = [];
    for (const p of _globMdSorted(areaDir)) {
        const base = path.basename(p);
        if (base === 'README.md') {
            continue;
        }
        const m = NAMED.exec(base);
        if (!m) {
            errs.push(`${area}/${base}: filename does not match NNNN-<slug>.md`);
            continue;
        }
        const fm = read_adr_meta(fs.readFileSync(p, 'utf-8'));
        adrs.push({ num: m[1] as string, slug: m[2] as string, path: base, ...fm });
    }
    // Gap check.
    const nums = adrs.map((a) => parseInt(a.num, 10));
    for (let idx = 0; idx < nums.length; idx += 1) {
        const i = idx + 1;
        const n = nums[idx] as number;
        if (n !== i) {
            // f"{n:04d}" — zero-padded width 4.
            errs.push(`${area}/: number gap at position ${i} (got ${String(n).padStart(4, '0')})`);
            break;
        }
    }
    return [adrs, errs];
}

/**
 * Resolve a contract reference. Plain filename → docs/contracts/<file>; a path
 * with separators → repo-relative. Returns an absolute path string.
 */
export function _contract_path(meta: AreaMeta): string {
    const c = meta.contract;
    return c.includes('/') ? path.join(ROOT, c) : path.join(CONTRACT_ROOT, c);
}

export function render_area_readme(area: string, meta: AreaMeta, adrs: AdrEntry[]): string {
    const lines: string[] = [`# ADRs — \`${area}\``, '', `> ${meta.scope}`, ''];
    const contractPath = _contract_path(meta);
    // repo_rel = contract_path.relative_to(ROOT) if exists else Path(...)
    let repoRel: string;
    if (_exists(contractPath)) {
        repoRel = _relativeToPosix(contractPath, ROOT);
    } else {
        repoRel = meta.contract.includes('/') ? meta.contract : `docs/contracts/${meta.contract}`;
    }
    // link_target = Path("..") / ".." / ".." / repo_rel
    const linkTarget = `../../../${repoRel}`;
    if (_exists(contractPath)) {
        lines.push(`Contract: [\`${repoRel}\`](${linkTarget}).`);
    } else {
        lines.push(`Contract: _not yet published_ (\`${repoRel}\`).`);
    }
    lines.push('', '| # | Title | Status | Date | Supersedes |', '|---|---|---|---|---|');
    for (const a of adrs) {
        // a.get("decision", a["slug"]).replace("-", " ").title()
        const decision = a['decision'] !== undefined ? a['decision'] : a.slug;
        const title = _title(decision.replace(/-/g, ' '));
        lines.push(
            `| [${a.num}](${a.path}) | ${title} | ` +
                `${a['status'] ?? '—'} | ${a['date'] ?? '—'} | ` +
                `${a['supersedes'] ?? '—'} |`,
        );
    }
    if (adrs.length === 0) {
        lines.push('| _none yet_ | — | — | — | — |');
    }
    return lines.join('\n') + '\n';
}

/**
 * A vanished `docs/adrs/` makes every area report zero ADRs — "missing
 * bootstrap" across the board, which both modes treat as a warning and exit 0.
 * Exit 1 is the hard-failure code (`cmd_check`); 2 is reserved for argparse
 * usage errors.
 */
function _dead_adr_scope(scanned: number): number | null {
    try {
        assertScanned({
            gate: 'audit_adr_coverage',
            scanned,
            units: 'ADR file(s)',
            roots: ['docs/adrs'],
        });
        return null;
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌ ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
}

export function cmd_report(): number {
    process.stdout.write('## ADR coverage report\n');
    process.stdout.write('\n');
    process.stdout.write('| Area | Contract | ADRs | README | Status |\n');
    process.stdout.write('|---|---|---:|:---:|---|\n');
    let missingBootstrap = 0;
    let totalAdrs = 0;
    for (const [area, meta] of Object.entries(AREAS)) {
        const [adrs] = scan_area(area);
        totalAdrs += adrs.length;
        const readme = _exists(path.join(ADR_ROOT, area, 'README.md')) ? '✅' : '—';
        const contractPresent = _exists(_contract_path(meta));
        const status = adrs.length > 0 ? 'ok' : 'missing bootstrap';
        if (adrs.length === 0) {
            missingBootstrap += 1;
        }
        const contractCell = contractPresent ? meta.contract : `_${meta.contract}_ (no contract)`;
        process.stdout.write(`| \`${area}\` | ${contractCell} | ${adrs.length} | ${readme} | ${status} |\n`);
    }
    const dead = _dead_adr_scope(totalAdrs);
    if (dead !== null) {
        return dead;
    }
    process.stdout.write('\n');
    process.stdout.write(
        `BASELINE: ${Object.keys(AREAS).length} canonical areas · ${missingBootstrap} missing bootstrap ADR(s)\n`,
    );
    return 0;
}

export function cmd_check(): number {
    let hard = 0;
    let warn = 0;
    let totalAdrs = 0;
    for (const dir of unlistedAreaDirs(ADR_ROOT)) {
        process.stderr.write(
            `❌ ${dir}/: area directory exists on disk but is absent from AREAS — it is not audited at all. ` +
                `Add it to the inventory (or delete the directory).\n`,
        );
        hard += 1;
    }
    for (const [area, meta] of Object.entries(AREAS)) {
        const [adrs, errs] = scan_area(area);
        totalAdrs += adrs.length;
        for (const e of errs) {
            process.stderr.write(`❌ ${e}\n`);
            hard += 1;
        }
        if (adrs.length > 0 && !_exists(path.join(ADR_ROOT, area, 'README.md'))) {
            process.stderr.write(`❌ ${area}/: README.md missing\n`);
            hard += 1;
        }
        if (adrs.length === 0) {
            process.stderr.write(`⚠️  ${area}/: no bootstrap ADR yet (contract: ${meta.contract})\n`);
            warn += 1;
        }
    }
    const dead = _dead_adr_scope(totalAdrs);
    if (dead !== null) {
        return dead;
    }
    process.stdout.write(`BASELINE: ${hard} hard fail(s) · ${warn} warn(s)\n`);
    return hard ? 1 : 0;
}

export function cmd_regen_area_readme(area: string): number {
    if (!(area in AREAS)) {
        process.stderr.write(`❌ unknown area '${area}' — add to AREAS inventory first\n`);
        return 1;
    }
    const [adrs, errs] = scan_area(area);
    for (const e of errs) {
        process.stderr.write(`❌ ${e}\n`);
    }
    const out = path.join(ADR_ROOT, area, 'README.md');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render_area_readme(area, AREAS[area] as AreaMeta, adrs), 'utf-8');
    process.stdout.write(`wrote ${_relativeToPosix(out, ROOT)}\n`);
    return 0;
}

interface ParsedArgs {
    check: boolean;
    regen_area_readme: string | null;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { check: false, regen_area_readme: null };
    let seenExclusive = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--check') {
            if (seenExclusive) {
                process.stderr.write(
                    'audit_adr_coverage: error: argument --check: not allowed with argument --regen-area-readme\n',
                );
                process.exit(2);
            }
            out.check = true;
            seenExclusive = true;
        } else if (a === '--regen-area-readme' || a.startsWith('--regen-area-readme=')) {
            if (seenExclusive) {
                process.stderr.write(
                    'audit_adr_coverage: error: argument --regen-area-readme: not allowed with argument --check\n',
                );
                process.exit(2);
            }
            let val: string;
            const eq = a.indexOf('=');
            if (eq !== -1) {
                val = a.slice(eq + 1);
            } else {
                const next = argv[i + 1];
                if (next === undefined) {
                    process.stderr.write(
                        'audit_adr_coverage: error: argument --regen-area-readme: expected one argument\n',
                    );
                    process.exit(2);
                }
                val = next;
                i += 1;
            }
            out.regen_area_readme = val;
            seenExclusive = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: audit_adr_coverage [-h] [--check | --regen-area-readme AREA]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.check) {
        return cmd_check();
    }
    if (args.regen_area_readme) {
        return cmd_regen_area_readme(args.regen_area_readme);
    }
    return cmd_report();
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
