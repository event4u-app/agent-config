import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    REMEDIATION,
    checkAll,
    parseHead,
    registeredGenerators,
    resolveId,
} from '../../src/agent-src/templates/scripts/check_playbook_invokes';

const FIXTURE = path.join('tests', 'fixtures', 'playbooks', 'mono-with-generator');

/** Copy the fixture into a scratch dir so a rename probe never touches the tracked tree. */
const cloneFixture = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-invokes-'));
    fs.cpSync(FIXTURE, root, { recursive: true });
    return root;
};

const writePlaybook = (root: string, name: string, body: string): string => {
    const home = path.join(root, 'agents', 'settings', 'contexts');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, name), body, 'utf8');
    return home;
};

const CONFIGURED = [
    '---',
    'task: "Add a new component to this repository"',
    'scope: "packages/ui"',
    'grade: "configured"',
    'invokes:',
    '  - "turbo gen component"',
    '---',
    '',
    '1. Run the generator.',
].join('\n');

describe('check_playbook_invokes', () => {
    describe('the step verify — rename fails, restore passes', () => {
        it('passes while the generator is registered', () => {
            const root = cloneFixture();
            const home = writePlaybook(root, 'add-ui-component.md', CONFIGURED);
            expect(checkAll(root, home).filter((c) => c.verdict === 'missing')).toEqual([]);
        });

        it('fails naming the playbook and the id after the generator is renamed', () => {
            const root = cloneFixture();
            const home = writePlaybook(root, 'add-ui-component.md', CONFIGURED);
            const cfg = path.join(root, 'turbo', 'generators', 'config.ts');
            fs.writeFileSync(
                cfg,
                fs.readFileSync(cfg, 'utf8').replace("setGenerator('component'", "setGenerator('widget'"),
                'utf8',
            );

            const missing = checkAll(root, home).filter((c) => c.verdict === 'missing');
            expect(missing).toHaveLength(1);
            expect(missing[0]?.file).toContain('add-ui-component.md');
            expect(missing[0]?.id).toBe('turbo gen component');

            // Restore → passes again. Asserted in the same test so the two states are
            // compared against ONE fixture; two separate tests could pass while disagreeing
            // about what the fixture contains.
            fs.writeFileSync(
                cfg,
                fs.readFileSync(cfg, 'utf8').replace("setGenerator('widget'", "setGenerator('component'"),
                'utf8',
            );
            expect(checkAll(root, home).filter((c) => c.verdict === 'missing')).toEqual([]);
        });
    });

    describe('what it refuses to judge', () => {
        it('reports an Nx or Plop id as unsupported, never as missing', () => {
            // Reporting a real id as missing is the WORSE error: it pushes a correct
            // playbook down to `observed` on the strength of a check that never looked.
            const root = cloneFixture();
            const home = writePlaybook(
                root,
                'add-lib.md',
                CONFIGURED.replace('"turbo gen component"', '"nx g @nx/react:lib"'),
            );
            const checks = checkAll(root, home);
            expect(checks.map((c) => c.verdict)).toEqual(['unsupported']);
        });

        it('ignores an observed playbook entirely', () => {
            // An `observed` playbook already says its steps are unverified. Failing it here
            // would punish the honest grade and reward writing `configured` and hoping.
            const root = cloneFixture();
            const home = writePlaybook(
                root,
                'add-thing.md',
                CONFIGURED.replace('grade: "configured"', 'grade: "observed"').replace(
                    '"turbo gen component"',
                    '"turbo gen absent"',
                ),
            );
            expect(checkAll(root, home)).toEqual([]);
        });

        it('an empty playbook home is a pass, not a crash', () => {
            const root = cloneFixture();
            expect(checkAll(root, path.join(root, 'nowhere'))).toEqual([]);
        });
    });

    describe('resolution kinds', () => {
        it('resolves a declared task and a manifest script, and misses an absent id', () => {
            const root = cloneFixture();
            expect(resolveId(root, 'build', new Map()).verdict).toBe('resolved');
            expect(resolveId(root, 'build', new Map()).where).toBe('turbo.json#tasks');
            expect(resolveId(root, 'new:component', new Map()).where).toBe('package.json#scripts');
            expect(resolveId(root, 'no-such-thing', new Map()).verdict).toBe('missing');
        });

        it('reads the registered generator name, not the filename', () => {
            expect([...registeredGenerators(FIXTURE).keys()]).toEqual(['component']);
        });
    });

    describe('frontmatter reading — both legal list shapes', () => {
        it('reads a block list and an inline list identically', () => {
            const block = parseHead('x.md', CONFIGURED);
            const inline = parseHead(
                'x.md',
                ['---', 'grade: "configured"', 'invokes: ["turbo gen component"]', '---', ''].join('\n'),
            );
            expect(block?.invokes).toEqual(['turbo gen component']);
            expect(inline?.invokes).toEqual(['turbo gen component']);
        });

        it('returns null for a file with no frontmatter', () => {
            expect(parseHead('x.md', '# just a doc\n')).toBeNull();
        });
    });

    describe('the remediation names both options and forbids the third (3.2)', () => {
        it('prints fix-the-id and downgrade-to-observed verbatim, and bans deleting the line', () => {
            expect(REMEDIATION).toContain('Fix the `invokes` id');
            expect(REMEDIATION).toContain('Downgrade the step to `observed`');
            expect(REMEDIATION).toContain('cite the commit');
            expect(REMEDIATION).toContain('Do NOT delete the evidence line');
        });
    });
});
