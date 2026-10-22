/**
 * Field-level payload projection (`payload_fields:`). A concern that reads a
 * handful of keys from a tool body is handed those keys and nothing else, so its
 * privacy rests on what it receives rather than on what it chooses to keep
 * (ratification 2026-10-22, condition 4).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { applyPayloadFields, isPayloadStub, type JsonObject } from '../../../src/scripts/hooks/payload_stub.js';
import { feedback_dir } from '../../../src/scripts/hooks/state_io.js';

const REPO = path.resolve(__dirname, '../../..');

function envelope(toolInput: unknown, toolResponse?: unknown): JsonObject {
    return {
        schema_version: 1,
        platform: 'claude',
        event: 'post_tool_use',
        payload: {
            session_id: 'sess-1',
            tool_name: 'Agent',
            tool_input: toolInput,
            ...(toolResponse === undefined ? {} : { tool_response: toolResponse }),
        },
    } as JsonObject;
}

describe('payload_fields — projection', () => {
    it('keeps only the declared keys of each tool body', () => {
        const env = envelope(
            { name: 'w1', subagent_type: 'ac-worker', prompt: 'SECRET-PROMPT' },
            { agentId: 'a1', content: [{ type: 'text', text: 'SECRET-RESULT' }] },
        );
        const out = applyPayloadFields({ payload_fields: ['name', 'subagent_type', 'agentId'] }, env);
        const payload = out['payload'] as JsonObject;
        expect(payload['tool_input']).toEqual({ name: 'w1', subagent_type: 'ac-worker' });
        expect(payload['tool_response']).toEqual({ agentId: 'a1' });
        expect(JSON.stringify(out)).not.toContain('SECRET');
        // Everything outside the two bodies is untouched.
        expect(payload['session_id']).toBe('sess-1');
        expect(payload['tool_name']).toBe('Agent');
    });

    it('a body that is not an object arrives as a stub carrying no content', () => {
        const out = applyPayloadFields({ payload_fields: ['to'] }, envelope({ to: 'w1' }, 'SECRET-RESULT-TEXT'));
        const result = (out['payload'] as JsonObject)['tool_response'];
        expect(isPayloadStub(result)).toBe(true);
        expect(JSON.stringify(out)).not.toContain('SECRET');
    });

    it('a concern without a declaration receives the envelope unchanged', () => {
        const env = envelope({ prompt: 'p' });
        expect(applyPayloadFields({}, env)).toBe(env);
    });

    it('a blocking or fail-closed concern is never narrowed, whatever it declares', () => {
        const env = envelope({ command: 'git push', prompt: 'p' });
        expect(applyPayloadFields({ payload_fields: ['to'], severity: 'blocking' }, env)).toBe(env);
        expect(applyPayloadFields({ payload_fields: ['to'], fail_closed: true }, env)).toBe(env);
    });
});

describe('payload_fields — spawn-guard-shadow declares exactly what it reads', () => {
    const manifest = parseYaml(fs.readFileSync(path.join(REPO, 'src/scripts/hook_manifest.yaml'), 'utf8')) as {
        concerns: Record<string, JsonObject>;
    };
    const spec = manifest.concerns['spawn-guard-shadow']!;

    it('receives the dispatch and send addressing fields, and no prompt, message or result body', () => {
        expect(spec['payload_fields']).toEqual(['name', 'subagent_type', 'to', 'recipient_kind', 'agentId']);
        const out = applyPayloadFields(
            spec,
            envelope(
                { name: 'w', subagent_type: 't', to: 'w', recipient_kind: 'name', prompt: 'SECRET', message: 'SECRET', content: 'SECRET' },
                { agentId: 'a', content: [{ text: 'SECRET' }] },
            ),
        );
        expect(JSON.stringify(out)).not.toContain('SECRET');
    });

    it('the compiled manifest carries the same declaration', () => {
        const compiled = JSON.parse(fs.readFileSync(path.join(REPO, 'src/scripts/hook_manifest.json'), 'utf8')) as {
            manifest: { concerns: Record<string, JsonObject> };
        };
        expect(compiled.manifest.concerns['spawn-guard-shadow']!['payload_fields']).toEqual(spec['payload_fields']);
    });
});

describe('payload_fields — end to end through the dispatcher', () => {
    it('the concern receives only the declared keys on its stdin', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-fields-'));
        try {
            const ws = path.join(tmp, 'ws');
            fs.mkdirSync(ws, { recursive: true });
            const manifest = path.join(tmp, 'manifest.yaml');
            fs.writeFileSync(
                manifest,
                [
                    'schema_version: 1',
                    'concerns:',
                    '  narrowed:',
                    '    script: tests/hooks/fixtures/concern_report_bodies.ts',
                    '    fail_closed: false',
                    '    severity: advisory',
                    '    needs_payload_bodies: [input, result]',
                    '    payload_fields: [name, agentId]',
                    'platforms:',
                    '  claude:',
                    '    post_tool_use: [narrowed]',
                    '',
                ].join('\n'),
                'utf8',
            );
            const payload = JSON.stringify({
                session_id: 'e2e-fields',
                tool_name: 'Agent',
                tool_input: { name: 'w1', prompt: 'SECRET-PROMPT' },
                tool_response: { agentId: 'a1', content: [{ type: 'text', text: 'SECRET-RESULT' }] },
            });
            const tsx = path.join(REPO, 'node_modules', '.bin', 'tsx');
            const r = spawnSync(
                tsx,
                [
                    path.join(REPO, 'src/scripts/hooks/dispatch_hook.ts'),
                    '--platform', 'claude', '--event', 'post_tool_use', '--native-event', 'PostToolUse',
                    '--manifest', manifest,
                ],
                { cwd: ws, input: payload, encoding: 'utf8' },
            );
            expect(r.status).toBe(0);
            const dir = feedback_dir(path.join(ws, 'agents', 'runtime', 'state'), 'e2e-fields');
            const rec = JSON.parse(fs.readFileSync(path.join(dir, 'narrowed.json'), 'utf8')) as { reason: string };
            const seen = JSON.parse(rec.reason) as { tool_input: unknown; tool_response: unknown };
            expect(seen.tool_input).toEqual({ name: 'w1' });
            expect(seen.tool_response).toEqual({ agentId: 'a1' });
            expect(rec.reason).not.toContain('SECRET');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
