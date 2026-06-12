#!/usr/bin/env tsx
/**
 * CI guard for the `agents/` top-level layout.
 *
 * TypeScript twin of `src/scripts/lint_agents_layout.py` (ADR-090,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet`
 * / `--strict` flags (parsed by membership test, like the Python which
 * scans `sys.argv[1:]`), exit codes (0 clean / warnings, 1 unknown
 * flat-file violation), stdout/stderr split (everything goes to stdout),
 * byte-identical messages, and the same cwd-relative `agents/` root.
 *
 * `find_violations` / `find_consumer_warnings` / `is_source_repo` take an
 * explicit root and are exported for the differential suite; `main()`
 * uses the cwd-relative `agents/` root exactly as the Python does, so the
 * printed paths (`agents/<name>`) match byte-for-byte.
 *
 * No behaviour changes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// Cwd-relative `agents/` root (mirrors Python `Path("agents")`).
const AGENTS_ROOT = 'agents';

const ALLOWED_FLAT_FILES: ReadonlySet<string> = new Set([
    'index.md',
    'roadmaps-progress.md',
    '.gitkeep',
    '.event4u-bridge.yml',
    '.agent-tools.yml',
    '.maintainer-workspace.md',
]);

const CONSUMER_EXPECTED_ENTRIES: ReadonlySet<string> = new Set([
    'overrides',
    '.event4u-bridge.yml',
    '.gitkeep',
]);

const MIGRATE_HINT =
    'Run `npx @event4u/agent-config migrate` to sweep legacy project-scope ' +
    'artefacts in one pass. The unified `migrate` command (see ' +
    '`docs/contracts/migrate-command.md`) leaves `agents/overrides/` + ' +
    '`agents/.event4u-bridge.yml` as the only consumer-side files; the ' +
    'wizard recreates fresh config on `agent-config setup`.';

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Sorted `iterdir` mirror — returns absolute child paths, lexicographically
 * sorted on the full path (Python `sorted(Path.iterdir())` sorts on the
 * path string, which for a common parent equals sorting on the basename).
 */
function _iterdirSorted(root: string): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(root);
    } catch {
        return [];
    }
    return entries
        .map((name) => path.join(root, name))
        .sort();
}

function is_source_repo(projectRoot: string): boolean {
    if (_isDir(path.join(projectRoot, '.agent-src.uncondensed'))) {
        return true;
    }
    if (_isDir(path.join(projectRoot, 'dist/agent-src'))) {
        return true;
    }
    const packages = path.join(projectRoot, 'packages');
    if (_isDir(packages)) {
        for (const sub of _iterdirSorted(packages)) {
            if (_isDir(path.join(sub, '.agent-src.uncondensed'))) {
                return true;
            }
        }
    }
    return false;
}

function find_violations(root: string): string[] {
    const unknown: string[] = [];
    if (!_isDir(root)) {
        return unknown;
    }
    for (const p of _iterdirSorted(root)) {
        if (!_isFile(p)) {
            continue;
        }
        const name = path.basename(p);
        if (ALLOWED_FLAT_FILES.has(name)) {
            continue;
        }
        unknown.push(
            `${p}: flat file not in agents/ whitelist — move to a typed ` +
                'subdirectory (runtime/, evidence/, decisions/, settings/, ' +
                'audits/, roadmaps/, policies/, contexts/, …) or add to ' +
                'ALLOWED_FLAT_FILES in scripts/lint_agents_layout.py with ' +
                'rationale.',
        );
    }
    return unknown;
}

function find_consumer_warnings(root: string): string[] {
    const warnings: string[] = [];
    if (!_isDir(root)) {
        return warnings;
    }
    for (const p of _iterdirSorted(root)) {
        const name = path.basename(p);
        if (CONSUMER_EXPECTED_ENTRIES.has(name)) {
            continue;
        }
        // Flat-file UNKNOWNs are already an error — don't double-count.
        if (_isFile(p) && !ALLOWED_FLAT_FILES.has(name)) {
            continue;
        }
        const kind = _isDir(p) ? 'dir' : 'file';
        warnings.push(`${p} (${kind}): legacy artefact outside the consumer-target shape.`);
    }
    return warnings;
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const strict = args.includes('--strict');
    const quiet = args.includes('--quiet');

    const projectRoot = process.cwd();
    const unknown = find_violations(AGENTS_ROOT);
    const consumerMode = !is_source_repo(projectRoot);
    const warnings = consumerMode ? find_consumer_warnings(AGENTS_ROOT) : [];

    if (unknown.length > 0) {
        process.stdout.write('❌  agents/ layout violations (unknown flat files):\n\n');
        for (const f of unknown) {
            process.stdout.write(`  - ${f}\n`);
        }
        process.stdout.write(
            '\nRule: scripts/lint_agents_layout.py — flat files at agents/ ' +
                'root must be whitelisted. Typed subdirectories: runtime/, ' +
                'evidence/, decisions/, settings/, audits/, roadmaps/, ' +
                'policies/, contexts/, … .\n',
        );
        return 1;
    }

    if (warnings.length > 0) {
        if (!quiet) {
            process.stdout.write('⚠️  agents/ consumer-shape warnings:\n\n');
            for (const w of warnings) {
                process.stdout.write(`  - ${w}\n`);
            }
            process.stdout.write(`\n${MIGRATE_HINT}\n`);
        }
        if (strict) {
            return 1;
        }
    }

    if (unknown.length === 0 && warnings.length === 0 && !quiet) {
        process.stdout.write('✅  agents/ layout clean.\n');
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    AGENTS_ROOT,
    ALLOWED_FLAT_FILES,
    CONSUMER_EXPECTED_ENTRIES,
    MIGRATE_HINT,
    is_source_repo,
    find_violations,
    find_consumer_warnings,
    main,
};
