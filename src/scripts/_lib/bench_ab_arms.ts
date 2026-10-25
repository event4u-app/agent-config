/**
 * The arms `bench_ab_v2_run` can run, and how the `neighbour` arm loads a plugin
 * it never installs. Split out of the runner, which sits at the source-size
 * ceiling; the runner re-exports every name here, so callers are unchanged.
 */
import * as fs from 'node:fs';
import process from 'node:process';

export interface ArmSpec {
    setting_sources: string | null;
    inject: string | null; // None | "rdp" | "placebo"
    recursive?: boolean; // ADR-106 D₂ arm: depth-bounded attempt→critic→re-attempt loop
    /**
     * Per-arm override for the footprint-lift audit, or `null` to declare that
     * lift is **not a valid signal** for this arm.
     *
     * `audit_activation`'s cross-arm direction catches a treatment surface that
     * COLLAPSED to baseline, by requiring the arm's prompt footprint to sit at
     * least `ACTIVATION_MIN_LIFT_RATIO` above the paired vanilla run. That test
     * presupposes a treatment surface large enough to move the footprint. An arm
     * whose treatment is deliberately *minimal* — `bare-principle` is one
     * sentence — has no lift to detect, so including it would fail legitimate
     * runs: the exact failure the ratio's own calibration note warns about.
     *
     * `null` narrows the audit for that arm to the per-trial TEXT direction,
     * which is checked both ways (`activation_verdict`: a text arm must carry an
     * injection, a non-text arm must not). It never leaves the arm unaudited —
     * and `bench_ab_v2_run.test.ts` pins both halves, so neither an
     * always-firing nor a never-firing audit passes.
     */
    min_lift_ratio?: number | null;
    /**
     * Env var naming a plugin directory this arm loads for the run only
     * (`--plugin-dir`). The neighbour package is never installed, and its path
     * never appears in the tree: the operator points the env var at a pinned,
     * vetted checkout.
     */
    plugin_dir_env?: string;
    /**
     * Run the loaded plugin with no MCP server and the operator's isolation env
     * (`neighbour_env`) over a per-run temp directory — so a neighbour whose own
     * hooks write outside the run, or carry state between runs, can be switched
     * off or redirected without naming it here.
     */
    isolate_neighbour?: boolean;
}

