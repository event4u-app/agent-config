// The thinned layer's machine dependence, as a formula — step 1.3 of
// `road-to-a-thinned-layer-measured-in-one-unit`.
//
// The thinned layer names the package the install was made from
// (`absoluteBodyLinkPrefix`), so its standing size depends on where that
// package happens to sit on the reader's disk. That is a real
// property of the installed form and not a fixture artefact: an independent
// install from a longer root was observed raising both the install receipt and
// the installed-layer report, and until now nobody could say by how much
// without running two installs.
//
// These cases turn it into an equation a reader can apply to any root. Stubs
// used to repeat the root in every `Body:` line (Δ root × number of stubs).
// Since road-to-a-session-start-under-the-host-limit Phase 3 a stub carries a
// bare `Body: <id>.md` and the root is written ONCE, in the bodies index, where
// it appears twice (the directory, and the `<dir>/<id>.md` reading example):
//
//     Δ unconditional characters = 2 × Δ root length, whatever the stub count
//
// The fixture is a synthetic package root, for the reason
// `install_thin_layer.test.ts` states in its own header: pinning to the live
// corpus would make the assertion restate whatever the corpus contains today.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RULE_BODIES_INDEX, thinInstalledRuleLayer } from '../../src/install/installThinLayer.js';
import { readLayer } from '../../src/scripts/_lib/installed_layer.js';
import { absoluteBodyLinkPrefix, is_thin_entry } from '../../src/scripts/_lib/thin_rules.js';

const made: string[] = [];

