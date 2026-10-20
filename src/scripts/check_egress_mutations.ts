#!/usr/bin/env tsx
/**
 * The egress engine's invariants survive no listed mutation
 * (road-to-one-detector-and-the-senders-we-own 2.6).
 *
 * Every recipe under `src/config/egress-mutations/` names one engine module, a
 * `find` text that must occur in it exactly once, its `replace`, and the
 * invariant that must kill it. For each recipe the three engine modules
 * (`egress_rules`, `egress_token`, `egress_text`) are copied into a scratch
 * directory — never edited in place — and the invariant is run twice: on the
 * unmutated copy, where it must hold, and on the mutated copy, where it must
 * fail. A recipe whose mutation survives, whose `find` text is gone, or whose
 * invariant fails on the unmutated engine fails the gate.
 *
 * Exit: 0 every mutation killed · 1 a mutation survived or a recipe is stale.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const GATE = 'check_egress_mutations';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RECIPE_DIR = 'src/config/egress-mutations';
export const ENGINE_MODULES: readonly string[] = [
    'src/scripts/_lib/egress_rules.ts',
    'src/scripts/_lib/egress_token.ts',
    'src/scripts/_lib/egress_text.ts',
];

export interface Recipe {
    readonly mutation: string;
    readonly module: string;
    readonly find: string;
    readonly replace: string;
    readonly killed_by: string;
}

interface EngineMods {
    readonly rules: typeof import('./_lib/egress_rules.js');
    readonly token: typeof import('./_lib/egress_token.js');
    readonly text: typeof import('./_lib/egress_text.js');
}

// Built at runtime so no credential literal sits in this file.
const PAT = ['ghp', 'Qw3Er5Ty7Ui9Op2As4Df6Gh8Jk1Lz3Xc5Vb7'].join('_');

/** Each returns true when the invariant holds on the engine it is given. */
export const INVARIANTS: Readonly<Record<string, (m: EngineMods) => boolean>> = {
    'credential-outranks-identifier': (m) => {
        const kept = m.rules.resolveOverlaps([
            { rule: 'id', type: 'EMAIL', class: 'identifier', start: 0, end: 20, validated: true },
            { rule: 'cred', type: 'TOKEN', class: 'credential', start: 5, end: 10, validated: false },
        ]);
        return kept.length === 1 && kept[0]?.class === 'credential';
    },
    'credential-token-never-restores': (m) => {
        const scope = new m.token.TokenScope();
        const out = m.token.replaceValues(`key ${PAT} here`, scope);
        const tokens = m.token.parseTokens(out);
        return tokens.length === 1 && tokens.every((t) => scope.resolve(out.slice(t.start, t.end)) === null);
    },
    'tally-carries-no-value': (m) => {
        const tally = m.text.tallyText(`key ${PAT} here`);
        return tally.found.length === 1 && !JSON.stringify(tally).includes(PAT);
    },
};

export function readRecipes(root: string): Recipe[] {
    const dir = path.join(root, RECIPE_DIR);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Recipe);
}

async function loadEngine(root: string, mutate?: Recipe): Promise<EngineMods> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-mutation-'));
    for (const rel of ENGINE_MODULES) {
        let src = fs.readFileSync(path.join(root, rel), 'utf-8');
        if (mutate !== undefined && rel === mutate.module) src = src.replace(mutate.find, () => mutate.replace);
        fs.writeFileSync(path.join(tmp, path.basename(rel)), src);
    }
    const at = (name: string): string => pathToFileURL(path.join(tmp, name)).href;
    return {
        rules: (await import(at('egress_rules.ts'))) as EngineMods['rules'],
        token: (await import(at('egress_token.ts'))) as EngineMods['token'],
        text: (await import(at('egress_text.ts'))) as EngineMods['text'],
    };
}

const holds = (inv: (m: EngineMods) => boolean, m: EngineMods): boolean => {
    try {
        return inv(m);
    } catch {
        return false;
    }
};

