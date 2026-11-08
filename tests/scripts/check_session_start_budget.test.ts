// road-to-a-session-start-under-the-host-limit 3.1 — the size budget on the
// package-delivered session-start layer.
//
// The arithmetic cases run over hand-made rule directories; one case runs the
// real global install into a scratch HOME, because the gate's claim is about
// what the installer writes, and then inflates one file past the budget.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    HOST_COMBINED_LIMIT,
    REPRESENTATIVE_HOME,
    SESSION_START_BUDGET,
    budgetVerdict,
    defaultInstallEnv,
    homeSpellings,
    main,
    normaliseHome,
    measureSessionStartLayer,
    projectDefaultInstall,
    renderReport,
} from '../../src/scripts/check_session_start_budget.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const made: string[] = [];

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(d);
    return d;
}

afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function rule(dir: string, name: string, text: string): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), text, 'utf8');
}

describe('measureSessionStartLayer', () => {
    it('sums unconditional files whole and leaves path-scoped ones out', () => {
        const dir = path.join(tmp('ssb-'), 'rules');
        const a = '---\npackage: event4u/agent-config\n---\n\n# a\n\nbody a\n';
        const b = '# b\n\nno frontmatter at all, still loaded\n';
        const scoped = '---\npaths:\n  - "**/*.tsx"\n---\n\n# scoped\n\n' + 'x'.repeat(5_000);
        rule(dir, 'a.md', a);
        rule(dir, 'b.md', b);
        rule(dir, 'scoped.md', scoped);
        rule(dir, 'notes.txt', 'not a rule');

        const r = measureSessionStartLayer(dir);
        expect(r.scanned).toBe(3);
        expect(r.total).toBe(a.length + b.length);
        expect(r.files.map((f) => f.file)).toEqual(a.length >= b.length ? ['a.md', 'b.md'] : ['b.md', 'a.md']);
    });

    it('a body line starting `paths:` does not hide a file from the total', () => {
        const dir = path.join(tmp('ssb-'), 'rules');
        const text = '---\npackage: event4u/agent-config\n---\n\npaths: quoted in prose, not a key\n';
        rule(dir, 'quoted.md', text);
        expect(measureSessionStartLayer(dir).total).toBe(text.length);
    });

    it('a missing directory reads as empty, not as an error', () => {
        expect(measureSessionStartLayer(path.join(tmp('ssb-'), 'absent'))).toMatchObject({ scanned: 0, total: 0 });
    });
});

describe('the declared HOME normalisation', () => {
    it('counts every spelling of the measured HOME as the representative one, and keeps the raw total', () => {
        const home = tmp('ssb-a-much-longer-scratch-home-name-');
        const dir = path.join(home, '.claude', 'rules');
        const text = `# stub\n\nBody: ${home}/x/a.md and again ${fs.realpathSync(home)}/x/b.md\n`;
        rule(dir, 'a.md', text);
        const r = measureSessionStartLayer(dir, home);
        expect(r.rawTotal).toBe(text.length);
        const expected = normaliseHome(text, homeSpellings(home));
        expect(expected).toContain(`${REPRESENTATIVE_HOME}/x/a.md`);
        expect(expected).not.toContain(home);
        expect(r.total).toBe(expected.length);
        expect(r.total).toBeLessThan(r.rawTotal);
        expect(renderReport(r, budgetVerdict(r.total)).join('\n')).toContain(`raw total ${r.rawTotal.toLocaleString('en-US')}`);
    });

    it('without a HOME nothing is normalised', () => {
        const dir = path.join(tmp('ssb-'), 'rules');
        rule(dir, 'a.md', '# a\n');
        const r = measureSessionStartLayer(dir);
        expect(r.total).toBe(r.rawTotal);
        expect(r.normalisedFrom).toEqual([]);
    });
});

describe('budgetVerdict', () => {
    it('is green at the budget and red one char above it', () => {
        expect(budgetVerdict(SESSION_START_BUDGET).ok).toBe(true);
        expect(budgetVerdict(SESSION_START_BUDGET + 1).ok).toBe(false);
    });

    it('reports the project allowance against the host limit, negative when over', () => {
        expect(budgetVerdict(70_000).projectAllowance).toBe(HOST_COMBINED_LIMIT - 70_000);
        expect(budgetVerdict(130_000).projectAllowance).toBe(HOST_COMBINED_LIMIT - 130_000);
    });

    it('the report carries the total, the allowance and at most ten files', () => {
        const dir = path.join(tmp('ssb-'), 'rules');
        for (let i = 0; i < 12; i += 1) rule(dir, `r${String(i).padStart(2, '0')}.md`, `# r${i}\n${'y'.repeat(100 * (i + 1))}\n`);
        const reading = measureSessionStartLayer(dir);
        const lines = renderReport(reading, budgetVerdict(reading.total));
        expect(lines[0]).toContain(reading.total.toLocaleString('en-US'));
        expect(lines[1]).toContain((HOST_COMBINED_LIMIT - reading.total).toLocaleString('en-US'));
        const listed = lines.filter((l) => /^\s+\d+\s+r\d\d\.md$/.test(l));
        expect(listed).toHaveLength(10);
        expect(listed[0]).toContain('r11.md');
    });
});

describe('the gate CLI over a HOME', () => {
    it('one file inflated past the budget turns a green HOME red', () => {
        const home = tmp('ssb-home-');
        const rules = path.join(home, '.claude', 'rules');
        rule(rules, 'small.md', '# small\n\nfits\n');
        expect(main(['--home', home, '--quiet'])).toBe(0);
        rule(rules, 'small.md', `# small\n\n${'z'.repeat(SESSION_START_BUDGET)}\n`);
        expect(main(['--home', home, '--quiet'])).toBe(1);
    });

    it('refuses an unknown flag with the usage exit', () => {
        expect(main(['--nope'])).toBe(2);
    });

    it('the projection environment drops every package redirect and opt-in', () => {
        const env = defaultInstallEnv('/scratch/home', {
            PATH: '/usr/bin',
            AGENT_CONFIG_DEV_MODE: '1',
            AGENT_CONFIG_DEPLOY_INVENTORY: '/elsewhere.json',
            EVENT4U_CONFIG_HOME: '/real/home/.event4u/agent-config',
        });
        expect(env['AGENT_CONFIG_DEV_MODE']).toBeUndefined();
        expect(env['AGENT_CONFIG_DEPLOY_INVENTORY']).toBeUndefined();
        expect(env['EVENT4U_CONFIG_HOME']).toBe(path.join('/scratch/home', '.event4u', 'agent-config'));
        expect(env['HOME']).toBe('/scratch/home');
        expect(env['PATH']).toBe('/usr/bin');
    });
});

describe('a real default install into a scratch HOME', () => {
    it('is measured, thinned on a reached carrier, and goes red when one installed file is inflated', () => {
        const home = tmp('ssb-install-');
        const res = projectDefaultInstall(REPO, home);
        expect(res.ok, res.output.slice(-2000)).toBe(true);
        expect(res.carrier).toBe('reached');
        expect(res.layer).toBe('thinned');

        const rules = path.join(home, '.claude', 'rules');
        const reading = measureSessionStartLayer(rules);
        expect(reading.scanned).toBeGreaterThan(50);
        expect(reading.total).toBeGreaterThan(0);

        const victim = reading.files[reading.files.length - 1]?.file as string;
        fs.appendFileSync(path.join(rules, victim), 'w'.repeat(SESSION_START_BUDGET + 1));
        expect(main(['--home', home, '--quiet'])).toBe(1);
    }, 300_000);
});
