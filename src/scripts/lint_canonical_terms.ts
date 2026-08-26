#!/usr/bin/env tsx
/**
 * Canonical-terms lint — the house dialect, held by a ratchet.
 *
 * `src/config/canonical-terms.yml` records which side of nine measured spelling
 * pairs this repository writes. Until this gate existed, nothing held that
 * decision: the map was a document, and a document cannot stop the next commit
 * from reintroducing `behaviour`. `road-to-canonical-terms` 2.2.
 *
 * ── What it reads, and what it deliberately does not ────────────────────────
 * Prose only, under `src/` and `docs/` — the SHIPPED surface, which is the
 * surface the map was decided on (22/78 American in `src/`; the British lead in
 * the published aggregate is produced almost entirely by `agents/`, this
 * repository's own working notes). Scanning `agents/` would judge roadmaps,
 * evidence files and an archive nobody will edit again against a convention
 * chosen for the shipped tree.
 *
 * Skipped, via the shared classifier in `_lib/md_prose_lines.ts` rather than a
 * second copy of it: YAML frontmatter, fenced code, indented code, inline code
 * spans, and any line carrying `<!-- canonical-terms: ignore -->`.
 *
 * ── Protected text ──────────────────────────────────────────────────────────
 * Licence TITLES are exact external strings and are never rewritten — `MIT
 * License`, `Apache License`, `GNU General Public License` and their family.
 * The council was explicit on the limit of that carve-out: **proximity to a
 * protected name does not exempt the surrounding prose.** So the exemption is
 * span-scoped, not line-scoped — the title is blanked and the rest of the line
 * is still read.
 *
 * URLs, link targets and paths are blanked for the same reason: `licence` in a
 * URL is an address, not a word.
 *
 * ── Ratchet, not a hard zero ────────────────────────────────────────────────
 * `sweep_authorised: false` in the map is a live constraint, not a formality:
 * the AI council refused an unconditional ~5000-occurrence rewrite and required
 * a classified inventory plus a bounded pilot first. So the corpus is NOT clean
 * on day one, and a hard-zero gate would either fail `main` immediately or have
 * to suppress the findings it exists to surface. `checkRatchet` records the
 * remaining count; the gate fails only when it RISES. Lowering the baseline is
 * a normal commit, raising it is a defect, and the entry expires so the number
 * cannot harden into configuration.
 *
 * ── Inventory mode ──────────────────────────────────────────────────────────
 * `--inventory` classifies every occurrence across a wider root set into the
 * four categories the council named — repository-authored prose, protected
 * exact text, generated or externally synchronised content, and ambiguous —
 * and prints the table the migration is designed from. A frequency count cannot
 * tell (a) from (b); that distinction is the whole point of the mode.
 *
 * Exit codes: 0 clean or within ratchet · 1 regression · 2 usage / dead scope.
 *
 * Usage:
 *     ./scripts-run src/scripts/lint_canonical_terms
 *     ./scripts-run src/scripts/lint_canonical_terms --inventory
 *     ./scripts-run src/scripts/lint_canonical_terms --inventory --format json
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { checkRatchet } from './_lib/gate_baseline.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { classifyMarkdownLines } from './_lib/md_prose_lines.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Where the house dialect is recorded. */
export const MAP_REL = 'src/config/canonical-terms.yml';

/** The gate's enforcing scope — the shipped surface the map was decided on. */
export const GATE_ROOTS = ['src/', 'docs/'] as const;

/** The inventory's scope — everything the sweep would ever touch. */
export const INVENTORY_ROOTS = ['src/', 'docs/', 'agents/', 'dist/'] as const;

/** Per-line opt-out. */
const IGNORE_RE = /<!--\s*canonical-terms:\s*ignore\s*-->/i;

/**
 * Generated or externally synchronised trees. An occurrence here is category
 * (c): rewriting it is a no-op that the next `task sync` reverts.
 */
