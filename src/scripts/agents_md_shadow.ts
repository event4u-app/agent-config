#!/usr/bin/env node
/**
 * AGENTS.md shadow detector — road-to-a-noted-that-is-a-write 2.2.
 *
 * Claude Code reads `CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md`, not
 * `AGENTS.md`. A convention written to `AGENTS.md` therefore never reaches a
 * Claude session when one of those files exists and neither imports
 * (`@AGENTS.md`) nor symlinks to it: the agent can truthfully say it wrote the
 * convention down, and the next session still does not see it. That file is a
 * shadow.
 *
 * Pure over the filesystem, read-only. Surfaced by `/agents audit`.
 *
 * Usage: ./scripts-run src/scripts/agents_md_shadow [--root <dir>]
 * Exit codes: 0 = no shadow · 1 = at least one shadow.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The host instruction files that can shadow `AGENTS.md`, relative to the root. */
export const SHADOW_CANDIDATES = ['CLAUDE.md', path.join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md'] as const;

export interface ShadowFinding {
    file: string;
    reason: string;
}

const IMPORT_RE = /(^|\s)@(\.{1,2}\/)*AGENTS\.md(\s|$)/m;

function realpath(p: string): string | null {
    try {
        return fs.realpathSync(p);
    } catch {
        return null;
    }
}

/**
 * Every candidate that exists and neither imports nor symlinks to a non-empty
 * `AGENTS.md` at `root`. An absent or empty `AGENTS.md` has nothing to shadow.
 */
export function detectAgentsMdShadow(root: string): ShadowFinding[] {
    const agents = path.join(root, 'AGENTS.md');
    let agentsText: string;
    try {
        agentsText = fs.readFileSync(agents, 'utf-8');
    } catch {
        return [];
    }
    if (agentsText.trim() === '') return [];
    const agentsReal = realpath(agents);
    const out: ShadowFinding[] = [];
    for (const rel of SHADOW_CANDIDATES) {
        const file = path.join(root, rel);
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        if (agentsReal !== null && realpath(file) === agentsReal) continue;
        if (IMPORT_RE.test(text)) continue;
        out.push({
            file: rel,
            reason: `${rel} neither imports (@AGENTS.md) nor symlinks to AGENTS.md, so a Claude session never reads what AGENTS.md says`,
        });
    }
    return out;
}

export function main(argv: readonly string[]): number {
    const i = argv.indexOf('--root');
    const root = i >= 0 && argv[i + 1] !== undefined ? path.resolve(argv[i + 1] as string) : process.cwd();
    const findings = detectAgentsMdShadow(root);
    if (findings.length === 0) {
        process.stdout.write('✅  agents_md_shadow: no host instruction file shadows AGENTS.md\n');
        return 0;
    }
    for (const f of findings) process.stdout.write(`❌  ${f.reason}\n`);
    process.stdout.write('    Fix: add a line `@AGENTS.md` to the file, or replace it with a symlink to AGENTS.md.\n');
    return 1;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
