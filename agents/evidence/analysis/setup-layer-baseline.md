<!-- evidence-type: analysis -->
# Setup layer baseline

Measured at commit `89e094819`, package version `16.5.0`, by
`./scripts-run src/scripts/layer_baseline_report`. Every row below names that commit.

Excluded so that two runs at one commit are byte-equal: the install receipt, lock and
log (each carries an install time), the scratch root (recorded as `<HOME>`), and the
host's own version (a property of the machine, not of the commit).

| host | scope | dir | files | bytes | full | stub | file-set digest | resolved form |
|---|---|---|---|---|---|---|---|---|
| augment | installed | `<HOME>/.augment/rules` | 106 | 446916 | 106 | 0 | `57b2646f91a3dd27` | full (host-not-thinnable) |
| claude-code | installed | `<HOME>/.claude/rules` | 106 | 368900 | 106 | 0 | `4e29e38d9c2a7271` | full (delivery-unobserved) |
| cline | installed | `<HOME>/Documents/Cline/Rules` | 106 | 446916 | 106 | 0 | `57b2646f91a3dd27` | full (delivery-unobserved) |
| cursor | installed | `<HOME>/.cursor/rules` | 106 | 446916 | 106 | 0 | `57b2646f91a3dd27` | full (delivery-unobserved) |
| windsurf | installed | `<HOME>/.codeium/windsurf/rules` | 106 | 446916 | 106 | 0 | `57b2646f91a3dd27` | full (host-not-thinnable) |
| augment | projected | `.augment/rules` | 15 | 43401 | 15 | 0 | `adf466bc8ddace52` | project tree, not decided per machine |
| claude-code | projected | `.claude/rules` | 13 | 31689 | 13 | 0 | `84d5ace7e8f72289` | project tree, not decided per machine |
| cline | projected | `.clinerules` | 16 | 53725 | 16 | 0 | `0342a2654af4870a` | project tree, not decided per machine |
| cursor | projected | `.cursor/rules` | 26 | 75493 | 26 | 0 | `03bc42f776239dfb` | project tree, not decided per machine |
| windsurf | projected | `.windsurf/rules` | 13 | 34491 | 13 | 0 | `ad4604791dc29148` | project tree, not decided per machine |

## Hook commands written

### augment — 0 command(s)

None written.

### claude-code — 10 command(s)

~~~text
SessionStart: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event session_start --native-event SessionStart --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event session_start --native-event SessionStart --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; echo 'agent-config hooks are NOT running in this session: the plugin found no dispatcher, so no concern runs, the fail_closed guards block-no-verify, block-kernel-rule-writes and block-plumbing-writes included.'; }; [ -z "$AC_HOOK_PROBE" ] && [ -f "$R/thinned" ] && { echo 'agent-config: no hook dispatcher was reached and the rule layer on disk is thinned, so routed rule bodies will not arrive in this session. Open a rule body from the absolute Body path in its stub. The full rule layer is restored for the next session.'; L=""; read -r L < "$R/thinned"; F=1; if [ -d "$L" ] && [ -d "$S/claude-rules" ]; then F=0; for f in "$S/claude-rules"/*.md; do [ -f "$f" ] || continue; t="$L/${f##*/}"; if [ ! -e "$t" ] || grep -qx "package: event4u/agent-config" "$t"; then cp "$f" "$t.ac-restore" && mv -f "$t.ac-restore" "$t" || F=1; fi; done; fi; [ "$F" = 0 ] && mv -f "$R/thinned" "$R/demoted"; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event session_start --native-event SessionStart --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
SessionEnd: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event session_end --native-event SessionEnd --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event session_end --native-event SessionEnd --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event session_end --native-event SessionEnd --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
Stop: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event stop --native-event Stop --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event stop --native-event Stop --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event stop --native-event Stop --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
UserPromptSubmit: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event user_prompt_submit --native-event UserPromptSubmit --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event user_prompt_submit --native-event UserPromptSubmit --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event user_prompt_submit --native-event UserPromptSubmit --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
PostToolUse: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event post_tool_use --native-event PostToolUse --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event post_tool_use --native-event PostToolUse --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event post_tool_use --native-event PostToolUse --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
PostToolUseFailure: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event post_tool_use --native-event PostToolUseFailure --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event post_tool_use --native-event PostToolUseFailure --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event post_tool_use --native-event PostToolUseFailure --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
PreToolUse: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event pre_tool_use --native-event PreToolUse --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event pre_tool_use --native-event PreToolUse --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event pre_tool_use --native-event PreToolUse --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
PreCompact: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event pre_compact --native-event PreCompact --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event pre_compact --native-event PreCompact --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event pre_compact --native-event PreCompact --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
SubagentStart: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event subagent_start --native-event SubagentStart --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event subagent_start --native-event SubagentStart --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event subagent_start --native-event SubagentStart --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
SubagentStop: R="${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" --platform claude --event subagent_stop --native-event SubagentStop --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then exec "$N" "$S/dist/hooks/dispatch.js" --platform claude --event subagent_stop --native-event SubagentStop --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || { [ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo 'agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)' >&2; }; exit 0; }; "$BIN" dispatch:hook --platform claude --event subagent_stop --native-event SubagentStop --project-dir "$CLAUDE_PROJECT_DIR" --min-version 1
~~~

