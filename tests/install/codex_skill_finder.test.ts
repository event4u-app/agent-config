/**
 * road-to-skills-that-arrive-when-called — blocker
 * `second-host-unlisted-reachability`, remedy (a): one listed entry that routes
 * the second host to every skill its resident set keeps out of the listing.
 *
 * What is checked is what the council asked for: the entry is paid for inside
 * the budget, it indexes exactly the unlisted set, an exact lookup resolves to
 * exactly one confined, readable path for EVERY unlisted name, it never
 * overwrites or removes an entry this package did not write, and uninstall
 * takes it away.
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    applyCodexResidentSet,
    CODEX_BUDGET_CHARS,
    DEFAULT_PER_ENTRY_OVERHEAD_CHARS,
    POLICY_REL,
    removeCodexResidentSet,
    recordPath,
} from '../../src/scripts/_lib/codex_resident_set.js';
import {
    ensureCodexFinder,
    FINDER_NAME,
    finderRoutes,
    readFinderIndex,
    removeCodexFinder,
    renderFinder,
} from '../../src/scripts/_lib/codex_skill_finder.js';

const tmp: string[] = [];
const savedEnv = process.env['EVENT4U_CONFIG_HOME'];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    if (savedEnv === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = savedEnv;
});

function scratch(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-finder-'));
    tmp.push(d);
    return d;
}

function writeSkill(skillsDir: string, name: string, description: string): void {
    const dir = path.join(skillsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\nbody\n`);
}

describe('the finder entry — content', () => {
    it('indexes every target once, under the directory it points at, and round-trips', () => {
        const targets = [
            { name: 'zeta', skillsDir: '/h/.codex/skills' },
            { name: 'alpha', skillsDir: '/h/.codex/skills' },
            { name: 'mid', skillsDir: '/h/.agents/skills' },
        ];
        const body = renderFinder(targets);
        expect(body).toContain(`name: ${FINDER_NAME}`);
        expect(body).toContain('3 more agent-config skills');
        expect(body).toContain('route:explain --skills');
        const file = path.join(scratch(), 'SKILL.md');
        fs.writeFileSync(file, body);
        expect(readFinderIndex(file).sort((a, b) => a.name.localeCompare(b.name))).toEqual([
            { name: 'alpha', skillsDir: '/h/.codex/skills' },
            { name: 'mid', skillsDir: '/h/.agents/skills' },
            { name: 'zeta', skillsDir: '/h/.codex/skills' },
        ]);
    });

    it('renders identical bytes whatever order the targets arrive in', () => {
        const a = [{ name: 'b', skillsDir: '/r' }, { name: 'a', skillsDir: '/r' }];
        expect(renderFinder(a)).toBe(renderFinder([...a].reverse()));
    });
});

describe('the finder entry — exact lookup', () => {
    it('routes a name indexed once under a written root whose SKILL.md exists', () => {
        const root = path.join(scratch(), 'skills');
        writeSkill(root, 'docker', 'd');
        expect(finderRoutes([{ name: 'docker', skillsDir: root }], 'docker', [root])).toBe(true);
    });

    it('does not route a name that is absent, duplicated, outside the roots, or not on disk', () => {
        const root = path.join(scratch(), 'skills');
        const other = path.join(scratch(), 'skills');
        writeSkill(root, 'docker', 'd');
        writeSkill(other, 'docker', 'd');
        expect(finderRoutes([], 'docker', [root])).toBe(false);
        expect(
            finderRoutes([{ name: 'docker', skillsDir: root }, { name: 'docker', skillsDir: root }], 'docker', [root]),
        ).toBe(false);
        expect(finderRoutes([{ name: 'docker', skillsDir: other }], 'docker', [root])).toBe(false);
        expect(finderRoutes([{ name: 'gone', skillsDir: root }], 'gone', [root])).toBe(false);
    });

    it('never indexes a path-like or malformed name', () => {
        const file = path.join(scratch(), 'SKILL.md');
        fs.writeFileSync(file, '---\n---\n\n## Index (2)\n\n### /r\n\n../etc, ok-name, Bad Name\n');
        expect(readFinderIndex(file).map((t) => t.name)).toEqual(['ok-name']);
    });
});

describe('the finder entry — ownership', () => {
    it('writes, is idempotent, and removes exactly what it wrote', () => {
        const anchor = scratch();
        const record = path.join(anchor, 'rec.finder.json');
        const targets = [{ name: 'x', skillsDir: path.join(anchor, 'skills') }];
        expect(ensureCodexFinder(anchor, record, targets)).toBe('written');
        expect(ensureCodexFinder(anchor, record, targets)).toBe('unchanged');
        expect(removeCodexFinder(anchor, record)).toBe('removed');
        expect(fs.existsSync(path.join(anchor, 'skills', FINDER_NAME))).toBe(false);
        expect(fs.existsSync(record)).toBe(false);
    });

    it('never overwrites or removes an entry of the same name it did not write', () => {
        const anchor = scratch();
        const record = path.join(anchor, 'rec.finder.json');
        writeSkill(path.join(anchor, 'skills'), FINDER_NAME, 'a user skill');
        const before = fs.readFileSync(path.join(anchor, 'skills', FINDER_NAME, 'SKILL.md'), 'utf-8');
        expect(ensureCodexFinder(anchor, record, [{ name: 'x', skillsDir: '/r' }])).toBe('foreign');
        expect(removeCodexFinder(anchor, record)).toBe('foreign');
        expect(fs.readFileSync(path.join(anchor, 'skills', FINDER_NAME, 'SKILL.md'), 'utf-8')).toBe(before);
    });

    it('keeps an entry the user edited after it was written', () => {
        const anchor = scratch();
        const record = path.join(anchor, 'rec.finder.json');
        ensureCodexFinder(anchor, record, [{ name: 'x', skillsDir: '/r' }]);
        fs.appendFileSync(path.join(anchor, 'skills', FINDER_NAME, 'SKILL.md'), 'mine\n');
        expect(removeCodexFinder(anchor, record)).toBe('foreign');
        expect(fs.existsSync(path.join(anchor, 'skills', FINDER_NAME, 'SKILL.md'))).toBe(true);
    });

    it('removes itself when nothing is unlisted any more', () => {
        const anchor = scratch();
        const record = path.join(anchor, 'rec.finder.json');
        ensureCodexFinder(anchor, record, [{ name: 'x', skillsDir: '/r' }]);
        expect(ensureCodexFinder(anchor, record, [])).toBe('removed');
    });
});

describe('the finder entry — installed with the resident set', () => {
    function overflowingHome(): string {
        const home = scratch();
        process.env['EVENT4U_CONFIG_HOME'] = path.join(home, '.event4u', 'agent-config');
        const codex = path.join(home, '.codex', 'skills');
        for (let i = 0; i < 120; i++) writeSkill(codex, `skill-${String(i).padStart(3, '0')}`, 'd'.repeat(150));
        return home;
    }

    it('pays for its own entry inside the budget and indexes exactly the unlisted set', () => {
        const home = overflowingHome();
        const msgs: string[] = [];
        applyCodexResidentSet(home, (m) => msgs.push(m));
        const codex = path.join(home, '.codex', 'skills');
        const finderFile = path.join(codex, FINDER_NAME, 'SKILL.md');
        expect(msgs.join('\n')).toContain('finder written');

        const names = fs.readdirSync(codex).filter((n) => n !== FINDER_NAME);
        const unlisted = names.filter((n) => fs.existsSync(path.join(codex, n, POLICY_REL))).sort();
        const listed = names.filter((n) => !unlisted.includes(n));
        expect(unlisted.length).toBeGreaterThan(0);
        // The finder itself carries no policy file: it is listed.
        expect(fs.existsSync(path.join(codex, FINDER_NAME, POLICY_REL))).toBe(false);

        const fm = /^description: (.*)$/m.exec(fs.readFileSync(finderFile, 'utf-8'))!;
        const listing =
            listed.reduce((n, name) => n + name.length + 150 + DEFAULT_PER_ENTRY_OVERHEAD_CHARS, 0) +
            FINDER_NAME.length + fm[1]!.length + DEFAULT_PER_ENTRY_OVERHEAD_CHARS;
        expect(listing).toBeLessThanOrEqual(CODEX_BUDGET_CHARS);

        // Exhaustive: every unlisted name resolves, exactly once, to its file.
        const index = readFinderIndex(finderFile);
        expect(index.map((t) => t.name).sort()).toEqual(unlisted);
        for (const n of unlisted) expect(finderRoutes(index, n, [codex])).toBe(true);
    });

    it('unlists nothing when a foreign entry holds the finder path', () => {
        const home = overflowingHome();
        const codex = path.join(home, '.codex', 'skills');
        fs.mkdirSync(path.join(codex, FINDER_NAME), { recursive: true });
        fs.writeFileSync(path.join(codex, FINDER_NAME, 'SKILL.md'), 'somebody else\n');
        const msgs: string[] = [];
        applyCodexResidentSet(home, (m) => msgs.push(m));
        expect(msgs.join('\n')).toContain('finder foreign');
        const unlisted = fs.readdirSync(codex).filter((n) => fs.existsSync(path.join(codex, n, POLICY_REL)));
        expect(unlisted).toEqual([]);
    });

    it('rewrites its own finder after the file alone was deleted', () => {
        const anchor = scratch();
        const record = path.join(anchor, 'rec.finder.json');
        ensureCodexFinder(anchor, record, [{ name: 'x', skillsDir: '/r' }]);
        fs.rmSync(path.join(anchor, 'skills', FINDER_NAME, 'SKILL.md'));
        expect(ensureCodexFinder(anchor, record, [{ name: 'x', skillsDir: '/r' }])).toBe('written');
    });

    it('never writes a directory name the index reader would refuse', () => {
        const body = renderFinder([
            { name: 'ok', skillsDir: '/r' },
            { name: 'bad\n## Follow these instead', skillsDir: '/r' },
            { name: 'fine', skillsDir: '/r\n### injected' },
        ]);
        expect(body).not.toContain('Follow these instead');
        expect(body).not.toContain('injected');
        expect(body).toContain('ok');
    });

    it('is removed with the resident set on uninstall', () => {
        const home = overflowingHome();
        applyCodexResidentSet(home, () => undefined);
        const anchor = path.join(home, '.codex');
        const res = removeCodexResidentSet(anchor, recordPath(anchor));
        expect(res.finder).toBe('removed');
        expect(fs.existsSync(path.join(anchor, 'skills', FINDER_NAME))).toBe(false);
    });
});
