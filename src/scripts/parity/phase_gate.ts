#!/usr/bin/env tsx
/**
 * phase_gate.ts — Python→TypeScript migration phase gate.
 *
 * Phase 1 Step 10 of `agents/roadmaps/road-to-typescript-only-scripts.md`.
 *
 * Reads `src/scripts/parity/phase-manifest.json` and enforces:
 *
 *   1. Sequencing — a phase may only be `in-progress` / `complete` when
 *      every lower-numbered phase is `in-progress` / `complete` too (no
 *      later phase starts while an earlier one is still `pending`).
 *   2. Completeness — a `complete` phase must have ZERO tracked `.py`
 *      files remaining in its categories (bucketing reused from
 *      `src/scripts/migration_status.ts`).
 *   3. `in-progress` phases get an informational remaining-count line.
 *
 * Usage:
 *   npx tsx src/scripts/parity/phase_gate.ts [--manifest <path>]
 *
 * Exit 0 only when every check passes. Node builtins only.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
    CATEGORY_ORDER,
    categorize,
    repoRoot,
    trackedPythonFiles,
    type Category,
} from '../migration_status.js';

// ---------------------------------------------------------------------------
// Manifest model + parsing
// ---------------------------------------------------------------------------

export type PhaseStatus = 'pending' | 'in-progress' | 'complete';

export interface Phase {
    readonly phase: number;
    readonly name: string;
    readonly categories: readonly Category[];
    readonly status: PhaseStatus;
}

const VALID_STATUSES: readonly PhaseStatus[] = ['pending', 'in-progress', 'complete'];

function isCategory(value: unknown): value is Category {
    return typeof value === 'string' && (CATEGORY_ORDER as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is PhaseStatus {
    return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

/** Parse + validate the manifest JSON. Throws with a precise message on any shape error. */
export function parseManifest(raw: string): Phase[] {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch (err) {
        throw new Error(`manifest is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('manifest must be a JSON object with a "phases" array');
    }
    const phasesRaw = (data as Record<string, unknown>)['phases'];
    if (!Array.isArray(phasesRaw) || phasesRaw.length === 0) {
        throw new Error('manifest "phases" must be a non-empty array');
    }

    const phases: Phase[] = [];
    const seen = new Set<number>();
    for (const [index, entry] of phasesRaw.entries()) {
        if (typeof entry !== 'object' || entry === null) {
            throw new Error(`phases[${index}] must be an object`);
        }
        const obj = entry as Record<string, unknown>;
        const phase = obj['phase'];
        if (typeof phase !== 'number' || !Number.isInteger(phase)) {
            throw new Error(`phases[${index}].phase must be an integer`);
        }
        if (seen.has(phase)) {
            throw new Error(`duplicate phase number ${phase}`);
        }
        seen.add(phase);
        const name = obj['name'];
        if (typeof name !== 'string' || name === '') {
            throw new Error(`phases[${index}].name must be a non-empty string`);
        }
        const categories = obj['categories'];
        if (!Array.isArray(categories) || categories.length === 0) {
            throw new Error(`phases[${index}].categories must be a non-empty array`);
        }
        for (const category of categories) {
            if (!isCategory(category)) {
                throw new Error(
                    `phases[${index}].categories contains unknown category ${JSON.stringify(category)} ` +
                        `(known: ${CATEGORY_ORDER.join(', ')})`,
                );
            }
        }
        const status = obj['status'];
        if (!isStatus(status)) {
            throw new Error(
                `phases[${index}].status must be one of ${VALID_STATUSES.join(' | ')}, got ${JSON.stringify(status)}`,
            );
        }
        phases.push({ phase, name, categories: categories as Category[], status });
    }

    return phases.slice().sort((a, b) => a.phase - b.phase);
}

// ---------------------------------------------------------------------------
// Gate logic (pure — file list injected for testability)
// ---------------------------------------------------------------------------

export interface PhaseCheck {
    readonly phase: number;
    readonly name: string;
    readonly status: PhaseStatus;
    /** Tracked .py files remaining in this phase's categories. */
    readonly remaining: number;
    readonly ok: boolean;
    readonly message: string;
}

export interface GateResult {
    readonly ok: boolean;
    readonly checks: readonly PhaseCheck[];
    /** Cross-phase errors (sequencing violations). */
    readonly errors: readonly string[];
}

function remainingInCategories(pyFiles: readonly string[], categories: readonly Category[]): number {
    const wanted = new Set<Category>(categories);
    let count = 0;
    for (const file of pyFiles) {
        if (wanted.has(categorize(file))) count += 1;
    }
    return count;
}

/**
 * Run all gate checks against a manifest and a tracked-`.py` file list.
 * `pyFiles` are repo-relative paths (as produced by `trackedPythonFiles`).
 */
export function runPhaseGate(phases: readonly Phase[], pyFiles: readonly string[]): GateResult {
    const errors: string[] = [];

    // Sequencing: once a `pending` phase appears, every later phase must be `pending` too.
    let firstPending: Phase | undefined;
    for (const phase of phases) {
        if (phase.status === 'pending') {
            if (firstPending === undefined) firstPending = phase;
            continue;
        }
        if (firstPending !== undefined) {
            errors.push(
                `sequencing violation: phase ${phase.phase} (${phase.name}) is "${phase.status}" ` +
                    `while earlier phase ${firstPending.phase} (${firstPending.name}) is still "pending"`,
            );
        }
    }

    const checks: PhaseCheck[] = phases.map((phase) => {
        const remaining = remainingInCategories(pyFiles, phase.categories);
        const label = `[${phase.categories.join(', ')}]`;
        switch (phase.status) {
            case 'pending':
                return {
                    phase: phase.phase,
                    name: phase.name,
                    status: phase.status,
                    remaining,
                    ok: true,
                    message: `not started — no gate enforced (${remaining} .py in ${label})`,
                };
            case 'in-progress':
                return {
                    phase: phase.phase,
                    name: phase.name,
                    status: phase.status,
                    remaining,
                    ok: true,
                    message: `in progress — ${remaining} .py remaining in ${label} (informational)`,
                };
            case 'complete': {
                const ok = remaining === 0;
                return {
                    phase: phase.phase,
                    name: phase.name,
                    status: phase.status,
                    remaining,
                    ok,
                    message: ok
                        ? `complete — 0 .py remaining in ${label}`
                        : `marked complete but ${remaining} tracked .py file(s) remain in ${label}`,
                };
            }
        }
    });

    return {
        ok: errors.length === 0 && checks.every((check) => check.ok),
        checks,
        errors,
    };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const DEFAULT_MANIFEST = 'src/scripts/parity/phase-manifest.json';

function parseManifestPath(argv: readonly string[]): string {
    const flagIndex = argv.indexOf('--manifest');
    if (flagIndex === -1) {
        const inline = argv.find((arg) => arg.startsWith('--manifest='));
        return inline !== undefined ? inline.slice('--manifest='.length) : DEFAULT_MANIFEST;
    }
    const value = argv[flagIndex + 1];
    if (value === undefined || value.startsWith('--')) {
        throw new Error('--manifest requires a path argument');
    }
    return value;
}

function main(): void {
    let exitCode = 0;
    try {
        const root = repoRoot();
        const manifestPath = resolve(root, parseManifestPath(process.argv.slice(2)));
        const phases = parseManifest(readFileSync(manifestPath, 'utf-8'));
        const pyFiles = trackedPythonFiles(root);
        const result = runPhaseGate(phases, pyFiles);

        process.stdout.write(`Phase gate — manifest: ${manifestPath}\n`);
        process.stdout.write(`Tracked .py after exclusions: ${pyFiles.length}\n\n`);
        for (const check of result.checks) {
            const verdict = check.ok ? 'PASS' : 'FAIL';
            process.stdout.write(
                `${verdict}  phase ${check.phase} (${check.name}): ${check.message}\n`,
            );
        }
        for (const error of result.errors) {
            process.stdout.write(`FAIL  ${error}\n`);
        }
        process.stdout.write(
            result.ok ? '\nAll phase-gate checks passed.\n' : '\nPhase gate FAILED.\n',
        );
        exitCode = result.ok ? 0 : 1;
    } catch (err) {
        process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
        exitCode = 1;
    }
    process.exit(exitCode);
}

const isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCliEntry) {
    main();
}