### cline — 0 command(s)

None written.

### cursor — 0 command(s)

None written.

### windsurf — 0 command(s)

None written.

## File sets

### `57b2646f91a3dd27`

~~~text
active-remediation.md	7629	full
agent-authority.md	1769	full
analysis-skill-routing.md	814	full
architecture.md	4825	full
artifact-drafting-protocol.md	3433	full
artifact-engagement-recording.md	2344	full
ask-when-uncertain.md	2706	full
autonomous-execution.md	6964	full
brand-consistency.md	992	full
brand-source-of-truth.md	6746	full
broken-access-control.md	4035	full
cli-output-handling.md	1478	full
code-comment-discipline.md	4096	full
code-provenance.md	9342	full
command-suggestion-policy.md	3663	full
commit-conventions.md	1072	full
commit-policy.md	3260	full
communication-through-line.md	2711	full
content-quoting-floor.md	4655	full
context-hygiene.md	8911	full
copilot-routing.md	979	full
council-availability.md	4030	full
cross-source-consistency.md	5330	full
decision-revisit-gate.md	9730	full
delegation-policy.md	6010	full
design-fidelity.md	10183	full
design-review-after-ui-write.md	10739	full
devcontainer-routing.md	990	full
direct-answers.md	3659	full
doc-screenshot-hygiene.md	5162	full
docker-commands.md	979	full
domain-safety-disclaimer.md	7929	full
domain-safety-pii.md	8711	full
domain-safety-retention.md	4846	full
downstream-changes.md	7458	full
engineering-safety-floor.md	4789	full
evaluator-independence.md	7394	full
external-code-graph-interop.md	3290	full
external-reference-deep-dive.md	4769	full
fast-path-marker-visibility.md	3624	full
finance-safety-floor.md	4955	full
fix-what-you-see.md	3997	full
git-history-discipline.md	5772	full
guidelines.md	1403	full
history-discipline.md	3489	full
icon-consistency.md	2634	full
image-likeness-and-rights.md	3153	full
improve-before-implement.md	4627	full
invite-challenge.md	3046	full
language-and-tone.md	3720	full
laravel-routing.md	1196	full
laravel-translations.md	839	full
legal-safety-floor.md	6859	full
lethal-trifecta-guard.md	4716	full
linked-projects-onboarding-gate.md	1644	full
markdown-safe-codeblocks.md	1179	full
media-governance-routing.md	5503	full
media-sync-ground-truth.md	3439	full
minimal-safe-diff.md	4346	full
missing-skill-recovery.md	4897	full
missing-tool-handling.md	1021	full
model-recommendation.md	1347	full
neighbour-precedence.md	3098	full
no-attribution-footers.md	2133	full
no-cheap-questions.md	3787	full
no-decorative-emojis-in-git-surfaces.md	4745	full
no-pr-progress-comments.md	4514	full
non-destructive-by-default.md	4472	full
notes-first-reasoning.md	3081	full
onboarding-gate.md	1666	full
output-discipline.md	4141	full
php-coding.md	963	full
playbook-precedence.md	5474	full
prefer-enums-over-literals.md	4407	full
provider-lifecycle-discipline.md	2988	full
question-not-instruction.md	3292	full
recurring-criticism.md	6015	full
reviewer-awareness.md	1161	full
roadmap-ci-steps-policy.md	3441	full
roadmap-progress-sync.md	10234	full
role-mode-adherence.md	2403	full
runtime-safety.md	1635	full
scale-discipline.md	5967	full
scope-control.md	4008	full
secret-vcs-guard.md	5095	full
security-sensitive-stop.md	5784	full
self-repair-loop.md	6034	full
senior-engineering-discipline.md	7106	full
session-canary.md	5949	full
settings-ask-protocol.md	9537	full
skill-improvement-trigger.md	836	full
slash-command-routing-policy.md	900	full
source-discovery-gate.md	4464	full
spreadsheet-source-quality.md	2556	full
strategy-safety-floor.md	5338	full
symfony-routing.md	984	full
test-first.md	2233	full
think-before-action.md	5938	full
token-efficiency.md	6009	full
tool-safety.md	4216	full
ui-audit-gate.md	9091	full
untrusted-input-defense.md	4713	full
upstream-proposal.md	786	full
user-interaction.md	4630	full
user-interrupt-priority.md	2451	full
verify-before-complete.md	2813	full
~~~

