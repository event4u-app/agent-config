/**
 * Project signal detection for pack auto-suggestion.
 *
 * Phase 3.2 § "Auto-detect helpers" of the Phase 3 roadmap. Pure
 * functions that inspect a project's file tree and surface pack
 * suggestions. The TUI shows each suggestion with its evidence
 * ("found composer.json") before the user confirms — never auto-applies.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DetectionSignal {
    readonly packId: string;
    /** Short human-readable reason, e.g. "composer.json found". */
    readonly reason: string;
    /** File that triggered the detection, relative to project root. */
    readonly evidence: string;
}

export interface DetectOptions {
    readonly projectRoot: string;
    /** Override fs reads in tests; defaults to node fs. */
    readonly readFile?: (path: string) => string;
    readonly fileExists?: (path: string) => boolean;
}

/**
 * Walk the project root for known signals and return a deterministic
 * list of suggestions. Order is fixed: PHP/Laravel/Symfony, then JS
 * stack (TS/React/Next), then Python.
 */
export function detectPacks(opts: DetectOptions): readonly DetectionSignal[] {
    const exists = opts.fileExists ?? defaultExists;
    const read = opts.readFile ?? defaultRead;
    const out: DetectionSignal[] = [];

    // PHP family.
    const composerPath = join(opts.projectRoot, 'composer.json');
    if (exists(composerPath)) {
        out.push({ packId: 'php', reason: 'composer.json found', evidence: 'composer.json' });
        const composer = safeJson(read, composerPath);
        if (composer !== null) {
            const deps = mergedDeps(composer, ['require', 'require-dev']);
            if (hasAny(deps, ['laravel/framework', 'laravel/laravel'])) {
                out.push({ packId: 'laravel', reason: 'laravel/framework in composer.json', evidence: 'composer.json' });
            }
            if (hasAny(deps, ['symfony/framework-bundle', 'symfony/symfony'])) {
                out.push({ packId: 'symfony', reason: 'symfony/framework-bundle in composer.json', evidence: 'composer.json' });
            }
        }
    }

    // JS/TS family.
    const packagePath = join(opts.projectRoot, 'package.json');
    if (exists(packagePath)) {
        out.push({ packId: 'javascript', reason: 'package.json found', evidence: 'package.json' });
        const pkg = safeJson(read, packagePath);
        if (pkg !== null) {
            const deps = mergedDeps(pkg, ['dependencies', 'devDependencies', 'peerDependencies']);
            if ('typescript' in deps || exists(join(opts.projectRoot, 'tsconfig.json'))) {
                const evidence = 'typescript' in deps ? 'package.json' : 'tsconfig.json';
                out.push({ packId: 'typescript', reason: 'typescript dependency present', evidence });
            }
            if ('react' in deps) {
                out.push({ packId: 'react', reason: 'react dependency present', evidence: 'package.json' });
            }
            if ('next' in deps) {
                out.push({ packId: 'nextjs', reason: 'next dependency present', evidence: 'package.json' });
            }
        }
    }

    // Python family.
    const pyproject = join(opts.projectRoot, 'pyproject.toml');
    const requirements = join(opts.projectRoot, 'requirements.txt');
    if (exists(pyproject)) {
        out.push({ packId: 'python', reason: 'pyproject.toml found', evidence: 'pyproject.toml' });
    } else if (exists(requirements)) {
        out.push({ packId: 'python', reason: 'requirements.txt found', evidence: 'requirements.txt' });
    }

    return dedupeFirstWins(out);
}

function defaultExists(path: string): boolean {
    return existsSync(path);
}

function defaultRead(path: string): string {
    return readFileSync(path, 'utf8');
}

function safeJson(read: (p: string) => string, path: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(read(path));
        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function mergedDeps(pkg: Record<string, unknown>, keys: readonly string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of keys) {
        const block = pkg[key];
        if (block !== null && typeof block === 'object') {
            for (const [name, version] of Object.entries(block as Record<string, unknown>)) {
                if (typeof version === 'string') out[name] = version;
            }
        }
    }
    return out;
}

function hasAny(deps: Record<string, string>, names: readonly string[]): boolean {
    return names.some((n) => n in deps);
}

function dedupeFirstWins(signals: readonly DetectionSignal[]): readonly DetectionSignal[] {
    const seen = new Set<string>();
    const out: DetectionSignal[] = [];
    for (const s of signals) {
        if (seen.has(s.packId)) continue;
        seen.add(s.packId);
        out.push(s);
    }
    return out;
}