const GENERATED_PREFIXES = [
    'dist/',
    '.augment/',
    '.claude/',
    '.cursor/',
    '.clinerules/',
    'node_modules/',
    // The retired uncondensed source container ADR-051 abandoned is deliberately
    // NOT listed. `check_no_new_legacy_path` refuses new references to it under
    // src/, and no scan root here reaches it — so an entry would be a dead
    // literal reintroducing a path this repository has spent a ratchet removing.
    // Built by `src/scripts/build_proof.ts` from the Claims Ledger; editing it
    // is a no-op that the next build reverts.
    'docs/proof.md',
] as const;

/**
 * Immutable records. Repository-authored, but rewriting them edits history:
 * an archived roadmap and a dated evidence file are what the repository SAID,
 * and a sweep that changes them makes the record disagree with the measurement
 * it published. Category (d) — a human decides, per file.
 */
const HISTORICAL_PREFIXES = [
    'agents/roadmaps/archive/',
    'agents/roadmaps/skipped/',
    'agents/evidence/',
    'docs/decisions/',
    // Frozen changelog slices. `docs/archive/CHANGELOG-pre-*.md` is what the
    // repository published at that version; rewriting it makes the record
    // disagree with the release it describes.
    'docs/archive/',
    'CHANGELOG.md',
] as const;

/** Licence titles — exact external strings, never rewritten. */
const LICENCE_TITLE_RE =
    /\b(?:MIT|Apache(?:\s+\d+(?:\.\d+)?)?|BSD(?:[- ]\d[- ]Clause)?|ISC|MPL|Mozilla\s+Public|GNU\s+(?:Lesser\s+|Affero\s+)?General\s+Public|Creative\s+Commons|Unlicense|EUPL|Eclipse\s+Public)\s+Licen[cs]e\b/gi;

/** Link targets, URLs and bare paths — addresses, not words. */
const ADDRESS_RE = /\]\([^)]*\)|<[^>\s]+>|\bhttps?:\/\/\S+|\b[\w./-]+\.(?:md|ts|js|json|ya?ml|py|sh|html)\b/g;

export type TermCategory = 'authored-prose' | 'protected-text' | 'generated' | 'ambiguous';

export interface TermPair {
    canonical: string;
    variant: string;
    confidence: string;
}

export interface TermFinding {
    file: string;
    line: number;
    variant: string;
    canonical: string;
    category: TermCategory;
    context: string;
}

interface CanonicalTermsMap {
    sweep_authorised?: boolean;
    terms?: { canonical?: string | null; variant?: string; confidence?: string }[];
}

