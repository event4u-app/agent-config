#!/usr/bin/env node
/**
 * Lint src/config/surface-matrix.yml — the machine-checked per-tool
 * canonical-surface inventory (road-to-install-path-convergence Phase 2).
 *
 * Guarantees:
 *   - every tool in install.ts::USER_SCOPE_PATHS has a matrix entry, and the
 *     matrix declares no tool the installer does not know (set equality)
 *   - each entry's scope_path matches USER_SCOPE_PATHS (drift fails)
 *   - surface / hooks values come from the closed enums
 *   - duplicate.detect.all_of paths are user-scope (~/) or repo-relative
 *     (./); repo-relative paths must resolve on disk
 *   - a defined duplicate class must carry a converge action, and the
 *     claude-code converge command must name the real plugin id (drift guard
 *     against _lib/claude_plugin.ts)
 *
 * Exit codes: 0 = clean, 1 = problems found, 3 = internal error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

import { USER_SCOPE_PATHS } from './install.js';
import { CLAUDE_MARKETPLACE_NAME, CLAUDE_PLUGIN_ID } from './_lib/claude_plugin.js';
import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
export const MATRIX_PATH = path.join(REPO_ROOT, 'src', 'config', 'surface-matrix.yml');

const SURFACE_VALUES = new Set(['projection', 'plugin', 'bundles', 'export-only']);
const HOOKS_VALUES = new Set(['managed-settings-block', 'settings-hooks-opt-in', 'plugin', 'none']);

type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface SurfaceMatrixTool {
    surface: string;
    scope_path: string;
    hooks: string;
    duplicate?: {
        description?: string;
        pending_evidence?: string;
        detect?: { all_of?: string[] };
    };
    converge?: { action?: string; command?: string; reaps?: string[] };
    notes?: string;
}

export function load_surface_matrix(matrixPath: string = MATRIX_PATH): Record<string, SurfaceMatrixTool> {
    const raw = YAML.parse(fs.readFileSync(matrixPath, 'utf-8'), { version: '1.1' }) as JsonObject;
    const tools = raw['tools'];
    if (!isObject(tools)) {
        throw new Error('surface-matrix.yml: `tools` must be a mapping');
    }
    return tools as unknown as Record<string, SurfaceMatrixTool>;
}

export function main(): number {
    // Replaces the ad-hoc `existsSync(MATRIX_PATH)` precondition. The matrix
    // yaml is the gate's only file input — an emptied `tools:` mapping is
    // already caught by the set-equality against USER_SCOPE_PATHS (a code
    // constant a path migration cannot empty), so a moved file is the one
    // remaining way this gate can go quiet. Exit 1 = "could not run" here; 3
    // stays reserved for an unexpected throw at the CLI boundary.
    try {
        assertWatchlistResolves({
            gate: 'lint_surface_matrix',
            candidates: [path.relative(REPO_ROOT, MATRIX_PATH)],
            repoRoot: REPO_ROOT,
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    const errors: string[] = [];
    let tools: Record<string, SurfaceMatrixTool>;
    try {
        tools = load_surface_matrix();
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stdout.write(`❌  surface-matrix.yml unreadable: ${msg}\n`);
        return 1;
    }

    // Coverage — set equality with the installer's tool inventory.
    const matrixIds = new Set(Object.keys(tools));
    const installerIds = new Set(Object.keys(USER_SCOPE_PATHS));
    for (const id of installerIds) {
        if (!matrixIds.has(id)) {
            errors.push(`tool \`${id}\` is in USER_SCOPE_PATHS but has no surface-matrix entry`);
        }
    }
    for (const id of matrixIds) {
        if (!installerIds.has(id)) {
            errors.push(`tool \`${id}\` is in the surface matrix but not in USER_SCOPE_PATHS`);
        }
    }

    for (const [id, entry] of Object.entries(tools)) {
        const where = `tools.${id}`;
        if (!isObject(entry)) {
            errors.push(`${where} must be a mapping`);
            continue;
        }
        if (!SURFACE_VALUES.has(entry.surface)) {
            errors.push(`${where}.surface \`${String(entry.surface)}\` not in {${[...SURFACE_VALUES].join(', ')}}`);
        }
        if (!HOOKS_VALUES.has(entry.hooks)) {
            errors.push(`${where}.hooks \`${String(entry.hooks)}\` not in {${[...HOOKS_VALUES].join(', ')}}`);
        }
        const expectedPath = USER_SCOPE_PATHS[id];
        if (expectedPath && entry.scope_path !== expectedPath) {
            errors.push(
                `${where}.scope_path \`${String(entry.scope_path)}\` drifted from ` +
                    `USER_SCOPE_PATHS \`${expectedPath}\``,
            );
        }

        const dup = entry.duplicate;
        if (dup !== undefined) {
            if (!isObject(dup)) {
                errors.push(`${where}.duplicate must be a mapping`);
                continue;
            }
            const detect = dup.detect;
            if (detect !== undefined) {
                const allOf = isObject(detect) ? detect['all_of'] : undefined;
                if (!Array.isArray(allOf) || allOf.length === 0) {
                    errors.push(`${where}.duplicate.detect.all_of must be a non-empty list`);
                } else {
                    for (const p of allOf) {
                        if (typeof p !== 'string' || !(p.startsWith('~/') || p.startsWith('./'))) {
                            errors.push(
                                `${where}.duplicate.detect path \`${String(p)}\` must start with ~/ or ./`,
                            );
                            continue;
                        }
                        if (p.startsWith('./') && !fs.existsSync(path.join(REPO_ROOT, p.slice(2)))) {
                            errors.push(`${where}.duplicate.detect repo path does not resolve: \`${p}\``);
                        }
                    }
                }
                // A defined (non-pending) duplicate class needs a converge action.
                const conv = entry.converge;
                if (!isObject(conv) || typeof conv['command'] !== 'string' || conv['command'] === '') {
                    errors.push(`${where} defines a duplicate class but no converge.command`);
                }
            } else if (typeof dup['pending_evidence'] !== 'string') {
                errors.push(
                    `${where}.duplicate must carry either detect.all_of or pending_evidence`,
                );
            }
        }
    }

    // Drift guard: the claude-code converge command must name the real
    // plugin id + marketplace name from _lib/claude_plugin.ts.
    const claude = tools['claude-code'];
    const claudeCmd = claude && isObject(claude.converge) ? String(claude.converge['command'] ?? '') : '';
    const expectedRef = `${CLAUDE_PLUGIN_ID}@${CLAUDE_MARKETPLACE_NAME}`;
    if (claudeCmd !== '' && !claudeCmd.includes(expectedRef)) {
        errors.push(
            `tools.claude-code.converge.command must reference \`${expectedRef}\` ` +
                `(got \`${claudeCmd}\`)`,
        );
    }

    if (errors.length > 0) {
        process.stdout.write('❌  surface-matrix.yml has problems:\n');
        for (const e of errors) {
            process.stdout.write(`  - ${e}\n`);
        }
        return 1;
    }

    process.stdout.write(
        `✅  surface-matrix.yml (${matrixIds.size} tools, coverage matches USER_SCOPE_PATHS)\n`,
    );
    process.stdout.write('  No issues found.\n');
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
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  internal error: ${msg}\n`);
        process.exit(3);
    }
}
