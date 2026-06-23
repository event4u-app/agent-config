
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as sd from '../../src/scripts/skill_discovery.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_discovery.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const NOW = new Date('2026-05-30T12:00:00Z');

function _catalog(): Map<string, sd.Skill> {
    const m = new Map<string, sd.Skill>();
    m.set('refine-prompt', new sd.Skill('refine-prompt', 'tighten a brief', 'product'));
    m.set('voice-and-tone-design', new sd.Skill('voice-and-tone-design', 'lock voice', 'product'));
    m.set('messaging-architecture', new sd.Skill('messaging-architecture', 'value proof', 'product'));
    m.set('api-design', new sd.Skill('api-design', 'design APIs', 'backend'));
    m.set('threat-modeling', new sd.Skill('threat-modeling', 'abuse cases', 'security'));
    m.set('funnel-analysis', new sd.Skill('funnel-analysis', 'stage discipline', 'product'));
    m.set('stakeholder-tradeoff', new sd.Skill('stakeholder-tradeoff', 'competing pulls', 'product'));
    // product-domain skill NOT in the shortlist → surfaces via related-to-current-task
    m.set('activation-design', new sd.Skill('activation-design', 'aha moment', 'product'));
    return m;
}

function _shortlist(): Array<Record<string, unknown>> {
    return [
        { id: 'refine-prompt', why: 'tightens fuzzy briefs' },
        { id: 'voice-and-tone-design', why: 'locks the deal voice' },
        { id: 'messaging-architecture', why: 'builds value proof' },
        { id: 'funnel-analysis', why: 'stage discipline' },
        { id: 'stakeholder-tradeoff', why: 'competing pulls' },
    ];
}

function _event(skill: string, role = 'sales', days = 1): Record<string, unknown> {
    // datetime(2026, 5, 30 - days, ...).isoformat() → "2026-05-{30-days}T12:00:00Z"
    const day = 30 - days;
    const ts = `2026-05-${String(day).padStart(2, '0')}T12:00:00Z`;
    return {
        ts,
        schema: 'workspace_event/v0',
        event: 'session.completed',
        data: { role, skill },
    };
}

function _recs(
    events: Array<Record<string, unknown>>,
    use_analytics: boolean,
    limit = 3,
): sd.Rec[] {
    return sd.recommend('sales', _catalog(), _shortlist(), events, use_analytics, NOW, limit);
}

describe('skill_discovery — recommend', () => {
    it('every recommendation has nonempty why', () => {
        const recs = _recs([], false);
        expect(recs.length).toBeGreaterThan(0);
        expect(recs.every((r) => r.why && r.why.trim())).toBe(true);
    });

    it('first class is role shortlist', () => {
        const recs = _recs([], false);
        const role_recs = recs.filter((r) => r.cls === 'most-useful-for-role');
        expect(role_recs.length).toBeGreaterThan(0);
        expect(role_recs[0]?.skill).toBe('refine-prompt');
        expect(role_recs[0]?.why).toBe('tightens fuzzy briefs');
    });

    it('related class uses domain signal', () => {
        const recs = _recs([], false);
        const related = recs.filter((r) => r.cls === 'related-to-current-task');
        expect(related.length).toBeGreaterThan(0);
        expect(related.every((r) => r.why.includes('same domain'))).toBe(true);
        const short = new Set(_shortlist().map((s) => s['id']));
        expect(related.every((r) => !short.has(r.skill))).toBe(true);
    });

    it('optout short-circuits to catalog and role', () => {
        const recs = _recs([_event('api-design')], false);
        const analytics_classes = recs.filter(
            (r) => r.cls === 'recently-adopted' || r.cls === 'popular-in-role',
        );
        expect(analytics_classes.length).toBeGreaterThan(0);
        expect(analytics_classes.every((r) => r.why.includes('no local usage signal yet'))).toBe(
            true,
        );
    });

    it('empty analytics degrades gracefully', () => {
        const recs = _recs([], true); // analytics on but zero events
        expect(recs.length).toBeGreaterThan(0);
        const analytics_classes = recs.filter(
            (r) => r.cls === 'recently-adopted' || r.cls === 'popular-in-role',
        );
        expect(analytics_classes.every((r) => r.why.includes('no local usage signal yet'))).toBe(
            true,
        );
    });

    it('analytics signal is used when present', () => {
        const events = [_event('threat-modeling', 'sales', 2), _event('threat-modeling', 'sales', 1)];
        const recs = _recs(events, true);
        const tm = recs.filter((r) => r.skill === 'threat-modeling');
        expect(tm.length).toBeGreaterThan(0);
        expect(tm.some((r) => r.cls === 'recently-adopted' || r.cls === 'popular-in-role')).toBe(
            true,
        );
        expect(
            tm.some(
                (r) => (r.why.includes('used') && r.why.includes('ago')) || r.why.includes('launched'),
            ),
        ).toBe(true);
    });

    it('all four classes reachable', () => {
        const events = [_event('threat-modeling', 'sales', 1)];
        const recs = _recs(events, true);
        const classes = new Set(recs.map((r) => r.cls));
        expect(classes.has('most-useful-for-role')).toBe(true);
        expect(classes.has('related-to-current-task')).toBe(true);
        expect(classes.has('recently-adopted') || classes.has('popular-in-role')).toBe(true);
    });
});

