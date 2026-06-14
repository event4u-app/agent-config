/**
 * State machine stub for the `/orchestrate` command.
 *
 * TypeScript twin of `work_engine/orchestration.py` (ADR-094 py2ts Phase 1 —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-094 — Python style is part of the contract).
 *
 * Reads a pipeline file conforming to
 * `docs/contracts/orchestration-dsl-v1.md` and produces an ordered
 * sequence of step descriptors the agent dispatches one at a time.
 * The runtime itself is **not** in Python — each step is executed by the
 * agent via skill / command / persona / subagent dispatch. This module
 * holds the deterministic bookkeeping:
 *
 * - load + interpolate
 * - step iteration with success / failure / when-guard tracking
 * - output-map resolution at the end
 *
 * Design constraints (R1 carve-outs from
 * `road-to-distribution-and-adoption.md`):
 *
 * - No external dependencies. YAML loading reuses the dispatcher's
 *   loader so the runtime sees what the linter sees.
 * - No side effects. The state machine never edits files, runs commands,
 *   or emits hooks of its own. Audit emission is the caller's job.
 * - Forward-ref free. `steps[].with` references can only reach
 *   earlier steps; this is enforced both by the linter and at runtime.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Mirror of Python `re` group semantics: capture (inputs|steps), the ident,
// and an optional `.output` suffix; `g` flag so `.sub`-style replace covers
// every non-overlapping match like Python `re.sub`.
const _INTERP_RE = /\$\{\{\s*(inputs|steps)\.([a-z0-9_-]+)(?:\.output)?\s*\}\}/g;

/** Heterogeneous value, mirroring Python's `Any`. */
export type Any = unknown;

/** One step's record after dispatch. */
export class StepResult {
    step_id: string;
    kind: string;
    ref: string;
    success: boolean;
    output: string;
    error: string | null;

    constructor(
        step_id: string,
        kind: string,
        ref: string,
        success = false,
        output = '',
        error: string | null = null,
    ) {
        this.step_id = step_id;
        this.kind = kind;
        this.ref = ref;
        this.success = success;
        this.output = output;
        this.error = error;
    }
}

/** Bookkeeping for a single `/orchestrate` run. */
export class PipelineState {
    name: string;
    inputs: Record<string, string>;
    results: Record<string, StepResult>;
    halted: boolean;
    halt_reason: string | null;

    constructor(args: {
        name: string;
        inputs: Record<string, string>;
        results?: Record<string, StepResult>;
        halted?: boolean;
        halt_reason?: string | null;
    }) {
        this.name = args.name;
        this.inputs = args.inputs;
        this.results = args.results ?? {};
        this.halted = args.halted ?? false;
        this.halt_reason = args.halt_reason ?? null;
    }
}

/** True when `value` is a plain object (Python `isinstance(x, dict)`). */
function _isDict(value: unknown): value is Record<string, Any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Python `re.Match`-style replacement function signature loader. */
interface DispatchHookModule {
    _load_yaml(p: string): Record<string, Any>;
}

/**
 * Reuse the linter's loader so the runtime accepts the same shape.
 *
 * Walks parents to find `scripts/hooks/dispatch_hook.ts` so the loader is
 * reachable both when this module runs from the consumer projection
 * (`dist/agent-src/templates/scripts/work_engine/`) and from the
 * source-of-truth tree
 * (`packages/<pack>/.agent-src.uncondensed/templates/scripts/work_engine/`).
 * Loaded by dynamic `import()` to avoid namespace collisions with test
 * modules named `hooks` (the TS analogue of the Python importlib-by-path
 * approach).
 */
async function _load_pipeline(p: string): Promise<Record<string, Any>> {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    let candidate: string | null = null;
    // Layout-agnostic: the dispatcher sits at `scripts/hooks/` in a consumer
    // install + the `dist/agent-src/` projection, and at `src/scripts/hooks/`
    // in the maintainer source tree. Probe both per parent so the loader
    // resolves regardless of where this template runs.
    const relCandidates = [
        path.join('scripts', 'hooks', 'dispatch_hook.ts'),
        path.join('src', 'scripts', 'hooks', 'dispatch_hook.ts'),
    ];
    let dir = path.dirname(here);
    // Walk `here.parents` — every ancestor directory up to the filesystem root.
    for (;;) {
        for (const rel of relCandidates) {
            const probe = path.join(dir, rel);
            if (fs.existsSync(probe) && fs.statSync(probe).isFile()) {
                candidate = probe;
                break;
            }
        }
        if (candidate !== null) {
            break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    if (candidate === null) {
        throw new Error(
            'could not locate scripts/hooks/dispatch_hook.ts (or ' +
                `src/scripts/hooks/dispatch_hook.ts) from ${here}`,
        );
    }
    const module = (await import(pathToFileURL(candidate).href)) as DispatchHookModule;
    const doc = module._load_yaml(p);
    if (!_isDict(doc)) {
        throw new Error(`${p}: top-level must be a mapping`);
    }
    return doc;
}

/**
 * Substitute `${{ inputs.X }}` / `${{ steps.Y.output }}` in a nested value.
 * Unknown references throw — the linter should have caught them, but the
 * runtime double-checks.
 */
export function _interpolate(value: Any, state: PipelineState): Any {
    if (typeof value === 'string') {
        return value.replace(_INTERP_RE, (_match, ns: string, ident: string) => {
            if (ns === 'inputs') {
                if (!(ident in state.inputs)) {
                    // Mirror Python `KeyError(f"unknown input '{ident}'")`.
                    throw new KeyError(`unknown input '${ident}'`);
                }
                return state.inputs[ident] as string;
            }
            if (!(ident in state.results)) {
                throw new KeyError(`unknown step '${ident}'`);
            }
            return (state.results[ident] as StepResult).output;
        });
    }
    if (_isDict(value)) {
        const out: Record<string, Any> = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = _interpolate(v, state);
        }
        return out;
    }
    if (Array.isArray(value)) {
        return value.map((v) => _interpolate(v, state));
    }
    return value;
}

/**
 * Evaluate the limited `when` mini-language. Supports
 * `steps.X.success` / `steps.X.failure` and equality on a single
 * `${{ steps.X.output }}` template against a literal.
 */
export function _when_passes(when: string | null | undefined, state: PipelineState): boolean {
    if (!when) {
        return true;
    }
    when = when.trim();
    const m1 = fullmatch(/steps\.([a-z0-9_-]+)\.(success|failure)/, when);
    if (m1) {
        const sid = m1[1] as string;
        const kind = m1[2] as string;
        if (!(sid in state.results)) {
            return false;
        }
        const res = state.results[sid] as StepResult;
        return kind === 'success' ? res.success : !res.success;
    }
    const m2 = fullmatch(/\$\{\{\s*steps\.([a-z0-9_-]+)\.output\s*\}\}\s*==\s*"([^"]*)"/, when);
    if (m2) {
        const sid = m2[1] as string;
        const literal = m2[2] as string;
        const res = state.results[sid] ?? new StepResult(sid, '', '');
        return res.output === literal;
    }
    // Mirror Python `ValueError(f"unsupported when expression: {when!r}")`.
    throw new ValueError(`unsupported when expression: ${pyRepr(when)}`);
}

