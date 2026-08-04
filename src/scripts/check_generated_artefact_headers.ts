#!/usr/bin/env tsx
/**
 * CI gate: every regenerable tracked analysis artefact must carry the
 * freshness marker `<!-- analyzed: date | commit: sha | files: N -->` in
 * its first 5 lines.
 *
 * Missing marker = warning (the file may not have been regenerated recently).
 * Missing marker on a file whose generator is known to write it = error.
 *
 * Exit codes:
 *   0 — all artefacts carry the marker
 *   1 — one or more artefacts are missing the marker
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(_HERE), '..', '..');

// Artefacts that must carry the <!-- analyzed: … --> freshness marker.
// Source: scripts that write these files (inventory_meta_layers.ts, audit_auto_rules.ts).
// Add new entries here when a new generator is wired in.
const GENERATED_ARTEFACTS: ReadonlyArray<{ path: string; writer: string; severity: 'error' | 'warning' }> = [
    {
        path: 'agents/evidence/analysis/meta-layer-inventory.md',
        writer: 'inventory_meta_layers.ts',
        severity: 'error',
    },
    {
        path: 'agents/reports/auto-rules-audit.md',
        writer: 'audit_auto_rules.ts',
        severity: 'warning', // on-demand regen only; marker present after first re-run
    },
    {
        path: 'agents/evidence/metrics/skill-usage-report.md',
        writer: 'skill_overlap.ts / audit_skill_overlap.ts',
        severity: 'warning',
    },
];

const MARKER_PATTERN = /<!--\s*analyzed:\s*\d{4}-\d{2}-\d{2}/;

function checkFile(p: string): boolean {
    try {
        const text = fs.readFileSync(p, 'utf-8');
        const first5 = text.split('\n').slice(0, 5).join('\n');
        return MARKER_PATTERN.test(first5);
    } catch {
        return true; // file doesn't exist locally (gitignored context) — skip
    }
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const quiet = args.includes('--quiet');

    // Every artefact is skipped when absent, so all three moving at once prints
    // "✅ All 3 generated artefacts carry the freshness marker" over zero reads.
    // The per-file skip below stays — a single gitignored artefact is a real
    // state; none of them existing is a moved root. 1 is the only failure code
    // this gate has, so "could not run" and "found something" share it.
    try {
        assertWatchlistResolves({
            gate: 'check_generated_artefact_headers',
            candidates: GENERATED_ARTEFACTS.map((e) => e.path),
            repoRoot: REPO_ROOT,
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 1;
        }
        throw err;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const entry of GENERATED_ARTEFACTS) {
        const absPath = path.join(REPO_ROOT, entry.path);
        if (!fs.existsSync(absPath)) continue; // not present locally — skip

        if (!checkFile(absPath)) {
            const msg = `${entry.path}: missing freshness marker (<!-- analyzed: date | commit: sha | files: N -->). Writer: ${entry.writer}`;
            if (entry.severity === 'error') {
                errors.push(msg);
            } else {
                warnings.push(msg);
            }
        }
    }

    if (errors.length > 0) {
        process.stdout.write(`❌  Generated artefact freshness errors:\n\n`);
        for (const e of errors) {
            process.stdout.write(`  - ${e}\n`);
        }
        process.stdout.write(
            `\nThe generator script must write <!-- analyzed: … --> as the first line.\n` +
                `See docs/contracts/agents-layout.md § Session-leftover discipline.\n`,
        );
    }

    if (warnings.length > 0 && !quiet) {
        process.stdout.write(`⚠️  Generated artefact freshness warnings:\n\n`);
        for (const w of warnings) {
            process.stdout.write(`  - ${w}\n`);
        }
    }

    if (errors.length === 0 && warnings.length === 0 && !quiet) {
        process.stdout.write(
            `✅  All ${GENERATED_ARTEFACTS.length} generated artefacts carry the freshness marker.\n`,
        );
    }

    return errors.length > 0 ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { main, GENERATED_ARTEFACTS };
