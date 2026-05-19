/**
 * Subcommand registry — the canonical list of subcommands exposed by
 * the consumer-facing CLI, mirrored from `scripts/agent-config`.
 *
 * Each entry tags whether the TS shell handles it natively or
 * delegates to the Bash dispatcher. Phase 2 keeps everything bar
 * `versions` and `doctor-shell` on the delegate path.
 *
 * Source of truth check: `tests/cli/registry.test.ts` re-parses the
 * Bash dispatcher's case-block and asserts symmetric coverage.
 */

export type Disposition = 'native' | 'delegate';

export interface CommandEntry {
    name: string;
    disposition: Disposition;
    /** One-line synopsis surfaced by `--help`. Optional. */
    synopsis?: string;
}

export const REGISTRY: readonly CommandEntry[] = [
    { name: 'init', disposition: 'delegate', synopsis: 'One-shot project install.' },
    { name: 'sync', disposition: 'delegate', synopsis: 'Replay installed-tools.lock.' },
    { name: 'validate', disposition: 'delegate', synopsis: 'Drift detection on the manifest.' },
    { name: 'work', disposition: 'delegate', synopsis: 'Drive the work_engine on a prompt.' },
    { name: 'implement-ticket', disposition: 'delegate', synopsis: 'Drive the work_engine on a ticket.' },
    { name: 'update', disposition: 'delegate' },
    { name: 'versions', disposition: 'native', synopsis: 'List @event4u/agent-config versions.' },
    { name: 'global', disposition: 'delegate' },
    { name: 'export', disposition: 'delegate' },
    { name: 'settings:check', disposition: 'delegate' },
    { name: 'uninstall', disposition: 'delegate' },
    { name: 'prune', disposition: 'delegate' },
    { name: 'doctor', disposition: 'delegate' },
    { name: 'doctor-shell', disposition: 'native', synopsis: 'Native TS-shell environment probe.' },
    { name: 'ui:serve', disposition: 'native', synopsis: 'Start the local UI server.' },
    { name: 'help', disposition: 'native', synopsis: 'Show TS-shell help; delegates --tier=N to Bash.' },
    { name: 'explain', disposition: 'delegate' },
    { name: 'migrate', disposition: 'delegate' },
    { name: 'migrate-state', disposition: 'delegate' },
    { name: 'mcp:render', disposition: 'delegate' },
    { name: 'mcp:check', disposition: 'delegate' },
    { name: 'mcp:setup', disposition: 'delegate' },
    { name: 'mcp:run', disposition: 'delegate' },
    { name: 'roadmap:progress', disposition: 'delegate' },
    { name: 'roadmap:progress-check', disposition: 'delegate' },
    { name: 'hooks:install', disposition: 'delegate' },
    { name: 'hooks:status', disposition: 'delegate' },
    { name: 'hooks:doctor', disposition: 'delegate' },
    { name: 'hooks:replay', disposition: 'delegate' },
    { name: 'keys:install-anthropic', disposition: 'delegate' },
    { name: 'keys:install-openai', disposition: 'delegate' },
    { name: 'first-run', disposition: 'delegate' },
    { name: 'memory:lookup', disposition: 'delegate' },
    { name: 'memory:signal', disposition: 'delegate' },
    { name: 'memory:hash', disposition: 'delegate' },
    { name: 'memory:check', disposition: 'delegate' },
    { name: 'memory:check-proposal', disposition: 'delegate' },
    { name: 'proposal:check', disposition: 'delegate' },
    { name: 'refine-ticket:detect', disposition: 'delegate' },
    { name: 'chat-history:hook', disposition: 'delegate' },
    { name: 'chat-history:checkpoint', disposition: 'delegate' },
    { name: 'roadmap-progress:hook', disposition: 'delegate' },
    { name: 'onboarding-gate:hook', disposition: 'delegate' },
    { name: 'context-hygiene:hook', disposition: 'delegate' },
    { name: 'dispatch:hook', disposition: 'delegate' },
    { name: 'telemetry:record', disposition: 'delegate' },
    { name: 'telemetry:status', disposition: 'delegate' },
    { name: 'telemetry:report', disposition: 'delegate' },
    { name: 'council:estimate', disposition: 'delegate' },
    { name: 'council:run', disposition: 'delegate' },
    { name: 'council:render', disposition: 'delegate' },
] as const;

export function findCommand(name: string): CommandEntry | undefined {
    return REGISTRY.find((entry) => entry.name === name);
}

export function isNative(name: string): boolean {
    return findCommand(name)?.disposition === 'native';
}
