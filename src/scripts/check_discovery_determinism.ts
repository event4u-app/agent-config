#!/usr/bin/env tsx
/**
 * Determinism check — runs the discovery scanner twice and diffs the output.
 *
 * TypeScript twin of `src/scripts/check_discovery_determinism.py` (ADR-094,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — no flags,
 * exit codes (0 deterministic, 1 drift), stdout/stderr split, byte-identical
 * messages, and the same `generated_at` normalization + sorted-key JSON
 * comparison. The scanner itself (`build_discovery_manifest.py`) has no TS
 * twin yet, so this twin runs the SAME Python scanner via `python3`, exactly
 * as the Python original runs it via `sys.executable`. No behaviour changes.
 *
 * Exit codes:
 *   0  byte-identical (apart from generated_at)
 *   1  drift detected
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCANNER = path.join(ROOT, 'src', 'scripts', 'build_discovery_manifest.py');

type Json = unknown;

/** Recursive key-sort, mirroring Python json.dumps(sort_keys=True). */
function _sortRec(v: Json): Json {
    if (Array.isArray(v)) {
        return v.map(_sortRec);
    }
    if (v !== null && typeof v === 'object') {
        const out: Record<string, Json> = {};
        for (const k of Object.keys(v as Record<string, Json>).sort()) {
            out[k] = _sortRec((v as Record<string, Json>)[k]);
        }
        return out;
    }
    return v;
}

/** Mirror Python json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False). */
function _dumps(obj: Json): string {
    return JSON.stringify(_sortRec(obj), null, 2);
}

function _run(): Record<string, Json> {
    const proc = spawnSync('python3', [SCANNER], {
        encoding: 'utf-8',
        cwd: ROOT,
        maxBuffer: 256 * 1024 * 1024,
    });
    if (proc.status !== 0) {
        process.stderr.write(proc.stderr ?? '');
        throw new ExitError(`scanner failed: exit ${proc.status}`);
    }
    return JSON.parse(proc.stdout ?? '') as Record<string, Json>;
}

function _normalise(manifest: Record<string, Json>): Record<string, Json> {
    const out = { ...manifest };
    out['generated_at'] = '<normalised>';
    return out;
}

/** Mirrors `raise SystemExit(msg)` — non-zero exit, message to stderr. */
class ExitError extends Error {}

function main(): number {
    const a = _normalise(_run());
    const b = _normalise(_run());
    const sa = _dumps(a);
    const sb = _dumps(b);
    if (sa !== sb) {
        process.stderr.write('DRIFT: scanner produced different output across two runs\n');
        // show first divergence
        const la = sa.split('\n');
        const lb = sb.split('\n');
        const n = Math.min(la.length, lb.length);
        for (let i = 0; i < n; i++) {
            if (la[i] !== lb[i]) {
                process.stderr.write(`  line ${i + 1}:\n`);
                process.stderr.write(`    run1: ${la[i]}\n`);
                process.stderr.write(`    run2: ${lb[i]}\n`);
                break;
            }
        }
        return 1;
    }
    // also assert the checksum survives the round-trip
    if (a['checksum'] !== b['checksum']) {
        process.stderr.write(
            `DRIFT: checksum changed (${String(a['checksum'])} vs ${String(b['checksum'])})\n`,
        );
        return 1;
    }
    process.stdout.write(
        `OK: deterministic across 2 runs, checksum ${String(a['checksum']).slice(0, 24)}...\n`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitError) {
            process.stderr.write(`${exc.message}\n`);
            process.exit(1);
        }
        throw exc;
    }
}

export { ROOT, SCANNER, main };
