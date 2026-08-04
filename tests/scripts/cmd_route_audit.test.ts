// Behavioural tests for `agent-config route:audit` — the audit table, the
// opt-in recorder (PII-excluded by construction), and the --weekly render.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    audit_prompts,
    build_records,
    append_records,
    render_weekly,
    load_user_prompts,
    MEASUREMENT_HEADER,
    PREREG_AUTHORITY_LINE,
    RECORD_SCHEMA_VERSION,
} from '../../src/scripts/_cli/cmd_route_audit.js';
import type { Router } from '../../src/scripts/_lib/router_match.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ROUTER: Router = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'dist', 'router.json'), 'utf-8'),
) as Router;

const tmpdirs: string[] = [];
function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'route-audit-'));
    tmpdirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpdirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    delete process.env['AGENT_CONFIG_REPLAY'];
});

describe('audit_prompts', () => {
    it('matches per prompt via the shared matcher, sorted by rule id', () => {
        const [a] = audit_prompts(ROUTER, ['refactor the controller']);
        const ids = a!.matched.map((m) => m.rule);
        expect(ids).toContain('architecture');
        expect(ids).toEqual([...ids].sort());
        expect(a!.matched.every((m) => m.triggers.length > 0)).toBe(true);
    });

    it('a no-trigger prompt yields an empty match list (kernel-only)', () => {
        const [a] = audit_prompts(ROUTER, ['xyzzy blorp quux']);
        expect(a!.matched).toEqual([]);
    });
});

describe('recorder — PII-excluded by construction', () => {
    const SECRET_PROMPT = 'my password is Hunter2 and my email is max@example.com — refactor the controller';

    it('records carry a truncated digest and matched labels, NEVER the prompt text', () => {
        const audits = audit_prompts(ROUTER, [SECRET_PROMPT]);
        const records = build_records(audits, '2026-08-04T12:00:00.000Z');
        expect(records).toHaveLength(1);
        const rec = records[0] as Record<string, unknown>;
        expect(rec['schema_version']).toBe(RECORD_SCHEMA_VERSION);
        expect(String(rec['prompt_sha16'])).toMatch(/^[0-9a-f]{16}$/);
        const flat = JSON.stringify(rec);
        expect(flat).not.toContain('Hunter2');
        expect(flat).not.toContain('max@example.com');
        expect(flat).not.toContain('my password is');
        // Closed field set — no free-form content field exists in the schema.
        expect(Object.keys(rec).sort()).toEqual([
            'enforcement_trips',
            'matched',
            'prompt_sha16',
            'schema_version',
            'ts',
        ]);
    });

    it('append + delete-and-rerun rebuilds the same records (state-store test)', () => {
        const target = path.join(tmpdir(), 'routing-telemetry.jsonl');
        const audits = audit_prompts(ROUTER, ['refactor the controller', 'fix the login endpoint']);
        const records = build_records(audits, '2026-08-04T12:00:00.000Z');
        expect(append_records(records, target)).toBe(2);
        const first = fs.readFileSync(target, 'utf-8');
        fs.rmSync(target);
        append_records(build_records(audits, '2026-08-04T12:00:00.000Z'), target);
        expect(fs.readFileSync(target, 'utf-8')).toBe(first);
    });

    it('replay mode writes nothing (AGENT_CONFIG_REPLAY=1)', () => {
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        const target = path.join(tmpdir(), 'routing-telemetry.jsonl');
        const audits = audit_prompts(ROUTER, ['refactor the controller']);
        expect(append_records(build_records(audits, '2026-08-04T12:00:00.000Z'), target)).toBe(0);
        expect(fs.existsSync(target)).toBe(false);
    });
});

describe('--weekly render', () => {
    it('golden: aggregates the 7-day window per rule and cites the PREREG as resolver authority', () => {
        const target = path.join(tmpdir(), 'routing-telemetry.jsonl');
        const now = new Date('2026-08-04T12:00:00.000Z');
        const recent = (rule: string) =>
            JSON.stringify({
                schema_version: 1,
                ts: '2026-08-02T09:00:00.000Z',
                prompt_sha16: '0123456789abcdef',
                matched: [{ rule, tier: 'tier-1', triggers: ['keyword: x'] }],
                enforcement_trips: {},
            });
        const stale = JSON.stringify({
            schema_version: 1,
            ts: '2026-07-01T09:00:00.000Z',
            prompt_sha16: 'fedcba9876543210',
            matched: [{ rule: 'stale-rule', tier: 'tier-2', triggers: ['keyword: y'] }],
            enforcement_trips: {},
        });
        fs.writeFileSync(target, [recent('architecture'), recent('architecture'), recent('php-coding'), stale].join('\n') + '\n');
        const { text, records } = render_weekly(target, now);
        expect(records).toBe(3);
        expect(text.split('\n')[0]).toBe(MEASUREMENT_HEADER);
        const expected = [
            MEASUREMENT_HEADER,
            '',
            'routing recorder — rolling 7-day window (3 recorded prompt(s))',
            '     2 × architecture',
            '     1 × php-coding',
            '',
            PREREG_AUTHORITY_LINE,
            '',
        ].join('\n');
        expect(text).toBe(expected);
        expect(text).not.toContain('stale-rule');
    });

    it('empty window renders the enablement hint and reports zero records', () => {
        const target = path.join(tmpdir(), 'missing.jsonl');
        const { text, records } = render_weekly(target, new Date('2026-08-04T12:00:00.000Z'));
        expect(records).toBe(0);
        expect(text).toContain('no records in the window');
        expect(text).toContain(PREREG_AUTHORITY_LINE);
    });
});

describe('load_user_prompts', () => {
    it('filters host-injected meta turns and keeps the last N user prompts', () => {
        const dir = tmpdir();
        const p = path.join(dir, '.agent-chat-history');
        const header = JSON.stringify({ t: 'header', schema_version: 4, started: '2026-08-04', freq: 'per_turn' });
        const mk = (t: string, text: string) => JSON.stringify({ t, text, s: 'abcd', ts: '2026-08-04T10:00:00Z', agent: 'claude' });
        fs.writeFileSync(
            p,
            [
                header,
                mk('user', '<system-reminder>meta</system-reminder>'),
                mk('user', 'Caveat: local command'),
                mk('agent', 'not a prompt'),
                mk('user', 'first real prompt'),
                mk('user', 'second real prompt'),
                mk('user', 'third real prompt'),
            ].join('\n') + '\n',
        );
        expect(load_user_prompts(2, p)).toEqual(['second real prompt', 'third real prompt']);
    });

    it('missing log → empty list', () => {
        expect(load_user_prompts(5, path.join(tmpdir(), 'nope'))).toEqual([]);
    });
});
