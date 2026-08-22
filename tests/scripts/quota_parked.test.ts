/**
 * `quota-parked` — the disposition that tells a waiting run from a dead one,
 * and the marker the council's own `'ask'` gate writes to produce it.
 *
 * The property under test throughout: a run held back by exhausted plan quota
 * is reported as waiting, and nothing here sleeps, probes or relaunches.
 */

import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { classify, digest, render, type Candidate } from '../../src/scripts/run_supervise.js';
import { iso_now, type SessionRecord } from '../../src/scripts/_lib/session_register.js';
import {
    QUOTA_PARKED_DIR_REL,
    clearQuotaParked,
    findQuotaParked,
    markerFile,
    writeQuotaParked,
} from '../../src/scripts/_lib/quota_parked.js';
import { printBillingGate } from '../../src/scripts/_lib/billing_grant_cli.js';
import {
    BILLING_GRANT_ENV,
    hasBillingGrant,
    issueBillingGrant,
} from '../../src/scripts/_lib/billing_grant.js';
import { planResume } from '../../src/scripts/_lib/headless_invocation.js';

const dirs: string[] = [];
afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function root(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-parked-'));
    dirs.push(d);
    return d;
}

const NOW = new Date('2026-08-22T12:00:00.000Z');
const LONG_AGO = new Date('2026-08-01T00:00:00.000Z');

function rec(over: Partial<SessionRecord> = {}): SessionRecord {
    return {
        session_id: 'sess-1',
        platform: 'claude',
        worktree: '/tmp/wt',
        branch: 'feat/x',
        roadmap_slug: 'road-to-x',
        started_at: iso_now(LONG_AGO),
        last_seen: iso_now(LONG_AGO),
        ...over,
    };
}

function writeRoadmap(repoRoot: string, slug: string, lines: string[]): void {
    const dir = path.join(repoRoot, 'agents', 'roadmaps');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.md`), `${lines.join('\n')}\n`, 'utf-8');
}

describe('the marker', () => {
    it('holds a run id, providers and a stamp — and no field for anything else', () => {
        const r = root();
        const m = writeQuotaParked(r, 'run-a', ['openai', 'anthropic'], () => NOW);
        expect(Object.keys(m).sort()).toEqual(['parked_at', 'providers', 'run_id']);
        // Sorted and deduplicated so two rounds cannot produce two orderings of
        // one fact.
        expect(m.providers).toEqual(['anthropic', 'openai']);
        expect(JSON.parse(fs.readFileSync(markerFile(r, 'run-a'), 'utf8'))).toEqual(m);
    });

    it('keeps the FIRST stamp and merges providers on a second park', () => {
        const r = root();
        writeQuotaParked(r, 'run-a', ['openai'], () => NOW);
        const later = new Date('2026-08-22T18:00:00.000Z');
        const m = writeQuotaParked(r, 'run-a', ['anthropic'], () => later);
        expect(m.parked_at).toBe(NOW.toISOString());
        expect(m.providers).toEqual(['anthropic', 'openai']);
    });

    it('is found by a session id that differs from the file name', () => {
        // The run id and the session id resolve from different env chains and
        // diverge the moment an orchestrator sets AC_RUN_ID. A lookup that only
        // tried the filename would report a parked run as a crashed one.
        const r = root();
        fs.mkdirSync(path.join(r, QUOTA_PARKED_DIR_REL), { recursive: true });
        fs.writeFileSync(
            path.join(r, QUOTA_PARKED_DIR_REL, 'some-other-name.json'),
            JSON.stringify({ run_id: 'sess-1', providers: ['openai'], parked_at: NOW.toISOString() }),
            'utf8',
        );
        expect(findQuotaParked(r, 'sess-1')?.providers).toEqual(['openai']);
        expect(findQuotaParked(r, 'sess-2')).toBeNull();
    });

    it('reads absent, malformed and cleared alike as no marker', () => {
        const r = root();
        expect(findQuotaParked(r, 'nobody')).toBeNull();
        fs.mkdirSync(path.join(r, QUOTA_PARKED_DIR_REL), { recursive: true });
        fs.writeFileSync(markerFile(r, 'bad'), '{ not json', 'utf8');
        expect(findQuotaParked(r, 'bad')).toBeNull();
        writeQuotaParked(r, 'run-a', ['openai'], () => NOW);
        clearQuotaParked(r, 'run-a');
        expect(findQuotaParked(r, 'run-a')).toBeNull();
        expect(() => clearQuotaParked(r, 'run-a')).not.toThrow();
    });
});

describe('classify', () => {
    it('reports a parked run as quota-parked, naming the providers', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] one', '- [ ] two']);
        writeQuotaParked(r, 'sess-1', ['anthropic'], () => NOW);
        const c = classify(r, rec(), {}, NOW);
        expect(c.disposition).toBe('quota-parked');
        expect(c.reason).toContain('anthropic');
        expect(c.reason).toContain('waiting, not broken');
        expect(c.open_steps).toBe(2);
    });

    it('says the reset time is unknown rather than omitting or guessing it', () => {
        // An omitted unknown reads as "no wait needed"; a guessed interval
        // reads as a fact. There is no parser, and the reason says so.
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] one']);
        writeQuotaParked(r, 'sess-1', ['openai'], () => NOW);
        const c = classify(r, rec(), {}, NOW);
        expect(c.reason).toContain('Reset time unknown');
        expect(c.reason).not.toMatch(/\d+\s*(min|hour|h)\b/);
    });

    it('wins over the relaunch cap — the cause, not its consequence', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] one']);
        writeQuotaParked(r, 'sess-1', ['openai'], () => NOW);
        const c = classify(r, rec(), { 'road-to-x': 99 }, NOW);
        expect(c.disposition).toBe('quota-parked');
    });

    it('does not fire before the run is dead, or when finished', () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] one']);
        writeQuotaParked(r, 'sess-1', ['openai'], () => NOW);
        expect(classify(r, rec({ last_seen: iso_now(NOW) }), {}, NOW).disposition).toBe('alive');
        writeRoadmap(r, 'road-to-x', ['- [x] one']);
        expect(classify(r, rec(), {}, NOW).disposition).toBe('complete');
    });

    it(`leaves every unparked run's disposition and reason untouched`, () => {
        const r = root();
        writeRoadmap(r, 'road-to-x', ['- [ ] one']);
        const c = classify(r, rec(), {}, NOW);
        expect(c.disposition).toBe('relaunchable');
        expect(c.reason).toBe('1 open step(s) remain and the session is gone');
    });
});

