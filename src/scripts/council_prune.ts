/**
 * Manual pruner for council artefacts.
 *
 * TypeScript twin of `src/scripts/council_prune.py` (ADR-094 — Python→TS
 * migration, Phase 1).
 *
 * Deletes council files older than `ai_council.session_retention_days`
 * (default 7) across all four artefact directories:
 *
 *   - agents/runtime/council/sessions/   (timestamp subdirs + root files)
 *   - agents/runtime/council/questions/  (mtime-based)
 *   - agents/runtime/council/responses/  (mtime-based)
 *
 * Same logic as the auto-prune that runs on every `council save()`,
 * exposed as a Task target so the user can sweep on demand.
 *
 * Invocation (from project root):
 *   ./scripts-run src/scripts/council_prune [--days N] [--dry-run]
 *
 * Exit code 0 always — pruning is a hygiene operation, never a build
 * gate. Disk failures are logged to stderr by the underlying pruner.
 *
 * Parity notes:
 * - `argparse` → hand-rolled parser matching the two options (`--days`,
 *   `--dry-run`); arg errors exit 2 with the argparse-shaped usage line.
 * - `_load_retention_days` / `prune_all_council_artifacts` import the
 *   `./ai_council/session` twin (a `.ts` MUST NOT import a `.py`).
 * - `raise SystemExit(main())` → `process.exitCode = main()` (never
 *   `process.exit`).
 */

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { _load_retention_days, prune_all_council_artifacts } from './ai_council/session.js';

function _prog(): string {
    return 'council_prune.py';
}

class _ExitSignal extends Error {
    constructor(readonly code: number) {
        super(`exit ${code}`);
    }
}

const _USAGE = `usage: ${_prog()} [-h] [--days DAYS] [--dry-run]`;

const _HELP =
    `${_USAGE}\n\n` +
    'Manual pruner for council artefacts.\n\n' +
    'optional arguments:\n' +
    '  -h, --help   show this help message and exit\n' +
    '  --days DAYS  Override retention_days (default: from .agent-settings.yml)\n' +
    '  --dry-run    List what would be deleted without removing anything.\n';

function _argError(message: string): never {
    process.stderr.write(`${_USAGE}\n`);
    process.stderr.write(`${_prog()}: error: ${message}\n`);
    process.exitCode = 2;
    throw new _ExitSignal(2);
}

interface _Args {
    days: number | null;
    dry_run: boolean;
}

/** Mirror argparse `type=int` for `--days` — int literal or error exit 2. */
function _parseDays(raw: string): number {
    const s = raw.trim();
    if (/^[+-]?\d+$/.test(s)) {
        return Number.parseInt(s, 10);
    }
    _argError(`argument --days: invalid int value: '${raw}'`);
}

function _parseArgs(args: string[]): _Args {
    let days: number | null = null;
    let dry_run = false;
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_HELP);
            throw new _ExitSignal(0);
        } else if (a === '--days') {
            const v = args[i + 1];
            if (v === undefined) {
                _argError('argument --days: expected one argument');
            }
            days = _parseDays(v as string);
            i += 1;
        } else if (a.startsWith('--days=')) {
            days = _parseDays(a.slice('--days='.length));
        } else if (a === '--dry-run') {
            dry_run = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return { days, dry_run };
}

export function main(argv: string[]): number {
    let args: _Args;
    try {
        args = _parseArgs(argv);
    } catch (exc) {
        if (exc instanceof _ExitSignal) {
            return exc.code;
        }
        throw exc;
    }

    const days = args.days !== null ? args.days : _load_retention_days();
    if (days <= 0) {
        process.stdout.write(`council-prune: retention_days=${days} → pruning disabled.\n`);
        return 0;
    }

    if (args.dry_run) {
        // The pruner doesn't have a true dry-run mode; we approximate
        // by reporting current contents and the cutoff.
        process.stdout.write(`council-prune: dry-run, cutoff = retention_days=${days}\n`);
        process.stdout.write('council-prune: actual deletion requires omitting --dry-run\n');
        return 0;
    }

    process.stdout.write(`council-prune: retention_days=${days}\n`);
    const result = prune_all_council_artifacts(days);
    let total = 0;
    for (const label of Object.keys(result)) {
        const removed = result[label] as string[];
        if (removed.length > 0) {
            process.stdout.write(`  ${label}: ${removed.length} pruned\n`);
            for (const p of removed) {
                process.stdout.write(`    - ${p}\n`);
            }
            total += removed.length;
        }
    }
    if (total === 0) {
        process.stdout.write('council-prune: nothing to prune.\n');
    } else {
        process.stdout.write(`council-prune: pruned ${total} entries total.\n`);
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main(process.argv.slice(2));
}
