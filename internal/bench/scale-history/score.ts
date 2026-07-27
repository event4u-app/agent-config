#!/usr/bin/env tsx
/**
 * Scale-history bench scorer — SECONDARY verification layer
 * (internal/bench/corpora/scale-history-PREREG.md: the manual rubric in
 * rubric.md is PRIMARY; this script runs lint_persistence over an artifact
 * dir and emits per-class gate-defect counts so linter recall/precision vs
 * the rubric can be reported).
 *
 * Threat model (PR #1016 review, blocking finding): bench artifacts are
 * LLM-generated, UNTRUSTED code. lint_persistence itself is purely static
 * (readFileSync + regex; no require/import/eval of artifact content), so
 * the residual risks are path traversal via a hostile --artifact value and
 * ReDoS/oversized-input DoS. Mitigations here:
 *
 *   1. Artifact-root CONFINEMENT — the artifact dir must realpath-resolve
 *      INSIDE this bench directory; anything else is refused (exit 2).
 *   2. Subprocess isolation — the lint run is spawned through
 *      `hardenedSpawnEnv()` (ADR-123 rail: LD_/DYLD_/GIT_*_COMMAND etc.
 *      scrubbed), never executed in-process on untrusted input.
 *   3. Hard timeout (30s) + output cap — a pathological artifact (ReDoS
 *      bait, giant files) kills the scoring run instead of hanging CI.
 *
 * Usage:
 *   score.ts --artifact <dir-under-internal/bench/scale-history>
 *            [--arm A|B|C] [--family <model-family>]
 *   score.ts --dry            # runs on the committed sample-artifact
 *
 * The dry path is the ONLY thing that executes before the standing
 * benchmark-spend authorization clears (run gate, pre-registered).
 * Exit 0 on scored output · 2 on usage/confinement errors.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { hardenedSpawnEnv } from '../../../src/scripts/_lib/spawn_env.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const LINT = path.join(REPO, 'src', 'scripts', 'lint_persistence.ts');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

interface Finding {
    failure_class: string;
    tier: string;
    waived?: boolean;
}

/** Refuse any artifact path that escapes the bench directory. */
function confine_artifact(raw: string): string | null {
    const given = path.resolve(raw);
    let resolved: string;
    try {
        resolved = fs.realpathSync(given);
    } catch {
        return null;
    }
    const root = fs.realpathSync(HERE) + path.sep;
    if (!(resolved + path.sep).startsWith(root)) return null;
    // Refuse a symlinked artifact root outright (council PR review): the
    // caller must hand the REAL directory, so the path we spawn on is the
    // path we checked — no check-to-use swap via a re-pointed link.
    try {
        if (fs.lstatSync(given).isSymbolicLink()) return null;
        if (!fs.lstatSync(resolved).isDirectory()) return null;
    } catch {
        return null;
    }
    return resolved;
}

function main(argv: string[]): number {
    let artifact = '';
    let arm = 'dry';
    let family = 'none';
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--artifact') artifact = argv[++i] ?? '';
        else if (argv[i] === '--arm') arm = argv[++i] ?? 'dry';
        else if (argv[i] === '--family') family = argv[++i] ?? 'none';
        else if (argv[i] === '--dry') artifact = path.join(HERE, 'sample-artifact');
    }
    if (!artifact) {
        process.stderr.write('usage: score.ts --artifact <dir> | --dry\n');
        return 2;
    }

    const confined = confine_artifact(artifact);
    if (confined === null) {
        process.stderr.write(
            `❌  artifact refused: '${artifact}' does not realpath-resolve inside ` +
                `${HERE} — bench artifacts are untrusted input and must live under the bench root\n`,
        );
        return 2;
    }

    const res = spawnSync(
        TSX,
        [LINT, '--dir', confined, '--stack', 'eloquent', '--stack', 'raw-sql', '--format', 'json'],
        {
            cwd: REPO,
            env: hardenedSpawnEnv(),
            timeout: TIMEOUT_MS,
            maxBuffer: MAX_OUTPUT_BYTES,
            encoding: 'utf8',
        },
    );
    if (res.error || res.signal) {
        process.stderr.write(
            `❌  lint run ${res.signal ? `killed (${res.signal} — timeout/oversize guard)` : `failed: ${res.error}`}\n`,
        );
        return 2;
    }

    let report: { findings: Finding[]; gate_count: number; advice_count: number; waived_count: number };
    try {
        report = JSON.parse(res.stdout);
    } catch {
        process.stderr.write(`❌  lint output was not parseable JSON (exit ${res.status})\n`);
        return 2;
    }

    const by_class: Record<string, number> = {};
    for (const f of report.findings) {
        if (f.waived || f.tier !== 'gate') continue;
        by_class[f.failure_class] = (by_class[f.failure_class] ?? 0) + 1;
    }
    const out = {
        arm,
        family,
        artifact: confined,
        gate_defects_total: report.gate_count,
        by_class,
        advice_count: report.advice_count,
        waived_count: report.waived_count,
        note: 'secondary scorer — manual rubric (rubric.md) is primary per pre-registration',
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return 0;
}

process.exit(main(process.argv.slice(2)));