/** A descriptor yielded by `iter_steps`, carrying the live state for callbacks. */
export interface StepDescriptor {
    id: string;
    kind: string;
    ref: string;
    with: Any;
    _state: PipelineState;
}

/**
 * Yield interpolated step descriptors in order.
 *
 * Caller dispatches each descriptor via skill / command / persona /
 * subagent and feeds the result back via {@link record_result}.
 */
export async function* iter_steps(
    p: string,
    inputs: Record<string, string>,
): AsyncGenerator<StepDescriptor> {
    const doc = await _load_pipeline(p);
    const merged_inputs: Record<string, string> = {};
    const docInputs = (doc['inputs'] as Any[] | null | undefined) || [];
    for (const inp of docInputs) {
        if (_isDict(inp) && typeof inp['id'] === 'string') {
            const id = inp['id'] as string;
            merged_inputs[id] =
                id in inputs
                    ? (inputs[id] as string)
                    : (((inp['default'] as string | undefined) ?? '') as string);
        }
    }
    const state = new PipelineState({
        name: (doc['name'] as string | undefined) ?? '',
        inputs: merged_inputs,
    });
    const steps = (doc['steps'] as Array<Record<string, Any>> | null | undefined) || [];
    for (const step of steps) {
        if (state.halted) {
            break;
        }
        if (!_when_passes(step['when'] as string | null | undefined, state)) {
            continue;
        }
        yield {
            id: step['id'] as string,
            kind: step['kind'] as string,
            ref: step['ref'] as string,
            with: _interpolate((step['with'] as Any) || {}, state),
            _state: state,
        };
    }
}

/**
 * Caller hands the descriptor + outcome back so subsequent steps can see
 * `${{ steps.<id>.output }}`.
 */
export function record_result(
    descriptor: StepDescriptor,
    opts: { success: boolean; output?: string; error?: string | null },
): void {
    const state = descriptor._state;
    state.results[descriptor.id] = new StepResult(
        descriptor.id,
        descriptor.kind,
        descriptor.ref,
        opts.success,
        opts.output ?? '',
        opts.error ?? null,
    );
    if (!opts.success) {
        state.halted = true;
        state.halt_reason = `step ${descriptor.id} failed`;
    }
}

/**
 * Resolve the pipeline's `outputs:` map against the captured step outputs.
 * Returns an empty map if the pipeline declares no outputs.
 */
export async function resolve_outputs(
    p: string,
    state: PipelineState,
): Promise<Record<string, Any>> {
    const doc = await _load_pipeline(p);
    const raw = (doc['outputs'] as Record<string, Any> | null | undefined) || {};
    const out: Record<string, Any> = {};
    for (const [k, v] of Object.entries(raw)) {
        out[k] = _interpolate(v, state);
    }
    return out;
}

// ── Python-parity helpers ───────────────────────────────────────────────

/** Python `KeyError` — distinct class so callers can mirror the type. */
export class KeyError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, KeyError.prototype);
        this.name = 'KeyError';
    }
}

/** Python `ValueError`. */
export class ValueError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, ValueError.prototype);
        this.name = 'ValueError';
    }
}

/** Python `re.fullmatch(pattern, s)` — the whole string must match. */
function fullmatch(pattern: RegExp, s: string): RegExpExecArray | null {
    const anchored = new RegExp(`^(?:${pattern.source})$`, pattern.flags.replace('g', ''));
    return anchored.exec(s);
}

/**
 * Python `repr(s)` for a string — used in the `unsupported when` error.
 * CPython prefers single quotes, switching to double only when the string
 * contains a single quote and no double quote.
 */
function pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = '';
    for (const ch of s) {
        if (ch === '\\') {
            body += '\\\\';
        } else if (ch === quote) {
            body += `\\${ch}`;
        } else if (ch === '\n') {
            body += '\\n';
        } else if (ch === '\r') {
            body += '\\r';
        } else if (ch === '\t') {
            body += '\\t';
        } else {
            body += ch;
        }
    }
    return `${quote}${body}${quote}`;
}
