/**
 * The reachability fixed point in `check_enforcement_coverage`.
 *
 * FIXTURE NAMES ARE LONG AND DISTINCTIVE ON PURPOSE. The seeding step asks
 * `wiring.includes(stem)`, so single-letter fixtures seed themselves out of the
 * wiring TEXT — `'WIRING zeta_root.ts'` contains `d` and `e`, which silently admitted
 * the last two links of a five-deep chain before the loop ran at all. The first
 * version of this file did exactly that, and both sabotage runs passed against
 * it. The names below share no substring with each other or with the wiring
 * string.
 *
 * The loop was changed from "re-scan every reached body each round" to a
 * worklist that searches only the bodies admitted in the previous round. The
 * argument for that being safe is that a file which did not match a body when
 * that body was added cannot match it later — nothing about either changes
 * between rounds. These tests are what makes the argument falsifiable.
 *
 * The depth test is the load-bearing one. A worklist that forgets to iterate,
 * or that clears the frontier too early, still finds everything one hop from
 * the wiring surface — so a shallow fixture agrees with a broken implementation.
 * Only a chain deeper than the number of rounds a wrong version performs can
 * tell them apart, which is why the fixture is five deep and asserts the LAST
 * link specifically rather than a set size.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { reachable_scripts } from '../../src/scripts/check_enforcement_coverage.js';

const made: string[] = [];

function tree(files: Record<string, string>): { dir: string; base: string } {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-'));
    made.push(base);
    const dir = path.join(base, 'scripts');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), body);
    }
    return { dir, base };
}

const relNames = (s: Set<string>): string[] => [...s].map((r) => path.basename(r)).sort();

afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('reachable_scripts — transitive closure', () => {
    it('follows a five-deep chain to its LAST link', () => {
        // a -> b -> c -> d -> e, each naming the next as a code string. Only the
        // first is named by the wiring surface. A version that does not iterate
        // to a fixed point stops at `a`; one that stops early stops mid-chain.
        const roots = tree({
            'zeta_root.ts': "const next = 'omicron_two.ts';\n",
            'omicron_two.ts': "const next = 'kappa_three.ts';\n",
            'kappa_three.ts': "const next = 'upsilon_four.ts';\n",
            'upsilon_four.ts': "const next = 'psi_five.ts';\n",
            'psi_five.ts': 'export const END = 1;\n',
        });
        const reached = reachable_scripts('WIRING zeta_root.ts', roots);
        expect(relNames(reached)).toEqual(
            ['kappa_three.ts', 'omicron_two.ts', 'psi_five.ts', 'upsilon_four.ts', 'zeta_root.ts'].sort(),
        );
    });

    it('does not reach a file nothing names', () => {
        // Not vacuous padding: without it, a version that simply returns every
        // file passes the test above. This is the half that says the closure is
        // a closure rather than the whole directory.
        const roots = tree({
            'zeta_root.ts': "const next = 'omicron_two.ts';\n",
            'omicron_two.ts': 'export const B = 1;\n',
            'lambda_orphan.ts': 'export const O = 1;\n',
        });
        const reached = reachable_scripts('WIRING zeta_root.ts', roots);
        expect(relNames(reached)).toEqual(['omicron_two.ts', 'zeta_root.ts']);
    });

    it('reaches a file named only inside a comment nowhere, and only as code', () => {
        // `mentions_as_code` requires the name inside a quoted string. A bare
        // mention in prose must NOT pull a file in, or the closure would grow to
        // everything any file discusses.
        const roots = tree({
            'zeta_root.ts': "// see omicron_two.ts for the sibling\nconst x = 1;\n",
            'omicron_two.ts': 'export const B = 1;\n',
        });
        const reached = reachable_scripts('WIRING zeta_root.ts', roots);
        expect(relNames(reached)).toEqual(['zeta_root.ts']);
    });

    it('terminates on a cycle instead of looping forever', () => {
        // Two files naming each other. The worklist empties because each is
        // admitted once; a version keyed on "did anything match" rather than on
        // "was anything NEW added" would not terminate here.
        const roots = tree({
            'zeta_root.ts': "const next = 'omicron_two.ts';\n",
            'omicron_two.ts': "const back = 'zeta_root.ts';\n",
        });
        const reached = reachable_scripts('WIRING zeta_root.ts', roots);
        expect(relNames(reached)).toEqual(['omicron_two.ts', 'zeta_root.ts']);
    });
});
