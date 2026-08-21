/**
 * The Class-A self-repair shadow (road-to-org-telemetry Phase 5, step 5.1).
 *
 * The load-bearing assertion is the negative one: the emitted record must not
 * contain the defect's evidence span or its suggested-surface sentence, which
 * are the Class-B payload. It is asserted over the written BYTES rather than
 * over the object, because a field added later would show up in the bytes.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { emitDefectShadow } from '../../src/scripts/hooks/telemetry_self_repair.js';
import { _resetSettingsCache } from '../../src/scripts/hooks/telemetry_usage_hook.js';
import type { DefectRecord } from '../../src/scripts/_lib/self_repair.js';

const roots: string[] = [];

const ACTIVE = `telemetry:
  remote:
    enabled: true
    endpoint: https://sink.example.invalid/ingest
    org_id: acme
    salt: org-pack-secret
    flush: session-end
discipline_profile: essential
`;

function makeRoot(body: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-shadow-'));
    roots.push(dir);
    if (body !== null) fs.writeFileSync(path.join(dir, '.agent-settings.yml'), body, 'utf-8');
    _resetSettingsCache();
    return dir;
}

const EVIDENCE = 'du hast die Datei /Users/someone/secret-project/app.ts falsch geaendert';
const SURFACE = 'fix the language-mirror rule so it stops doing that';

function defect(over: Partial<DefectRecord> = {}): DefectRecord {
    return {
        defect_class: 'language-mirror',
        source: 'detector',
        evidence: EVIDENCE,
        suggested_surface: SURFACE,
        fingerprint: 'abc123',
        first_seen: '2026-08-20T10:00:00Z',
        last_seen: '2026-08-20T10:00:00Z',
        occurrences: 3,
        status: 'open',
        ...over,
    } as DefectRecord;
}

const env = { platform: 'claude', session_id: 'host-session-token' };

function logOf(root: string): string {
    return path.join(root, '.agent-telemetry.jsonl');
}

afterEach(() => {
    while (roots.length > 0) fs.rmSync(roots.pop() as string, { recursive: true, force: true });
    _resetSettingsCache();
});

describe('the self-repair shadow carries no case content', () => {
    it('writes the class, source, occurrences, host and version — and nothing else', () => {
        const root = makeRoot(ACTIVE);
        expect(emitDefectShadow(root, defect(), env)).toBe('written');

        const raw = fs.readFileSync(logOf(root), 'utf-8');
        const rec = JSON.parse(raw.trim()) as Record<string, unknown>;

        expect(rec['record_class']).toBe('self-repair');
        expect(rec['defect_class']).toBe('language-mirror');
        expect(rec['defect_source']).toBe('detector');
        expect(rec['occurrences']).toBe(3);
        expect(rec['host']).toBe('claude');
        expect(rec['discipline_profile']).toBe('essential');
        expect(rec['org_id']).toBe('acme');

        // The whole point. Asserted on the raw bytes so a later field addition
        // cannot slip content past an object-shaped assertion.
        expect(raw).not.toContain(EVIDENCE);
        expect(raw).not.toContain(SURFACE);
        expect(raw).not.toContain('/Users/');
        expect(raw).not.toContain('secret-project');
        // No raw identifiers either: the session id is hashed, never recorded.
        expect(raw).not.toContain('host-session-token');
        expect(String(rec['user_hash'])).toMatch(/^[0-9a-f]{16}$/u);
        expect(String(rec['session_hash'])).toMatch(/^[0-9a-f]{16}$/u);
    });

    it('records the hour bucket, never an exact timestamp', () => {
        const root = makeRoot(ACTIVE);
        emitDefectShadow(root, defect(), env);
        const rec = JSON.parse(fs.readFileSync(logOf(root), 'utf-8').trim()) as Record<string, unknown>;
        expect(String(rec['ts_bucket'])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00Z$/u);
        // The store's own minute-resolution stamps must not travel.
        expect(fs.readFileSync(logOf(root), 'utf-8')).not.toContain('2026-08-20T10:00:00Z');
    });

    it('spools alongside the log so the shadow travels the one transport', () => {
        const root = makeRoot(ACTIVE);
        emitDefectShadow(root, defect(), env);
        const spool = path.join(root, '.agent-telemetry.spool.jsonl');
        expect(fs.readFileSync(spool, 'utf-8')).toBe(fs.readFileSync(logOf(root), 'utf-8'));
    });

    it('drops a defect class outside the pinned vocabulary', () => {
        const root = makeRoot(ACTIVE);
        expect(emitDefectShadow(root, defect({ defect_class: 'invented' as never }), env)).toBe(
            'unknown-class',
        );
        expect(fs.existsSync(logOf(root))).toBe(false);
    });
});

describe('the shadow is inert unless the org pack activated telemetry', () => {
    it.each([
        ['no settings file at all', null],
        ['no telemetry section', 'discipline_profile: essential\n'],
        ['enabled but no endpoint / org / salt', 'telemetry:\n  remote:\n    enabled: true\n'],
        ['fully configured but not enabled', ACTIVE.replace('enabled: true', 'enabled: false')],
    ])('%s', (_label, body) => {
        const root = makeRoot(body as string | null);
        expect(emitDefectShadow(root, defect(), env)).toBe('inactive');
        expect(fs.existsSync(logOf(root))).toBe(false);
        expect(fs.readdirSync(root).filter((f) => f.includes('telemetry'))).toEqual([]);
    });
});
