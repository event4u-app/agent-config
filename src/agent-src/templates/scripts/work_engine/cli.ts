/**
 * Command-line entry point for `/implement-ticket`.
 *
 * TypeScript twin of `work_engine/cli.py` (ADR-096 py2ts Phase 1 — work_engine
 * TOP/integration layer). Public API names stay snake_case to mirror the Python
 * module 1:1 (per ADR-096 — Python style is part of the contract).
 *
 * Minimal Option-A transport: the script loads a persisted state file, runs the
 * dispatcher once, writes the updated state back, and prints either the delivery
 * report (on SUCCESS) or the halt surface — directive plus numbered questions —
 * on BLOCKED/PARTIAL.
 *
 * The script never edits code, runs tests, or opens pull requests. All of that
 * is delegated to the agent via `@agent-directive:` markers.
 *
 * Layout (post P2.3 of `road-to-post-pr29-optimize.md`): this file is a thin
 * orchestrator. The argument parser, state I/O, file-input builders, hook
 * bootstrap, and stdout/stderr emitters live in their own leaf modules under
 * `work_engine` — see `cli_args`, `state_io`, `input_builders`, `hook_bootstrap`,
 * `emitters`, `errors`. Public names (`main`, `DEFAULT_STATE_FILE`) and the
 * private surface (`_build_hook_registry`, `_CLIError`, `_load_or_build`, …) are
 * re-exported here so existing imports continue to resolve.
 *
 * Exit codes:
 *
 * - `0` — flow reached SUCCESS; `state.report` printed.
 * - `1` — flow halted BLOCKED; halt surface printed on stdout, the state file
 *   carries the updated `outcomes` and `questions` so the agent can resume.
 * - `2` — argument or I/O error. The state file is *not* written in this case.
 */

import {
    ArgparseExit,
    DEFAULT_STATE_FILE,
    LEGACY_STATE_FILE,
    _FMT_V0,
    _FMT_V1,
    parse_args,
} from './cli_args.js';
import { Outcome } from './delivery_state.js';
import {
    NotImplementedError,
    ValueError,
    assert_kind_supported,
    dispatch,
    load_directive_set,
    select_directive_set,
} from './dispatcher.js';
import { _emit, _emit_halt } from './emitters.js';
import { _CLIError } from './errors.js';
import { _build_hook_registry, _register_chat_history_hooks } from './hook_bootstrap.js';
import { HookContext, HookEvent, HookRunner } from './hooks/index.js';
import {
    _build_from_diff_file,
    _build_from_file_file,
    _build_from_prompt_file,
    _load_or_build,
} from './input_builders.js';
import {
    _load,
    _maybe_raise_legacy_hint,
    _read_json,
    _save,
    _sync_back,
    _to_delivery,
    _to_v0_dict,
} from './state_io.js';
import type { WorkState } from './state.js';

/**
 * Run one dispatch cycle against the persisted state.
 *
 * `argv` is taken as-is; pass `null` to fall back to `process.argv.slice(2)`
 * (the usual entry-point contract).
 */
export function main(argv: string[] | null = null): number {
    // The Python source does `_build_parser().parse_args(argv)`. The cli_args
    // twin folds the parser into `parse_args`, which on `-h`/`--help` or any
    // arg error sets `process.exitCode` and throws the `ArgparseExit` sentinel
    // (mirroring argparse's `SystemExit`). main() converts that to its return
    // code so the entry point and the test harness agree on the exit.
    let args;
    try {
        args = parse_args(argv ?? process.argv.slice(2));
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            return exc.code;
        }
        throw exc;
    }
    const state_file: string = args.state_file;

    const runner = new HookRunner(_build_hook_registry(args));

    let halt = runner.emit(
        HookEvent.BEFORE_LOAD,
        new HookContext({ state_file, args }),
    );
    if (halt !== null) {
        return _emit_halt(halt, { state_file, event: 'BEFORE_LOAD' });
    }

    let work: WorkState;
    let fmt: string;
    try {
        [work, fmt] = _load_or_build(state_file, args);
    } catch (exc) {
        if (exc instanceof _CLIError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    halt = runner.emit(
        HookEvent.AFTER_LOAD,
        new HookContext({ state_file, work, fmt, args }),
    );
    if (halt !== null) {
        return _emit_halt(halt, { work, state_file, event: 'AFTER_LOAD' });
    }

    let set_name: string;
    let steps;
    try {
        set_name = select_directive_set(work);
        assert_kind_supported(work.input.kind, set_name);
        steps = load_directive_set(set_name);
    } catch (exc) {
        if (exc instanceof ValueError || exc instanceof NotImplementedError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    const delivery = _to_delivery(work);

    halt = runner.emit(
        HookEvent.BEFORE_DISPATCH,
        new HookContext({ work, delivery, set_name, args }),
    );
    if (halt !== null) {
        return _emit_halt(halt, { work, state_file, event: 'BEFORE_DISPATCH' });
    }

    const [final, halting] = dispatch(delivery, steps, runner);

    halt = runner.emit(
        HookEvent.AFTER_DISPATCH,
        new HookContext({ work, delivery, final, halting, args }),
    );
    if (halt !== null) {
        return _emit_halt(halt, { work, state_file, event: 'AFTER_DISPATCH' });
    }

    _sync_back(work, delivery);

    halt = runner.emit(
        HookEvent.BEFORE_SAVE,
        new HookContext({ work, delivery, fmt, args }),
    );
    if (halt !== null) {
        return _emit_halt(halt, { work, state_file, event: 'BEFORE_SAVE' });
    }

    _save(state_file, work, fmt);

    halt = runner.emit(
        HookEvent.AFTER_SAVE,
        new HookContext({ work, state_file, fmt, args }),
    );
    if (halt !== null) {
        // State is already on disk; exit 2 still per the P3 branch table.
        return _emit_halt(halt, { work, state_file, event: 'AFTER_SAVE' });
    }

    _emit(work, final, halting);
    return final === Outcome.SUCCESS ? 0 : 1;
}

// Re-export the leaf-module surface so existing imports / patch targets that
// reached for `work_engine.cli.<name>` continue to resolve (mirrors the Python
// `__all__`).
export {
    DEFAULT_STATE_FILE,
    LEGACY_STATE_FILE,
    _CLIError,
    _FMT_V0,
    _FMT_V1,
    _build_from_diff_file,
    _build_from_file_file,
    _build_from_prompt_file,
    _build_hook_registry,
    _emit,
    _emit_halt,
    _load,
    _load_or_build,
    _maybe_raise_legacy_hint,
    _read_json,
    _register_chat_history_hooks,
    _save,
    _sync_back,
    _to_delivery,
    _to_v0_dict,
};
