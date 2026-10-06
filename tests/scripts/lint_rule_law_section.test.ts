/**
 * The three axes of `lint_rule_law_section`, each proved both ways.
 *
 * Every block runs the gate against the REAL default tree as well as a fixture
 * root. A fixture-only test proves the algorithm and not the gate: the 2026-07-29
 * sweep found fourteen gates whose tests passed against an injected root while
 * the production entry point scanned a directory that no longer existed.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    BODY_HARD_CHARS,
    LAW_HARD_CHARS,
    LAW_TARGET_CHARS,
    lint,
    measureRouted,
    readConfig,
    routedRuleIds,
    selfTest,
    writeBaseline,
} from '../../src/scripts/lint_rule_law_section.js';
import { lawSections, lawText, ruleBody } from '../../src/scripts/_lib/rule_law_section.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** A throwaway tree with a router, a config and whatever rule files are given. */
function fixture(rules: Record<string, string>, cfg: Record<string, unknown> = {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'law-fixture-'));
    fs.mkdirSync(path.join(root, 'src', 'rules'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'dist', 'router.json'),
        JSON.stringify({ kernel: [], tier_1: Object.keys(rules).map((id) => ({ id })), tier_2: [] }),
    );
    fs.writeFileSync(
        path.join(root, 'src', 'config', 'rule-law-ceilings.json'),
        JSON.stringify({ missing: [], law_exceptions: {}, body_exceptions: {}, ...cfg }),
    );
    for (const [id, text] of Object.entries(rules)) {
        fs.writeFileSync(path.join(root, 'src', 'rules', `${id}.md`), text);
    }
    return root;
}

const FM = '---\ntype: "auto"\n---\n\n';

describe('rule law section — extraction', () => {
    it('ends a law section at the next heading of the same or shallower depth', () => {
        const body = ruleBody(
            `${FM}# R\n\n## The Iron Law\n\nLAW ONE.\n\n### A sub-point\n\nStill the law.\n\n## After\n\nNot the law.\n`,
        );
        const sections = lawSections(body);
        expect(sections).toHaveLength(1);
        expect(sections[0]?.text).toContain('Still the law.');
        expect(sections[0]?.text).not.toContain('Not the law.');
    });

    it('joins every law section, so a rule with three laws does not lose two', () => {
        const body = ruleBody(
            `${FM}# R\n\n## Iron Law 1\n\nONE.\n\n## Middle\n\nx\n\n## Iron Law 2\n\nTWO.\n\n## Iron Law 3\n\nTHREE.\n`,
        );
        expect(lawSections(body)).toHaveLength(3);
        const law = lawText(body) as string;
        expect(law).toContain('ONE.');
        expect(law).toContain('TWO.');
        expect(law).toContain('THREE.');
        expect(law).not.toContain('## Middle');
    });

    it('ignores an Iron-Law heading inside a fenced block', () => {
        const body = ruleBody(`${FM}# R\n\n\`\`\`\n## The Iron Law\n\`\`\`\n\nProse.\n`);
        expect(lawText(body)).toBeNull();
    });

    it('strips HTML comments from the body it prices', () => {
        const body = ruleBody(`${FM}# R\n\n<!-- ${'x'.repeat(500)} -->\n\nShort.\n`);
        expect(body.length).toBeLessThan(100);
    });
});

