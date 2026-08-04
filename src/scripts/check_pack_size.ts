#!/usr/bin/env tsx
/**
 * check_pack_size — enforce the published-tarball payload budget
 * (road-to-zero-ceremony-install Phase 4).
 *
 * Two metrics, both ungated before this script existed:
 *   1. COMPRESSED tarball size — absolute max, plus the >regression_pct creep
 *      rule (fails even under the absolute budget, so slow rot cannot hide
 *      under a generous cap).
 *   2. PER-SKILL share of the skills subtree — no single skill may silently
 *      reclaim space freed elsewhere. Named exceptions carry a reason.
 *
 * The UNPACKED size is deliberately NOT gated here — and since 2026-08-04 not
 * anywhere: the former `evaluator-budgets.unpacked_size_mb` key was removed by
 * maintainer decision (see `removed_2026_08_04` in evaluator-budgets.json);
 * the evaluator umbrella still measures it as evidence.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_pack_size [--json]
 *   ./scripts-run src/scripts/check_pack_size --pack-json <file>   # test/offline
 *
 * Exit codes: 0 green · 1 over budget · 2 misuse / unreadable input.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'src', 'config', 'pack-size-budget.json');
const SKILL_PREFIX = 'dist/agent-src/skills/';

export interface PackFile {
    path: string;
    size: number;
}

export interface PackResult {
    size: number;
    unpackedSize: number;
    files: PackFile[];
}

export interface PackSizeBudget {
    regression_pct: number;
    budgets: Record<string, { max: number; last_measured: number; method: string }>;
    per_skill_share: {
        max_pct: number;
        basis: string;
        rationale: string;
        exceptions: Record<string, { max_pct: number; measured_pct: number; reason: string }>;
    };
}

/**
 * Parse `npm pack --json` stdout. npm runs the `prepare` lifecycle script even
 * under `--ignore-scripts` on some versions, and this repo's `prepare` prints a
 * banner — straight into the stream we parse. Slice from a `[` so a lifecycle
 * banner is tolerated instead of becoming a SyntaxError.
 *
 * Not the FIRST `[`: npm echoes the lifecycle command line, and this repo's own
 * `prepare` is `[ -d .git ] && bash src/scripts/install-hooks.sh || true` — its
 * `[` precedes the payload's. Try each candidate offset in order and keep the
 * first that actually parses (road-to-gates-that-can-fail Phase 6.2).
 */
export function parsePackJson(stdout: string): PackResult {
    let parsed: PackResult[] | null = null;
    for (let i = stdout.indexOf('['); i >= 0; i = stdout.indexOf('[', i + 1)) {
        try {
            parsed = JSON.parse(stdout.slice(i)) as PackResult[];
            break;
        } catch {
            // Not the payload — a banner bracket. Keep scanning.
        }
    }
    // No candidate parsed: reproduce the original SyntaxError from the raw text.
    parsed ??= JSON.parse(stdout) as PackResult[];
    const first = parsed[0];
    if (first === undefined) throw new Error('npm pack --json returned an empty array');
    return first;
}

/** Bytes per skill under `dist/agent-src/skills/`, plus the subtree total. */
export function skillBytes(files: readonly PackFile[]): { perSkill: Record<string, number>; total: number } {
    const perSkill: Record<string, number> = {};
    let total = 0;
    for (const file of files) {
        if (!file.path.startsWith(SKILL_PREFIX)) continue;
        const name = file.path.slice(SKILL_PREFIX.length).split('/')[0];
        if (name === undefined || name === '') continue;
        perSkill[name] = (perSkill[name] ?? 0) + file.size;
        total += file.size;
    }
    return { perSkill, total };
}

