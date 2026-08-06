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

import type { SettingsClass } from '../shared/settingsClasses.js';
import { consentVerdict, type ConsentVerdict } from '../shared/settingsConsent.js';

import {
    buildSidecar,
    LESSONS_NAME,
    renderLessonsMd,
    SIDECAR_NAME,
} from './learning_sidecar.js';

const SETTINGS_FILE = '.agent-settings.yml';
/** Wall-clock budget for the whole aggregation (ms). */
export const BUDGET_MS = 2000;

/** The key this hook is gated on. */
export const LEARN_KEY = 'memory.learn_on_session_end';

/**
 * The key's class, pinned rather than parsed.
 *
 * `classOfPath` would give the same answer, but only after reading and parsing
 * `docs/contracts/settings-classes.md` — a multi-hundred-row markdown file — on
 * every session teardown, which is exactly the cost the 2 s budget above exists
 * to avoid. The drift risk a hardcoded constant carries is neutralised the
 * cheap way instead: `tests/scripts/memory_learn_hook.test.ts` asserts the
 * contract still classifies this key `B`, so a reclassification reds CI rather
 * than silently unbinding the gate.
 */
export const LEARN_KEY_CLASS: SettingsClass = 'B';

/**
 * Whether `memory.learn_on_session_end` reads as enabled, or `undefined` when
 * the file or the key is absent (same hand-rolled mini-parser pattern as the
 * sibling hooks — no YAML dependency in the hook hot path).
 *
 * Normalised strictly: the literal `true` and nothing else enables the hook. A
 * crude parser must not let `yes` / `1` / `maybe` read as a permission, and
 * `isConservativeDefault` would treat any non-empty string as permissive — so
 * the normalisation happens here, before the consent check, not inside it.
 *
 * WHAT THE TRI-STATE DOES AND DOES NOT SAY. `undefined` means the key is
 * absent. `false` means EITHER a deliberate `false` OR a present-but-malformed
 * scalar, and the two are not distinguished — a user who writes
 * `learn_on_session_end: yes` gets a silent, permanent no-op with no
 * diagnostic. The fail-safe direction is deliberate (a hook that writes files
 * must not be enabled by a value nobody typed on purpose), but the ambiguity is
 * real and is stated here rather than implied by a "raw scalar" the function
 * does not actually return. Diagnosing a malformed value belongs to
 * `settings:check`, not to a fail-open teardown hook.
 */
export function readLearnValue(root: string): boolean | undefined {
    const p = path.join(root, SETTINGS_FILE);
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf8');
    } catch {
        return undefined;
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
    return undefined;
}

/**
 * The consent verdict for running the aggregation.
 *
 * This is the first production caller of `consentVerdict` — Phase 5 step 4 of
 * `road-to-zero-ceremony-settings` asks the consent-gated action to verify the
 * recorded DECISION rather than read the bare value, and this session_end
 * concern is the only action in the tree that a class-B key actually gates.
 *
 * `handEdited: true` is a fact about the path, not a shortcut: the file read
 * here is the PROJECT-LOCAL `.agent-settings.yml`, which
 * `docs/contracts/settings-classes.md` names as a file only a human writes —
 * `settings:set` and the GUI both write the user-global file instead. So on
 * this path a permissive value IS the recorded decision and the verdict is
 * `granted`; what the check adds is that the class is now live (a
 * reclassification out of B refuses the hook instead of silently leaving it
 * enabled) and that the value goes through the shared conservative-default
 * notion rather than a local `=== 'true'`.
 *
 * KNOWN GAP, recorded rather than fixed here: the hook reads only the
 * project-local file, so a user who enables this in the GUI — which writes the
 * user-global file plus the provenance sidecar — never triggers it. Reading the
 * user-global file is where the sidecar's `auto-detected`-refusing power would
 * actually discriminate, but it is also a behaviour change (a hook that writes
 * files would start firing for users it does not fire for today), so it belongs
 * to a decision rather than to this step. Filed in the roadmap.
 */
export function learnConsent(root: string): ConsentVerdict {
    return consentVerdict({
        cls: LEARN_KEY_CLASS,
        value: readLearnValue(root) ?? false,
        handEdited: true,
    });
}

/** `true` only when the recorded decision permits the aggregation. */
export function enabled(root: string): boolean {
    return learnConsent(root) === 'granted';
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
