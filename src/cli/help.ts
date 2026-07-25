/**
 * TS-shell help text — derived from the subcommand REGISTRY so the
 * banner can never miss a command the CLI actually dispatches.
 *
 * The registry itself is held in sync with the Bash dispatcher's
 * case-block by `tests/cli/registry.test.ts`; the help/registry
 * coverage is asserted by `tests/cli/help.test.ts`.
 */

import { REGISTRY } from './registry.js';

const NAME_COLUMN_WIDTH = 26;

export function buildHelp(): string {
    const lines: string[] = [
        'agent-config — event4u/agent-config CLI (TS shell)',
        '',
        'Usage:',
        '  agent-config <command> [options]',
        '  agent-config --help',
        '  agent-config --version [--json]',
        '',
        'Global options:',
        '  --config-root <path>       Config/settings/state home (else $EVENT4U_CONFIG_HOME, else ~/.event4u/agent-config)',
        '',
        'Native commands (TS shell):',
    ];
    for (const entry of REGISTRY) {
        if (entry.disposition !== 'native') continue;
        lines.push(`  ${entry.name.padEnd(NAME_COLUMN_WIDTH)} ${entry.synopsis ?? ''}`.trimEnd());
    }
    lines.push('');
    lines.push('Delegated commands (Bash dispatcher):');
    for (const entry of REGISTRY) {
        if (entry.disposition !== 'delegate') continue;
        lines.push(`  ${entry.name.padEnd(NAME_COLUMN_WIDTH)} ${entry.synopsis ?? ''}`.trimEnd());
    }
    lines.push('');
    lines.push('Per-command flags and usage detail: `agent-config help --tier=all`.');
    return lines.join('\n');
}
