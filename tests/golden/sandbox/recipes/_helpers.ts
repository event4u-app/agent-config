/**
 * Shared mutation helpers used by all Golden Transcript recipes (TS twin of
 * the retired `_helpers.py`).
 *
 * The helpers are deliberately small and side-effect-explicit: each edits a
 * single file under `workspace/` or runs a single vitest invocation. Recipes
 * compose them; nothing here invents behaviour.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Dict = Record<string, unknown>;

// Repo root = four levels up from tests/golden/sandbox/recipes/_helpers.ts.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const VITEST_BIN = path.join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');

/** Append `text` to `workspace/relpath` (newline-terminated). */
export function append_to_file(workspace: string, relpath: string, text: string): void {
    const target = path.join(workspace, relpath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
    if (existing && !existing.endsWith('\n')) existing += '\n';
    fs.writeFileSync(target, `${existing}${text.replace(/\s+$/, '')}\n`, 'utf-8');
}

/**
 * Replace the unique occurrence of `old` with `replacement`.
 *
 * Throws when `old` is missing or appears more than once — the recipes must
 * stay deterministic, so silent partial replacements are not acceptable.
 */
export function replace_in_file(
    workspace: string,
    relpath: string,
    oldText: string,
    newText: string,
): void {
    const target = path.join(workspace, relpath);
    const body = fs.readFileSync(target, 'utf-8');
    const count = body.split(oldText).length - 1;
    if (count !== 1) {
        throw new Error(
            `replace_in_file: expected exactly 1 occurrence of ${JSON.stringify(oldText)} ` +
                `in ${relpath}, found ${count}`,
        );
    }
    fs.writeFileSync(target, body.replace(oldText, newText), 'utf-8');
}

// vitest prints timing (`301ms`, `1ms`, `Start at …`); only the `Tests …`
// count line is deterministic across machines. Scrub any residual `<n>ms`.
const _VITEST_DURATION_RE = /\b\d+ms\b/g;

/** Last deterministic verdict line of vitest stdout — the `Tests …` summary. */
function _summarise(stdout: string): string {
    const lines = stdout.split('\n').map((l) => l.trim());
    const testsLine = [...lines].reverse().find((l) => /^Tests\s+/.test(l));
    if (testsLine) return testsLine.replace(/\s+/g, ' ').replace(_VITEST_DURATION_RE, '<DURATION>ms');
    for (const line of [...lines].reverse()) {
        if (line) return line.replace(_VITEST_DURATION_RE, '<DURATION>ms');
    }
    return '';
}

/**
 * Run vitest inside `workspace` and return a `state.tests` dict.
 *
 * Verdict mapping mirrors the engine contract (and the retired pytest twin):
 * exit 0 → success, exit 1 → failed, any other code → mixed. `targeted`
 * stores the deterministic one-line verdict summary the agent would have seen.
 */
export function run_vitest(workspace: string, ...extra: string[]): Dict {
    const proc = spawnSync('node', [VITEST_BIN, 'run', '--no-color', ...extra], {
        cwd: workspace,
        encoding: 'utf-8',
        env: { ...process.env, NO_COLOR: '1', CI: '1', FORCE_COLOR: '0' },
    });
    const code = proc.status ?? -1;
    const verdict = code === 0 ? 'success' : code === 1 ? 'failed' : 'mixed';
    return {
        verdict,
        scope: 'targeted',
        exit_code: code,
        targeted: _summarise(`${proc.stdout ?? ''}\n${proc.stderr ?? ''}`),
    };
}

/**
 * Stable `state.verify` payload used by every happy-path recipe. The sandbox
 * does not run the four judges; recipes record the verdict the orchestrator
 * would have produced after a clean review.
 */
export function simulated_review_verdict(): Dict {
    return {
        verdict: 'success',
        confidence: 'high',
        judges: ['bug-hunter', 'security', 'test-coverage', 'code-quality'],
        findings: [],
    };
}

/** Render a minimal `state.changes` list for the given files. */
export function base_changes(...paths: string[]): Dict[] {
    return paths.map((p) => ({ path: p, purpose: 'applied by GT recipe' }));
}

/** Render a `state.plan` shape accepted by the plan directive. */
export function standard_plan(title: string, ...steps: string[]): Dict[] {
    return steps.map((step) => ({ title, detail: step }));
}

/**
 * Persist the `refine-prompt` skill's output back into v1 state. The
 * deterministic gate in the backend `refine` directive reads
 * `state.input.data.reconstructed_ac` / `.assumptions` on the rebound.
 */
export function write_prompt_refinement(
    state: Dict,
    opts: { reconstructed_ac: string[]; assumptions: string[] },
): Dict {
    const input = (state['input'] ??= {}) as Dict;
    const data = (input['data'] ??= {}) as Dict;
    data['reconstructed_ac'] = [...opts.reconstructed_ac];
    data['assumptions'] = [...opts.assumptions];
    return state;
}

/** Build the `trivial_edit` envelope read by `ui_trivial.apply`. */
export function trivial_envelope(opts: {
    files: string[];
    lines_changed: number;
    summary: string;
    new_component?: boolean;
    new_state?: boolean;
    new_dependency?: boolean;
}): Dict {
    return {
        files: [...opts.files],
        lines_changed: opts.lines_changed,
        summary: opts.summary,
        new_component: opts.new_component ?? false,
        new_state: opts.new_state ?? false,
        new_dependency: opts.new_dependency ?? false,
    };
}

/** Build the `state.stack` shape read by `ui.apply`'s dispatch. */
export function stack_state(opts: { frontend: string; php_framework?: string | null }): Dict {
    return { frontend: opts.frontend, php_framework: opts.php_framework ?? null };
}

/** Build the `state.contract` shape pinned by GT-U5. */
export function mixed_contract(opts: {
    data_model?: Dict[];
    api_surface?: Dict[];
    confirmed?: boolean;
} = {}): Dict {
    return {
        data_model: [...(opts.data_model ?? [])],
        api_surface: [...(opts.api_surface ?? [])],
        contract_confirmed: opts.confirmed ?? false,
    };
}

/** Stable `state.tests` payload for the `ui-trivial` smoke gate. */
export function simulated_smoke_verdict(): Dict {
    return {
        verdict: 'success',
        scope: 'smoke',
        exit_code: 0,
        targeted: 'Tests 1 passed (1)',
    };
}
