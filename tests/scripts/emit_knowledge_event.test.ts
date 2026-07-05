// Tests for src/scripts/emit_knowledge_event.ts (road-to-knowledge-system,
// Phase 5 — the actual CLI entrypoint agents invoke to append an event;
// _lib/knowledge_events.ts holds the pure schema only, per this repo's
// _lib-is-never-invoked-directly convention).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { main } from '../../src/scripts/emit_knowledge_event.ts';
import { readAllEvents } from '../../src/scripts/_lib/knowledge_events.ts';

describe('emit_knowledge_event CLI', () => {
    let cwd: string;
    let root: string;

    beforeEach(() => {
        cwd = process.cwd();
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'emit-event-'));
        process.chdir(root);
    });

    afterEach(() => {
        process.chdir(cwd);
    });

    it('convention_detected: appends with all required fields', () => {
        const rc = main([
            '--type', 'convention_detected',
            '--pattern', 'camelCase params',
            '--evidence', 'src/a.ts:1',
            '--evidence', 'src/b.ts:2',
            '--sample-size', '2',
            '--scope', 'project',
        ]);
        expect(rc).toBe(0);
        const events = readAllEvents('agents/knowledge/intake');
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: 'convention_detected', pattern: 'camelCase params', sampleSize: 2, scope: 'project' });
    });

    it('mistake_made: --context-source null maps to a real null, not the string "null"', () => {
        const rc = main([
            '--type', 'mistake_made',
            '--error-category', 'null-deref',
            '--context-source', 'null',
            '--correction', 'guard it',
            '--recurrence-key', 'x',
        ]);
        expect(rc).toBe(0);
        const events = readAllEvents('agents/knowledge/intake');
        expect(events[0]).toMatchObject({ type: 'mistake_made', contextSource: null });
    });

    it('mistake_made: a real context source path is preserved', () => {
        main([
            '--type', 'mistake_made',
            '--error-category', 'x',
            '--context-source', 'agents/knowledge/concepts/a.md',
            '--correction', 'y',
            '--recurrence-key', 'z',
        ]);
        const events = readAllEvents('agents/knowledge/intake');
        expect(events[0]).toMatchObject({ contextSource: 'agents/knowledge/concepts/a.md' });
    });

    it('api_shape_learned: parses JSON schema flags', () => {
        const rc = main([
            '--type', 'api_shape_learned',
            '--endpoint', '/v1/users/:id',
            '--method', 'GET',
            '--request-schema', '{}',
            '--response-schema', '{"id":"string"}',
        ]);
        expect(rc).toBe(0);
        const events = readAllEvents('agents/knowledge/intake');
        expect(events[0]).toMatchObject({ type: 'api_shape_learned', endpoint: '/v1/users/:id', responseSchema: { id: 'string' } });
    });

    it('context_stale: appends with all required fields', () => {
        const rc = main([
            '--type', 'context_stale',
            '--page-path', 'agents/knowledge/concepts/api.md',
            '--field', 'response_format',
            '--expected', '{status}',
            '--actual', '{success}',
            '--evidence', 'test.ts:1',
        ]);
        expect(rc).toBe(0);
    });

    it('missing required flags exits 1 without writing anything', () => {
        const rc = main(['--type', 'mistake_made', '--error-category', 'x']);
        expect(rc).toBe(1);
        expect(readAllEvents('agents/knowledge/intake')).toEqual([]);
    });

    it('unknown --type exits 1', () => {
        expect(main(['--type', 'bogus'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
