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
    { name: 'init', disposition: 'delegate', synopsis: 'One-shot install (opens the wizard); --project initializes the project surface.' },
    { name: 'sync', disposition: 'delegate', synopsis: 'Replay installed-tools.lock.' },
    { name: 'validate', disposition: 'delegate', synopsis: 'Drift detection on the manifest.' },
    { name: 'work', disposition: 'delegate', synopsis: 'Drive the work_engine on a prompt.' },
    { name: 'implement-ticket', disposition: 'delegate', synopsis: 'Drive the work_engine on a ticket.' },
    { name: 'update', disposition: 'delegate', synopsis: 'Update the agent_config_version pin in .agent-settings.yml.' },
    { name: 'upgrade', disposition: 'delegate', synopsis: 'Install the latest package globally + refresh the global install.' },
    { name: 'refresh', disposition: 'delegate', synopsis: 'Idempotent re-install (no version change): --global or --project.' },
    { name: 'versions', disposition: 'native', synopsis: 'List @event4u/agent-config versions.' },
    { name: 'global', disposition: 'delegate', synopsis: 'Install to user-scope paths (~/.claude/, ~/.cursor/, …).' },
    { name: 'export', disposition: 'delegate', synopsis: "Eject a tool's canonical content into a chosen path (real file, no symlink)." },
    { name: 'settings:check', disposition: 'delegate', synopsis: 'Validate .agent-settings.yml against the YAML-subset contract (read-only).' },
    { name: 'settings:sync', disposition: 'delegate', synopsis: 'Additively merge new template keys into an existing .agent-settings.yml.' },
    { name: 'settings:migrate', disposition: 'delegate', synopsis: 'Lift legacy project-local settings into ~/.event4u/agent-config/.' },
    { name: 'settings:get', disposition: 'delegate', synopsis: 'Read one setting: value, resolved source file, class, and absent-vs-default divergence.' },
    { name: 'settings:set', disposition: 'delegate', synopsis: 'Set one A/B-class setting in the global file; C-class keys are refused.' },
    { name: 'uninstall', disposition: 'delegate', synopsis: 'Remove bridge markers (project) or lockfile entries (global).' },
    { name: 'prune', disposition: 'delegate', synopsis: 'Remove project bridge markers not declared in installed-tools.lock.' },
    { name: 'doctor', disposition: 'delegate', synopsis: 'Read-only drift report: manifest ↔ filesystem; --anatomy renders the injection anatomy.' },
    { name: 'converge', disposition: 'delegate', synopsis: 'Consented cleanup of duplicate install surfaces (surface-matrix driven).' },
    { name: 'conformance', disposition: 'delegate', synopsis: 'Consumer conformance contract: doctor --ci + installed-and-firing checks.' },
    { name: 'conformance:behavior', disposition: 'delegate', synopsis: 'Replay local transcripts through the mechanised conformance checks (report, not gate); --why <id> traces one check.' },
    { name: 'doctor-shell', disposition: 'native', synopsis: 'Native TS-shell environment probe.' },
    { name: 'rtk:detect', disposition: 'native', synopsis: 'rtk (Rust Token Killer) presence + identity readout — contract: docs/contracts/rtk-detection.md.' },
    { name: 'ui:serve', disposition: 'native', synopsis: 'Start the local UI server.' },
    { name: 'config', disposition: 'native', synopsis: 'Open the configuration GUI (global by default; --project for the project surface).' },
    { name: 'settings', disposition: 'native', synopsis: 'Open the local Settings GUI (alias of config).' },
    { name: 'install', disposition: 'native', synopsis: 'Open the install wizard (UI server, lands on Step 1 / AI tools).' },
    { name: 'setup', disposition: 'native', synopsis: 'Open the onboarding wizard (UI server, lands on Identity).' },
    { name: 'workspaces', disposition: 'native', synopsis: 'List workspaces from the discovery manifest (ls subcommand).' },
    { name: 'packs', disposition: 'native', synopsis: 'List packs from the discovery manifest (ls subcommand).' },
    { name: 'packs:active', disposition: 'delegate', synopsis: 'Which packs are active here, from which file — names the degraded zero-pack case.' },
    { name: 'brand:status', disposition: 'delegate', synopsis: 'Whether a consumer brand tokens file is present, where, and dot-prefixed near-misses.' },
    { name: 'commands', disposition: 'native', synopsis: 'List/explain the command surface from the discovery manifest (ls / explain subcommands); ls --candidates reports surface-reduction signals.' },
    { name: 'help', disposition: 'native', synopsis: 'Show TS-shell help; delegates --tier=N to Bash.' },
    { name: 'explain', disposition: 'delegate', synopsis: 'Read-only decision-chain trace (config | rule <name> | route "<text>") or command explanation.' },
    { name: 'analyze-session', disposition: 'delegate', synopsis: 'Read-only post-session report from on-disk runtime state.' },
    { name: 'handoff', disposition: 'delegate', synopsis: 'Pick a recent session, generate a handoff, seed a fresh session.' },
    { name: 'migrate', disposition: 'delegate', synopsis: 'One-shot migration off every legacy install / state shape.' },
    { name: 'mcp:render', disposition: 'delegate', synopsis: 'Render mcp.json into per-tool MCP client configs.' },
    { name: 'mcp:check', disposition: 'delegate', synopsis: 'Dry-run mcp:render; exit non-zero if targets are stale.' },
    { name: 'mcp:available', disposition: 'delegate', synopsis: 'Declared MCP servers, whether each is launchable, and the separate tool registry.' },
    { name: 'mcp:setup', disposition: 'delegate', synopsis: 'Verify the tsx runtime + MCP server module; print the client config snippet.' },
    { name: 'mcp:run', disposition: 'delegate', synopsis: 'Run the built-in MCP server over stdio (experimental).' },
    { name: 'mcp-server', disposition: 'native', synopsis: 'Turnkey read-only stdio MCP server over the bundled content (no repo clone; ADR-085).' },
    { name: 'use', disposition: 'delegate', synopsis: 'Switch the active experience/profile (writes profile.id).' },
    { name: 'sessions:list', disposition: 'delegate', synopsis: 'List live agent sessions plus unmerged branches held by other worktrees; --json, --branches.' },
    { name: 'sessions:claim', disposition: 'delegate', synopsis: 'Claim a roadmap for this session so other sessions skip it; --release clears it.' },
    { name: 'session:recycle', disposition: 'delegate', synopsis: 'Validate + write the main-session recycle envelope (--verify validates only, --project names the repo); the successor resumes from it after /clear.' },
    { name: 'roadmap:progress', disposition: 'delegate', synopsis: 'Regenerate agents/roadmaps-progress.md from open roadmaps; archives completed ones (--no-archive to skip).' },
    { name: 'roadmap:progress-check', disposition: 'delegate', synopsis: 'Fail if agents/roadmaps-progress.md is stale (for CI).' },
    { name: 'roadmap:archive', disposition: 'delegate', synopsis: 'Archive completed roadmaps (PR-gate sweep).' },
    { name: 'gates', disposition: 'delegate', synopsis: 'Open decisions that need you, as actions — owner-filtered roadmap blockers; --all, --json, --reply, --pending (staged requires_confirmation actions).' },
    { name: 'capabilities:index', disposition: 'delegate', synopsis: 'Regenerate CAPABILITIES.yaml (the package coverage index); --check for CI.' },
    { name: 'adr:effective', disposition: 'delegate', synopsis: "Effective state of one ADR: status, Decision verbatim, clauses its own amendments superseded, active amendments, axes, trigger state. Authorizes nothing." },
    { name: 'affected', disposition: 'delegate', synopsis: 'Artefacts related to <artefact> via the discovery relation-graph (BFS).' },
    { name: 'graph-explain', disposition: 'delegate', synopsis: 'Seed on a <concept>, expand 2 hops over the discovery relation-graph with a node budget.' },
    { name: 'benchmark', disposition: 'delegate', synopsis: 'Report context-token reduction vs the full always-loaded projection.' },
    { name: 'code-graph', disposition: 'delegate', synopsis: 'Deterministic code-graph engine: build|detect|query|affected|path|explain|validate.' },
    { name: 'hooks:install', disposition: 'delegate', synopsis: 'Install the combined pre-commit hook.' },
    { name: 'hooks:status', disposition: 'delegate', synopsis: 'Print the runtime hook matrix (per-platform install + bindings).' },
    { name: 'hooks:doctor', disposition: 'delegate', synopsis: 'Diagnose hook health: concerns, posture, missing trampolines (read-only).' },
    { name: 'routing:doctor', disposition: 'delegate', synopsis: 'Live routing diagnosis: per-gate ACTIVE/INACTIVE with reason, chain, freshness, orchestration state (read-only).' },
    { name: 'workspace:doctor', disposition: 'delegate', synopsis: 'Workspace identity with provenance (repo root, main worktree, current worktree, branch, PR base) + session claim and worktree pressure (read-only).' },
    { name: 'route:explain', disposition: 'delegate', synopsis: 'Deterministic rule-routing trace for one prompt: matched triggers, tier, disposition, budget, rejected candidates (trigger-match level only).' },
    { name: 'route:audit', disposition: 'delegate', synopsis: 'Replay the router matcher over the last N chat-history prompts; opt-in recorder + --weekly rolling render (trigger-match level only).' },
    { name: 'hooks:replay', disposition: 'delegate', synopsis: 'Replay a fixture through the universal hook dispatcher (no state writes).' },
    { name: 'reach:doctor', disposition: 'delegate', synopsis: 'Reach-channel health report: active backend + pinned fix per channel (read-only; --deep opts into network).' },
    { name: 'keys:install-anthropic', disposition: 'delegate', synopsis: 'Install the Anthropic API key for the AI Council (interactive).' },
    { name: 'keys:install-openai', disposition: 'delegate', synopsis: 'Install the OpenAI API key for the AI Council (interactive).' },
    { name: 'first-run', disposition: 'delegate', synopsis: 'Guided first-run setup — cost profile, settings, tooling.' },
    { name: 'memory:lookup', disposition: 'delegate', synopsis: 'Retrieve memory entries (text or JSON envelope).' },
    { name: 'memory:get', disposition: 'delegate', synopsis: 'Batch-fetch full memory entries by id (CLI twin of the memory_get MCP tool).' },
    { name: 'linked-projects:list', disposition: 'delegate', synopsis: 'List opted-in IDE-attached sibling repos.' },
    { name: 'memory:signal', disposition: 'delegate', synopsis: 'Append a provisional intake signal (memory proposal).' },
    { name: 'memory:hash', disposition: 'delegate', synopsis: 'Hash a memory entry (YAML or JSON stdin).' },
    { name: 'memory:check', disposition: 'delegate', synopsis: 'Validate memory YAML schema + staleness.' },
    { name: 'memory:check-proposal', disposition: 'delegate', synopsis: 'Run the admission gate on a memory proposal.' },
    { name: 'memory:learn', disposition: 'delegate', synopsis: 'Aggregate memory intake signals into the local learning sidecar (read-only; --write to emit).' },
    { name: 'analytics', disposition: 'delegate', synopsis: 'Local-only workspace analytics: emit|show|prune|migrate (never leaves the machine).' },
    { name: 'knowledge', disposition: 'delegate', synopsis: 'Global knowledge-card store: list|show|trace|forget|promote|validate|lead-check|purge.' },
    { name: 'proposal:check', disposition: 'delegate', synopsis: 'Validate a learning/skill/rule proposal markdown.' },
    { name: 'refine-ticket:detect', disposition: 'delegate', synopsis: 'Run the deterministic refine-ticket detection helper.' },
    { name: 'chat-history:hook', disposition: 'delegate', synopsis: 'Platform hook entry point for chat-history capture (JSON via stdin).' },
    { name: 'chat-history:checkpoint', disposition: 'delegate', synopsis: 'Append a phase-boundary entry to agents/runtime/.agent-chat-history.' },
    { name: 'roadmap-progress:hook', disposition: 'delegate', synopsis: 'PostToolUse hook entry point — regenerates the roadmap dashboard.' },
    { name: 'onboarding-gate:hook', disposition: 'delegate', synopsis: 'Hook entry point — writes the onboarding-gate state file.' },
    { name: 'context-hygiene:hook', disposition: 'delegate', synopsis: 'PostToolUse hook entry point — maintains context-hygiene state.' },
    { name: 'dispatch:hook', disposition: 'native', synopsis: 'Universal hook dispatcher (runs the resolved concern chain in-process via dist/hooks/dispatch.js).' },
    { name: 'telemetry:record', disposition: 'delegate', synopsis: 'Append one artefact-engagement event (default-off).' },
    { name: 'telemetry:status', disposition: 'delegate', synopsis: 'Print artefact-engagement telemetry status (read-only).' },
    { name: 'telemetry:report', disposition: 'delegate', synopsis: 'Aggregate the engagement log into a quartile report.' },
    { name: 'council:estimate', disposition: 'delegate', synopsis: 'Pre-call council cost preview (no API call, no spend).' },
    { name: 'council:run', disposition: 'delegate', synopsis: 'Run the AI council (requires --confirm to spend).' },
    { name: 'council:render', disposition: 'delegate', synopsis: 'Re-render a saved council responses JSON to markdown.' },
    { name: 'council:status', disposition: 'delegate', synopsis: 'Is a council configured, and from which file — zero spend, no inference.' },
    { name: 'council:quota', disposition: 'delegate', synopsis: "Today's per-provider CLI-call usage against the enforced cap — zero spend." },
    { name: 'council:grant-billing', disposition: 'delegate', synopsis: 'Record the human yes that lets an exhausted plan quota retry on the metered rung, for ONE run.' },
    { name: 'council:revoke-billing', disposition: 'delegate', synopsis: 'End a run-scoped billing grant. Exit 0 when none exists.' },
    { name: 'eval:record', disposition: 'native', synopsis: 'Record a live trigger-eval result into a corpus manifest (corpus-refresh DoD, ADR-061 §6).' },
    { name: 'self-repair:status', disposition: 'delegate', synopsis: 'List queued agent-config defect records (read-only).' },
    { name: 'self-repair:release', disposition: 'delegate', synopsis: 'Publish one defect record as a PR, or an issue when a PR is impossible (Hard-Floor gated).' },
    { name: 'decision:memo', disposition: 'delegate', synopsis: 'Record or list an autonomously-resolved question so it stays reviewable (local-only).' },
    { name: 'run:supervise', disposition: 'delegate', synopsis: 'Report runs whose session died with open steps left. Never merges, pushes, or closes.' },
] as const;

export function findCommand(name: string): CommandEntry | undefined {
    return REGISTRY.find((entry) => entry.name === name);
}

export function isNative(name: string): boolean {
    return findCommand(name)?.disposition === 'native';
}
