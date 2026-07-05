// Tests for src/scripts/update_skill_candidates.ts (road-to-knowledge-system,
// Phase 2 — cross-cycle recurrence counter feeding skill-candidates.md).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CANDIDATE_THRESHOLD,
    main,
    parseCandidates,
    renderCandidates,
    upsertCandidate,
} from '../../src/scripts/update_skill_candidates.ts';

describe('upsertCandidate', () => {
    it('creates a new record on first mention, does not cross threshold', () => {
        const records = new Map();
        const { crossedThreshold, record } = upsertCandidate(records, 'retry-with-backoff', 'sess-1', '2026-07-01');
        expect(record.mentions).toBe(1);
        expect(record.sessions).toEqual(['sess-1']);
        expect(record.first).toBe('2026-07-01');
        expect(crossedThreshold).toBe(false);
    });

    it('crosses the threshold exactly once, on the mention that reaches it', () => {
        const records = new Map();
        upsertCandidate(records, 'retry-with-backoff', 'sess-1', '2026-07-01');
        upsertCandidate(records, 'retry-with-backoff', 'sess-2', '2026-07-02');
        const third = upsertCandidate(records, 'retry-with-backoff', 'sess-3', '2026-07-03');
        expect(third.crossedThreshold).toBe(true);
        expect(third.record.mentions).toBe(CANDIDATE_THRESHOLD);

        const fourth = upsertCandidate(records, 'retry-with-backoff', 'sess-4', '2026-07-04');
        expect(fourth.crossedThreshold).toBe(false); // already crossed — no re-trigger
        expect(fourth.record.mentions).toBe(4);
    });

    it('the same session id does not double-count', () => {
        const records = new Map();
        upsertCandidate(records, 'retry-with-backoff', 'sess-1', '2026-07-01');
        const again = upsertCandidate(records, 'retry-with-backoff', 'sess-1', '2026-07-01');
        expect(again.record.mentions).toBe(1);
        expect(again.record.sessions).toEqual(['sess-1']);
    });

    it('updates last-seen date on every call', () => {
        const records = new Map();
        upsertCandidate(records, 'x', 'sess-1', '2026-07-01');
        const second = upsertCandidate(records, 'x', 'sess-2', '2026-07-10');
        expect(second.record.lastSeen).toBe('2026-07-10');
        expect(second.record.first).toBe('2026-07-01');
    });
});

describe('render / parse round-trip', () => {
    it('parseCandidates(renderCandidates(records)) reproduces the same records', () => {
        const records = new Map();
        upsertCandidate(records, 'retry-with-backoff', 'sess-1', '2026-07-01');
        upsertCandidate(records, 'retry-with-backoff', 'sess-2', '2026-07-02');
        upsertCandidate(records, 'another-topic', 'sess-3', '2026-07-03');

        const rendered = renderCandidates(records);
        const parsed = parseCandidates(rendered);

        expect(parsed.get('retry-with-backoff')).toEqual(records.get('retry-with-backoff'));
        expect(parsed.get('another-topic')).toEqual(records.get('another-topic'));
    });

    it('parseCandidates on an empty body returns an empty map', () => {
        expect(parseCandidates('').size).toBe(0);
    });

    it('renderCandidates sorts topics alphabetically', () => {
        const records = new Map();
        upsertCandidate(records, 'zeta-topic', 'sess-1', '2026-07-01');
        upsertCandidate(records, 'alpha-topic', 'sess-2', '2026-07-01');
        const rendered = renderCandidates(records);
        expect(rendered.indexOf('alpha-topic')).toBeLessThan(rendered.indexOf('zeta-topic'));
    });
});

describe('update_skill_candidates CLI', () => {
    function mkFile(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-candidates-'));
        return path.join(dir, 'skill-candidates.md');
    }

    it('creates the file on first invocation', () => {
        const file = mkFile();
        const rc = main(['--topic', 'retry-with-backoff', '--session', 'sess-1', '--date', '2026-07-01', '--file', file]);
        expect(rc).toBe(0);
        const body = fs.readFileSync(file, 'utf8');
        expect(body).toContain('## retry-with-backoff');
        expect(body).toContain('- Mentions: 1');
    });

    it('is idempotent-safe across repeated calls with distinct sessions, accumulating mentions', () => {
        const file = mkFile();
        main(['--topic', 't', '--session', 's1', '--date', '2026-07-01', '--file', file]);
        main(['--topic', 't', '--session', 's2', '--date', '2026-07-02', '--file', file]);
        main(['--topic', 't', '--session', 's3', '--date', '2026-07-03', '--file', file]);
        const body = fs.readFileSync(file, 'utf8');
        expect(body).toContain('- Mentions: 3');
        expect(body).toContain('- Sessions: s1, s2, s3');
    });

    it('usage errors exit 1', () => {
        expect(main(['--topic', 'x'])).toBe(1);
        expect(main(['--bogus'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
