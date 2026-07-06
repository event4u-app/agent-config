#!/usr/bin/env tsx
/**
 * CI gate: every generator output root declared in this registry must be
 * classified in `src/config/agents-paths.yml` (policy = ignored or carve-out)
 * OR explicitly marked as tracked-generated with a committed carve-out in
 * the package .gitignore (e.g. `!/dist/agent-src/`).
 *
 * This is the guard that would have caught `.claude/agents/` being unclassified:
 * generate_claude_subagents() writes .claude/agents/, but neither the manifest
 * nor the package .gitignore had an entry for it.
 *
 * Exit codes:
 *   0 — all generator output roots are classified
 *   1 — one or more roots are unclassified
 *   2 — missing file
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(_HERE), '..', '..');

const MANIFEST = path.join(REPO_ROOT, 'src', 'config', 'agents-paths.yml');
const PACKAGE_GITIGNORE = path.join(REPO_ROOT, '.gitignore');

// Generator output root registry.
// Maintained here (alongside condense.ts generator list).
// Each entry: { root, generator, tool? } where root is the directory
// the generator writes into (relative to repo root).
//
// When you add a new generate_* function in condense.ts that writes to a
// new directory, add an entry here in the same commit.
const GENERATOR_OUTPUT_ROOTS = [
    { root: '.claude/rules', generator: 'generate_rule_symlinks', tool: 'claude-code' },
    { root: '.claude/personas', generator: 'generate_persona_symlinks', tool: 'claude-code' },
    { root: '.claude/user-types', generator: 'generate_user_type_symlinks', tool: 'claude-code' },
    { root: '.claude/skills', generator: 'generate_claude_skills + generate_plugin_command_skills', tool: 'claude-code' },
    { root: '.claude/agents', generator: 'generate_claude_subagents', tool: 'claude-code' },
    { root: '.augment', generator: 'sync_augment (condense main)', tool: 'augment' },
    { root: '.cursor/rules', generator: 'generate_cursor_mdc_rules', tool: 'cursor' },
    { root: '.windsurfrules', generator: 'generate_windsurfrules', tool: 'windsurf' },
    { root: '.windsurf/rules', generator: 'generate_windsurf_modern_rules', tool: 'windsurf' },
    { root: 'dist/agent-src', generator: 'condense (main output)', tool: null },
    { root: 'GEMINI.md', generator: 'generate_gemini_md', tool: 'gemini' },
] as const;

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Check if a root is classified in agents-paths.yml OR in .gitignore */
function isClassified(root: string, manifestPaths: Set<string>, gitignoreLines: Set<string>): boolean {
    // Build all candidates for this root: the root itself plus all ancestor dirs.
    // gitignore patterns like /.cursor/ cover .cursor/rules because the parent is ignored.
    const parts = root.split('/');
    const candidates: string[] = [];
    for (let i = parts.length; i >= 1; i--) {
        const sub = parts.slice(0, i).join('/');
        candidates.push(sub, `/${sub}`, `/${sub}/`, sub + '/');
    }
    // Also check negation carve-outs (e.g. !/dist/agent-src/)
    candidates.push(`!/${root}/`, `!${root}`, `!/${root}`);

    for (const c of candidates) {
        if (manifestPaths.has(c) || gitignoreLines.has(c)) return true;
    }
    return false;
}

function parseManifestPaths(text: string): Set<string> {
    const paths = new Set<string>();
    for (const line of text.split('\n')) {
        const m = line.match(/^- path:\s*(.+)/);
        if (m?.[1] !== undefined) paths.add(m[1].trim().replace(/^"|"$/g, ''));
    }
    return paths;
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const quiet = args.includes('--quiet');

    if (!_isFile(MANIFEST)) {
        process.stdout.write(`❌  Manifest not found: ${MANIFEST}\n`);
        return 2;
    }
    if (!_isFile(PACKAGE_GITIGNORE)) {
        process.stdout.write(`❌  .gitignore not found: ${PACKAGE_GITIGNORE}\n`);
        return 2;
    }

    const manifestPaths = parseManifestPaths(fs.readFileSync(MANIFEST, 'utf-8'));
    const gitignoreLines = new Set(
        fs.readFileSync(PACKAGE_GITIGNORE, 'utf-8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => Boolean(l) && !l.startsWith('#')),
    );

    const unclassified: typeof GENERATOR_OUTPUT_ROOTS[number][] = [];
    for (const entry of GENERATOR_OUTPUT_ROOTS) {
        if (!isClassified(entry.root, manifestPaths, gitignoreLines)) {
            unclassified.push(entry);
        }
    }

    if (unclassified.length > 0) {
        process.stdout.write(
            `❌  Generator output roots not classified in agents-paths.yml or .gitignore:\n\n`,
        );
        for (const e of unclassified) {
            process.stdout.write(`  - ${e.root} (written by ${e.generator})\n`);
        }
        process.stdout.write(
            `\nAdd an entry to src/config/agents-paths.yml (policy: ignored or carve-out)\n` +
                `or ensure a negation carve-out exists in the package .gitignore.\n` +
                `Also add the path to the GENERATOR_OUTPUT_ROOTS registry in this script.\n`,
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  All ${GENERATOR_OUTPUT_ROOTS.length} generator output roots are classified.\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { main, GENERATOR_OUTPUT_ROOTS };