### `4e29e38d9c2a7271`

~~~text
active-remediation.md	6800	full
agent-authority.md	1401	full
analysis-skill-routing.md	431	full
architecture.md	4355	full
artifact-drafting-protocol.md	2919	full
artifact-engagement-recording.md	1870	full
ask-when-uncertain.md	2440	full
autonomous-execution.md	6331	full
brand-consistency.md	635	full
brand-source-of-truth.md	6042	full
broken-access-control.md	3051	full
cli-output-handling.md	422	full
code-comment-discipline.md	3289	full
code-provenance.md	8292	full
command-suggestion-policy.md	3082	full
commit-conventions.md	649	full
commit-policy.md	2924	full
communication-through-line.md	2268	full
content-quoting-floor.md	4188	full
context-hygiene.md	8282	full
copilot-routing.md	608	full
council-availability.md	3327	full
cross-source-consistency.md	4369	full
decision-revisit-gate.md	8589	full
delegation-policy.md	5326	full
design-fidelity.md	8649	full
design-review-after-ui-write.md	7946	full
devcontainer-routing.md	596	full
direct-answers.md	3273	full
doc-screenshot-hygiene.md	4061	full
docker-commands.md	416	full
domain-safety-disclaimer.md	6389	full
domain-safety-pii.md	7196	full
domain-safety-retention.md	3769	full
downstream-changes.md	7085	full
engineering-safety-floor.md	3811	full
evaluator-independence.md	5963	full
external-code-graph-interop.md	2746	full
external-reference-deep-dive.md	4378	full
fast-path-marker-visibility.md	3009	full
finance-safety-floor.md	3968	full
fix-what-you-see.md	3082	full
git-history-discipline.md	4988	full
guidelines.md	1043	full
history-discipline.md	2879	full
icon-consistency.md	2151	full
image-likeness-and-rights.md	2288	full
improve-before-implement.md	3762	full
invite-challenge.md	2644	full
language-and-tone.md	3207	full
laravel-routing.md	549	full
laravel-translations.md	428	full
legal-safety-floor.md	5794	full
lethal-trifecta-guard.md	3785	full
linked-projects-onboarding-gate.md	864	full
markdown-safe-codeblocks.md	785	full
media-governance-routing.md	4210	full
media-sync-ground-truth.md	2865	full
minimal-safe-diff.md	3771	full
missing-skill-recovery.md	4196	full
missing-tool-handling.md	562	full
model-recommendation.md	790	full
neighbour-precedence.md	2402	full
no-attribution-footers.md	1724	full
no-cheap-questions.md	3414	full
no-decorative-emojis-in-git-surfaces.md	4241	full
no-pr-progress-comments.md	4128	full
non-destructive-by-default.md	4077	full
notes-first-reasoning.md	2481	full
onboarding-gate.md	1186	full
output-discipline.md	3665	full
php-coding.md	431	full
playbook-precedence.md	4288	full
prefer-enums-over-literals.md	3794	full
provider-lifecycle-discipline.md	1919	full
question-not-instruction.md	2567	full
recurring-criticism.md	4835	full
reviewer-awareness.md	699	full
roadmap-ci-steps-policy.md	2269	full
roadmap-progress-sync.md	9359	full
role-mode-adherence.md	1971	full
runtime-safety.md	1229	full
scale-discipline.md	5095	full
scope-control.md	3690	full
secret-vcs-guard.md	4088	full
security-sensitive-stop.md	4622	full
self-repair-loop.md	5420	full
senior-engineering-discipline.md	6090	full
session-canary.md	4869	full
settings-ask-protocol.md	8194	full
skill-improvement-trigger.md	458	full
slash-command-routing-policy.md	445	full
source-discovery-gate.md	3729	full
spreadsheet-source-quality.md	2076	full
strategy-safety-floor.md	4204	full
symfony-routing.md	564	full
test-first.md	1604	full
think-before-action.md	5097	full
token-efficiency.md	5494	full
tool-safety.md	3693	full
ui-audit-gate.md	6430	full
untrusted-input-defense.md	3850	full
upstream-proposal.md	428	full
user-interaction.md	4056	full
user-interrupt-priority.md	1726	full
verify-before-complete.md	2511	full
~~~

