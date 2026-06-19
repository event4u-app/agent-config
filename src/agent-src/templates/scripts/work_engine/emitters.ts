/**
 * Stdout / stderr emitters for the CLI entry point.
 *
 * TypeScript twin of `work_engine/emitters.py` (ADR-200 py2ts Phase 1 —
 * work_engine TOP/integration layer). Public API names stay snake_case to
 * mirror the Python module 1:1 (per ADR-200 — Python style is part of the
 * contract).
 *
 * Extracted from `cli.py` in P2.3 of `road-to-post-pr29-optimize.md`. Holds
 * the two output helpers that shape the wire surface of `main()`: the
 * SUCCESS/halt branch printed on stdout, and the lifecycle-hook halt surface
 * printed on stderr.
 */

import * as fs from 'node:fs';

import { Outcome } from './delivery_state.js';
import type { HookHalt } from './hooks/index.js';
import type { WorkState} from './state.js';
import { dump } from './state.js';

/**
 * Print the terminal surface for `final` to stdout.
 *
 * On SUCCESS, the delivery report. Otherwise a `[halt]` status line plus the
 * surfaced questions verbatim.
 */
export function _emit(work: WorkState, final: Outcome, halting: string | null): void {
    if (final === Outcome.SUCCESS) {
        process.stdout.write(work.report + '\n');
        return;
    }
    process.stdout.write(`[halt] outcome=${final} step=${halting || '(none)'}\n`);
    for (const line of work.questions) {
        process.stdout.write(line + '\n');
    }
}

/**
 * Render a {@link HookHalt} surface to stderr and return exit 2.
 *
 * Per the P3 halt branch table, every CLI-layer halt yields exit code `2`
 * regardless of which event fired it. State persistence is governed by *where*
 * in `main` the halt is detected: the call site decides whether `_save`
 * already ran.
 *
 * When `work` + `state_file` are provided AND the state file already exists on
 * disk, the halt is appended to `work.halts[]` and the state is re-saved. This
 * lets `agent-config explain last` surface the halt reason later. Fresh-run
 * halts before the first `_save` (state file absent) still leave no state on
 * disk — the pre-explain-v2 contract is preserved.
 */
export function _emit_halt(
    halt: HookHalt,
    opts: {
        work?: WorkState | null;
        state_file?: string | null;
        event?: string | null;
    } = {},
): number {
    const work = opts.work ?? null;
    const state_file = opts.state_file ?? null;
    const event = opts.event ?? null;

    if (halt.surface.length > 0) {
        for (const line of halt.surface) {
            process.stderr.write(line + '\n');
        }
    } else {
        process.stderr.write(`halt: ${halt.reason}\n`);
    }
    if (work !== null && state_file !== null && _exists(state_file)) {
        work.halts.push({
            reason: halt.reason,
            step: event || '',
            surface: [...halt.surface],
            timestamp: _utcNowIso(),
        });
        try {
            dump(work, state_file);
        } catch {
            // never let halt persistence mask the halt
        }
    }
    return 2;
}

/** Python `Path.exists()`. */
function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * Mirror Python `datetime.now(tz=timezone.utc).isoformat()`.
 *
 * CPython renders an aware UTC datetime as `YYYY-MM-DDTHH:MM:SS.ffffff+00:00`
 * (microsecond precision, explicit `+00:00` offset). `Date.toISOString()`
 * yields `YYYY-MM-DDTHH:MM:SS.sssZ` (millisecond precision, `Z` suffix), so
 * this rebuilds the CPython shape: pad milliseconds to microseconds and
 * replace the `Z` with `+00:00`. This timestamp is wall-clock and therefore
 * non-deterministic — tests normalise it.
 */
function _utcNowIso(): string {
    const iso = new Date().toISOString(); // e.g. 2026-06-15T03:11:58.123Z
    // Strip the trailing 'Z', expand .sss → .ssssss (µs), append +00:00.
    const body = iso.slice(0, -1); // drop 'Z'
    const dot = body.lastIndexOf('.');
    if (dot === -1) {
        return body + '.000000+00:00';
    }
    const frac = body.slice(dot + 1); // milliseconds, 3 digits
    const micros = (frac + '000000').slice(0, 6);
    return body.slice(0, dot + 1) + micros + '+00:00';
}
