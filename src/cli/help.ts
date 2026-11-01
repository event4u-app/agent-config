/**
 * Default help — the front page of the CLI, grouped by what a user wants to
 * do, not by how the command is implemented.
 *
 * It is a curated subset on purpose: the full surface (every dispatched
 * command, internals included) is `agent-config help --tier=all`, whose
 * coverage of the REGISTRY is asserted by `tests/cli/help.test.ts`. That test
 * also asserts every command named here is a registered one, so this page can
 * shrink the surface but never invent a command.
 *
 * Entry-command story: `init` installs (the wizard, or the terminal with
 * --yes/--tools/--no-ui), `install` is the same wizard, `setup` reopens the
 * onboarding wizard, `doctor` checks. `first-run` and `global` stay off this
 * page; they remain callable and listed under `help --tier=all`.
 */

interface HelpRow {
    readonly name: string;
    readonly text: string;
}

interface HelpGroup {
    readonly heading: string;
    readonly rows: readonly HelpRow[];
}

const NAME_COLUMN_WIDTH = 22;

export const HELP_GROUPS: readonly HelpGroup[] = [
    {
        heading: 'Get started:',
        rows: [
            { name: 'init', text: 'Install for your AI tools (opens the setup wizard; --yes --global stays in the terminal)' },
            { name: 'install', text: 'Same setup wizard as init' },
            { name: 'doctor', text: 'Check the install and name the next fix' },
            { name: 'versions', text: 'List published versions and the one you run' },
        ],
    },
    {
        heading: 'Daily use:',
        rows: [
            { name: 'code-graph', text: 'Ask about the codebase: callers, impact, tests for a change, the project map' },
            { name: 'handoff', text: 'Hand the current session over to a fresh one' },
            { name: 'council:estimate', text: 'Preview what a second opinion from other models would cost' },
            { name: 'council:run', text: 'Get that second opinion (spends only with --confirm)' },
            { name: 'ci:settle', text: "Wait for a pull request's checks and print the verdict" },
            { name: 'gates', text: 'Open decisions that are waiting for you' },
        ],
    },
    {
        heading: 'Inspect:',
        rows: [
            { name: 'explain', text: 'Trace a decision: config | rule <name> | route "<text>"' },
            { name: 'commands', text: 'List the commands your agent can run' },
            { name: 'packs:active', text: 'Which packs are active here, and from which file' },
            { name: 'hooks:status', text: 'Which hooks are installed and bound, per tool' },
            { name: 'settings:get', text: 'Read one setting and the file its value comes from' },
            { name: 'council:status', text: 'Whether a council is configured (no spend)' },
        ],
    },
    {
        heading: 'Configure:',
        rows: [
            { name: 'setup', text: 'Reopen the setup wizard in the browser' },
            { name: 'config', text: 'Open the settings page (global; --project for this project)' },
            { name: 'settings:set', text: 'Change one setting from the terminal' },
            { name: 'use', text: 'Switch the active profile' },
            { name: 'keys:install-anthropic', text: 'Store an Anthropic API key for the council' },
            { name: 'keys:install-openai', text: 'Store an OpenAI API key for the council' },
        ],
    },
    {
        heading: 'Maintain:',
        rows: [
            { name: 'upgrade', text: 'Install the latest version and refresh your install' },
            { name: 'update', text: 'Pin this project to a version' },
            { name: 'refresh', text: 'Re-install the current version (--global or --project)' },
            { name: 'settings:sync', text: 'Add new setting keys to your settings file (--prune-removed drops retired ones)' },
            { name: 'migrate', text: 'Move off an older install layout' },
            { name: 'uninstall', text: 'Remove agent-config (--global for the user-scope install)' },
        ],
    },
];

function row(name: string, text: string): string {
    const pad = name.length >= NAME_COLUMN_WIDTH ? `${name} ` : name.padEnd(NAME_COLUMN_WIDTH);
    return `  ${pad} ${text}`.trimEnd();
}

export function buildHelp(): string {
    const lines: string[] = [
        'agent-config — governed skills, rules and commands for your AI coding tools',
        '',
        'Usage:',
        '  agent-config <command> [options]',
        '  agent-config <command> --help      Flags for one command',
        '  agent-config --version',
        '',
    ];
    for (const group of HELP_GROUPS) {
        lines.push(group.heading);
        for (const r of group.rows) lines.push(row(r.name, r.text));
        lines.push('');
    }
    lines.push('Global option:');
    lines.push(row('--config-root <path>', 'Config home (else $EVENT4U_CONFIG_HOME, else ~/.event4u/agent-config)'));
    lines.push('');
    lines.push('Every command, including advanced and internal ones: agent-config help --tier=all');
    return lines.join('\n');
}
