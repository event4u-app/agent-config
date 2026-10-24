// road-to-a-tick-the-shipped-path-earns 2.4: a worker that skips instruction
// files receives the project's constraints on the host's own SubagentStart path.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    definitionSkipsInstructions,
    digestFor,
    DIGEST_MAX_BYTES,
    instructionDigest,
} from '../../src/scripts/hooks/subagent_constraints_hook.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const PLANTED = 'PLANTED-CONSTRAINT-7f3a: never write under vendor/.';

let root: string;
let config: string;

function definition(name: string, skips: boolean): void {
    const dir = path.join(root, '.claude', 'agents');
    fs.mkdirSync(dir, { recursive: true });
    const fm = `---\nname: ${name}\ndescription: fixture\ntools: Read\n${skips ? 'omitClaudeMd: true\n' : ''}---\n`;
    fs.writeFileSync(path.join(dir, `${name}.md`), `${fm}\nYou are a fixture worker.\n`);
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-constraints-')));
    config = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-constraints-cfg-'));
    fs.mkdirSync(path.join(root, '.git'));
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), `# Fixture project\n\n${PLANTED}\n`);
    definition('ac-worker', true);
    definition('ac-plain', false);
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(config, { recursive: true, force: true });
});

const env = (): NodeJS.ProcessEnv => ({ ...process.env, CLAUDE_CONFIG_DIR: config });

describe('subagent-constraints concern', () => {
    it('reads the omitClaudeMd flag off the definition the host runs', () => {
        expect(definitionSkipsInstructions(root, 'ac-worker', config)).toBe(true);
        expect(definitionSkipsInstructions(root, 'ac-plain', config)).toBe(false);
        expect(definitionSkipsInstructions(root, 'missing', config)).toBe(false);
        expect(definitionSkipsInstructions(root, '../ac-worker', config)).toBe(false);
    });

    it('falls back to the user-level definition directory', () => {
        fs.rmSync(path.join(root, '.claude'), { recursive: true });
        fs.mkdirSync(path.join(config, 'agents'));
        fs.writeFileSync(path.join(config, 'agents', 'ac-worker.md'), '---\nname: ac-worker\nomitClaudeMd: true\n---\n');
        expect(definitionSkipsInstructions(root, 'ac-worker', config)).toBe(true);
    });

    it('digests a skipping worker and stays silent for any other', () => {
        const payload = (agent: string): unknown => ({ event: 'subagent_start', payload: { agent_type: agent, cwd: root } });
        expect(digestFor(payload('ac-worker'), env())).toContain(PLANTED);
        expect(digestFor(payload('ac-plain'), env())).toBeNull();
        expect(digestFor(payload('ac-worker'), { ...env(), AGENT_CONFIG_SUBAGENT_CONSTRAINTS: 'off' })).toBeNull();
        expect(digestFor({ event: 'subagent_stop', payload: { agent_type: 'ac-worker', cwd: root } }, env())).toBeNull();
    });

    it('reads the instruction files from the repository root down, and bounds the digest', () => {
        const sub = path.join(root, 'pkg');
        fs.mkdirSync(path.join(sub, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(sub, '.claude', 'CLAUDE.md'), 'inner rule\n');
        const digest = instructionDigest(sub) as string;
        expect(digest.indexOf(PLANTED)).toBeLessThan(digest.indexOf('inner rule'));
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), `${PLANTED}\n${'x'.repeat(80)}\n`.repeat(200));
        const capped = instructionDigest(root) as string;
        expect(Buffer.byteLength(capped, 'utf-8')).toBeLessThanOrEqual(DIGEST_MAX_BYTES);
        expect(capped).toContain(PLANTED);
        expect(capped).toMatch(/\[truncated: read the files named above/);
    });

    it('reaches the subagent through the real dispatcher on SubagentStart', () => {
        const run = (agent: string): { code: number; out: string } => {
            const r = spawnSync(
                'npx',
                ['tsx', DISPATCH, '--platform', 'claude', '--event', 'subagent_start', '--native-event', 'SubagentStart', '--project-dir', root],
                {
                    input: JSON.stringify({
                        session_id: 'fixture-session',
                        hook_event_name: 'SubagentStart',
                        agent_id: `agent-${agent}`,
                        agent_type: agent,
                        cwd: root,
                    }),
                    encoding: 'utf-8',
                    cwd: REPO,
                    timeout: 180_000,
                    env: env(),
                },
            );
            return { code: r.status ?? -1, out: r.stdout ?? '' };
        };
        const skipping = run('ac-worker');
        expect(skipping.code).toBe(0);
        const reply = JSON.parse(skipping.out.trim().split('\n').pop() as string) as {
            hookSpecificOutput: { hookEventName: string; additionalContext: string };
        };
        expect(reply.hookSpecificOutput.hookEventName).toBe('SubagentStart');
        expect(reply.hookSpecificOutput.additionalContext).toContain(PLANTED);
        const loading = run('ac-plain');
        expect(loading.code).toBe(0);
        expect(loading.out).not.toContain(PLANTED);
    }, 240_000);
});
