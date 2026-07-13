/**
 * tool_adapter_registry.ts — canonical supported-tools adapter set.
 *
 * Single source of truth binding three surfaces that previously drifted
 * independently (road-to-ecosystem-harvest-skill-quality-gates Phase 4,
 * Source AA):
 *
 *   1. the README `## Supported tools` § "Project-installed" matrix,
 *   2. this registry (reviewed, canonical),
 *   3. the generator output roots in `check_generator_output_coverage.ts`.
 *
 * `lint_supported_tools_matrix.ts` fails CI when (1) ≠ (2) in either
 * direction, and when a generator tool tag in (3) has no registry entry
 * covering its root. Adding/removing a supported tool therefore requires
 * touching README + registry (+ generator roots when native) in one commit.
 */
import { GENERATOR_OUTPUT_ROOTS } from '../check_generator_output_coverage.js';

export interface AdapterEntry {
    /** Tool name exactly as the README matrix first column renders it (without bold markers / parenthetical). */
    readonly tool: string;
    /** How the tool consumes the package. */
    readonly kind: 'native' | 'agents-md' | 'marker';
    /** Generated / written roots this tool reads (repo-relative). Empty for agents-md / marker tools. */
    readonly roots: readonly string[];
    /** Tool tag used by GENERATOR_OUTPUT_ROOTS, when the condense pipeline owns a root for it. */
    readonly generator_tag?: string;
}

export const ADAPTER_REGISTRY: readonly AdapterEntry[] = [
    {
        tool: 'Claude Code',
        kind: 'native',
        roots: ['.claude/rules', '.claude/skills', '.claude/agents', '.claude/personas', '.claude/user-types'],
        generator_tag: 'claude-code',
    },
    { tool: 'Cursor', kind: 'native', roots: ['.cursor/rules', '.cursor/commands'], generator_tag: 'cursor' },
    { tool: 'Cline', kind: 'native', roots: ['.clinerules'] },
    {
        tool: 'Windsurf',
        kind: 'native',
        roots: ['.windsurfrules', '.windsurf/rules', '.windsurf/workflows'],
        generator_tag: 'windsurf',
    },
    { tool: 'Gemini CLI', kind: 'native', roots: ['GEMINI.md'], generator_tag: 'gemini' },
    { tool: 'GitHub Copilot', kind: 'native', roots: ['.github/copilot-instructions.md'] },
    { tool: 'Roo Code', kind: 'agents-md', roots: [] },
    { tool: 'Codex CLI', kind: 'agents-md', roots: [] },
    { tool: 'Continue.dev', kind: 'agents-md', roots: [] },
    { tool: 'Aider', kind: 'marker', roots: [] },
    { tool: 'Augment', kind: 'marker', roots: ['.augment'], generator_tag: 'augment' },
    { tool: 'Claude Desktop', kind: 'marker', roots: [] },
];

/**
 * Extract the tool names from the README's `## Supported tools` §
 * "Project-installed" table. Returns names with bold markers and trailing
 * parentheticals stripped, in table order.
 */
export function parse_supported_tools(readme: string): string[] {
    const section = readme.split(/^## Supported tools\s*$/m)[1];
    if (section === undefined) return [];
    // Stop at the next H2/H3 AFTER the first table (the "Plugin-installed" H3).
    const lines = section.split('\n');
    const tools: string[] = [];
    let inTable = false;
    for (const line of lines) {
        const t = line.trim();
        if (/^###\s/.test(t) && inTable) break; // next sub-section after the table
        if (/^\|/.test(t)) {
            inTable = true;
            const cell = t.split('|')[1]?.trim() ?? '';
            if (cell === '' || cell === 'Tool' || /^:?-+:?$/.test(cell)) continue;
            const name = cell
                .replace(/\*\*/g, '')
                .replace(/\s*\(.*\)\s*$/, '')
                .trim();
            if (name && name !== '---') tools.push(name);
        } else if (inTable && t !== '' && !/^\|/.test(t)) {
            // Table ended (legend line etc.).
            break;
        }
    }
    return tools;
}

/** Compare README matrix ↔ registry ↔ generator roots. Returns human-readable errors; empty = green. */
export function lint_matrix(readme: string): string[] {
    const errors: string[] = [];
    const readmeTools = parse_supported_tools(readme);
    const readmeSet = new Set(readmeTools);
    const registrySet = new Set(ADAPTER_REGISTRY.map((e) => e.tool));

    for (const t of registrySet) {
        if (!readmeSet.has(t)) {
            errors.push(`registry tool '${t}' missing from the README Supported-tools matrix`);
        }
    }
    for (const t of readmeSet) {
        if (!registrySet.has(t)) {
            errors.push(`README Supported-tools row '${t}' has no ADAPTER_REGISTRY entry`);
        }
    }

    // Generator leg: every tool-tagged generator output root must be claimed
    // by the registry entry carrying that tag.
    const byTag = new Map(ADAPTER_REGISTRY.filter((e) => e.generator_tag).map((e) => [e.generator_tag, e]));
    for (const { root, tool } of GENERATOR_OUTPUT_ROOTS) {
        if (tool === null) continue;
        const entry = byTag.get(tool);
        if (!entry) {
            errors.push(`generator output root '${root}' (tool '${tool}') has no ADAPTER_REGISTRY entry with that generator_tag`);
            continue;
        }
        if (!entry.roots.includes(root)) {
            errors.push(`generator output root '${root}' (tool '${tool}') is not listed in ADAPTER_REGISTRY entry '${entry.tool}'`);
        }
    }
    return errors;
}
