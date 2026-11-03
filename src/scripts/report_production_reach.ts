#!/usr/bin/env tsx
/**
 * Print the production entries and the size and digest of their import closure
 * (road-to-a-tick-the-shipped-path-earns 3.1). Two runs over one tree print the
 * same digest; a moved entry or a new edge changes it.
 *
 * `--unreached <glob>` also lists the modules matching `<glob>` that no entry
 * reaches, each with the door that labels it "reference spec, model-carried",
 * and exits 1 when an unreached module carries no label or a labelled one is
 * reached after all (ledger-that-can-say-no 2.3): an unreached engine module
 * is either wired or says, in its door, that the model carries it.
 *
 * Usage: ./scripts-run src/scripts/report_production_reach [--entries] [--unreached <glob>]
 */
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { globToRegExp, productionReach, type Reach, type ReachTree, worktreeOf } from './_lib/production_reach.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const LABEL = /`(src\/[A-Za-z0-9_/.-]+\.ts)`[^\n]*reference spec, model-carried/g;
const LABEL_SOURCES = [/^src\/domains\/.*\.md$/, /^src\/agent-src\/.*\.md$/];

/** Non-test modules matching `glob` that the closure does not reach. */
export function unreachedModules(tree: ReachTree, reach: Reach, glob: string): string[] {
    const re = globToRegExp(glob);
    return tree
        .list()
        .filter((f) => re.test(f) && !/\.test\.ts$/.test(f) && !reach.modules.has(f))
        .sort();
}

/** Module → the door file that labels it "reference spec, model-carried". */
export function labelledModules(tree: ReachTree): Map<string, string> {
    const out = new Map<string, string>();
    for (const file of tree.list()) {
        if (!LABEL_SOURCES.some((re) => re.test(file))) continue;
        for (const m of (tree.read(file) ?? '').matchAll(LABEL)) if (!out.has(m[1] as string)) out.set(m[1] as string, file);
    }
    return new Map([...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export interface UnreachedLine {
    bad: boolean;
    text: string;
}

/**
 * One line per unreached module and per label that does not hold: a label on a
 * module the closure reaches, or on a module the tree does not have at all —
 * that one is `missing`, since a deleted module is not a reached one.
 */
export function unreachedFindings(tree: ReachTree, reach: Reach, glob: string): UnreachedLine[] {
    const re = globToRegExp(glob);
    const unreached = unreachedModules(tree, reach, glob);
    const labelled = labelledModules(tree);
    const out: UnreachedLine[] = [];
    for (const m of unreached) {
        const door = labelled.get(m);
        out.push(
            door === undefined
                ? { bad: true, text: `❌  unreached, unlabelled: ${m}` }
                : { bad: false, text: `   unreached: ${m} — reference spec, model-carried (${door})` },
        );
    }
    for (const [m, door] of labelled) {
        if (!re.test(m) || unreached.includes(m)) continue;
        const state = tree.read(m) === null ? 'missing' : 'reached';
        out.push({ bad: true, text: `❌  labelled model-carried but ${state}: ${m} (${door})` });
    }
    out.push({ bad: false, text: `unreached ${glob}: ${unreached.length} · labelled ${unreached.filter((m) => labelled.has(m)).length}` });
    return out;
}

export function main(argv: readonly string[]): number {
    const tree = worktreeOf(REPO_ROOT);
    const reach = productionReach(tree);
    const digest = createHash('sha256')
        .update([...reach.modules].sort().join('\n'))
        .update('\0')
        .update([...reach.symbols].sort().join('\n'))
        .digest('hex')
        .slice(0, 16);
    if (argv.includes('--entries')) for (const e of reach.entries) process.stdout.write(`${e}\n`);
    process.stdout.write(
        `production reach: ${reach.entries.size} entries · ${reach.modules.size} modules · ` +
            `${reach.symbols.size} reached symbols · digest ${digest}\n`,
    );
    const at = argv.indexOf('--unreached');
    if (at < 0) return 0;
    const glob = argv[at + 1];
    if (glob === undefined) {
        process.stderr.write('report_production_reach: --unreached needs a glob\n');
        return 2;
    }
    const lines = unreachedFindings(tree, reach, glob);
    for (const l of lines) process.stdout.write(`${l.text}\n`);
    const bad = lines.filter((l) => l.bad).length;
    return bad > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
