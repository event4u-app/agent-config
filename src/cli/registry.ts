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
    { name: 'upgrade', disposition: 'delegate', synopsis: 'Install the latest package globally + refresh the global install.' },
    { name: 'refresh', disposition: 'delegate', synopsis: 'Idempotent re-install (no version change): --global or --project.' },
    { name: 'versions', disposition: 'native', synopsis: 'List @event4u/agent-config versions.' },
    { name: 'global', disposition: 'delegate' },
    { name: 'export', disposition: 'delegate' },
    { name: 'settings:check', disposition: 'delegate' },
    { name: 'settings:migrate', disposition: 'delegate', synopsis: 'Lift legacy project-local settings into ~/.event4u/agent-config/.' },
    { name: 'uninstall', disposition: 'delegate' },
    { name: 'prune', disposition: 'delegate' },
    { name: 'doctor', disposition: 'delegate' },
    { name: 'doctor-shell', disposition: 'native', synopsis: 'Native TS-shell environment probe.' },
    { name: 'ui:serve', disposition: 'native', synopsis: 'Start the local UI server.' },
    { name: 'settings', disposition: 'native', synopsis: 'Open the local Settings GUI.' },
    { name: 'install', disposition: 'native', synopsis: 'Open the install wizard (UI server, lands on Step 1 / AI tools).' },
    { name: 'setup', disposition: 'native', synopsis: 'Open the onboarding wizard (UI server, lands on Identity).' },
    { name: 'workspaces', disposition: 'native', synopsis: 'List workspaces from the discovery manifest (ls subcommand).' },
    { name: 'packs', disposition: 'native', synopsis: 'List packs from the discovery manifest (ls subcommand).' },
    { name: 'commands', disposition: 'native', synopsis: 'List/explain the command surface from the discovery manifest (ls / explain subcommands).' },
    { name: 'help', disposition: 'native', synopsis: 'Show TS-shell help; delegates --tier=N to Bash.' },
    { name: 'explain', disposition: 'delegate' },
    { name: 'migrate', disposition: 'delegate' },
    { name: 'mcp:render', disposition: 'delegate' },
    { name: 'mcp:check', disposition: 'delegate' },
    { name: 'mcp:setup', disposition: 'delegate' },
    { name: 'mcp:run', disposition: 'delegate' },
    { name: 'mcp-server', disposition: 'native', synopsis: 'Turnkey read-only stdio MCP server over the bundled content (no repo clone; ADR-085).' },
    { name: 'use', disposition: 'delegate', synopsis: 'Switch the active experience/profile (writes profile.id).' },
    { name: 'roadmap:progress', disposition: 'delegate' },
    { name: 'roadmap:progress-check', disposition: 'delegate' },
    { name: 'capabilities:index', disposition: 'delegate', synopsis: 'Regenerate CAPABILITIES.yaml (the package coverage index); --check for CI.' },
    { name: 'hooks:install', disposition: 'delegate' },
    { name: 'hooks:status', disposition: 'delegate' },
    { name: 'hooks:doctor', disposition: 'delegate' },
    { name: 'hooks:replay', disposition: 'delegate' },
    { name: 'keys:install-anthropic', disposition: 'delegate' },
    { name: 'keys:install-openai', disposition: 'delegate' },
    { name: 'first-run', disposition: 'delegate' },
    { name: 'memory:lookup', disposition: 'delegate' },
    { name: 'linked-projects:list', disposition: 'delegate' },
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
