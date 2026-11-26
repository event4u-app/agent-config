#!/usr/bin/env node
/**
 * Precompiled entry for the dispatcher routes that run a plain `src/scripts/`
 * module — `council:*`, `self-repair:*`, `memory:lookup`, `chat-history:*`,
 * `mcp:*`, `sessions`, `audit:*`, `bracket`, … — so a consumer install never
 * reaches `require_tsx` and its `npx tsx` last resort for them.
 *
 * `exec_ts` and `exec_hook` send every `src/scripts/<key>.ts` named in `SCRIPT_DELEGATES`
 * (bash) here as `node dist/cli-delegate/cmd_script.js <key> <argv…>`. Before
 * this entry, `cli_delegate_bundle` mapped only `_cli/`, `dist/agent-src/scripts/`
 * and `code_graph/cli.ts`, so these routes ran from source through `npx tsx`
 * against the CONSUMER's npm config — the exposure ADR-204 closed for `_cli/`.
 *
 * Each target is loaded with a dynamic `import()`. Under `--splitting` that makes
 * it its own chunk, whose `import.meta.url` is the chunk file and never
 * `process.argv[1]` — so the target's own entry guard (url compare, basename
 * compare, `__AGENT_CONFIG_BUNDLE__` short-circuit, whichever it carries) stays
 * false and only the call below runs it. A static import would inline it and,
 * for the url-compare guards, run it twice (the `cmd_closure` failure, #3021).
 *
 * Each runner reproduces what the target's own guard does: which function it
 * calls, and whether it ends with `process.exit` or only sets `exitCode`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

type Code = number | void;
type Runner = (argv: string[]) => Promise<Code>;

/** `exit: true` mirrors a guard that ends in `process.exit(main())`. */
interface Delegate {
    readonly run: Runner;
    readonly exit: boolean;
}

const d = (run: Runner, exit: boolean): Delegate => ({ run, exit });

