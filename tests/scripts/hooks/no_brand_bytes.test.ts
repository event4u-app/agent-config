// road-to-a-brand-the-tree-can-check 0.6 — the floor every later phase holds.
//
// A backend prompt in a project that carries a full brand (a registered token
// file, a DESIGN.md and a brand-voice slot) must not pull a single brand byte
// into what the hooks inject. Green today because no concern reads the brand;
// kept so a later carrier (6.4) cannot start emitting on unrelated tasks.
//
// Every concern bound to the `claude` session_start and user_prompt_submit
// slots runs in-process against an envelope rooted in the branded fixture
// project, the way bench_hook_injection does, and its whole stdout is searched
// for markers that exist only in the brand files.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolveConcernMain } from '../../../src/scripts/hooks/concern_registry.js';
import { _load_yaml, _resolve_concerns } from '../../../src/scripts/hooks/dispatch_hook.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../../src/scripts/hooks/hook_stdin.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

const BRAND_NAME = 'Quillorbit';
const BRAND_HEX = '#3A7F9C';
const VOICE_PHRASE = 'luminous-not-loud';
const MARKERS = [BRAND_NAME, BRAND_HEX, BRAND_HEX.toLowerCase(), VOICE_PHRASE, 'brand-voice', 'tokens.json'];

function runConcern(script: string, args: readonly string[], envelope: Record<string, unknown>): string {
    // The dispatcher's own resolver: inlined concerns AND the ones that live
    // in a conditional chunk. A direct table lookup here would miss the second
    // kind and read as "not a concern".
    const main = resolveConcernMain(script);
    if (main === null) throw new Error(`${script} resolves to no in-process concern`);
    let out = '';
    const prevWrite = process.stdout.write;
    const prevErr = process.stderr.write;
    const prevArgv = process.argv;
    setHookStdinOverride(JSON.stringify(envelope));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stdout.write = ((chunk: any, enc?: any, cb?: any): boolean => {
        out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
        const callback = typeof enc === 'function' ? enc : cb;
        if (typeof callback === 'function') callback();
        return true;
    }) as typeof process.stdout.write;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stderr.write = ((chunk: any, enc?: any, cb?: any): boolean => {
        const callback = typeof enc === 'function' ? enc : cb;
        if (typeof callback === 'function') callback();
        return true;
    }) as typeof process.stderr.write;
    try {
        process.argv = [prevArgv[0] as string, script, ...args, '--platform', 'claude'];
        main([...args, '--platform', 'claude']);
    } catch {
        /* a crashing concern injects nothing; its own suite owns the crash */
    } finally {
        process.stdout.write = prevWrite;
        process.stderr.write = prevErr;
        process.argv = prevArgv;
        clearHookStdinOverride();
    }
    return out;
}

let project: string;
const saved: Record<string, string | undefined> = {};
const ENV_KEYS = ['AGENT_CONFIG_REPLAY', 'CLAUDE_PROJECT_DIR'];

beforeAll(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'no-brand-bytes-'));
    fs.writeFileSync(
        path.join(project, 'tokens.json'),
        JSON.stringify({
            $description: `${BRAND_NAME} brand tokens`,
            primitive: { color: { $type: 'color', brand: { $value: BRAND_HEX } } },
        }),
    );
    fs.writeFileSync(path.join(project, 'DESIGN.md'), `# ${BRAND_NAME} design\n\nPrimary ${BRAND_HEX}.\n`);
    fs.mkdirSync(path.join(project, 'agents', 'context-spine'), { recursive: true });
    fs.writeFileSync(
        path.join(project, 'agents', 'context-spine', 'brand-voice.md'),
        `---\nattributes:\n  - is: ${VOICE_PHRASE}\n---\n# ${BRAND_NAME} voice\n`,
    );
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env['AGENT_CONFIG_REPLAY'] = '1';
    process.env['CLAUDE_PROJECT_DIR'] = project;
});

afterAll(() => {
    for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
    fs.rmSync(project, { recursive: true, force: true });
});

describe('hooks — no-brand-bytes', () => {
    const manifest = _load_yaml(MANIFEST);

    for (const event of ['session_start', 'user_prompt_submit'] as const) {
        it(`no-brand-bytes: a backend prompt carries no brand byte on ${event}`, () => {
            const envelope = {
                session_id: `no-brand-bytes-${event}`,
                prompt: 'Add a composite index on orders(customer_id, created_at) and fix the slow query.',
                transcript_path: path.join(project, 'transcript.jsonl'),
                cwd: project,
                platform_hint: 'claude',
            };
            const concerns = _resolve_concerns(manifest, 'claude', event);
            expect(concerns.length).toBeGreaterThan(0);
            const leaks: string[] = [];
            for (const concern of concerns) {
                const args = Array.isArray(concern['args']) ? concern['args'].map(String) : [];
                const out = runConcern(String(concern['script']), args, envelope);
                for (const marker of MARKERS) {
                    if (out.includes(marker)) leaks.push(`${String(concern['name'])}: ${marker}`);
                }
            }
            expect(leaks).toEqual([]);
        });
    }

    // Non-vacuity: the capture sees what a concern prints, so a silent harness
    // cannot pass the assertion above by construction.
    it('no-brand-bytes: the capture sees a concern that does emit', () => {
        const manifest2 = _load_yaml(MANIFEST);
        const concerns = _resolve_concerns(manifest2, 'claude', 'session_start');
        const envelope = { session_id: 'no-brand-bytes-control', cwd: project, platform_hint: 'claude' };
        const total = concerns
            .map((c) => runConcern(String(c['script']), Array.isArray(c['args']) ? c['args'].map(String) : [], envelope))
            .join('');
        expect(total.length).toBeGreaterThan(0);
    });
});
