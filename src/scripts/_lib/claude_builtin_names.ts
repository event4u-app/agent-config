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
//   3. `lint_agent_skill_names.ts` — a skill in `src/skills/` with a reserved
//      name fails CI, with no frontmatter escape: `user-invocable: false`
//      controls who may invoke a skill, not who owns the name, so the host
//      still resolves `/name` to the skill and the built-in stays shadowed
//      (observed 2026-11 for `/mcp` and `/code-review`).
//
// Source: https://code.claude.com/docs/en/commands (fetched 2026-07-10), the
// design family read offline from host 2.1.301 (2026-10-16), the host-shipped
// skills seen in a live session listing (2026-11-03) and the command/alias
// names a second-hand read of the commands page reported (2026-10-22), plus a
// small legacy set still present in older Claude Code versions. Every name
// added since 2026-10-16 is carried by a witness fixture under
// `tests/fixtures/host-builtins/`.
// Refresh trigger: a package artefact stops appearing in Claude Code, a
// release-notes entry adds a new built-in command, or the pinned host fixture
// `tests/fixtures/host-builtins/<version>.json` is re-read at a newer host.

const _CURRENT = [
    'add-dir',
    'advisor',
    'agents',
    'artifact-capabilities',
    'artifact-design',
    'artifact-diagramming',
    'autofix-pr',
    'background',
    'batch',
    'bg',
    'branch',
    'btw',
    'cd',
    'checkpoint',
    'checkup',
    'chrome',
    'claude-api',
    'clear',
    'code-review',
    'color',
    'compact',
    'config',
    'context',
    'continue',
    'copy',
    'cost',
    'dataviz',
    'debug',
    'deep-research',
    'design',
    'design-consent',
    'design-login',
    'design-revoke',
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
    'import',
    'init',
    'insights',
    'install-github-app',
    'install-slack-app',
    'keybindings',
    'keybindings-help',
    'list-agents',
    'login',
    'logout',
    'loop',
    'mcp',
    'memory',
    'mobile',
    'model',
    'new',
    'passes',
    'peers',
    'permissions',
    'plan',
    'plugin',
    'plugin-authoring',
    'powerup',
    'pr-comments',
    'privacy-settings',
    'proactive',
    'quit',
    'radio',
    'rc',
    'recap',
    'release-notes',
    'reload-plugins',
    'reload-skills',
    'remote-control',
    'remote-env',
    'rename',
    'reset',
    'resume',
    'review',
    'rewind',
    'routines',
    'run',
    'run-skill-generator',
    'sandbox',
    'schedule',
    'scroll-speed',
    'security-review',
    'settings',
    'setup-bedrock',
    'setup-vertex',
    'share',
    'simplify',
    'skill-doctor',
    'skills',
    'stats',
    'status',
    'statusline',
    'stickers',
    'stop',
    'subtask',
    'tasks',
    'team-onboarding',
    'teleport',
    'thinking',
    'trust',
    'tui',
    'ultraplan',
    'ultrareview',
    'undo',
    'update-config',
    'upgrade',
    'usage',
    'verify',
    'vim',
    'voice',
    'web',
    'whats-new',
    'workflow',
    'workflow-authoring',
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

/**
 * The comparison key the host would resolve: NFKC folds compatibility forms
 * (full-width letters), whitespace and format characters (zero-width joiners,
 * BOM) are invisible in a slash menu, and the match is case-insensitive.
 */
export function normalize_builtin_name(slug: string): string {
    return slug.normalize('NFKC').replace(/[\s\p{Cf}]/gu, '').toLowerCase();
}

/** True when `slug` would shadow a Claude Code built-in command or bundled skill. */
export function is_claude_builtin_name(slug: string): boolean {
    return CLAUDE_CODE_BUILTIN_NAMES.has(normalize_builtin_name(slug));
}
