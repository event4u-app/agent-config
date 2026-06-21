// Tests for src/scripts/redact_hook_capture.ts (py2ts Phase 8 / Wave 8g).
//
// Ports tests/test_redact_hook_capture.py 1:1 (redact() recursion, strict
// mode, envelope-key keep, CLI single-file / directory / missing-input).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { main, redact, REDACTED } from '../../src/scripts/redact_hook_capture.js';


let tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rhc-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    }
    tmpDirs = [];
});

type Rec = Record<string, unknown>;

describe('redact_hook_capture — ported pytest suite', () => {
    it('redacts known user-content keys', () => {
        const record: Rec = {
            captured_at: '2026-05-05T10:00:00Z',
            platform: 'cursor',
            raw_payload: {
                hook_event_name: 'stop',
                session_id: 'abc123',
                prompt: 'secret user input',
                response: 'secret agent output',
                model: 'claude-opus-4.7',
            },
        };
        const out = redact(record) as Rec;
        const rp = out['raw_payload'] as Rec;
        expect(rp['prompt']).toBe(REDACTED);
        expect(rp['response']).toBe(REDACTED);
        expect(rp['hook_event_name']).toBe('stop');
        expect(rp['session_id']).toBe('abc123');
        expect(rp['model']).toBe('claude-opus-4.7');
        expect(out['captured_at']).toBe('2026-05-05T10:00:00Z');
        expect(out['platform']).toBe('cursor');
    });

    it('redacts nested augment conversation shape', () => {
        const record: Rec = {
            raw_payload: {
                hook_event_name: 'Stop',
                conversation: {
                    userPrompt: 'secret',
                    agentTextResponse: 'secret reply',
                    agentCodeResponse: [
                        { path: 'src/foo.py', changeType: 'edit', content: 'secret diff body' },
                    ],
                },
            },
        };
        const out = redact(record) as Rec;
        const conv = (out['raw_payload'] as Rec)['conversation'] as Rec;
        expect(conv['userPrompt']).toBe(REDACTED);
        expect(conv['agentTextResponse']).toBe(REDACTED);
        const acr = (conv['agentCodeResponse'] as Rec[])[0] as Rec;
        expect(acr['path']).toBe('src/foo.py');
        expect(acr['changeType']).toBe('edit');
        expect(acr['content']).toBe(REDACTED);
    });

    it('strict mode redacts long unknown strings', () => {
        const record: Rec = {
            raw_payload: {
                hook_event_name: 'stop',
                some_unknown_field: 'x'.repeat(200),
                short_value: 'ok',
            },
        };
        const out = redact(record, true, 50) as Rec;
        const rp = out['raw_payload'] as Rec;
        expect(rp['some_unknown_field']).toBe(REDACTED);
        expect(rp['short_value']).toBe('ok');
        expect(rp['hook_event_name']).toBe('stop');
    });

    it('envelope keys kept under strict', () => {
        const record: Rec = {
            raw_payload: {
                transcript_path: '/Users/me/very/long/path/to/transcript.jsonl' + '/'.repeat(200),
                session_id: 'abcdef0123456789'.repeat(5),
            },
        };
        const out = redact(record, true, 10) as Rec;
        const rp = out['raw_payload'] as Rec;
        expect((rp['transcript_path'] as string).startsWith('/Users/me/')).toBe(true);
        expect((rp['session_id'] as string).includes('abcdef')).toBe(true);
    });

    it('redacts lists and recurses', () => {
        const record: Rec = {
            raw_payload: {
                messages: [
                    { role: 'user', content: 'secret 1' },
                    { role: 'assistant', content: 'secret 2' },
                ],
            },
        };
        const out = redact(record) as Rec;
        const msgs = (out['raw_payload'] as Rec)['messages'] as Rec[];
        expect(msgs[0]!['content']).toBe(REDACTED);
        expect(msgs[1]!['content']).toBe(REDACTED);
    });

    it('cli single file', () => {
        const tmp = mkTmp();
        const record = {
            captured_at: '2026-05-05T10:00:00Z',
            platform: 'cursor',
            raw_payload: { prompt: 'secret' },
        };
        const src = path.join(tmp, 'capture.json');
        fs.writeFileSync(src, JSON.stringify(record), 'utf-8');
        const rc = main([src]);
        expect(rc).toBe(0);
        const outPath = path.join(tmp, 'capture.redacted.json');
        expect(fs.existsSync(outPath)).toBe(true);
        const out = JSON.parse(fs.readFileSync(outPath, 'utf-8')) as Rec;
        expect((out['raw_payload'] as Rec)['prompt']).toBe(REDACTED);
    });

    it('cli directory mode', () => {
        const tmp = mkTmp();
        for (let i = 0; i < 3; i++) {
            fs.writeFileSync(
                path.join(tmp, `capture-${i}.json`),
                JSON.stringify({ raw_payload: { prompt: `secret-${i}` } }),
                'utf-8',
            );
        }
        const rc = main([tmp]);
        expect(rc).toBe(0);
        const redactedFiles = fs
            .readdirSync(tmp)
            .filter((n) => n.endsWith('.redacted.json'))
            .sort();
        expect(redactedFiles.length).toBe(3);
        for (const f of redactedFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf-8')) as Rec;
            expect((data['raw_payload'] as Rec)['prompt']).toBe(REDACTED);
        }
    });

    it('cli missing input returns 2', () => {
        const tmp = mkTmp();
        const rc = main([path.join(tmp, 'does-not-exist.json')]);
        expect(rc).toBe(2);
    });
});

// ---- Golden parity: python3 vs tsx CLI -------------------------------------