### `adf466bc8ddace52`

~~~text
augment-edit-discipline.md	1263	full
domain-adoption-policy.md	2792	full
framework-neutrality-in-generic-skills.md	4241	full
low-impact-corpus-privacy-floor.md	2904	full
no-roadmap-references.md	3342	full
package-ci-checks.md	682	full
persona-governance.md	2238	full
preservation-guard.md	5564	full
rule-type-governance.md	723	full
size-enforcement.md	1712	full
skill-quality.md	810	full
source-confidentiality.md	5113	full
source-of-truth.md	3730	full
token-budget-discipline.md	6098	full
token-optimizer-maintenance.md	2189	full
~~~

### `84d5ace7e8f72289`

~~~text
augment-edit-discipline.md	565	full
domain-adoption-policy.md	2094	full
framework-neutrality-in-generic-skills.md	2368	full
low-impact-corpus-privacy-floor.md	2405	full
no-roadmap-references.md	2619	full
persona-governance.md	1190	full
preservation-guard.md	4982	full
rule-type-governance.md	351	full
skill-quality.md	341	full
source-confidentiality.md	4326	full
source-of-truth.md	3190	full
token-budget-discipline.md	5770	full
token-optimizer-maintenance.md	1488	full
~~~

### `0342a2654af4870a`

~~~text
ac-researcher.subagent.md	2859	full
ac-worker.subagent.md	3067	full
augment-edit-discipline.md	1263	full
domain-adoption-policy.md	2792	full
framework-neutrality-in-generic-skills.md	4241	full
low-impact-corpus-privacy-floor.md	2904	full
no-roadmap-references.md	3342	full
persona-governance.md	2238	full
preservation-guard.md	5564	full
production-validator.subagent.md	6792	full
rule-type-governance.md	723	full
skill-quality.md	810	full
source-confidentiality.md	5113	full
source-of-truth.md	3730	full
token-budget-discipline.md	6098	full
token-optimizer-maintenance.md	2189	full
~~~

### `03bc42f776239dfb`

~~~text
augment-edit-discipline.md	1263	full
augment-edit-discipline.mdc	781	full
domain-adoption-policy.md	2792	full
domain-adoption-policy.mdc	2304	full
framework-neutrality-in-generic-skills.md	4241	full
framework-neutrality-in-generic-skills.mdc	2731	full
low-impact-corpus-privacy-floor.md	2904	full
low-impact-corpus-privacy-floor.mdc	2690	full
no-roadmap-references.md	3342	full
no-roadmap-references.mdc	2794	full
persona-governance.md	2238	full
persona-governance.mdc	1510	full
preservation-guard.md	5564	full
preservation-guard.mdc	5152	full
rule-type-governance.md	723	full
rule-type-governance.mdc	498	full
skill-quality.md	810	full
skill-quality.mdc	506	full
source-confidentiality.md	5113	full
source-confidentiality.mdc	4491	full
source-of-truth.md	3730	full
source-of-truth.mdc	3318	full
token-budget-discipline.md	6098	full
token-budget-discipline.mdc	5971	full
token-optimizer-maintenance.md	2189	full
token-optimizer-maintenance.mdc	1740	full
~~~

### `ad4604791dc29148`

~~~text
augment-edit-discipline.md	776	full
domain-adoption-policy.md	2299	full
framework-neutrality-in-generic-skills.md	2726	full
low-impact-corpus-privacy-floor.md	2685	full
no-roadmap-references.md	2799	full
persona-governance.md	1505	full
preservation-guard.md	5157	full
rule-type-governance.md	503	full
skill-quality.md	511	full
source-confidentiality.md	4496	full
source-of-truth.md	3313	full
token-budget-discipline.md	5976	full
token-optimizer-maintenance.md	1745	full
~~~
