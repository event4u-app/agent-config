/**
 * Continuity-surface inventory — the behavioural half of the ratchet.
 *
 * WHY THIS EXISTS
 * ---------------
 * `road-to-one-continuity-record` measured its own success as five numbers —
 * public continuity commands, session resume pickers, persistent continuity
 * artefacts, continuity schemas, normal-path manual actions — and its council
 * of 2026-09-07 named the defect in measuring them by name:
 *
 *   "Any persisted state written for later session/run recovery, verification,
 *   or context restoration must be listed, whether or not it is labeled
 *   continuity."
 *
 * A count keyed on the WORD `continuity` is gameable by renaming. So the
 * artefact axis is DISCOVERED behaviourally — every distinct leaf under
 * `agents/runtime/state/` that any source file names — and the inventory then
 * has to dispose of each one as `counted` or `excluded` WITH A REASON. A leaf
 * nothing disposes of is a hard failure, which is what makes a newly added
 * persisted-state surface impossible to slip past the count silently.
 *
 * The exclusions are the load-bearing half, not the leftovers. `checkpoints/`
 * is the worked example the council named: it is kept (D2 — run-integrity
 * evidence is keyed by run id, consumed by `run:supervise`, and a disagreement
 * there is an integrity alarm rather than a degraded resume), so it is excluded
 * from the continuity axis, and that exclusion is PRINTED on every run rather
 * than buried in a predicate.
 *
 * WHAT THIS MODULE IS NOT
 * -----------------------
 * It does not decide policy. It reads a committed inventory, checks that the
 * inventory still describes the tree (every `locus` resolves; every discovered
 * leaf is disposed of), and derives the five numbers from the dispositions.
 * The ratchet that forbids growth lives in `check_continuity_surface.ts`, which
 * runs these same functions over a materialised base tree.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Repo-relative POSIX path of the committed inventory. */
export const INVENTORY_POSIX = 'src/config/continuity-surface.json';

/** Source roots the behavioural discovery walks. */
export const DISCOVERY_ROOTS: readonly string[] = [
    'src/scripts',
    'src/agent-src/scripts',
    'src/cli',
    'src/shared',
    'src/server',
    'src/install',
];

/**
 * The five axes, in the order the parent roadmap's goal states them. The order
 * is part of the contract: the goal reads `0 / 0 / 1 / 1 / 0` positionally, and
 * a reader comparing a run against that line needs the same positions.
 */
export const AXES = [
    'public_continuity_commands',
    'session_resume_pickers',
    'persistent_continuity_artefacts',
    'continuity_schemas',
    'normal_path_manual_actions',
] as const;

export type Axis = (typeof AXES)[number];

/** The target the parent roadmap's goal states, by axis. */
export const TARGETS: Readonly<Record<Axis, number>> = {
    public_continuity_commands: 0,
    session_resume_pickers: 0,
    persistent_continuity_artefacts: 1,
    continuity_schemas: 1,
    normal_path_manual_actions: 0,
};

export interface InventoryRow {
    /** Stable identifier. For a discovered artefact this is the state leaf. */
    id: string;
    /** Which axis this row belongs to. */
    axis: Axis;
    /** `counted` contributes to the axis number; `excluded` does not. */
    disposition: 'counted' | 'excluded';
    /**
     * Repo-relative `file` or `file:line` the row is anchored to. It must
     * resolve, which is what makes a retirement MEASURED: deleting the surface
     * without deleting or re-disposing its row reddens.
     */
    locus: string;
    /**
     * Why. Mandatory on every row, not only on exclusions — a `counted` row
     * whose reason nobody wrote is a number without a meaning.
     */
    reason: string;
}

export interface Inventory {
    rows: readonly InventoryRow[];
}

/** A leaf the discovery found, with the first source position that names it. */
export interface DiscoveredLeaf {
    leaf: string;
    locus: string;
}

const LEAF_RE =
    /agents\/runtime\/state\/([A-Za-z0-9_.-]+)|['"]runtime['"],\s*['"]state['"],\s*['"]([A-Za-z0-9_.-]+)['"]/g;

const SOURCE_EXT = /\.(ts|js|mjs|sh|bash)$/;

function _walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            _walk(full, out);
            continue;
        }
        if (!SOURCE_EXT.test(entry.name)) continue;
        // Test files name state paths in fixtures; a fixture is not a surface.
        if (entry.name.endsWith('.test.ts')) continue;
        out.push(full);
    }
}

/**
 * Every distinct `agents/runtime/state/<leaf>` any source file names, with the
 * first `file:line` that names it. Sorted, so two runs over the same tree
 * produce byte-identical output and a diff of the count is a diff of the tree.
 */
export function discoverStateLeaves(root: string): DiscoveredLeaf[] {
    const files: string[] = [];
    for (const rel of DISCOVERY_ROOTS) {
        _walk(path.join(root, rel), files);
    }
    files.sort();
    const found = new Map<string, string>();
    for (const file of files) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        const rel = path.relative(root, file).split(path.sep).join('/');
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i] ?? '';
            LEAF_RE.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = LEAF_RE.exec(line)) !== null) {
                const raw = match[1] ?? match[2] ?? '';
                // A trailing dot is string concatenation in the source
                // (`'...json' + '.tmp'`), never part of the leaf name.
                const leaf = raw.replace(/\.+$/, '');
                if (leaf === '' || leaf === '.') continue;
                if (!found.has(leaf)) found.set(leaf, `${rel}:${String(i + 1)}`);
            }
        }
    }
    return [...found.keys()].sort().map((leaf) => ({ leaf, locus: found.get(leaf) ?? '' }));
}