describe('skill_discovery — loaders, render, main (in-process)', () => {
    it('load_catalog reads real skills', () => {
        const cat = sd.load_catalog();
        expect(cat.size).toBeGreaterThan(100);
        expect([...cat.values()].every((s) => s instanceof sd.Skill)).toBe(true);
    });

    it('available_roles and shortlist', () => {
        const roles = sd.available_roles();
        expect(roles.includes('sales')).toBe(true);
        const short = sd.load_role_shortlist('sales');
        expect(short.length).toBeGreaterThan(0);
        expect(short.every((s) => 'id' in s)).toBe(true);
        expect(sd.load_role_shortlist('not-a-role')).toEqual([]);
    });

    it('analytics_enabled env and config', () => {
        const prev = process.env['AGENT_CONFIG_NO_LOCAL_ANALYTICS'];
        delete process.env['AGENT_CONFIG_NO_LOCAL_ANALYTICS'];
        try {
            expect(sd.analytics_enabled({})).toBe(true);
            expect(sd.analytics_enabled({ analytics: { local: 'off' } })).toBe(false);
            process.env['AGENT_CONFIG_NO_LOCAL_ANALYTICS'] = '1';
            expect(sd.analytics_enabled({})).toBe(false);
        } finally {
            if (prev === undefined) delete process.env['AGENT_CONFIG_NO_LOCAL_ANALYTICS'];
            else process.env['AGENT_CONFIG_NO_LOCAL_ANALYTICS'] = prev;
        }
    });

    it('load_analytics_events with fixture', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-'));
        const adir = path.join(tmp, 'workspace', 'analytics');
        fs.mkdirSync(adir, { recursive: true });
        fs.writeFileSync(
            path.join(adir, 'events.jsonl'),
            '{"event":"session.completed","data":{"role":"sales","skill":"api-design"}}\n' +
                'not-json-skip-me\n' +
                '{"event":"x","data":{"role":"sales"}}\n',
            'utf-8',
        );
        const prev = sd._event4u.event4u_root;
        sd._event4u.event4u_root = () => tmp;
        try {
            const events = sd.load_analytics_events();
            expect(events.length).toBe(2); // malformed line skipped, valid lines kept
        } finally {
            sd._event4u.event4u_root = prev;
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('render_text includes analytics note', () => {
        const recs = _recs([], false);
        const txt = sd.render_text('sales', recs, false);
        expect(txt.includes('role shortlist only')).toBe(true);
        expect(txt.includes('| skill | class | why | first command |')).toBe(true);
    });

    it('first_command maps existing command', () => {
        expect(/^(\/|Skill)/.test(sd.first_command('discover'))).toBe(true);
    });

    it('main unknown role returns 2', () => {
        expect(sd.main(['--role', 'definitely-not-a-role'])).toBe(2);
    });

    it('main json happy path', () => {
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout.write as unknown) = (s: string): boolean => {
            out.push(s);
            return true;
        };
        let rc: number;
        try {
            rc = sd.main(['--role', 'sales', '--format', 'json', '--now', '2026-05-30T12:00:00Z']);
        } finally {
            (process.stdout.write as unknown) = orig;
        }
        expect(rc).toBe(0);
        const payload = JSON.parse(out.join('')) as { role: string; recommendations: unknown[] };
        expect(payload.role).toBe('sales');
        expect(payload.recommendations.length).toBeGreaterThan(0);
    });

    it('main text happy path', () => {
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout.write as unknown) = (s: string): boolean => {
            out.push(s);
            return true;
        };
        let rc: number;
        try {
            rc = sd.main(['--role', 'sales', '--now', '2026-05-30T12:00:00Z']);
        } finally {
            (process.stdout.write as unknown) = orig;
        }
        expect(rc).toBe(0);
        expect(out.join('').includes('Suggested skills')).toBe(true);
    });
});