/** Every violation, as human-readable lines. Empty array means green. */
export function evaluate(budget: PackSizeBudget, pack: PackResult): string[] {
    const errors: string[] = [];

    const packedMb = pack.size / 1e6;
    const entry = budget.budgets['packed_size_mb'];
    if (entry === undefined) {
        errors.push('packed_size_mb: missing from the budget file — gate would pass vacuously');
    } else if (packedMb > entry.max) {
        errors.push(`packed_size_mb: measured ${packedMb.toFixed(3)} exceeds budget ${entry.max}`);
    } else {
        const pct = budget.regression_pct;
        const ceiling = entry.last_measured * (1 + pct / 100);
        if (entry.last_measured > 0 && packedMb > ceiling) {
            errors.push(
                `packed_size_mb: measured ${packedMb.toFixed(3)} regressed >${pct}% vs ` +
                    `last_measured ${entry.last_measured} (ceiling ${ceiling.toFixed(3)}) — ` +
                    'fails even under the absolute budget',
            );
        }
    }

    const { perSkill, total } = skillBytes(pack.files);
    if (total === 0) {
        errors.push(`per_skill_share: no files under ${SKILL_PREFIX} — gate would pass vacuously`);
        return errors;
    }
    const { max_pct: defaultMax, exceptions } = budget.per_skill_share;
    for (const [name, bytes] of Object.entries(perSkill)) {
        const share = (bytes / total) * 100;
        const exception = exceptions[name];
        const cap = exception?.max_pct ?? defaultMax;
        if (share > cap) {
            errors.push(
                exception === undefined
                    ? `per_skill_share: ${name} is ${share.toFixed(2)}% of the skills payload, over the ${cap}% cap — ` +
                      'shrink it, or add a named exception with a reason'
                    : `per_skill_share: ${name} is ${share.toFixed(2)}%, over its own exception cap of ${cap}% — ` +
                      'the exception is not a blank cheque; shrink it or raise the cap with a reason',
            );
        }
    }
    for (const name of Object.keys(exceptions)) {
        if (!(name in perSkill)) {
            errors.push(`per_skill_share: exception for '${name}' is stale — no such skill ships`);
        }
    }
    return errors;
}

function readPack(argv: readonly string[]): PackResult {
    const idx = argv.indexOf('--pack-json');
    if (idx >= 0) {
        const file = argv[idx + 1];
        if (file === undefined) throw new Error('--pack-json needs a path');
        return parsePackJson(fs.readFileSync(file, 'utf-8'));
    }
    const stdout = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--silent'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parsePackJson(stdout);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let budget: PackSizeBudget;
    let pack: PackResult;
    try {
        budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf-8')) as PackSizeBudget;
    } catch (err) {
        process.stderr.write(`❌  pack size: cannot read ${BUDGET_PATH}: ${String(err)}\n`);
        return 2;
    }
    try {
        pack = readPack(argv);
    } catch (err) {
        process.stderr.write(`❌  pack size: npm pack failed: ${String(err)}\n`);
        return 2;
    }
    // The pack manifest IS the corpus. `evaluate` refuses a vacuous per-skill
    // share, but the packed-size arm has no such floor: an empty payload — a
    // botched `files[]`, a pack that resolved nothing — measures 0 MB and sits
    // comfortably under every budget.
    try {
        assertScanned({
            gate: 'check_pack_size',
            scanned: pack.files.length,
            units: 'packed file(s)',
            roots: ['npm pack --dry-run payload (package.json files[])'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            // 2, not 1: the documented meaning of 1 is "over budget", and an
            // empty manifest is unreadable input, not a budget violation.
            process.stderr.write(`❌  pack size: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    const errors = evaluate(budget, pack);
    const { perSkill, total } = skillBytes(pack.files);
    if (argv.includes('--json')) {
        process.stdout.write(
            `${JSON.stringify({ packed_mb: pack.size / 1e6, skills_total_bytes: total, skills: Object.keys(perSkill).length, errors }, null, 2)}\n`,
        );
        return errors.length > 0 ? 1 : 0;
    }
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  pack size: ${e}\n`);
        return 1;
    }
    process.stdout.write(
        `✅  pack size within budget — ${(pack.size / 1e6).toFixed(3)} MB packed, ` +
            `${Object.keys(perSkill).length} skills, largest share ` +
            `${Math.max(...Object.values(perSkill).map((b) => (b / total) * 100)).toFixed(2)}%\n`,
    );
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
