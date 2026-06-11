#!/usr/bin/env tsx
/**
 * Fail if any `.agent-settings.local.yml` is tracked by git.
 *
 * TypeScript twin of `src/scripts/check_no_local_settings_committed.py`
 * (ADR-088, Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY —
 * no flags, exit codes (0 clean, 1 offenders), stdout, byte-identical
 * finding messages, same `git ls-files` scan and basename match. No
 * behaviour changes.
 *
 * `.agent-settings.local.yml` is the per-developer, per-machine override
 * layer (see `scripts/_lib/agent_settings.py` `LOCAL_PROJECT_FILE`). It is
 * gitignored on purpose — committing one would leak one developer's local
 * machine paths (e.g. linked-project siblings) into everyone's checkout.
 *
 * Exit 0 when none are tracked, 1 (with the offending paths) otherwise.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const LOCAL_FILE = '.agent-settings.local.yml';

function tracked_local_settings(): string[] {
    const res = spawnSync('git', ['ls-files'], { encoding: 'utf-8' });
    // Mirror Python: CalledProcessError (non-zero) or FileNotFoundError
    // (git missing) → return [] (nothing to enforce).
    if (res.error !== undefined || res.status !== 0 || typeof res.stdout !== 'string') {
        return [];
    }
    const out = res.stdout;
    return out
        .split('\n')
        .filter((line) => line !== '')
        .filter((line) => {
            const parts = line.split('/');
            return parts[parts.length - 1] === LOCAL_FILE;
        });
}

function main(): number {
    const offenders = tracked_local_settings();
    if (offenders.length === 0) {
        process.stdout.write(`✅  No tracked ${LOCAL_FILE} files.\n`);
        return 0;
    }
    process.stdout.write(
        `❌  ${LOCAL_FILE} must never be committed (per-machine local layer):\n`,
    );
    for (const p of offenders) {
        process.stdout.write(`  🔴 ${p}\n`);
    }
    process.stdout.write(
        `\nRun: git rm --cached <path>  — and confirm ${LOCAL_FILE} is gitignored.\n`,
    );
    return 1;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { LOCAL_FILE, tracked_local_settings, main };
