#!/usr/bin/env tsx
/**
 * Janitor — retention sweep for volatile/TTL directories.
 *
 * Supported TTL directories (per docs/contracts/agents-layout.md):
 *   agents/tmp.old/     — processed inbox archive (TTL: 30 days)
 *   agents/runtime/     — volatile runtime artefacts (TTL: 7 days for council/tmp)
 *
 * NEVER auto-sweeps agents/tmp/ (user inbox — user-owned, no TTL).
 *
 * Usage:
 *   ./scripts-run src/scripts/janitor          — dry-run report only
 *   ./scripts-run src/scripts/janitor --apply  — delete expired files
 *   ./scripts-run src/scripts/janitor --report — same as default (dry-run)
 *
 * Exit codes:
 *   0 — report generated (dry-run) or sweep completed (--apply)
 *   2 — invalid args
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(_HERE), '..', '..');

// TTL configuration per directory (days)
const TTL_CONFIG: ReadonlyArray<{ dir: string; ttlDays: number; description: string }> = [
    {
        dir: 'agents/tmp.old',
        ttlDays: 30,
        description: 'Processed inbox archive (consumed agents/tmp/ files)',
    },
    {
        dir: 'agents/runtime/tmp',
        ttlDays: 7,
        description: 'Agent scratch / runtime tmp',
    },
    {
        dir: 'agents/runtime/council/responses',
        ttlDays: 7,
        description: 'Council response cache',
    },
];

// Directories that must NEVER be auto-swept
const PROTECTED_DIRS: ReadonlySet<string> = new Set([
    'agents/tmp',          // user inbox — user-owned, no TTL
    'agents/knowledge',    // committed curated pages
    'agents/memory',       // promotion pipeline (committed YAML)
    'agents/decisions',    // permanent durable records
    'agents/evidence',     // permanent durable evidence
    'agents/roadmaps',     // tracked roadmaps
]);

interface FileStat {
    relPath: string;
    absPath: string;
    ageDays: number;
    size: number;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _walkFiles(dir: string): string[] {
    const results: string[] = [];
    if (!_isDir(dir)) return results;
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isFile()) {
            results.push(full);
        } else if (stat.isDirectory()) {
            results.push(..._walkFiles(full));
        }
    }
    return results;
}

function _ageDays(p: string): number {
    try {
        const stat = fs.statSync(p);
        const ageMs = Date.now() - stat.mtimeMs;
        return ageMs / (1000 * 60 * 60 * 24);
    } catch {
        return 0;
    }
}

function _humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function report(apply: boolean): void {
    const now = new Date();
    process.stdout.write(`\n🗂️  Janitor report — ${now.toISOString().slice(0, 10)}\n\n`);

    // Inbox status (never swept, report only)
    const inboxDir = path.join(REPO_ROOT, 'agents/tmp');
    if (_isDir(inboxDir)) {
        const files = _walkFiles(inboxDir);
        if (files.length === 0) {
            process.stdout.write(`✅  agents/tmp/ (user inbox) — empty\n`);
        } else {
            const oldest = files.map((f) => _ageDays(f)).reduce((a, b) => Math.max(a, b), 0);
            const totalSize = files.reduce((s, f) => {
                try { return s + fs.statSync(f).size; } catch { return s; }
            }, 0);
            process.stdout.write(
                `📥  agents/tmp/ (user inbox) — ${files.length} file(s), ` +
                    `oldest: ${oldest.toFixed(0)}d, size: ${_humanSize(totalSize)}\n` +
                    `    (user-owned; never auto-swept)\n`,
            );
        }
    }

    process.stdout.write('\n');

    // Harvest-local size note
    const harvestDir = path.join(REPO_ROOT, 'agents/.harvest-local');
    if (_isDir(harvestDir)) {
        const files = _walkFiles(harvestDir);
        const totalSize = files.reduce((s, f) => {
            try { return s + fs.statSync(f).size; } catch { return s; }
        }, 0);
        process.stdout.write(
            `📦  agents/.harvest-local/ — ${_humanSize(totalSize)} ` +
                `(source-confidentiality evidence; retain, never auto-deleted)\n\n`,
        );
    }

    let totalExpired = 0;
    let totalSize = 0;

    for (const { dir, ttlDays, description } of TTL_CONFIG) {
        const absDir = path.join(REPO_ROOT, dir);
        if (!_isDir(absDir)) continue;

        // Safety: never sweep protected dirs
        if (PROTECTED_DIRS.has(dir)) {
            process.stdout.write(`🔒  ${dir} — protected, skipping\n`);
            continue;
        }

        const files = _walkFiles(absDir);
        const expired: FileStat[] = [];

        for (const absPath of files) {
            const ageDays = _ageDays(absPath);
            if (ageDays >= ttlDays) {
                let size = 0;
                try { size = fs.statSync(absPath).size; } catch { /* */ }
                expired.push({ relPath: path.relative(REPO_ROOT, absPath), absPath, ageDays, size });
            }
        }

        if (files.length === 0) {
            process.stdout.write(`✅  ${dir}/ — empty\n`);
            continue;
        }

        const dirSize = files.reduce((s, f) => {
            try { return s + fs.statSync(f).size; } catch { return s; }
        }, 0);
        process.stdout.write(
            `📁  ${dir}/ — ${files.length} file(s), ${_humanSize(dirSize)} total, ` +
                `TTL: ${ttlDays}d (${description})\n`,
        );

        if (expired.length === 0) {
            process.stdout.write(`    ✅  No expired files.\n`);
        } else {
            const expiredSize = expired.reduce((s, f) => s + f.size, 0);
            process.stdout.write(
                `    ⚠️  ${expired.length} expired file(s), ${_humanSize(expiredSize)} reclaimable:\n`,
            );
            for (const f of expired.slice(0, 10)) {
                process.stdout.write(
                    `       ${f.relPath} (${f.ageDays.toFixed(0)}d old, ${_humanSize(f.size)})\n`,
                );
            }
            if (expired.length > 10) {
                process.stdout.write(`       … and ${expired.length - 10} more\n`);
            }

            if (apply) {
                for (const f of expired) {
                    try { fs.unlinkSync(f.absPath); } catch { /* ignore */ }
                }
                // Remove empty dirs
                for (const f of expired) {
                    let dir = path.dirname(f.absPath);
                    while (dir.startsWith(absDir) && dir !== absDir) {
                        try {
                            if (fs.readdirSync(dir).length === 0) {
                                fs.rmdirSync(dir);
                            }
                        } catch { /* */ }
                        dir = path.dirname(dir);
                    }
                }
                process.stdout.write(`    🗑️  Deleted ${expired.length} expired file(s).\n`);
            } else {
                process.stdout.write(
                    `    → Run with --apply to delete. All files stay on disk in dry-run mode.\n`,
                );
            }

            totalExpired += expired.length;
            totalSize += expired.reduce((s, f) => s + f.size, 0);
        }
        process.stdout.write('\n');
    }

    if (!apply && totalExpired > 0) {
        process.stdout.write(
            `Total reclaimable: ${totalExpired} file(s), ${_humanSize(totalSize)}\n` +
                `Run \`./scripts-run src/scripts/janitor --apply\` to delete.\n`,
        );
    } else if (apply && totalExpired > 0) {
        process.stdout.write(`Total deleted: ${totalExpired} file(s), ${_humanSize(totalSize)} freed.\n`);
    }
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(
            'Usage: janitor [--apply] [--report]\n' +
                '  (no flags)  — dry-run report\n' +
                '  --report    — same as no flags\n' +
                '  --apply     — delete expired files\n',
        );
        return 0;
    }

    const apply = args.includes('--apply');
    report(apply);
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

export { main, TTL_CONFIG, PROTECTED_DIRS };
