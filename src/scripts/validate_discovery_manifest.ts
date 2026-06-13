#!/usr/bin/env tsx
/**
 * Stale-manifest guard — re-builds the manifest in memory and diffs it
 * against the committed `dist/discovery/discovery-manifest.json`.
 *
 * TypeScript twin of `src/scripts/validate_discovery_manifest.py` (ADR-092,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — `--quiet`
 * flag, exit codes (0 match, 1 drift / missing committed manifest),
 * stdout/stderr split, byte-identical messages, and the same `generated_at`
 * normalization + sorted-key JSON comparison + first-diff-line report. The
 * scanner (`build_discovery_manifest.py`) has no TS twin yet, so this twin
 * runs the SAME Python scanner via `python3`, exactly as the Python original
 * runs it via `sys.executable`. No behaviour changes.
 *
 * Exit codes:
 *   0  manifest on disk matches a fresh re-build
 *   1  drift detected (committed manifest is stale)
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCANNER = path.join(ROOT, 'src', 'scripts', 'build_discovery_manifest.py');
const COMMITTED = path.join(ROOT, 'dist', 'discovery', 'discovery-manifest.json');

type Json = unknown;
type JsonObject = Record<string, Json>;

class ExitError extends Error {}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Recursive key-sort, mirroring Python json.dumps(sort_keys=True). */
function _sortRec(v: Json): Json {
    if (Array.isArray(v)) {
        return v.map(_sortRec);
    }
    if (v !== null && typeof v === 'object') {
        const out: JsonObject = {};
        for (const k of Object.keys(v as JsonObject).sort()) {
            out[k] = _sortRec((v as JsonObject)[k]);
        }
        return out;
    }
    return v;
}

/** Mirror `json.dumps(out, indent=2, sort_keys=True, ensure_ascii=False) + "\n"`. */
function _normalise(manifest: JsonObject): string {
    const out: JsonObject = { ...manifest };
    out['generated_at'] = '<normalised>';
    return JSON.stringify(_sortRec(out), null, 2) + '\n';
}

function _fresh_build(): JsonObject {
    const proc = spawnSync('python3', [SCANNER], {
        encoding: 'utf-8',
        cwd: ROOT,
        maxBuffer: 256 * 1024 * 1024,
    });
    if (proc.status !== 0) {
        process.stderr.write(proc.stderr ?? '');
        throw new ExitError(`scanner failed: exit ${proc.status}`);
    }
    return JSON.parse(proc.stdout ?? '') as JsonObject;
}

interface ParsedArgs {
    quiet: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { quiet: false };
    for (const arg of argv) {
        if (arg === '--quiet') {
            args.quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: validate_discovery_manifest [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(
                `validate_discovery_manifest: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    return args;
}

function main(argv: readonly string[]): number {
    const args = parse_args(argv);

    if (!fs.existsSync(COMMITTED)) {
        process.stderr.write(
            `error: committed manifest not found at ${_relPosix(COMMITTED, ROOT)} ` +
                '— run `task build-discovery` and commit the output.\n',
        );
        return 1;
    }

    const committed = JSON.parse(fs.readFileSync(COMMITTED, 'utf-8')) as JsonObject;
    const fresh = _fresh_build();
    const sa = _normalise(committed);
    const sb = _normalise(fresh);
    if (sa !== sb) {
        process.stderr.write(
            'DRIFT: committed discovery-manifest.json differs from a fresh re-build.\n',
        );
        process.stderr.write('  Run `task build-discovery` and commit dist/discovery/.\n');
        // first divergence — single most useful line
        const la = sa.split('\n');
        const lb = sb.split('\n');
        const n = Math.min(la.length, lb.length);
        for (let i = 0; i < n; i++) {
            if (la[i] !== lb[i]) {
                process.stderr.write(`  first diff at line ${i + 1}:\n`);
                process.stderr.write(`    committed: ${la[i]}\n`);
                process.stderr.write(`    fresh:     ${lb[i]}\n`);
                break;
            }
        }
        return 1;
    }
    if (!args.quiet) {
        const stats = committed['stats'] as JsonObject;
        process.stdout.write(
            `OK ${_relPosix(COMMITTED, ROOT)} matches fresh re-build ` +
                `(${String(stats['total_artefacts'])} artefacts).\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (exc) {
        if (exc instanceof ExitError) {
            process.stderr.write(`${exc.message}\n`);
            process.exit(1);
        }
        throw exc;
    }
}

export { ROOT, SCANNER, COMMITTED, main };
