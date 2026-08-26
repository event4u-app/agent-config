/**
 * Per-host projection reach — does each host's generated tree actually carry
 * artefacts, and when it does not, WHY.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 3 Step 1. The existing
 * `check_host_loadability.ts` proves two projections PARSE; `smoke_host_loadability.sh`
 * proves one host CLI (claude) ACCEPTS its plugin. Neither answers the question
 * this module exists for: **of the host trees this package generates, how many
 * reach anything, and for each one that does not, is the tool absent or is the
 * projection empty?**
 *
 * Those two are the same green today, and they are opposite findings. A tool
 * nobody has installed producing no artefacts is correct. A tool that IS
 * installed producing no artefacts is a dead projection, and the current gates
 * report it as a clean pass.
 *
 * ── The skip reason is the deliverable ──────────────────────────────────────
 * The step asks to "skip with a recorded reason when the tool is absent, per the
 * completeness ledger". So an absent tool is `skipped` with a NAMED reason, never
 * a silent zero — the distinction this whole roadmap is about.
 *
 * ── What this does NOT do ───────────────────────────────────────────────────
 * It does not install into a throwaway HOME and invoke the host's own loader.
 * That is `smoke_host_loadability.sh`, it exists for claude, and extending it to
 * eight hosts means eight vendor CLIs on the runner — a dependency decision, not
 * a check. This module reports REACH from the tree, and says so rather than
 * implying a host validated anything.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

/** One host's generated surface, and how to tell whether the tool is present. */
export interface HostSurface {
    /** Tool id, matching `src/install/toolDetection.ts`. */
    id: string;
    /** Executables that indicate the tool is installed. */
    bins: readonly string[];
    /** Home-relative paths that indicate the tool is installed. */
    homePaths: readonly string[];
    /** Repo-relative projection paths this package generates for the host. */
    projections: readonly string[];
    /** Below this the projection is treated as empty rather than thin. */
    minArtefacts: number;
}

/**
 * The host surfaces this package generates, with their detection signals.
 *
 * Deliberately NOT every id in `toolDetection.ts`: that table lists 23 tools
 * the wizard can record, most of which this package writes no dedicated tree
 * for — they read `AGENTS.md`, which is one file and has its own gates. Listing
 * them here would produce twenty rows of "0 artefacts, correctly", which is the
 * padding that makes a report unreadable.
 */
export const HOST_SURFACES: readonly HostSurface[] = [
    {
        id: 'claude-code',
        bins: ['claude'],
        homePaths: ['.claude', '.claude.json'],
        projections: ['.claude/skills', '.claude/rules', '.claude/commands'],
        minArtefacts: 1,
    },
    { id: 'cursor', bins: ['cursor'], homePaths: ['.cursor'], projections: ['.cursor/rules', '.cursor/commands'], minArtefacts: 1 },
    { id: 'cline', bins: [], homePaths: ['Documents/Cline'], projections: ['.clinerules'], minArtefacts: 1 },
    { id: 'windsurf', bins: ['windsurf'], homePaths: ['.codeium/windsurf'], projections: ['.windsurf/rules', '.windsurf/workflows'], minArtefacts: 1 },
    { id: 'gemini-cli', bins: ['gemini'], homePaths: ['.gemini'], projections: ['GEMINI.md'], minArtefacts: 1 },
    { id: 'copilot', bins: ['copilot'], homePaths: ['.config/github-copilot'], projections: ['.github/copilot-instructions.md'], minArtefacts: 1 },
];

export type ReachStatus = 'ok' | 'empty-projection' | 'skipped-tool-absent';

export interface HostReach {
    id: string;
    status: ReachStatus;
    artefacts: number;
    /** Present for every non-`ok` row. A status with no reason is what this replaces. */
    reason: string;
    present: boolean;
}

/** Count files under a projection path — one file is one artefact, recursively. */
export function countArtefacts(root: string, rel: string): number {
    const abs = path.join(root, rel);
    let st: fs.Stats;
    try {
        st = fs.statSync(abs);
    } catch {
        return 0;
    }
    if (st.isFile()) return 1;
    let n = 0;
    const walk = (dir: string): void => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            if (ent.isDirectory()) walk(path.join(dir, ent.name));
            else n += 1;
        }
    };
    walk(abs);
    return n;
}

/** True when any detection signal for the host hits. */
export function toolPresent(
    surface: HostSurface,
    opts: { home?: string; pathEnv?: string; exists?: (p: string) => boolean } = {},
): boolean {
    const home = opts.home ?? os.homedir();
    const exists = opts.exists ?? ((p: string) => fs.existsSync(p));
    for (const rel of surface.homePaths) {
        if (exists(path.join(home, rel))) return true;
    }
    const pathEnv = opts.pathEnv ?? process.env['PATH'] ?? '';
    for (const bin of surface.bins) {
        for (const dir of pathEnv.split(path.delimiter)) {
            if (dir !== '' && exists(path.join(dir, bin))) return true;
        }
    }
    return false;
}

export function measureReach(
    root: string,
    surfaces: readonly HostSurface[] = HOST_SURFACES,
    opts: { home?: string; pathEnv?: string; exists?: (p: string) => boolean } = {},
): HostReach[] {
    return surfaces.map((s) => {
        const artefacts = s.projections.reduce((n, rel) => n + countArtefacts(root, rel), 0);
        const present = toolPresent(s, opts);
        if (artefacts >= s.minArtefacts) {
            return { id: s.id, status: 'ok' as const, artefacts, reason: '', present };
        }
        if (!present) {
            return {
                id: s.id,
                status: 'skipped-tool-absent' as const,
                artefacts,
                reason:
                    `no detection signal for ${s.id} on this machine (bins: ${s.bins.join(', ') || 'none'}; ` +
                    `home paths: ${s.homePaths.join(', ') || 'none'}) — an unprojected tree for an ` +
                    'uninstalled tool is the correct state, not a gap',
                present,
            };
        }
        return {
            id: s.id,
            status: 'empty-projection' as const,
            artefacts,
            reason:
                `${s.id} IS installed and its projection carries ${String(artefacts)} artefact(s) ` +
                `(${s.projections.join(', ')}) — a dead projection for a present tool, which the ` +
                'shape gates report as a clean pass because they only read what exists',
            present,
        };
    });
}
