#!/usr/bin/env tsx
/**
 * Guard against `internal/glama/README.md` drifting from the committed
 * `internal/glama/build` / `internal/glama/run` scripts it documents.
 *
 * Extracts the single canonical command line each script actually runs
 * (the last non-comment, non-`set -euo pipefail` line — `exec ` stripped)
 * and asserts that literal string appears verbatim somewhere in the README.
 * Catches the exact failure mode fixed in road-to-mcp-full-power.md Phase 1:
 * the README described a Python/uv build long after the scripts moved to
 * Node/tsx.
 *
 * Exit codes: 0 no drift, 1 one or more scripts' canonical command is not
 * documented verbatim in the README.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const GLAMA_DIR = path.join(REPO, 'internal', 'glama');

interface ScriptSpec {
    file: string;
    /** Strip this exact prefix from the extracted command line before comparing. */
    stripPrefix?: string;
}

const SCRIPTS: readonly ScriptSpec[] = [
    { file: 'build' },
    { file: 'run', stripPrefix: 'exec ' },
];

function _canonicalCommand(scriptPath: string, stripPrefix?: string): string {
    const lines = fs.readFileSync(scriptPath, 'utf8').split('\n');
    const candidates = lines
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#') && l !== 'set -euo pipefail');
    const last = candidates[candidates.length - 1] ?? '';
    return stripPrefix && last.startsWith(stripPrefix) ? last.slice(stripPrefix.length) : last;
}

function main(): number {
    const readmePath = path.join(GLAMA_DIR, 'README.md');

    // No corpus — the gate guards three named files. If internal/glama/ moves,
    // every read below throws rather than reporting; name the scope instead so
    // the failure says which paths went missing.
    try {
        assertWatchlistResolves({
            gate: 'lint_glama_drift',
            candidates: [
                path.posix.join('internal', 'glama', 'README.md'),
                ...SCRIPTS.map((s) => path.posix.join('internal', 'glama', s.file)),
            ],
            repoRoot: REPO,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 1 is the gate's only failure code — drift and "cannot run" share it.
            console.error(`❌  ${exc.message}`);
            return 1;
        }
        throw exc;
    }

    const readme = fs.readFileSync(readmePath, 'utf8');

    let failed = false;
    for (const spec of SCRIPTS) {
        const scriptPath = path.join(GLAMA_DIR, spec.file);
        const cmd = _canonicalCommand(scriptPath, spec.stripPrefix);
        if (!cmd) {
            console.error(`❌  internal/glama/${spec.file}: could not extract a canonical command line`);
            failed = true;
            continue;
        }
        if (!readme.includes(cmd)) {
            console.error(
                `❌  drift: internal/glama/${spec.file} runs \`${cmd}\` — not found verbatim in internal/glama/README.md`,
            );
            failed = true;
        }
    }

    if (failed) {
        console.error('\nUpdate internal/glama/README.md to match the committed build/run scripts.');
        return 1;
    }

    process.stdout.write('✅  internal/glama/README.md matches build/run scripts — no drift.\n');
    return 0;
}

process.exit(main());
