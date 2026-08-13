#!/usr/bin/env node
/**
 * design-slop false-positive bench (road-to-design-detector-evidence Phase 2).
 *
 * Measures M1 from `internal/bench/corpora/design-slop-fp-PREREG.md`: for every
 * rule in the registry, the number of CLEAN-corpus files on which it emits at
 * least one finding. Every corpus file is labelled clean by construction, so a
 * finding is a false positive by definition and needs no adjudication.
 *
 * Counting is per FILE, not per hit — the unit a consumer experiences is "this
 * rule flagged this file", and a rule matching six lines of one file is one
 * false positive, not six.
 *
 * M2 (recall on the positive fixtures) is deliberately NOT computed here. It is
 * already a hard assertion in `src/scripts/design_slop_rules.test.ts`; a second
 * implementation over the same fixtures would print a number and add no
 * evidence. See the pre-registration.
 *
 * It lives under `internal/` rather than `src/scripts/` for the same reason the
 * port-fidelity bench does: `package.json` `files[]` ships `src/scripts/` to
 * consumers, and a benchmark corpus is not something a consumer installs.
 *
 * Usage:
 *   npx tsx internal/bench/design-slop-fp/run.ts            — human-readable
 *   npx tsx internal/bench/design-slop-fp/run.ts --json     — machine-readable
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SLOP_RULES } from '../../../src/scripts/design_slop_rules.js';
import { scanFile } from '../../../src/scripts/lint_design_slop.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const CORPUS_DIR = path.join(REPO, 'internal', 'bench', 'corpora', 'design-slop-clean');

/** File classes the corpus carries; each maps onto at least one rule engine. */
const CORPUS_EXT = /\.(css|html|jsx|md)$/i;

/** An empty DESIGN.md context — the corpus declares no intent, so nothing is suppressed. */
const NO_CTX = { raw: '', has: () => false };

export interface RuleScore {
    rule: string;
    catalogId: string;
    /** Number of distinct corpus files on which the rule fired. */
    falsePositives: number;
    /** The files, so a non-zero count is auditable rather than just alarming. */
    files: string[];
}

export interface BenchResult {
    corpusHash: string;
    fileCount: number;
    ruleCount: number;
    scores: RuleScore[];
    /** Rules with at least one false positive — the number the ceiling is about. */
    impureRules: number;
}

/** Corpus files, sorted, so the hash and the report are order-stable. */
export function corpusFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => CORPUS_EXT.test(f))
        .sort()
        .map((f) => path.join(dir, f));
}

/**
 * SHA-256 over `<name>:<sha256 of contents>` per file, sorted. A number quoted
 * without this hash is not comparable to any other number — changing the corpus
 * starts a new epoch rather than updating an old result.
 */
export function corpusHash(files: string[]): string {
    const h = crypto.createHash('sha256');
    for (const f of files) {
        const body = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
        h.update(`${path.basename(f)}:${body}\n`);
    }
    return h.digest('hex');
}

/** Score every registry rule against the corpus. */
export function scoreCorpus(dir: string = CORPUS_DIR): BenchResult {
    const files = corpusFiles(dir);
    const hits = new Map<string, string[]>();
    for (const rule of SLOP_RULES) hits.set(rule.id, []);

    for (const file of files) {
        const rel = path.basename(file);
        const findings = scanFile(fs.readFileSync(file, 'utf-8'), rel, NO_CTX);
        for (const id of new Set(findings.map((f) => f.rule))) {
            hits.get(id)?.push(rel);
        }
    }

    const scores: RuleScore[] = SLOP_RULES.map((r) => ({
        rule: r.id,
        catalogId: r.catalogId,
        falsePositives: (hits.get(r.id) ?? []).length,
        files: hits.get(r.id) ?? [],
    }));

    return {
        corpusHash: corpusHash(files),
        fileCount: files.length,
        ruleCount: SLOP_RULES.length,
        scores,
        impureRules: scores.filter((s) => s.falsePositives > 0).length,
    };
}

function report(result: BenchResult): string {
    const lines: string[] = [];
    lines.push(`design-slop FP bench · ${result.ruleCount} rules × ${result.fileCount} clean files`);
    lines.push(`corpus ${result.corpusHash.slice(0, 16)}`);
    lines.push('');
    if (result.impureRules === 0) {
        lines.push('M1 = 0 for every rule — no rule fired on the clean corpus.');
        lines.push('');
        lines.push('Read this as the pre-registration says to: it has NOT shown the');
        lines.push('detector is precise. It has shown this corpus does not discriminate,');
        lines.push('which is a statement about the corpus.');
    } else {
        lines.push(`M1 non-zero for ${result.impureRules} of ${result.ruleCount} rules:`);
        for (const s of result.scores.filter((x) => x.falsePositives > 0)) {
            lines.push(`  ${s.rule} (${s.catalogId}) — ${s.falsePositives} file(s): ${s.files.join(', ')}`);
        }
    }
    return lines.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const files = corpusFiles(CORPUS_DIR);
    if (files.length === 0) {
        process.stderr.write(
            `design-slop FP bench: no corpus at ${path.relative(REPO, CORPUS_DIR)} — a bench that scans nothing exits green, so this is an error\n`,
        );
        return 1;
    }
    const result = scoreCorpus();
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(result, null, 2)}\n` : `${report(result)}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
