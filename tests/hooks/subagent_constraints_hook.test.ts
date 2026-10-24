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
    EMISSION_MAX_BYTES,
    instructionDigest,
    replyLine,
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

    it('reads the definition flag as YAML, CRLF and comments included', () => {
        const dir = path.join(root, '.claude', 'agents');
        fs.writeFileSync(path.join(dir, 'crlf.md'), '---\r\nname: crlf\r\nomitClaudeMd: true\r\n---\r\nbody\r\n');
        fs.writeFileSync(path.join(dir, 'commented.md'), '---\nname: c\nomitClaudeMd: true # skip\n---\n');
        fs.writeFileSync(path.join(dir, 'quoted.md'), '---\nname: q\nomitClaudeMd: "true"\n---\n');
        fs.writeFileSync(path.join(dir, 'broken.md'), '---\nname: [b\nomitClaudeMd: true\n---\n');
        expect(definitionSkipsInstructions(root, 'crlf', config)).toBe(true);
        expect(definitionSkipsInstructions(root, 'commented', config)).toBe(true);
        expect(definitionSkipsInstructions(root, 'quoted', config)).toBe(false);
        expect(definitionSkipsInstructions(root, 'broken', config)).toBe(false);
    });

    it('prints the files root-most first and names every one in the inventory', () => {
        const sub = path.join(root, 'pkg');
        fs.mkdirSync(path.join(sub, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(sub, '.claude', 'CLAUDE.md'), 'inner rule\n');
        const digest = instructionDigest(sub) as string;
        expect(digest.indexOf(PLANTED)).toBeLessThan(digest.indexOf('inner rule'));
        expect(digest).toContain('CLAUDE.md (full), pkg/.claude/CLAUDE.md (full)');
    });

    it('gives room to the nearest file first when a root file is too large', () => {
        const sub = path.join(root, 'pkg');
        fs.mkdirSync(sub);
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), `${'root filler line\n'.repeat(600)}`);
        fs.writeFileSync(path.join(sub, 'CLAUDE.local.md'), `${PLANTED}\n`);
        const digest = instructionDigest(sub) as string;
        expect(digest).toContain(PLANTED);
        expect(digest).toContain('CLAUDE.md (cut), pkg/CLAUDE.local.md (full)');
        expect(digest).toContain('[cut here]');
    });

    it('names a file it had no room for as omitted', () => {
        const sub = path.join(root, 'pkg');
        fs.mkdirSync(sub);
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'root rule\n');
        fs.writeFileSync(path.join(sub, 'CLAUDE.md'), `${'near filler line\n'.repeat(600)}`);
        const digest = instructionDigest(sub) as string;
        expect(digest).toContain('CLAUDE.md (omitted), pkg/CLAUDE.md (cut)');
        expect(digest).not.toContain('root rule');
    });

    it('keeps the serialized reply under the registered ceiling under worst-case escaping', () => {
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), '"\\\u0001\t'.repeat(3_000));
        const digest = instructionDigest(root) as string;
        expect(Buffer.byteLength(replyLine(digest), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), '\u{1F600}x'.repeat(3_000));
        const emoji = instructionDigest(root) as string;
        expect(Buffer.byteLength(replyLine(emoji), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        expect(emoji.isWellFormed()).toBe(true);
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