describe('presence axis', () => {
    it('is clean over the real tree', () => {
        const res = lint(REPO_ROOT, 'presence');
        expect(res.findings).toEqual([]);
    });

    it('scans the whole routed corpus, not a subset', () => {
        const res = lint(REPO_ROOT, 'presence');
        expect(res.scanned).toBe(routedRuleIds(REPO_ROOT).length);
        expect(res.scanned).toBeGreaterThan(90);
    });

    it('fails a routed rule with no law section that is not baselined', () => {
        const root = fixture({ lawless: `${FM}# Lawless\n\nProse only.\n` });
        const res = lint(root, 'presence');
        expect(res.findings.map((f) => f.kind)).toEqual(['no-law-section']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('accepts the same rule once it is in the shrink-only baseline', () => {
        const root = fixture({ lawless: `${FM}# Lawless\n\nProse only.\n` }, { missing: ['lawless'] });
        expect(lint(root, 'presence').findings).toEqual([]);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('reports a baseline entry that has since grown a law section, so debt paid is collected', () => {
        const root = fixture(
            { fixed: `${FM}# Fixed\n\n## The Iron Law\n\nNEVER.\n` },
            { missing: ['fixed'] },
        );
        const res = lint(root, 'presence');
        expect(res.findings.map((f) => f.kind)).toEqual(['stale-baseline-entry']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('every id in the committed baseline is a routed rule that really lacks a law', () => {
        const cfg = readConfig(REPO_ROOT);
        const byId = new Map(measureRouted(REPO_ROOT).map((m) => [m.id, m]));
        for (const id of cfg.missing) {
            expect(byId.has(id), `${id} is in \`missing\` but is not routed`).toBe(true);
            expect(byId.get(id)?.law, `${id} is in \`missing\` but has a law section`).toBeNull();
        }
    });
});

describe('ceiling', () => {
    it('is clean over the real tree', () => {
        expect(lint(REPO_ROOT, 'ceiling').findings).toEqual([]);
    });

    it('fails a law section over the hard ceiling with no exception', () => {
        const root = fixture({
            fat: `${FM}# Fat\n\n## The Iron Law\n\n${'LAW. '.repeat(LAW_HARD_CHARS / 4)}\n`,
        });
        const res = lint(root, 'ceiling');
        expect(res.findings.map((f) => f.kind)).toEqual(['law-over-hard-ceiling']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('accepts it under a recorded exception, and refuses growth past that exception', () => {
        const text = `${FM}# Fat\n\n## The Iron Law\n\n${'LAW. '.repeat(LAW_HARD_CHARS / 4)}\n`;
        const at = (lawText(ruleBody(text)) as string).length;
        const okRoot = fixture(
            { fat: text },
            { law_exceptions: { fat: { chars: at, owner: 'o', review: '2026-12-01', reason: 'r' } } },
        );
        expect(lint(okRoot, 'ceiling').findings).toEqual([]);
        fs.rmSync(okRoot, { recursive: true, force: true });

        const grownRoot = fixture(
            { fat: text },
            { law_exceptions: { fat: { chars: at - 1, owner: 'o', review: '2026-12-01', reason: 'r' } } },
        );
        expect(lint(grownRoot, 'ceiling').findings.map((f) => f.kind)).toEqual(['law-exception-grew']);
        fs.rmSync(grownRoot, { recursive: true, force: true });
    });

    it('reports the soft target without failing on it', () => {
        const root = fixture({
            mid: `${FM}# Mid\n\n## The Iron Law\n\n${'LAW. '.repeat(LAW_TARGET_CHARS / 4)}\n`,
        });
        const res = lint(root, 'ceiling');
        expect(res.findings).toEqual([]);
        expect(res.overTarget.map((t) => t.id)).toEqual(['mid']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('every recorded law exception is above the hard ceiling and still needed', () => {
        const cfg = readConfig(REPO_ROOT);
        const byId = new Map(measureRouted(REPO_ROOT).map((m) => [m.id, m]));
        for (const [id, exc] of Object.entries(cfg.law_exceptions)) {
            expect(exc.chars, `${id} exception is below the hard ceiling — delete it`).toBeGreaterThan(
                LAW_HARD_CHARS,
            );
            expect(exc.reason.length, `${id} needs a real reason`).toBeGreaterThan(40);
            expect(exc.review).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(byId.get(id)?.lawChars ?? 0).toBeLessThanOrEqual(exc.chars);
        }
    });
});

describe('trigger axis', () => {
    it('is clean over the real tree', () => {
        expect(lint(REPO_ROOT, 'trigger').findings).toEqual([]);
    });

    it('fails a routed rule with no trigger that is not baselined', () => {
        const root = fixture({ mute: `${FM}# Mute\n\n## The Iron Law\n\nNEVER.\n` });
        const res = lint(root, 'trigger');
        expect(res.findings.map((f) => f.kind)).toEqual(['no-trigger']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('accepts the same rule once it is in the shrink-only `no_trigger` baseline', () => {
        const root = fixture(
            { mute: `${FM}# Mute\n\n## The Iron Law\n\nNEVER.\n` },
            { no_trigger: ['mute'] },
        );
        expect(lint(root, 'trigger').findings).toEqual([]);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('reports a baseline entry that has since gained a trigger, so debt paid is collected', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'law-fixture-'));
        fs.mkdirSync(path.join(root, 'src', 'rules'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
        fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'dist', 'router.json'),
            JSON.stringify({ kernel: [], tier_1: [{ id: 'vocal', triggers: [{ keyword: 'v' }] }], tier_2: [] }),
        );
        fs.writeFileSync(
            path.join(root, 'src', 'config', 'rule-law-ceilings.json'),
            JSON.stringify({ missing: [], no_trigger: ['vocal'], law_exceptions: {}, body_exceptions: {} }),
        );
        fs.writeFileSync(
            path.join(root, 'src', 'rules', 'vocal.md'),
            `${FM}# Vocal\n\n## The Iron Law\n\nNEVER.\n`,
        );
        const res = lint(root, 'trigger');
        expect(res.findings.map((f) => f.kind)).toEqual(['stale-baseline-entry']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('every id in the committed `no_trigger` baseline is a routed rule that really has none', () => {
        const cfg = readConfig(REPO_ROOT);
        const router = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'dist', 'router.json'), 'utf-8'),
        ) as { tier_1: Array<{ id: string; triggers?: unknown[] }>; tier_2: Array<{ id: string; triggers?: unknown[] }> };
        const triggerCounts = new Map<string, number>();
        for (const e of [...router.tier_1, ...router.tier_2]) {
            triggerCounts.set(e.id, Array.isArray(e.triggers) ? e.triggers.length : 0);
        }
        for (const id of cfg.no_trigger) {
            expect(triggerCounts.has(id), `${id} is in \`no_trigger\` but is not a routed rule`).toBe(true);
            expect(
                triggerCounts.get(id),
                `${id} is in \`no_trigger\` but now has a trigger`,
            ).toBe(0);
        }
    });
});

// Step 3.4 of `road-to-an-installed-layer-that-is-thinned`: a new routed rule
// must clear BOTH axes at once — a law section under the hard ceiling AND a
// trigger a prompt can fire. Neither axis alone proves the combined claim: a
// rule could pass `presence`+`ceiling` with zero triggers, or pass `trigger`
// with no law section at all.
describe('new-rule', () => {
    it('a brand-new routed rule with a law section and a trigger declares its cost and passes clean', () => {
        const root = fixture(
            { fresh: `${FM}# Fresh\n\n## The Iron Law\n\nNEVER SHIP WITHOUT A COST.\n` },
            {},
        );
        // Give it a real trigger — `fixture()` leaves tier entries trigger-less
        // by default, which is exactly the shape step 3.4 must reject.
        const router = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'router.json'), 'utf-8')) as {
            tier_1: Array<{ id: string; triggers?: unknown[] }>;
        };
        for (const e of router.tier_1) e.triggers = [{ keyword: 'fresh-word' }];
        fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(router));

        expect(lint(root, 'all').findings).toEqual([]);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('a new routed rule with no law section and no trigger fails on BOTH axes at once', () => {
        const root = fixture({ raw: `${FM}# Raw\n\nJust prose, no law, no trigger.\n` });
        const res = lint(root, 'all');
        expect(res.findings.map((f) => f.axis).sort()).toEqual(['presence', 'trigger']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('a law section at or over the 2,000-char hard ceiling still fails even with a trigger', () => {
        const root = fixture({
            heavy: `${FM}# Heavy\n\n## The Iron Law\n\n${'LAW. '.repeat(LAW_HARD_CHARS / 4)}\n`,
        });
        const router = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'router.json'), 'utf-8')) as {
            tier_1: Array<{ id: string; triggers?: unknown[] }>;
        };
        for (const e of router.tier_1) e.triggers = [{ keyword: 'heavy-word' }];
        fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(router));

        const res = lint(root, 'all');
        expect(res.findings.map((f) => f.kind)).toEqual(['law-over-hard-ceiling']);
        fs.rmSync(root, { recursive: true, force: true });
    });
});

describe('body-ceiling', () => {
    it('is clean over the real tree', () => {
        expect(lint(REPO_ROOT, 'body-ceiling').findings).toEqual([]);
    });

    it('fails a body over the hard ceiling with no exception', () => {
        const root = fixture({ fat: `${FM}# Fat\n\n${'word '.repeat(BODY_HARD_CHARS / 4)}\n` });
        expect(lint(root, 'body-ceiling').findings.map((f) => f.kind)).toEqual(['body-over-hard-ceiling']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('accepts it under a recorded exception and refuses growth past it', () => {
        const text = `${FM}# Fat\n\n${'word '.repeat(BODY_HARD_CHARS / 4)}\n`;
        const at = ruleBody(text).length;
        const okRoot = fixture(
            { fat: text },
            { body_exceptions: { fat: { chars: at, owner: 'o', review: '2026-12-01', reason: 'r' } } },
        );
        expect(lint(okRoot, 'body-ceiling').findings).toEqual([]);
        fs.rmSync(okRoot, { recursive: true, force: true });

        const grownRoot = fixture(
            { fat: text },
            { body_exceptions: { fat: { chars: at - 1, owner: 'o', review: '2026-12-01', reason: 'r' } } },
        );
        expect(lint(grownRoot, 'body-ceiling').findings.map((f) => f.kind)).toEqual(['body-exception-grew']);
        fs.rmSync(grownRoot, { recursive: true, force: true });
    });

    it('every recorded body exception is above the hard ceiling and the rule sits under it', () => {
        const cfg = readConfig(REPO_ROOT);
        const byId = new Map(measureRouted(REPO_ROOT).map((m) => [m.id, m]));
        for (const [id, exc] of Object.entries(cfg.body_exceptions)) {
            expect(exc.chars, `${id} body exception is below the ceiling — delete it`).toBeGreaterThan(
                BODY_HARD_CHARS,
            );
            expect(exc.reason.length, `${id} needs a real reason`).toBeGreaterThan(40);
            expect(byId.get(id)?.bodyChars ?? 0).toBeLessThanOrEqual(exc.chars);
        }
    });
});

describe('the baseline writer never raises a ceiling', () => {
    it('re-records the smaller of the committed value and the current one', () => {
        const text = `${FM}# Fat\n\n## The Iron Law\n\n${'LAW. '.repeat(LAW_HARD_CHARS / 4)}\n`;
        const at = (lawText(ruleBody(text)) as string).length;
        const root = fixture(
            { fat: text },
            { law_exceptions: { fat: { chars: at - 50, owner: 'o', review: '2026-01-01', reason: 'r' } } },
        );
        writeBaseline(root, '2026-10-02');
        const cfg = readConfig(root);
        expect(cfg.law_exceptions.fat?.chars).toBe(at - 50);
        expect(cfg.law_exceptions.fat?.review).toBe('2026-01-01');
        fs.rmSync(root, { recursive: true, force: true });
    });
});

describe('self-test', () => {
    it('passes — the gate has at least one rejecting and one accepting case', () => {
        expect(selfTest(() => {})).toBe(0);
    });
});