/** Read the decided pairs. Undecided entries (`canonical: null`) are skipped. */
export function loadPairs(repoRoot: string = REPO_ROOT, rel: string = MAP_REL): TermPair[] {
    const raw = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    const doc = parseYaml(raw) as CanonicalTermsMap;
    const out: TermPair[] = [];
    for (const t of doc.terms ?? []) {
        if (t.canonical === null || t.canonical === undefined) continue;
        if (typeof t.variant !== 'string' || t.variant === '') continue;
        out.push({ canonical: t.canonical, variant: t.variant, confidence: t.confidence ?? 'unknown' });
    }
    return out;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match the variant as a whole word, and also as the stem of its own
 * inflections — `behaviour` must catch `behaviours` and `behavioural`, which is
 * where a naive `\b…\b` silently under-reports. The leading boundary stays
 * strict so `licence` does not fire inside `unlicenced-source`… it does, and
 * that is correct: that is the variant.
 */
function variantRegExp(variant: string): RegExp {
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(variant)}(?:s|es|d|al|ally|ing)?(?![\\p{L}\\p{N}_])`, 'giu');
}

function blankSpans(line: string, re: RegExp): string {
    re.lastIndex = 0;
    return line.replace(re, (m) => ' '.repeat(m.length));
}

function fileCategory(file: string): TermCategory | null {
    if (GENERATED_PREFIXES.some((p) => file.startsWith(p))) return 'generated';
    if (HISTORICAL_PREFIXES.some((p) => file.startsWith(p))) return 'ambiguous';
    return null;
}

/**
 * Classify every variant occurrence in one document.
 *
 * Pure over the content string, so the four states the roadmap's verify clause
 * names — prose, fence, frontmatter, quoted licence title — are demonstrable
 * from literals with no repo.
 */
export function scanContent(file: string, content: string, pairs: readonly TermPair[]): TermFinding[] {
    const findings: TermFinding[] = [];
    const forcedCategory = fileCategory(file);

    for (const line of classifyMarkdownLines(content, { markers: [IGNORE_RE] })) {
        if (line.kind !== 'prose') continue;

        // `text` already has inline code spans blanked. Blank the protected
        // spans on top, keeping the line length so a category decision made on
        // the blanked text still lines up with the raw one.
        const protectedBlanked = blankSpans(blankSpans(line.text, LICENCE_TITLE_RE), ADDRESS_RE);

        for (const pair of pairs) {
            const re = variantRegExp(pair.variant);
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(line.text)) !== null) {
                const at = m.index;
                const survives = protectedBlanked.slice(at, at + m[0].length).trim() !== '';
                const category: TermCategory = !survives
                    ? 'protected-text'
                    : (forcedCategory ?? 'authored-prose');
                findings.push({
                    file,
                    line: line.lineno,
                    variant: m[0],
                    canonical: pair.canonical,
                    category,
                    context: line.raw.trim(),
                });
            }
        }
    }
    return findings;
}

/**
 * Every markdown file under the given roots — TRACKED and UNTRACKED.
 *
 * `--others --exclude-standard` is load-bearing, not thoroughness. The gate's
 * canary in `gate-coverage.yml` is create-only by contract, so it plants a NEW,
 * untracked file; a plain `git ls-files` would not see it and the gate would
 * report green on its own canary — the exact "gate that cannot fail" failure
 * `check_gate_coverage --canary` exists to catch.
 */
function listMarkdown(repoRoot: string, roots: readonly string[]): string[] {
    const patterns = [...roots.map((r) => `${r}**/*.md`), ...roots.map((r) => `${r}*.md`)];
    const run = (args: string[]): string[] =>
        execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            .split('\n')
            .filter((l) => l.endsWith('.md'));
    const tracked = run(['ls-files', '--', ...patterns]);
    const untracked = run(['ls-files', '--others', '--exclude-standard', '--', ...patterns]);
    return Array.from(new Set([...tracked, ...untracked])).sort();
}

export interface ScanResult {
    findings: TermFinding[];
    filesScanned: number;
}

/** Every `.md` under a plain directory — the fixture path, where there is no git index. */
function walkMarkdown(root: string): string[] {
    const out: string[] = [];
    const visit = (dir: string): void => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, ent.name);
            if (ent.isDirectory()) visit(abs);
            else if (ent.name.endsWith('.md')) out.push(path.relative(root, abs));
        }
    };
    visit(root);
    return out.sort();
}

/**
 * Scan a tree, accounting for every file through a {@link GateLedger}.
 *
 * The ledger is not decoration here. This gate `continue`s past unreadable
 * files, and a `continue` with no record is precisely the silent-skip the
 * ledger exists to make visible — a gate that read 1,400 of 1,577 files and
 * printed a green checkmark is indistinguishable from one that read all of them.
 */
export function scanTree(
    repoRoot: string,
    roots: readonly string[],
    pairs: readonly TermPair[],
    ledger?: GateLedger,
): ScanResult {
    const files = roots.length === 1 && roots[0] === '' ? walkMarkdown(repoRoot) : listMarkdown(repoRoot, roots);
    ledger?.plan(files);
    const findings: TermFinding[] = [];
    for (const f of files) {
        let content: string;
        try {
            content = fs.readFileSync(path.join(repoRoot, f), 'utf8');
        } catch {
            ledger?.skip(f, 'binary_content');
            continue;
        }
        const hits = scanContent(f, content, pairs);
        findings.push(...hits);
        const actionable = hits.filter((h) => h.category === 'authored-prose');
        if (actionable.length > 0) ledger?.fail(f, `${actionable.length} non-canonical occurrence(s)`);
        else ledger?.complete(f);
    }
    return { findings, filesScanned: files.length };
}