export const DELEGATES: Readonly<Record<string, Delegate>> = {
    advisories: d(async (a) => {
        try {
            return await (await import('../advisories.js')).main(a);
        } catch (e) {
            process.stderr.write(`Internal error: ${e instanceof Error ? e.message : String(e)}\n`);
            return 3;
        }
    }, true),
    agent_actions_detect: d(async (a) => (await import('../agent_actions_detect.js')).main(a), true),
    audit_security: d(async (a) => (await import('../audit_security.js')).main(a), false),
    benchmark: d(async (a) => (await import('../benchmark.js')).main(a), true),
    'bracket/cli': d(async (a) => {
        const [{ main }, { BracketError }] = await Promise.all([
            import('../bracket/cli.js'),
            import('../bracket/errors.js'),
        ]);
        try {
            return main(a);
        } catch (e) {
            if (!(e instanceof BracketError)) throw e;
            process.stderr.write(`bracket: ${e.code}: ${e.message}\n`);
            return 1;
        }
    }, false),
    chat_history: d(async (a) => {
        const mod = await import('../chat_history.js');
        try {
            return mod.main(a);
        } catch (e) {
            if (!(e instanceof mod.ValueError || e instanceof mod.FileNotFoundError)) throw e;
            process.stderr.write(`${e.constructor.name}: ${e.message}\n`);
            return 1;
        }
    }, false),
    check_proposal: d(async () => (await import('../check_proposal.js')).main(), true),
    code_audit: d(async (a) => (await import('../code_audit.js')).main(a), false),
    context_hygiene_hook: d(async (a) => (await import('../context_hygiene_hook.js')).main(a), true),
    conformance_scan: d(async (a) => (await import('../conformance_scan.js')).main(a), true),
    council_cli: d(async (a) => {
        const { main, _ArgExit } = await import('../council_cli.js');
        try {
            return main(a);
        } catch (e) {
            // The argparse-style error path set process.exitCode before throwing.
            if (!(e instanceof _ArgExit)) throw e;
        }
    }, false),
    decision_memo: d(async (a) => (await import('../decision_memo.js')).main(a), true),
    derive_live_surfaces: d(async (a) => (await import('../derive_live_surfaces.js')).main(a), false),
    discovery_graph: d(async (a) => (await import('../discovery_graph.js')).main(a), true),
    generate_capabilities_index: d(async (a) => (await import('../generate_capabilities_index.js')).main(a), false),
    hook_effect_doctor: d(async (a) => (await import('../hook_effect_doctor.js')).main(a), true),
    'hooks/replay_hook': d(async (a) => (await import('../hooks/replay_hook.js')).main(a), true),
    hooks_doctor: d(async (a) => (await import('../hooks_doctor.js')).main(a), true),
    hooks_status: d(async (a) => (await import('../hooks_status.js')).main(a), true),
    knowledge_global_cli: d(async (a) => (await import('../knowledge_global_cli.js')).main(a), true),
    learning_sidecar: d(async (a) => (await import('../learning_sidecar.js')).main(a), true),
    linked_projects_list: d(async (a) => (await import('../linked_projects_list.js')).main(a), false),
    mcp_render: d(async (a) => (await import('../mcp_render.js')).main(a), false),
    media_bundle: d(async (a) => (await import('../media_bundle.js')).main(a), true),
    memory_lookup: d(async () => (await import('../memory_lookup.js')).main(), true),
    onboarding_gate_hook: d(async (a) => (await import('../onboarding_gate_hook.js')).main(a), true),
    profile_use: d(async (a) => (await import('../profile_use.js')).main(a), true),
    reach_doctor: d(async (a) => (await import('../reach_doctor.js')).main(a), true),
    refine_ticket_detect: d(async () => (await import('../refine_ticket_detect.js')).main(), false),
    roadmap_context: d(async (a) => (await import('../roadmap_context.js')).main(a), true),
    roadmap_progress_hook: d(async (a) => (await import('../roadmap_progress_hook.js')).main(a), true),
    routing_doctor: d(async (a) => (await import('../routing_doctor.js')).main(a), true),
    run_supervise: d(async (a) => (await import('../run_supervise.js')).main(a), true),
    security_audit_config: d(async (a) => (await import('../security_audit_config.js')).main(a), false),
    self_repair_cli: d(async (a) => (await import('../self_repair_cli.js')).main(a), true),
    sessions_catalog_cli: d(async (a) => (await import('../sessions_catalog_cli.js')).cmd_catalog(a), true),
    sessions_cli: d(async (a) => (await import('../sessions_cli.js')).main(a), true),
    workspace_doctor: d(async (a) => (await import('../workspace_doctor.js')).main(a), true),
    worktree_cleanup_check: d(async (a) => {
        try {
            return (await import('../worktree_cleanup_check.js')).main(a);
        } catch (e) {
            process.stderr.write(`Internal error: ${e instanceof Error ? e.message : String(e)}\n`);
            return 3;
        }
    }, true),
};

const USAGE = 'usage: cmd_script <script-key> [args...]   (dispatcher-internal)\n';

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
    const [key, ...rest] = argv;
    const delegate = key === undefined ? undefined : DELEGATES[key];
    if (delegate === undefined) {
        process.stderr.write(
            key === undefined ? USAGE : `agent-config: no precompiled delegate for src/scripts/${key}.ts\n`,
        );
        process.exit(127);
    }
    // Several targets read `process.argv.slice(2)` themselves (`memory_lookup`,
    // `check_proposal`, `refine_ticket_detect`, defaulted `main()`s); drop the key
    // so they see exactly the argv the tsx path gave them.
    process.argv.splice(2, 1);
    const code = await delegate.run(rest);
    const resolved = typeof code === 'number' ? code : (process.exitCode as number | undefined) ?? 0;
    if (delegate.exit) process.exit(resolved);
    process.exitCode = resolved;
}

// `--splitting` may move this body into a shared chunk whose `import.meta.url`
// is never `argv[1]`, so inside the delegate bundle the invoked file name
// decides (the cmd_migrate.ts note); elsewhere the URL / realpath comparison does.
declare const __AGENT_CONFIG_CLI_DELEGATE__: boolean | undefined;
function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (
        typeof __AGENT_CONFIG_CLI_DELEGATE__ !== 'undefined' &&
        __AGENT_CONFIG_CLI_DELEGATE__ &&
        path.basename(process.argv[1], '.js') === 'cmd_script'
    ) {
        return true;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    void main();
}