afterEach(() => {
    while (made.length > 0) {
        const dir = made.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

function padBody(lead: string): string {
    return `${lead}\n\n${'Paragraph of rule prose that the stub replaces. '.repeat(40)}`;
}

const RULES = [
    ['kern', padBody('Kernel body, never thinned.')],
    ['routed', padBody('A long routed body that the stub replaces.')],
    ['second', padBody('A second routed body, so the stub count is not one.')],
    ['third', padBody('A third routed body, so a per-stub division is meaningful.')],
    ['pathy', padBody('A path-only body, kept full.')],
] as const;

/** How many of {@link RULES} `build_thin` emits as a stub. The divisor under test. */
const STUBS = 3;

function sourceRule(id: string, body: string): string {
    return `---\ndescription: "What ${id} is for"\ntriggers:\n  - keyword: "${id}-word"\n---\n\n# ${id}\n\n${body}\n`;
}

function installedRule(id: string, body: string): string {
    return `---\npackage: event4u/agent-config\nsource_path: dist/agent-src/rules/${id}.md\n---\n\n# ${id}\n\n${body}\n`;
}

/** A package root at `root`, carrying the same five rules whatever its path is. */
function makePackage(root: string): void {
    const rules = path.join(root, 'dist', 'agent-src', 'rules');
    fs.mkdirSync(rules, { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'dist', 'router.json'),
        JSON.stringify({
            schema_version: 2,
            kernel: ['kern'],
            tier_1: [
                { id: 'routed', triggers: [{ keyword: 'routed-word' }], workspaces: [] },
                { id: 'second', triggers: [{ keyword: 'second-word' }], workspaces: [] },
                { id: 'third', triggers: [{ keyword: 'third-word' }], workspaces: [] },
                { id: 'pathy', triggers: [{ file_pattern: '*.php' }], workspaces: [] },
            ],
            tier_2: [],
            profiles: {},
        }),
        'utf-8',
    );
    fs.writeFileSync(
        path.join(root, 'src', 'config', 'rule-consequence-class.json'),
        JSON.stringify({
            criterion_ref: 'test fixture',
            members: {},
            no_stub: {},
            excluded: {},
        }),
        'utf-8',
    );
    for (const [id, body] of RULES) {
        fs.writeFileSync(path.join(rules, `${id}.md`), sourceRule(id, body), 'utf-8');
    }
}

/** The verbatim installed layer a pre-thinning install leaves behind. */
function makeInstalledLayer(home: string): string {
    const dir = path.join(home, '.claude', 'rules');
    fs.mkdirSync(dir, { recursive: true });
    for (const [id, body] of RULES) {
        fs.writeFileSync(path.join(dir, `${id}.md`), installedRule(id, body), 'utf-8');
    }
    return dir;
}

/**
 * Thin one layer from a package root whose basename is `nameLen` characters,
 * and report what stands afterwards.
 *
 * Both roots are created under ONE base directory, so every character of the
 * difference comes from the basename and none from the temp-directory prefix.
 */
function runAt(
    base: string,
    nameLen: number,
    char = 'p',
): { uncond: number; stubs: number; prefix: number } {
    const root = path.join(base, char.repeat(nameLen));
    const home = path.join(base, `h${char}${String(nameLen)}`);
    makePackage(root);
    const rulesDir = makeInstalledLayer(home);
    const res = thinInstalledRuleLayer({ rulesDir, packageRoot: root });
    const layer = readLayer('claude-code', 'global', rulesDir, new Map());
    return {
        uncond: layer.unconditional_chars,
        stubs: res.thinned,
        prefix: absoluteBodyLinkPrefix(root).length,
    };
}

describe('the thinned layer is machine-dependent, by a stated formula', () => {
    it('a root 60 characters longer costs exactly 2 x 60, not 60 x the stub count', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'itrl-60-'));
        made.push(base);
        const short = runAt(base, 1);
        const long = runAt(base, 61);

        // The fixture's own premise, asserted rather than assumed: the two roots
        // really do differ by 60 characters, and both thinned the same rules.
        expect(long.prefix - short.prefix).toBe(60);
        expect(short.stubs).toBe(STUBS);
        expect(long.stubs).toBe(STUBS);

        expect(long.uncond - short.uncond).toBe(2 * 60);
    });

    it('the cost per character of root is two, independent of the stub count', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'itrl-per-'));
        made.push(base);
        const a = runAt(base, 1);
        const b = runAt(base, 24);
        const deltaRoot = b.prefix - a.prefix;
        expect(deltaRoot).toBe(23);
        // The formula, divided out: the root is paid in the index only.
        expect(b.uncond - a.uncond).toBe(2 * deltaRoot);
    });

    it('two roots of EQUAL length give an identical reading', () => {
        // The control. Without it the two cases above would pass for a fixture
        // that simply grew with every run, and the equality would never be
        // tested in the direction that says the mechanism is the root length.
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'itrl-eq-'));
        made.push(base);
        const first = runAt(base, 7, 'p');
        const second = runAt(base, 7, 'q');
        expect(second.prefix).toBe(first.prefix);
        expect(second.uncond).toBe(first.uncond);
    });

    it('only the INDEX carries the root — stubs and kept rules are the same size either way', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'itrl-kept-'));
        made.push(base);
        const shortRoot = path.join(base, 'p');
        const longRoot = path.join(base, 'p'.repeat(61));
        makePackage(shortRoot);
        makePackage(longRoot);
        const shortHome = path.join(base, 'hs');
        const longHome = path.join(base, 'hl');
        const shortDir = makeInstalledLayer(shortHome);
        const longDir = makeInstalledLayer(longHome);
        thinInstalledRuleLayer({ rulesDir: shortDir, packageRoot: shortRoot });
        thinInstalledRuleLayer({ rulesDir: longDir, packageRoot: longRoot });

        for (const id of ['kern', 'pathy']) {
            const a = fs.readFileSync(path.join(shortDir, `${id}.md`), 'utf-8');
            const b = fs.readFileSync(path.join(longDir, `${id}.md`), 'utf-8');
            expect(is_thin_entry(a)).toBe(false);
            expect(a).toBe(b);
        }
        for (const id of ['routed', 'second', 'third']) {
            const a = fs.readFileSync(path.join(shortDir, `${id}.md`), 'utf-8');
            const b = fs.readFileSync(path.join(longDir, `${id}.md`), 'utf-8');
            expect(is_thin_entry(a)).toBe(true);
            expect(b).toBe(a);
        }
        const ia = fs.readFileSync(path.join(shortDir, RULE_BODIES_INDEX), 'utf-8');
        const ib = fs.readFileSync(path.join(longDir, RULE_BODIES_INDEX), 'utf-8');
        expect(ib.length - ia.length).toBe(2 * 60);
    });
});
