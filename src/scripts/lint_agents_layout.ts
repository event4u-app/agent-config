#!/usr/bin/env tsx
/**
 * CI guard for the `agents/` top-level layout.
 *
 * Ported from the retired Python `src/scripts/lint_agents_layout.py` (ADR-200,
 * Phase 4 / Wave 4b). The CLI contract is pinned — `--quiet`
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
 * Extended (road-to-agents-dir-and-gitignore-hygiene Phase 2.3):
 * - In source-repo mode, unknown TOP-LEVEL DIRECTORIES also become errors.
 *   Whitelist is ALLOWED_SOURCE_DIRS (see docs/contracts/agents-layout.md).
 * - CONSUMER_EXPECTED_ENTRIES extended with the full consumer-scope subset
 *   from the contract (knowledge/, memory/, roadmaps/, tmp/, tmp.old/).
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
    // Gitignored local-only files (present in working tree, never committed).
    // NOTE: if any of these are tracked (appear in `git ls-files`), that is a
    // separate violation caught by check_tracked_but_ignored.ts.
    '.ai-video.xml',       // operator AI-video config; gitignored per .gitignore § AI Video
    'installed-tools.lock', // installer per-user inventory; gitignored per ADR-020
    '.event4u-bridge.yml',  // consumer bridge marker; ADR-020 (should only be in consumers)
]);

// All directories allowed at the agents/ root in the SOURCE REPO.
// Entries marked (* consumer) are also allowed in consumer projects.
// Contract: docs/contracts/agents-layout.md § Directory table.
const ALLOWED_SOURCE_DIRS: ReadonlySet<string> = new Set([
    'decisions',
    'evidence',
    'features',
    'knowledge',    // * consumer
    'memory',       // * consumer
    'notes',        // legacy; new files go to evidence/notes/
    'reports',      // legacy; new files go to evidence/reports/ (see agents-layout.md)
    'overrides',    // * consumer
    'recruit-sessions',
    'reference',
    'roadmap-assets',
    'roadmaps',     // * consumer
    'roles',
    'runtime',      // local-only, gitignored
    'settings',
    'state',        // local-only, gitignored
    'templates',
    'tickets',
    'tmp',          // local-only, gitignored (* consumer)
    'tmp.old',      // local-only, gitignored (* consumer)
    '.harvest-local', // local-only, gitignored
]);

const CONSUMER_EXPECTED_ENTRIES: ReadonlySet<string> = new Set([
    // Required consumer entries
    'overrides',
    '.event4u-bridge.yml',
    '.gitkeep',
    // Optional but legitimate consumer entries (will not trigger warnings)
    'knowledge',
    'memory',
    'roadmaps',
    'tmp',
    'tmp.old',
    // Flat files that are tracked in consumers
    'index.md',
    'roadmaps-progress.md',
    '.agent-tools.yml',
    '.maintainer-workspace.md',
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

function find_violations(root: string, sourceRepo = false): string[] {
    const unknown: string[] = [];
    if (!_isDir(root)) {
        return unknown;
    }
    for (const p of _iterdirSorted(root)) {
        const name = path.basename(p);
        if (_isFile(p)) {
            if (ALLOWED_FLAT_FILES.has(name)) {
                continue;
            }
            unknown.push(
                `${p}: flat file not in agents/ whitelist — move to a typed ` +
                    'subdirectory (runtime/, evidence/, decisions/, settings/, ' +
                    'audits/, roadmaps/, policies/, contexts/, …) or add to ' +
                    'ALLOWED_FLAT_FILES in scripts/lint_agents_layout.ts with ' +
                    'rationale.',
            );
        } else if (_isDir(p) && sourceRepo) {
            // In source-repo mode, unknown top-level directories are also errors.
            // See docs/contracts/agents-layout.md § Directory table.
            if (!ALLOWED_SOURCE_DIRS.has(name)) {
                unknown.push(
                    `${p}: unknown top-level directory in agents/ — ` +
                        'add to ALLOWED_SOURCE_DIRS in lint_agents_layout.ts ' +
                        '(with rationale) AND to docs/contracts/agents-layout.md.',
                );
            }
        }
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
    const consumerMode = !is_source_repo(projectRoot);
    const unknown = find_violations(AGENTS_ROOT, !consumerMode);
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

export {
    AGENTS_ROOT,
    ALLOWED_FLAT_FILES,
    ALLOWED_SOURCE_DIRS,
    CONSUMER_EXPECTED_ENTRIES,
    MIGRATE_HINT,
    is_source_repo,
    find_violations,
    find_consumer_warnings,
    main,
};