function countBy(items: readonly { [k: string]: unknown }[], key: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const it of items) {
        const k = String(it[key]);
        out[k] = (out[k] ?? 0) + 1;
    }
    return out;
}

function renderInventory(result: ScanResult, pairs: readonly TermPair[]): string {
    const byCat = countBy(result.findings as unknown as Record<string, unknown>[], 'category');
    const lines: string[] = [];
    lines.push(`files scanned: ${result.filesScanned}`);
    lines.push(`occurrences:   ${result.findings.length}`);
    lines.push('');
    lines.push('| category | occurrences | what it means |');
    lines.push('|---|---:|---|');
    const meaning: Record<TermCategory, string> = {
        'authored-prose': 'repository-authored prose, eligible for normalisation',
        'protected-text': 'exact external text — licence titles, addresses, code spans',
        generated: 'generated or externally synchronised; a rewrite is reverted by `task sync`',
        ambiguous: 'immutable record (archive, evidence, ADRs, changelog) — a human decides per file',
    };
    for (const c of ['authored-prose', 'protected-text', 'generated', 'ambiguous'] as TermCategory[]) {
        lines.push(`| ${c} | ${byCat[c] ?? 0} | ${meaning[c]} |`);
    }
    lines.push('');
    lines.push('| pair | authored-prose | files | blast radius |');
    lines.push('|---|---:|---:|---|');
    for (const p of pairs) {
        const hits = result.findings.filter((f) => f.canonical === p.canonical && f.category === 'authored-prose');
        const files = new Set(hits.map((f) => f.file));
        lines.push(`| \`${p.variant}\` → \`${p.canonical}\` | ${hits.length} | ${files.size} | ${files.size <= 5 ? 'small' : files.size <= 25 ? 'medium' : 'large'} |`);
    }
    return lines.join('\n');
}


/**
 * Rewrite one matched token to the canonical side, preserving inflection and
 * capitalization. `Sub-agents` → `Subagents`, `behavioural` → `behavioral`,
 * `canonicalised` → `canonicalized`.
 *
 * The suffix is whatever the variant regex matched beyond the base, so the
 * inflection set is defined in exactly one place ({@link variantRegExp}) and a
 * new suffix added there is automatically handled here.
 */