describe('the report surfaces', () => {
    const parked = (): Candidate => ({
        session_id: 'sess-1',
        roadmap: 'road-to-x',
        worktree: '/tmp/wt',
        platform: 'claude',
        disposition: 'quota-parked',
        open_steps: 2,
        relaunches: 0,
        reason: 'plan quota exhausted on openai since 2026-08-22T12:00:00.000Z — 2 open step(s) remain; the run is waiting, not broken. Reset time unknown (no parser: no verified error string yet).',
    });

    it('render names the disposition and the provider', () => {
        const out = render([parked()]);
        expect(out).toContain('QUOTA-PARKED');
        expect(out).toContain('openai');
    });

    it('digest counts it separately from relaunchable and gives it its own line', () => {
        const out = digest(root(), [parked()], NOW);
        expect(out).toContain('1 quota-parked');
        expect(out).toContain('parked:');
        expect(out).toContain('road-to-x');
    });

    it('digest stays silent about parking when nothing is parked', () => {
        const out = digest(root(), [{ ...parked(), disposition: 'relaunchable' }], NOW);
        expect(out).not.toContain('quota-parked');
        expect(out).not.toContain('parked:');
    });
});

describe('the council gate writes the marker', () => {
    const io = (repoRoot: string, out: string[]) => ({
        repoRoot,
        stdout: (s: string) => out.push(s),
        stderr: (s: string) => out.push(s),
    });

    it('records the parked providers under the run id', () => {
        const r = root();
        const before = process.env[BILLING_GRANT_ENV];
        process.env[BILLING_GRANT_ENV] = 'run-z';
        try {
            const out: string[] = [];
            printBillingGate(['openai'], io(r, out));
            expect(findQuotaParked(r, 'run-z')?.providers).toEqual(['openai']);
            expect(out.join('')).toContain('HUMAN GATE');
        } finally {
            if (before === undefined) delete process.env[BILLING_GRANT_ENV];
            else process.env[BILLING_GRANT_ENV] = before;
        }
    });

    it('writes nothing when nothing parked', () => {
        const r = root();
        const out: string[] = [];
        printBillingGate([], io(r, out));
        expect(fs.existsSync(path.join(r, QUOTA_PARKED_DIR_REL))).toBe(false);
        expect(out).toEqual([]);
    });

    it('writes nothing when no run id resolves — never a fabricated key', () => {
        const r = root();
        const saved = {
            g: process.env[BILLING_GRANT_ENV],
            r: process.env['AC_RUN_ID'],
            c: process.env['CLAUDE_CODE_SESSION_ID'],
        };
        delete process.env[BILLING_GRANT_ENV];
        delete process.env['AC_RUN_ID'];
        delete process.env['CLAUDE_CODE_SESSION_ID'];
        try {
            const out: string[] = [];
            printBillingGate(['openai'], io(r, out));
            expect(fs.existsSync(path.join(r, QUOTA_PARKED_DIR_REL))).toBe(false);
            // The line still prints — the operator at the terminal is told even
            // when no marker can be keyed for the watcher.
            expect(out.join('')).toContain('HUMAN GATE');
        } finally {
            for (const [k, v] of [
                [BILLING_GRANT_ENV, saved.g],
                ['AC_RUN_ID', saved.r],
                ['CLAUDE_CODE_SESSION_ID', saved.c],
            ] as const) {
                if (v === undefined) delete process.env[k];
                else process.env[k] = v;
            }
        }
    });
});

describe('the grant is re-read at resume, never carried in the plan', () => {
    it('a resume plan embeds no grant value — only the run id it is keyed by', () => {
        // The failure this prevents is silent: a plan printed while a run was
        // parked, pasted hours later, carrying a billing decision the operator
        // made — or did not make — at a different moment. `hasBillingGrant`
        // reads from disk on every call, so the correct plan carries nothing.
        const r = root();
        const plan = planResume(
            r,
            { session_id: 'sess-1', platform: 'claude', worktree: r, roadmap: 'road-to-x', head: 'abc123' },
            NOW,
        );
        const serialised = JSON.stringify(plan);
        expect(serialised).not.toContain(BILLING_GRANT_ENV);
        expect(serialised).not.toContain('billing');
    });

    it('the grant answer moves with the disk, not with the plan', () => {
        const r = root();
        const before = process.env[BILLING_GRANT_ENV];
        try {
            delete process.env[BILLING_GRANT_ENV];
            expect(hasBillingGrant(r)).toBe(false);
            issueBillingGrant(r, 'run-later');
            process.env[BILLING_GRANT_ENV] = 'run-later';
            // Same repo root, no plan rebuilt, answer flipped — which is the
            // property: a yes given after the park is honoured at resume.
            expect(hasBillingGrant(r)).toBe(true);
        } finally {
            if (before === undefined) delete process.env[BILLING_GRANT_ENV];
            else process.env[BILLING_GRANT_ENV] = before;
        }
    });
});
