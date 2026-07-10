// Claude Code built-in command / bundled-skill names — the reserved namespace.
//
// A user- or project-scope skill (or flat command) whose name equals a
// built-in Claude Code slash command SHADOWS the built-in: typing `/mcp`
// then opens the package's skill instead of Claude Code's MCP auth dialog
// (observed 2026-07-10). The suite's contract is to complement the host,
// never to overlay or degrade it — so no Claude-facing projection may claim
// one of these names.
//
// Enforced at three layers:
//   1. `condense.ts::generate_claude_commands` — project-scope `.claude/skills/`
//      command entries skip reserved slugs.
//   2. `install.ts::_apply_claude_flat_command_wrappers` — user-scope
//      `~/.claude/` deploys neither a skill wrapper nor a flat command file
//      for a reserved slug (nested `/cluster:sub` commands are unaffected —
//      built-ins carry no `:`).
//   3. `lint_agent_skill_names.ts` — a skill in `src/skills/` (or a domain
//      pack) with a reserved name fails CI unless it opts out of slash
//      registration with `user-invocable: false` (Claude may still load it
//      automatically; the built-in keeps the `/name`).
//
// Source: https://code.claude.com/docs/en/commands (fetched 2026-07-10),
// plus a small legacy set still present in older Claude Code versions.
// Refresh trigger: a package artefact stops appearing in Claude Code, or a
// release-notes entry adds a new built-in command.

const _CURRENT = [
    'add-dir',
    'advisor',
    'agents',
    'autofix-pr',
    'background',
    'batch',
    'branch',
    'btw',
    'cd',
    'chrome',
    'claude-api',
    'clear',
    'code-review',
    'color',
    'compact',
    'config',
    'context',
    'copy',
    'cost',
    'dataviz',
    'debug',
    'deep-research',
    'design-login',
    'design-sync',
    'desktop',
    'diff',
    'doctor',
    'effort',
    'exit',
    'export',
    'fast',
    'feedback',
    'fewer-permission-prompts',
    'focus',
    'fork',
    'goal',
    'heapdump',
    'help',
    'hooks',
    'ide',
    'init',
    'insights',
    'install-github-app',
    'install-slack-app',
    'keybindings',
    'login',
    'logout',
    'loop',
    'mcp',
    'memory',
    'mobile',
    'model',
    'passes',
    'permissions',
    'plan',
    'plugin',
    'powerup',
    'pr-comments',
    'privacy-settings',
    'radio',
    'recap',
    'release-notes',
    'reload-plugins',
    'reload-skills',
    'remote-control',
    'remote-env',
    'rename',
    'resume',
    'review',
    'rewind',
    'run',
    'run-skill-generator',
    'sandbox',
    'schedule',
    'scroll-speed',
    'security-review',
    'setup-bedrock',
    'setup-vertex',
    'simplify',
    'skills',
    'stats',
    'status',
    'statusline',
    'stickers',
    'teleport',
    'thinking',
    'trust',
    'upgrade',
    'usage',
    'verify',
    'vim',
    'web',
    'whats-new',
    'workflow',
    'workflows',
    'worktree',
] as const;

// Retired from the current docs but still registered by older Claude Code
// versions users may run — reserving them costs nothing (no package artefact
// uses these names) and avoids version-dependent shadowing.
const _LEGACY = [
    'bashes',
    'bug',
    'migrate-installer',
    'output-style',
    'terminal-setup',
    'theme',
    'todos',
] as const;

/** Lowercase names a Claude-facing `/name` projection must never claim. */
export const CLAUDE_CODE_BUILTIN_NAMES: ReadonlySet<string> = new Set<string>([
    ..._CURRENT,
    ..._LEGACY,
]);

/** True when `slug` would shadow a Claude Code built-in command or bundled skill. */
export function is_claude_builtin_name(slug: string): boolean {
    return CLAUDE_CODE_BUILTIN_NAMES.has(slug.toLowerCase());
}