export function canonicalizeToken(token: string, pair: TermPair): string {
    const lower = token.toLowerCase();
    const base = pair.variant.toLowerCase();
    if (!lower.startsWith(base)) return token;
    const suffix = lower.slice(base.length);
    const replacement = pair.canonical + suffix;
    if (token === token.toUpperCase() && token !== token.toLowerCase()) return replacement.toUpperCase();
    if (token[0] === token[0]?.toUpperCase() && token[0] !== token[0]?.toLowerCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
}

/**
 * Apply the canonical side to the `authored-prose` occurrences of the selected
 * pairs, and only those.
 *
 * The rewrite is driven by the SAME classification the gate reports, so a
 * category the scanner protects is a category the sweep cannot touch — there is
 * no second find-and-replace with its own idea of what a fence is. That is the
 * property the council's "classified inventory, not a frequency count"
 * condition was asking for.
 */
export function applyFix(
    repoRoot: string,
    findings: readonly TermFinding[],
    pairs: readonly TermPair[],
): { files: number; occurrences: number } {
    const byCanonical = new Map(pairs.map((p) => [p.canonical, p]));
    const byFile = new Map<string, TermFinding[]>();
    for (const f of findings) {
        if (f.category !== 'authored-prose') continue;
        const list = byFile.get(f.file) ?? [];
        list.push(f);
        byFile.set(f.file, list);
    }
    let occurrences = 0;
    for (const [file, list] of byFile) {
        const abs = path.join(repoRoot, file);
        const lines = fs.readFileSync(abs, 'utf8').split('\n');
        // Group per line so several hits on one line are rewritten together.
        const lineNos = Array.from(new Set(list.map((f) => f.line)));
        for (const lineNo of lineNos) {
            const idx = lineNo - 1;
            let text = lines[idx] ?? '';
            for (const pair of new Set(list.filter((f) => f.line === lineNo).map((f) => byCanonical.get(f.canonical)!))) {
                const re = variantRegExp(pair.variant);
                text = text.replace(re, (tok) => canonicalizeToken(tok, pair));
            }
            if (text !== lines[idx]) {
                occurrences += list.filter((f) => f.line === lineNo).length;
                lines[idx] = text;
            }
        }
        fs.writeFileSync(abs, lines.join('\n'), 'utf8');
    }
    return { files: byFile.size, occurrences };
}


/**
 * Self-test — the gate proving it can still fail, on a fixture tree.
 *
 * The `--root` seam exists for exactly this: a fixture must never be judged
 * against the repository's recorded debt, so `--root` bypasses the ratchet and
 * uses the plain "any authored-prose occurrence is a failure" rule. The four
 * cases are the four states the roadmap's verify clause names.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lct-selftest-'));
    const write = (rel: string, body: string): string => {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf-8');
        return path.dirname(p);
    };
    const run = (dir: string): number =>
        runGateCli(REPO_ROOT, 'src/scripts/lint_canonical_terms.ts', ['--root', dir, '--quiet'], REPO_ROOT);

    try {
        return runSelfTest({
            gate: 'lint_canonical_terms',
            minCases: 4,
            minRejectCases: 1,
            cases: [
                {
                    name: 'a non-canonical spelling in prose is rejected',
                    expect: 'reject',
                    run: () => run(write('prose/doc.md', 'The observed behaviour is wrong.\n')),
                },
                {
                    name: 'the same word inside a fence passes',
                    expect: 'accept',
                    run: () => run(write('fence/doc.md', 'Prose.\n\n```ts\n// behaviour\n```\n')),
                },
                {
                    name: 'the same word inside a frontmatter value passes',
                    expect: 'accept',
                    run: () => run(write('fm/doc.md', '---\ndescription: behaviour\n---\n\nProse.\n')),
                },
                {
                    name: 'the same word inside a quoted licence title passes',
                    expect: 'accept',
                    run: () => run(write('lic/doc.md', 'Shipped under the Mozilla Public Licence.\n')),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(
            'usage: lint_canonical_terms [--inventory] [--format {text,json}] [--quiet]\n' +
                '  Default: ratchet over authored prose under src/ and docs/.\n' +
                '  --inventory: classified occurrence table across src/, docs/, agents/ and dist/.\n' +
                '  --fix --pair <canonical>[,<canonical>]: rewrite authored-prose occurrences of\n' +
                '        the named pairs only. Refuses without --pair: the map carries\n' +
                '        `sweep_authorised: false`, so an unbounded sweep is not available here.\n' +
                '  --root <dir>: judge a fixture tree instead of the repo (no ratchet).\n' +
                '  --self-test: prove the gate can still fail.\n',
        );
        return 0;
    }
    if (argv.includes('--self-test')) return selfTest();

    const rootIdx = argv.indexOf('--root');
    const fixtureRoot = rootIdx !== -1 && rootIdx + 1 < argv.length ? (argv[rootIdx + 1] as string) : null;

    const quiet = argv.includes('--quiet');
    const asJson = argv.includes('--format=json') || (argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json');
    const inventory = argv.includes('--inventory');
    const fix = argv.includes('--fix');
    const pairArgIdx = argv.indexOf('--pair');
    const selected =
        pairArgIdx !== -1 && pairArgIdx + 1 < argv.length
            ? new Set((argv[pairArgIdx + 1] as string).split(',').map((s) => s.trim()).filter(Boolean))
            : null;

    if (fix && (selected === null || selected.size === 0)) {
        process.stderr.write(
            'lint_canonical_terms: --fix requires --pair. `sweep_authorised: false` in ' +
                `${MAP_REL} means the corpus-wide sweep is not authorised; the pilot is bounded ` +
                'by naming the pairs it may touch.\n',
        );
        return 2;
    }

    const pairs = loadPairs();

    if (fixtureRoot !== null) {
        // Fixture mode: no git index, no ratchet. Any authored-prose occurrence
        // fails, which is what makes an accept/reject self-test meaningful.
        const fixture = scanTree(path.resolve(fixtureRoot), [''], pairs);
        const bad = fixture.findings.filter((f) => f.category === 'authored-prose');
        if (!quiet) {
            for (const f of bad) process.stderr.write(`    ${f.file}:${f.line} \`${f.variant}\` -> \`${f.canonical}\`\n`);
            process.stdout.write(`scanned: ${fixture.filesScanned}\n`);
        }
        return bad.length > 0 ? 1 : 0;
    }

    const roots = inventory ? INVENTORY_ROOTS : GATE_ROOTS;
    const ledger = inventory ? undefined : new GateLedger('lint_canonical_terms');
    const result = scanTree(REPO_ROOT, roots, pairs, ledger);

    try {
        assertScanned({
            gate: 'lint_canonical_terms',
            scanned: result.filesScanned,
            units: 'markdown file(s)',
            roots,
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    if (fix) {
        const scoped = result.findings.filter((f) => selected!.has(f.canonical));
        const applied = applyFix(REPO_ROOT, scoped, pairs);
        process.stdout.write(
            `lint_canonical_terms --fix: ${applied.occurrences} occurrence(s) in ${applied.files} file(s) ` +
                `for pair(s) ${[...selected!].join(', ')}.\n`,
        );
        return 0;
    }

    if (inventory) {
        if (asJson) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
            process.stdout.write(`${renderInventory(result, pairs)}\n`);
        }
        return 0;
    }

    const actionable = result.findings.filter((f) => f.category === 'authored-prose');
    if (asJson) {
        process.stdout.write(`${JSON.stringify({ findings: actionable, filesScanned: result.filesScanned }, null, 2)}\n`);
    }

    const verdict = checkRatchet({
        gate: 'lint_canonical_terms',
        actual: actionable.length,
        repoRoot: REPO_ROOT,
    });

    if (!verdict.ok) {
        ledger?.report();
        // The machine-readable count is emitted on the RED path too. Rule 1 of
        // the gate-coverage manifest asks for exactly one `scanned:` line, and a
        // gate that publishes its coverage only when it passes cannot be caught
        // going blind at the moment that matters most. This was missing when the
        // gate landed, and `check_gate_coverage` reported it the first time the
        // ratchet went red — which is the census working.
        process.stdout.write(`scanned: ${result.filesScanned}\n`);
        if (!quiet) {
            for (const f of actionable.slice(0, 40)) {
                process.stderr.write(`    ${f.file}:${f.line} · \`${f.variant}\` → \`${f.canonical}\`\n`);
            }
            if (actionable.length > 40) process.stderr.write(`    … and ${actionable.length - 40} more\n`);
        }
        process.stderr.write(`❌  ${verdict.message}\n`);
        return 1;
    }

    ledger?.report(quiet ? () => undefined : undefined);
    if (!quiet) {
        process.stdout.write(`✅  ${verdict.message}\n`);
        process.stdout.write(`scanned: ${result.filesScanned}\n`);
    }
    return 0;
}

/* c8 ignore start */
function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href;
}
if (isCliEntry()) {
    process.exit(main());
}
/* c8 ignore stop */
