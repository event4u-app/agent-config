#!/usr/bin/env tsx
/**
 * lint_supported_tools_matrix.ts — CI gate: the README `## Supported tools`
 * matrix equals the canonical adapter registry (fail on drift in either
 * direction), and every tool-tagged generator output root is claimed by the
 * registry (road-to-ecosystem-harvest-skill-quality-gates Phase 4, Source AA).
 *
 * Exit codes: 0 — in sync · 1 — drift (each line names the drifted row).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lint_matrix } from './_lib/tool_adapter_registry.js';
import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(_HERE), '..', '..');

export function run(readmePath: string): string[] {
    const readme = fs.readFileSync(readmePath, 'utf-8');
    return lint_matrix(readme);
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_HERE);
if (isMain) {
    const idx = process.argv.indexOf('--readme');
    const readmePath = idx !== -1 ? (process.argv[idx + 1] ?? '') : path.join(REPO_ROOT, 'README.md');
    // The whole README leg of this gate is one named file. A moved README turns
    // `run()` into an ENOENT stack trace, which reads as a crash rather than as
    // a gate whose scope died — name the scope first. Exit 1 is the gate's only
    // failure code; here it means "could not run", not "found drift".
    try {
        assertWatchlistResolves({
            gate: 'lint_supported_tools_matrix',
            candidates: [path.relative(REPO_ROOT, path.resolve(readmePath))],
            repoRoot: REPO_ROOT,
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            process.exit(1);
        }
        throw e;
    }
    const errors = run(readmePath);
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  ${e}\n`);
        process.exit(1);
    }
    process.stdout.write('✅  Supported-tools matrix ↔ adapter registry ↔ generator roots in sync\n');
    process.exit(0);
}
