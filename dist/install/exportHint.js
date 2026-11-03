/**
 * The `agent-config export` command a global install prints for a tool that has
 * no user-scope convention — the install writes nothing for it, so the hint is
 * the whole deliverable and must be runnable as printed.
 */
// install tool id → [`export --tool` id, project-relative `--output`]. The
// export ids differ from the install ids (`copilot` exports as
// `copilot-instructions`), and `export` refuses to run without `--output`.
const EXPORT_TARGETS = {
    copilot: ['copilot-instructions', '.github/copilot-instructions.md'],
    aider: ['aider', '.aider/agent-config.md'],
    zed: ['zed', '.zed/agent-config.md'],
    jetbrains: ['jetbrains', '.jetbrains/agent-config.md'],
};
/** Tools a global install answers with an export hint instead of files. */
export const GLOBAL_HINT_TOOLS = Object.keys(EXPORT_TARGETS);
/** The command line printed for `tool_id`, or null when it is not a hint tool. */
export function exportHintCommand(tool_id) {
    const target = EXPORT_TARGETS[tool_id];
    if (target === undefined)
        return null;
    return `agent-config export --tool=${target[0]} --output=${target[1]}`;
}
//# sourceMappingURL=exportHint.js.map