export function readInventory(root: string): Inventory {
    const file = path.join(root, INVENTORY_POSIX);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { rows?: unknown };
    const rows = Array.isArray(parsed.rows) ? (parsed.rows as InventoryRow[]) : [];
    return { rows };
}

/** Does a `file` or `file:line` locus still resolve in this tree? */
export function locusResolves(root: string, locus: string): boolean {
    const match = /^(.*?):(\d+)$/.exec(locus);
    const rel = match ? (match[1] ?? '') : locus;
    const target = path.join(root, rel);
    let stat: fs.Stats;
    try {
        stat = fs.statSync(target);
    } catch {
        return false;
    }
    if (!match) return true;
    if (!stat.isFile()) return false;
    // A line anchor must still BE a line. Content is deliberately not compared:
    // a locus that pins prose would rot on every reflow and turn the inventory
    // into a line-number chore, which is how anchor checks get deleted.
    const line = Number(match[2]);
    let text: string;
    try {
        text = fs.readFileSync(target, 'utf-8');
    } catch {
        return false;
    }
    return line >= 1 && line <= text.split('\n').length;
}

export interface SurfaceCounts {
    public_continuity_commands: number;
    session_resume_pickers: number;
    persistent_continuity_artefacts: number;
    continuity_schemas: number;
    normal_path_manual_actions: number;
}

export function countAxes(inv: Inventory): SurfaceCounts {
    const counts = {
        public_continuity_commands: 0,
        session_resume_pickers: 0,
        persistent_continuity_artefacts: 0,
        continuity_schemas: 0,
        normal_path_manual_actions: 0,
    };
    for (const row of inv.rows) {
        if (row.disposition !== 'counted') continue;
        if (!AXES.includes(row.axis)) continue;
        counts[row.axis] += 1;
    }
    return counts;
}

export interface InventoryFinding {
    kind: 'undisposed-leaf' | 'dead-locus' | 'bad-row' | 'duplicate-row';
    detail: string;
}

/**
 * Validate the inventory against the tree.
 *
 * Three failure classes, and each exists because a specific way of faking a
 * lower number would otherwise work:
 *
 *   - `undisposed-leaf` — a persisted-state leaf the source names and the
 *     inventory does not mention. This is the add-a-surface-quietly route.
 *   - `dead-locus` — a row anchored to something that no longer exists. This
 *     is the claim-a-retirement-that-did-not-happen route in reverse: it forces
 *     the row to be deleted (a real subtraction) rather than left standing.
 *   - `bad-row` / `duplicate-row` — shape defects that would make either of the
 *     above unenforceable.
 */
export function validateInventory(
    root: string,
    inv: Inventory,
    discovered: readonly DiscoveredLeaf[],
): InventoryFinding[] {
    const findings: InventoryFinding[] = [];
    const seen = new Set<string>();
    for (const row of inv.rows) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (id === '') {
            findings.push({ kind: 'bad-row', detail: 'a row carries no `id`' });
            continue;
        }
        if (seen.has(id)) {
            findings.push({ kind: 'duplicate-row', detail: `two rows share the id \`${id}\`` });
        }
        seen.add(id);
        if (!AXES.includes(row.axis)) {
            findings.push({ kind: 'bad-row', detail: `\`${id}\`: unknown axis \`${String(row.axis)}\`` });
        }
        if (row.disposition !== 'counted' && row.disposition !== 'excluded') {
            findings.push({
                kind: 'bad-row',
                detail: `\`${id}\`: disposition must be \`counted\` or \`excluded\`, got \`${String(row.disposition)}\``,
            });
        }
        if (typeof row.reason !== 'string' || row.reason.trim().length < 20) {
            findings.push({
                kind: 'bad-row',
                detail: `\`${id}\`: every row needs a reason of substance — a number without a stated meaning is not an inventory`,
            });
        }
        if (typeof row.locus !== 'string' || row.locus.trim() === '') {
            findings.push({ kind: 'bad-row', detail: `\`${id}\`: no \`locus\`` });
        } else if (!locusResolves(root, row.locus)) {
            findings.push({
                kind: 'dead-locus',
                detail: `\`${id}\`: locus \`${row.locus}\` does not resolve — if the surface was retired, DELETE the row (that is the subtraction); if it moved, re-anchor it`,
            });
        }
    }
    for (const item of discovered) {
        if (!seen.has(item.leaf)) {
            findings.push({
                kind: 'undisposed-leaf',
                detail: `\`${item.leaf}\` (${item.locus}) is persisted state under agents/runtime/state/ that the inventory does not dispose of — add a row with \`disposition: counted\` (it is continuity state) or \`disposition: excluded\` with the reason it is not`,
            });
        }
    }
    return findings;
}
