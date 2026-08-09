#!/usr/bin/env node
/**
 * Team Review-Gate governance — `stop` concern (road-to-team-mode Phase 4).
 *
 * Minimal call-site for `src/scripts/ai_team/review_gate.ts`. On Stop it
 * reads the dispatcher envelope, and — ONLY when `ai_team.review_gate.managed`
 * is true — locates the newest stop-gate review job the codex plugin
 * persisted for this session, parses its first-line ALLOW/BLOCK contract,
 * applies the consecutive-BLOCK counter, and prints the circuit-breaker
 * notice (exactly once per trip) to stdout for the dispatch layer to
 * render. With `managed: false` (default) the hook exits 0 without
 * touching anything — byte-identical pre-Phase-4 Stop behavior.
 *
 * `ai_team.enabled` was DELETED (road-to-always-on-orchestration Phase 1,
 * Step 1.3) — `managed` was previously double-gated behind it, but the two
 * keys govern independent things: `managed` governs the codex PLUGIN's own
 * Stop-hook loop (upstream's mechanism, which does not depend on our codex
 * CLI availability), while `/team`'s own availability is a separate,
 * CLI-resolved fact (`src/scripts/ai_team/availability.ts`) that the
 * conversational `/team` wrappers check, not this passive Stop hook. So the
 * two keys are decoupled: `managed` stands alone.
 *
 * DELIBERATELY NOT GATED ON `emergency.orchestration_halt` (independent
 * review, road-to-always-on-orchestration): unlike `/team`'s own
 * conversational surfaces (`assert_delegate_allowed` / `run_team_review` in
 * `ai_team/team_dispatch.ts`, both of which check `isOrchestrationHalted`
 * before doing anything), this hook never reads that switch. This is
 * intentional, not an oversight — `managed` governs the UPSTREAM codex
 * plugin's OWN Stop-hook loop, a third-party mechanism this hook merely
 * observes and reports on (parsing an already-persisted job record); it
 * never itself dispatches, spends, or calls a provider. The always-on-
 * orchestration incident switch exists to pause OUR dispatch surfaces —
 * there is no dispatch here to pause. Tripping the halt does not, and
 * should not, silence this hook's circuit-breaker notice about the
 * plugin's own loop.
 *
 * Composition point (wired): registered as the `team-review-gate` concern
 * in `src/scripts/hook_manifest.yaml` on the claude `stop` slot, after
 * `chat-history` (ordering relative to the PLUGIN's own Stop hook is
 * host-scheduled and irrelevant here — the verdict is read from the
 * plugin's persisted job record, not from sibling hook output).
 *
 * Contract: never blocks, exit 0 on every path, `fail_closed: false`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    find_latest_gate_transcript,
    record_gate_verdict,
} from './ai_team/review_gate.js';
import { AI_TEAM_DEFAULTS, load_ai_team_config, type AiTeamConfig } from './ai_team/config.js';
import { unwrap } from './hooks/envelope.js';
import { readHookStdin } from './hooks/hook_stdin.js';

function _read_stdin(): string {
    return readHookStdin();
}

export function main(): number {
    const [envelope] = unwrap(_read_stdin(), 'claude');

    const event = String(envelope['event'] ?? '');
    if (event !== '' && event !== 'stop') {
        return 0;
    }

    const workspace_root =
        String(envelope['workspace_root'] ?? '').trim() || process.cwd();
    const session_id = String(envelope['session_id'] ?? '');

    let config: AiTeamConfig;
    try {
        config = load_ai_team_config({ cwd: workspace_root });
    } catch {
        // A broken ai_team block must never break the Stop path — doctor
        // owns reporting it. Defaults = managed off = strict no-op.
        config = AI_TEAM_DEFAULTS;
    }
    if (!config.review_gate.managed) {
        return 0;
    }

    let notice: string | null = null;
    try {
        const gate = find_latest_gate_transcript(workspace_root, session_id);
        if (gate === null) {
            return 0; // no gate run this session — nothing to govern
        }
        const outcome = record_gate_verdict({
            session_id,
            transcript_text: gate.transcript,
            dedupe_key: gate.job_id,
            config,
            project_root: workspace_root,
        });
        notice = outcome.notice;
    } catch {
        return 0; // fail-open — never block the agent loop
    }

    if (notice !== null) {
        process.stdout.write(`${notice}\n`);
    }
    return 0;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
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
    process.exit(main());
}
