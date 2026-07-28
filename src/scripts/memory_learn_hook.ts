#!/usr/bin/env node
/**
 * session_end concern — memory learning sidecar aggregation
 * (road-to-reachable-code-memory Phase 4).
 *
 * Joins the EXISTING `session_end` concern set in hook_manifest.yaml — no
 * new platform hook wiring. On session end it aggregates
 * `agents/memory/intake/signals-*.jsonl` through the learning sidecar
 * (`learning_sidecar.ts`: 30-day decay, ≥2-origin corroboration, dead-end
 * ledger) into the gitignored `agents/memory/.agent-learning.json` +
 * // cache-invalidation: path owned by learning_sidecar.ts (schema_version field inside the JSON; name pinned there)
 * `LESSONS.md`. Local-only, budget-capped, fail-open:
 *
 * - Default-OFF. Fires only when `memory.learn_on_session_end: true` in
 *   `.agent-settings.yml` (council decision 2026-07-27: ships off; the
 *   default flip is proposed only after the 30-day dogfood shows
 *   non-trivial signal AND session-end p95 < 2 s).
 * - Budget-capped: a wall-clock budget (default 2000 ms) aborts the write
 *   and exits 0 — a slow aggregation must never tax session teardown.
 * - Fail-open: any error → exit 0, no output. `fail_closed: false`.
 * - Promotion stays human: this hook only refreshes the sidecar; a
 *   PROMOTED lesson is surfaced as a one-line visibility marker pointing
 *   at the existing /memory:propose flow. Nothing auto-writes curated
 *   `agents/memory/*.yml`.
 *
 * Exit codes (dispatcher contract): 0 always (allow).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    buildSidecar,
    LESSONS_NAME,
    renderLessonsMd,
    SIDECAR_NAME,
} from './learning_sidecar.js';

const SETTINGS_FILE = '.agent-settings.yml';
/** Wall-clock budget for the whole aggregation (ms). */
export const BUDGET_MS = 2000;

/**
 * Minimal `.agent-settings.yml` reader for `memory.learn_on_session_end`
 * (same hand-rolled mini-parser pattern as the sibling hooks — no YAML
 * dependency in the hook hot path).
 */
export function enabled(root: string): boolean {
    const p = path.join(root, SETTINGS_FILE);
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf8');
    } catch {
        return false;
    }
    let inMemory = false;
    for (const rawLine of text.split('\n')) {
        const line = rawLine.replace(/\s+$/u, '');
        if (/^memory:\s*(#.*)?$/u.test(line)) {
            inMemory = true;
            continue;
        }
        if (inMemory) {
            if (/^\S/u.test(line) && line !== '') {
                inMemory = false; // left the memory: block
                continue;
            }
            const m = /^\s{2,}learn_on_session_end:\s*(\S+)/u.exec(line);
            if (m) return m[1] === 'true';
        }
    }
    return false;
}

/** Run the aggregation. Returns the one-line marker to emit, or null. */
export function runLearn(root: string, nowIso: string, budgetMs: number = BUDGET_MS): string | null {
    const started = Date.now();
    const intakeDir = path.join(root, 'agents', 'memory', 'intake');
    const outDir = path.join(root, 'agents', 'memory');
    if (!fs.existsSync(intakeDir)) return null;
    const sidecar = buildSidecar(intakeDir, nowIso);
    if (Date.now() - started > budgetMs) return null; // over budget — skip the write
    if (sidecar.lessons.length === 0) return null;
    fs.writeFileSync(path.join(outDir, SIDECAR_NAME), `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outDir, LESSONS_NAME), renderLessonsMd(sidecar), 'utf8');
    const promoted = sidecar.lessons.filter((l) => l.verdict === 'preferred').length;
    const deadEnds = sidecar.lessons.filter((l) => l.verdict === 'dead_end').length;
    // Memory-visibility contract shape: one line, ids/counters only, no bodies.
    return (
        `🧠 Memory: sidecar refreshed — ${sidecar.lessons.length} lesson(s) ` +
        `(${promoted} preferred · ${deadEnds} dead-end); promote via /memory:propose`
    );
}

export function main(): number {
    try {
        const root = process.cwd();
        if (!enabled(root)) return 0;
        const marker = runLearn(root, new Date().toISOString());
        if (marker) process.stdout.write(`${marker}\n`);
    } catch {
        // fail-open: session teardown must never break on a learning hook.
    }
    return 0;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _isMain = (() => {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    try {
        return (
            pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href ===
            import.meta.url
        );
    } catch {
        return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
    }
})();
if (_isMain) {
    process.exit(main());
}

export const _HERE = fileURLToPath(import.meta.url);
