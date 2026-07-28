#!/usr/bin/env node
/**
 * Store-boundary lint — invariant 1 of ADR-130 (`subject` axis,
 * road-to-reachable-code-memory Phase 8).
 *
 * Memory/knowledge INDEX code must not resolve the user-global store root
 * itself: no `homedir(` call, no quoted `.event4u` literal, no
 * `process.env.HOME` outside the sanctioned path modules. Global-root
 * resolution is owned by exactly two modules (read-open/write-closed
 * asymmetry lives behind them):
 *
 *   - src/scripts/_lib/user_global_paths.ts
 *   - src/scripts/_lib/knowledge_global.ts
 *
 * Scan scope is the memory/knowledge index + retrieval + write-edge modules
 * (SCAN_FILES below) — the surface that reads/writes memory records and must
 * therefore stay partition-blind. Doc comments mentioning `~/.event4u/...`
 * are prose, not resolution — only CODE literals match (quoted strings,
 * call expressions, env access).
 *
 * Primary CI gate: tests/scripts/lint_store_boundary.test.ts (vitest,
 * node-tests job) runs this against the real tree. Escape hatch for a
 * deliberate example: a `// lint-store-boundary: ignore` comment on the
 * same or preceding line.
 *
 * Exit codes: 0 clean · 1 violations · 2 usage · 3 internal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Sanctioned owners of global-root resolution (repo-relative, POSIX). */
export const SANCTIONED_MODULES: readonly string[] = [
    'src/scripts/_lib/user_global_paths.ts',
    'src/scripts/_lib/knowledge_global.ts',
];

/**
 * Memory/knowledge index, retrieval, and write-edge modules — the
 * partition-blind surface. Extend this list when a new index module lands.
 */
export const SCAN_FILES: readonly string[] = [
    'src/scripts/memory_lookup.ts',
    'src/scripts/memory_report.ts',
    'src/scripts/memory_signal.ts',
    'src/scripts/learning_sidecar.ts',
    'src/scripts/memory_learn_hook.ts',
    'src/scripts/second_brain_retrieval.ts',
    'src/scripts/measure_lexical_ranking.ts',
    'src/scripts/generate_knowledge_index.ts',
    'src/scripts/_lib/lexical_index.ts',
    'src/scripts/knowledge_global_cli.ts',
];

/** Code-literal patterns only — doc-comment prose does not match. */
const GLOBAL_ROOT_RE = /homedir\s*\(|['"`][^'"`\n]*\.event4u|process\.env\.HOME\b|process\.env\[\s*['"]HOME['"]\s*\]/;
const IGNORE_RE = /\/\/\s*lint-store-boundary:\s*ignore/;

export interface Violation {
    file: string;
    line: number;
    excerpt: string;
}

export function scanFile(absPath: string, relPath: string): Violation[] {
    const out: Violation[] = [];
    let text: string;
    try {
        text = fs.readFileSync(absPath, 'utf8');
    } catch {
        return out;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trimStart();
        // Comment lines are prose (docblocks quote `~/.event4u/…` in markdown
        // backticks) — only CODE can resolve a path.
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
        if (!GLOBAL_ROOT_RE.test(line)) continue;
        if (IGNORE_RE.test(line) || (i > 0 && IGNORE_RE.test(lines[i - 1]!))) continue;
        out.push({ file: relPath, line: i + 1, excerpt: line.trim().slice(0, 120) });
    }
    return out;
}

export function run(root: string): Violation[] {
    const violations: Violation[] = [];
    for (const rel of SCAN_FILES) {
        if (SANCTIONED_MODULES.includes(rel)) continue;
        violations.push(...scanFile(path.join(root, rel), rel));
    }
    return violations;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let root = REPO_ROOT;
    let format: 'text' | 'json' = 'text';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--root') root = argv[++i] ?? root;
        else if (a.startsWith('--root=')) root = a.slice('--root='.length);
        else if (a === '--format') format = (argv[++i] as 'text' | 'json') ?? 'text';
        else if (a.startsWith('--format=')) format = a.slice('--format='.length) as 'text' | 'json';
        else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_store_boundary [--root ROOT] [--format text|json]\n');
            return 0;
        } else {
            process.stderr.write(`lint_store_boundary: unknown argument ${a}\n`);
            return 2;
        }
    }
    let violations: Violation[];
    try {
        violations = run(root);
    } catch (exc) {
        process.stderr.write(`lint_store_boundary: internal error: ${String(exc)}\n`);
        return 3;
    }
    if (format === 'json') {
        process.stdout.write(`${JSON.stringify(violations, null, 2)}\n`);
        return violations.length === 0 ? 0 : 1;
    }
    if (violations.length === 0) {
        process.stdout.write('✅  store boundary clean — no global-root literal in index code.\n');
        return 0;
    }
    process.stdout.write(`❌  ${violations.length} global-root literal(s) in index code:\n\n`);
    for (const v of violations) {
        process.stdout.write(`  🔴 ${v.file}:${v.line}  →  ${v.excerpt}\n`);
    }
    process.stdout.write(
        '\nRoute global-store access through src/scripts/_lib/user_global_paths.ts ' +
            'or src/scripts/_lib/knowledge_global.ts (ADR-130 invariant 1).\n',
    );
    return 1;
}

const _isMain = (() => {
    if (process.argv[1] === undefined) return false;
    try {
        return pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href === import.meta.url;
    } catch {
        return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
    }
})();
if (_isMain) {
    process.exit(main());
}
