#!/usr/bin/env tsx
/**
 * check_dependency_floors — keep every runtime dependency floor at a settled
 * minor, so consumers on `prefer-offline=true` or a lagging registry mirror
 * cannot hit `ETARGET — No matching version found`
 * (road-to-zero-ceremony-install § Phase 2).
 *
 * Why a gate and not a retry: `dependencies` are resolved on the CONSUMER's
 * machine by npm, BEFORE our `bin` is executed. When resolution fails, npx
 * aborts and no code of ours ever runs — so this failure mode cannot be
 * caught, retried, or explained from inside the CLI. It can only be made
 * unreachable at publish time, which is what this gate does. CONTRIBUTING
 * § "Runtime dependency floors" states the rule in prose; this is its teeth.
 *
 * The rule: a caret floor pins the minimum compatible version, so its patch
 * component is `.0` (`^9.5.0`, never `^9.6.1`). A floor pinned to a
 * just-published patch fails against cached registry metadata that predates
 * it, even though the version exists on public npm.
 *
 * Exact pins (no range operator) are a different, deliberate mechanism — an
 * ABI lock — and are allowed only when listed in EXACT_PIN_EXCEPTIONS with a
 * reason, so a drive-by pin cannot hide among them.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_dependency_floors [--json]
 *
 * Exit codes: 0 green · 1 a floor violates the rule · 2 misuse / unreadable manifest.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

/**
 * Dependencies deliberately pinned to an exact version, with the reason. An
 * exact pin cannot suffer the freshest-patch failure (the version is either
 * cached or it is not), but it also forfeits patch fixes — so each one is
 * named here rather than silently tolerated.
 */
export const EXACT_PIN_EXCEPTIONS: Readonly<Record<string, string>> = {
    'web-tree-sitter': 'ABI-locked against tree-sitter-wasms; see code-graph engine pin',
    'tree-sitter-wasms': 'ABI-locked against web-tree-sitter; see code-graph engine pin',
};

/** A settled caret floor: `^X.Y.0`. */
const SETTLED_CARET = /^\^\d+\.\d+\.0$/;

/** An exact version with no range operator: `1.2.3`. */
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Every violation in `dependencies`, as human-readable lines. Empty array
 * means the manifest cannot produce a freshest-patch `ETARGET` for a consumer.
 */
export function evaluate(dependencies: Readonly<Record<string, string>>): string[] {
    const errors: string[] = [];
    for (const [name, range] of Object.entries(dependencies)) {
        if (EXACT_VERSION.test(range)) {
            if (!(name in EXACT_PIN_EXCEPTIONS)) {
                errors.push(
                    `${name}@${range}: exact pin without an entry in EXACT_PIN_EXCEPTIONS — ` +
                        'add the reason there, or use a settled caret floor (^X.Y.0)',
                );
            }
            continue;
        }
        if (SETTLED_CARET.test(range)) continue;
        if (range.startsWith('^')) {
            errors.push(
                `${name}@${range}: caret floor is not a settled minor — lower the patch to ` +
                    `.0 (e.g. ${range.replace(/\.\d+$/, '.0')}) so a lagging registry mirror ` +
                    'can still resolve it',
            );
            continue;
        }
        errors.push(
            `${name}@${range}: unsupported range shape — use a settled caret floor (^X.Y.0), ` +
                'or an exact pin listed in EXACT_PIN_EXCEPTIONS',
        );
    }
    return errors;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const asJson = argv.includes('--json');
    const manifestPath = path.join(REPO_ROOT, 'package.json');
    let dependencies: Record<string, string>;
    try {
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
            dependencies?: Record<string, string>;
        };
        dependencies = raw.dependencies ?? {};
    } catch (err) {
        process.stderr.write(`❌  dependency floors: cannot read ${manifestPath}: ${String(err)}\n`);
        return 2;
    }
    if (Object.keys(dependencies).length === 0) {
        process.stderr.write('❌  dependency floors: no runtime dependencies found — gate would pass vacuously\n');
        return 2;
    }
    const errors = evaluate(dependencies);
    if (asJson) {
        process.stdout.write(`${JSON.stringify({ checked: Object.keys(dependencies).length, errors }, null, 2)}\n`);
        return errors.length > 0 ? 1 : 0;
    }
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  dependency floor: ${e}\n`);
        return 1;
    }
    process.stdout.write(
        `✅  dependency floors settled (${Object.keys(dependencies).length} runtime deps) — ` +
            'no freshest-patch ETARGET reachable for a consumer\n',
    );
    return 0;
}

const _selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath)) {
    process.exit(main());
}