/** One finding per recipe that does not do its job; empty when every mutation is killed. */
export async function findSurvivors(root: string, recipes: readonly Recipe[]): Promise<string[]> {
    const out: string[] = [];
    for (const r of recipes) {
        const inv = INVARIANTS[r.killed_by];
        if (inv === undefined) {
            out.push(`${r.mutation}: no invariant named ${r.killed_by}`);
            continue;
        }
        if (!ENGINE_MODULES.includes(r.module)) {
            out.push(`${r.mutation}: ${r.module} is not an engine module`);
            continue;
        }
        const src = fs.readFileSync(path.join(root, r.module), 'utf-8');
        if (src.split(r.find).length !== 2) {
            out.push(`${r.mutation}: its find text does not occur exactly once in ${r.module} — the recipe is stale`);
            continue;
        }
        if (!holds(inv, await loadEngine(root))) {
            out.push(`${r.mutation}: ${r.killed_by} fails on the unmutated engine`);
            continue;
        }
        if (holds(inv, await loadEngine(root, r))) out.push(`${r.mutation}: survived — ${r.killed_by} still holds`);
    }
    return out;
}

export async function check(root: string): Promise<number> {
    const recipes = readRecipes(root);
    reportScanned({ gate: GATE, scanned: recipes.length, units: 'mutation recipe(s)', roots: [RECIPE_DIR] });
    const survivors = await findSurvivors(root, recipes);
    if (survivors.length > 0) {
        process.stderr.write(`❌  ${GATE}: a mutation of the egress engine was not killed:\n`);
        for (const s of survivors) process.stderr.write(`  · ${s}\n`);
        return 1;
    }
    process.stdout.write(`✅  ${GATE}: every mutation killed (${String(recipes.length)} recipe(s)).\n`);
    return 0;
}

function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-mutations-selftest-'));
    const fixture = (name: string, recipes: readonly Recipe[]): string => {
        const root = path.join(tmp, name);
        for (const rel of ENGINE_MODULES) {
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.copyFileSync(path.join(REPO_ROOT, rel), path.join(root, rel));
        }
        fs.mkdirSync(path.join(root, RECIPE_DIR), { recursive: true });
        recipes.forEach((r, i) => fs.writeFileSync(path.join(root, RECIPE_DIR, `${String(i)}.json`), JSON.stringify(r)));
        return root;
    };
    const real = readRecipes(REPO_ROOT);
    const first = real[0] as Recipe;
    const run = (root: string): number => runGateCli(REPO_ROOT, 'src/scripts/check_egress_mutations.ts', ['--root', root], root);
    try {
        return runSelfTest({
            gate: GATE,
            minCases: 4,
            minRejectCases: 3,
            cases: [
                {
                    name: 'a mutation that changes nothing survives and is rejected',
                    expect: 'reject',
                    run: () => run(fixture('survivor', [{ ...first, mutation: 'noop', replace: first.find }])),
                },
                {
                    name: 'a recipe whose find text is gone is rejected as stale',
                    expect: 'reject',
                    run: () => run(fixture('stale', [{ ...first, mutation: 'stale', find: 'no such text in the module' }])),
                },
                {
                    name: 'a recipe naming no known invariant is rejected',
                    expect: 'reject',
                    run: () => run(fixture('unknown', [{ ...first, mutation: 'unknown', killed_by: 'no-such-invariant' }])),
                },
                {
                    name: 'the committed recipes are all killed',
                    expect: 'accept',
                    run: () => run(fixture('real', real)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export async function main(argv: readonly string[]): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`usage: ${GATE} [--root DIR] [--self-test]\n`);
        return 0;
    }
    if (argv.includes('--self-test')) return selfTest();
    const i = argv.indexOf('--root');
    return check(i === -1 ? REPO_ROOT : (argv[i + 1] ?? REPO_ROOT));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (exc: unknown) => {
            process.stderr.write(`${GATE}: ${String(exc)}\n`);
            process.exit(2);
        },
    );
}