// Arm -> (setting_sources, inject) where inject ∈ {None, "rdp", "placebo"}.
// `package-recursive` (ADR-106's D₂) reuses the real-plugin `package` config but
// runs the recursion loop instead of a single --print. It only executes when
// explicitly selected (`--arms package-recursive`); the four default arms are
// untouched, so existing runs and their golden-parity outputs are unchanged.
// `hardened` / `hardened-placebo` (docs/contracts/governance-enforcement-projection.md)
// are opt-in like `package-recursive`: NOT in the default arm list, so existing
// runs and golden-parity outputs are unchanged. `hardened` = the real `package`
// config PLUS the compile-time HARD CONSTRAINT blocks injected via sysprompt;
// `hardened-placebo` = `package` + inert prose of the SAME length, so the
// hardened Δ is length-controlled (measures emphasis, not verbosity).
// `rules-kernel-dc` / `rules-balanced` (cost-factor sweep, 2026-07): plugin OFF
// + ONLY a rule subset injected via sysprompt, to measure how much of the
// weak-host discipline lift survives at a fraction of the full package's
// loaded-context cost. `rules-kernel-dc` = the router kernel (9 Iron-Law rules)
// + `downstream-changes` (one of the two lift-carrying rules; the other,
// `scope-control`, is already in the kernel) — the cheapest configuration that
// contains both. `rules-balanced` = kernel + tier_1 rule bodies, i.e. the
// shipped `balanced` router profile (which does NOT include downstream-changes
// — tier_2 — so this arm also tests whether that profile cut loses the lift).
// Both are opt-in: NOT in the default arm list; existing runs unchanged.
//
// `package-ladder` / `bare-principle` (road-to-solution-minimalism Phase 3 — the
// two arms its Arms step names and `ARMS` lacked). Also opt-in, so existing runs
// and golden-parity outputs are unchanged.
//
// `package-ladder` is NOT redundant with `package`, and the reason is measurable
// rather than stylistic: the ladder ships inside `improve-before-implement`,
// which is `type: auto`, `tier: 2b`, `alwaysApply: false`, keyword-triggered on
// `refactor|implement|migration`, and is absent from `dist/router.json`'s
// preloaded tier lists. So under `package` the ladder reaches the model only when
// a task's own wording happens to trip one of those keywords — unmeasured, and
// per-task. That is finding F1's failure class exactly (an activation gap that a
// null cannot be distinguished from), which is why the pair is: `package` = the
// shipped reality, `package-ladder` = the same config with the ladder rule body
// injected via sysprompt so it is guaranteed in context. The contrast measures
// the ladder, not the trigger set.
//
// `bare-principle` is finding F6's control: the naked principle with NO floors
// routed, plugin scoped away. Its text is authored HERE and is deliberately not
// the external source's own prompt — per `code-provenance`, a borrowed prompt is
// re-derived rather than copied, and the arm's job is to be a floor-free
// principle statement, not a specific artefact.
export const ARMS: Record<string, ArmSpec> = {
    vanilla: { setting_sources: 'project,local', inject: null },
    package: { setting_sources: null, inject: null },
    'package-rdp': { setting_sources: null, inject: 'rdp' },
    placebo: { setting_sources: 'project,local', inject: 'placebo' },
    'package-recursive': { setting_sources: null, inject: null, recursive: true },
    hardened: { setting_sources: null, inject: 'hardened' },
    'hardened-placebo': { setting_sources: null, inject: 'hardened-placebo' },
    'rules-kernel-dc': { setting_sources: 'project,local', inject: 'rules-kernel-dc' },
    'rules-balanced': { setting_sources: 'project,local', inject: 'rules-balanced' },
    'package-ladder': { setting_sources: null, inject: 'ladder' },
    'bare-principle': { setting_sources: 'project,local', inject: 'bare-principle', min_lift_ratio: null },
    neighbour: {
        setting_sources: 'project,local',
        inject: null,
        plugin_dir_env: 'BENCH_NEIGHBOUR_PLUGIN_DIR',
        isolate_neighbour: true,
        min_lift_ratio: null,
    },
};

/**
 * The environment an isolated neighbour run gets. The operator supplies it as a
 * JSON object of string values in the file `BENCH_NEIGHBOUR_ENV_FILE` names,
 * kept outside the tree like the plugin itself; `{data}` in a value becomes the
 * per-run temp directory, so every store the neighbour writes is thrown away.
 */
export function neighbour_env(
    dataDir: string,
    env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
    const file = env['BENCH_NEIGHBOUR_ENV_FILE'];
    if (!file) throw new Error('BENCH_NEIGHBOUR_ENV_FILE is not set; it must name the isolation env JSON');
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${file} is not a JSON object`);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v !== 'string') throw new Error(`${file}: ${k} is not a string`);
        out[k] = v.split('{data}').join(dataDir);
    }
    return out;
}

/**
 * The plugin directory an arm loads, or null for an arm that loads none. Throws
 * when the arm needs one and the env var is unset or names no directory — a
 * neighbour arm that silently ran without its plugin would be a second vanilla.
 */
export function neighbour_plugin_dir(spec: ArmSpec, env: NodeJS.ProcessEnv = process.env): string | null {
    if (!spec.plugin_dir_env) return null;
    const dir = env[spec.plugin_dir_env];
    if (!dir) throw new Error(`${spec.plugin_dir_env} is not set; it must name the neighbour plugin directory`);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        throw new Error(`${spec.plugin_dir_env} is not a directory: ${dir}`);
    }
    return dir;
}
