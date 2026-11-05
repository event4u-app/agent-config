// road-to-a-memory-each-worker-is-handed 2.2 + 2.3 — one record-only concern.
//   2.2  a child (payload carries agent_id) writing under agents/memory/ produces
//        one record; the same write without agent_id produces none. Never denies.
//   2.3  at the orchestrator's Agent call the slice is computed and only its counts
//        are logged; nothing is delivered to the model.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LEDGER_DIR } from '../../../src/scripts/hooks/subagent_ledger_hook.js';
import { MAX_EXAMINED_REFS, MAX_RESOLVE_DEPTH, MAX_SCAN_CHARS, processEnvelope } from '../../../src/scripts/hooks/memory_audience_shadow_hook.js';
import { EXIT_ALLOW } from '../../../src/scripts/hooks/exit_codes.js';
import { applyPayloadFields } from '../../../src/scripts/hooks/payload_stub.js';

function manifest(): { concerns: Record<string, Record<string, unknown>> } {
    const compiled = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'src', 'scripts', 'hook_manifest.json'), 'utf8'));
    return compiled.manifest;
}

let root: string;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mem-audience-'));
    mkdirSync(join(root, 'agents', 'memory'), { recursive: true });
    writeFileSync(join(root, 'agents', 'memory', 'historical-patterns.yml'), 'x'.repeat(400));
    writeFileSync(join(root, 'agents', 'memory', 'product-rules.yml'), 'y'.repeat(800));
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
});

function ledgerLines(): Record<string, unknown>[] {
    const dir = join(root, LEDGER_DIR);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => f.endsWith('.jsonl'))
        .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').filter((l) => l.trim()))
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

function write(agentId: string | null, filePath: string, tool = 'Write'): Record<string, unknown> {
    return {
        event: 'pre_tool_use',
        platform: 'claude',
        payload: {
            hook_event_name: 'PreToolUse',
            tool_name: tool,
            ...(agentId === null ? {} : { agent_id: agentId }),
            tool_input: { file_path: filePath, content: 'a lesson' },
        },
    };
}

function spawn(prompt: string, agentId: string | null = null): Record<string, unknown> {
    return {
        event: 'pre_tool_use',
        platform: 'claude',
        payload: {
            hook_event_name: 'PreToolUse',
            tool_name: 'Agent',
            ...(agentId === null ? {} : { agent_id: agentId }),
            tool_input: { prompt, subagent_type: 'general-purpose' },
        },
    };
}

describe('2.2 — record-only guard on child writes to agents/memory/', () => {
    it('a child Write under agents/memory/ produces exactly one record and allows', () => {
        expect(processEnvelope(write('agent-abc', 'agents/memory/intake/signals-2026-11.jsonl'), root)).toBe(EXIT_ALLOW);
        const lines = ledgerLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ event: 'memory_child_write_attempt', tool: 'Write', target: 'intake', posture: 'record-only' });
        // Privacy by construction: no agent id, no path, no content reaches disk.
        const raw = JSON.stringify(lines[0]);
        expect(raw).not.toContain('agent-abc');
        expect(raw).not.toContain('signals-2026-11');
        expect(raw).not.toContain('a lesson');
    });

    it('an absolute path inside the root counts as the same write', () => {
        processEnvelope(write('agent-abc', join(root, 'agents', 'memory', 'product-rules.yml'), 'Edit'), root);
        expect(ledgerLines()).toMatchObject([{ event: 'memory_child_write_attempt', tool: 'Edit', target: 'curated' }]);
    });

    it('a MultiEdit by a child is recorded like a Write', () => {
        processEnvelope(write('agent-abc', 'agents/memory/product-rules.yml', 'MultiEdit'), root);
        expect(ledgerLines()).toMatchObject([{ event: 'memory_child_write_attempt', tool: 'MultiEdit', target: 'curated' }]);
    });

    it('a child write survives the dispatcher projection and is recorded', () => {
        const spec = manifest().concerns['memory-audience-shadow']!;
        const projected = applyPayloadFields(spec as never, write('agent-abc', 'agents/memory/product-rules.yml') as never);
        expect(processEnvelope(projected as never, root)).toBe(EXIT_ALLOW);
        expect(ledgerLines()).toMatchObject([{ event: 'memory_child_write_attempt', target: 'curated' }]);
    });

    it('a write through a symlink out of the store is not a memory write', () => {
        mkdirSync(join(root, 'elsewhere'), { recursive: true });
        symlinkSync(join(root, 'elsewhere'), join(root, 'agents', 'memory', 'out'));
        processEnvelope(write('agent-abc', 'agents/memory/out/new-file.yml'), root);
        expect(ledgerLines()).toHaveLength(0);
    });

    it('a new file under a symlink into the store is a memory write', () => {
        symlinkSync(join(root, 'agents', 'memory'), join(root, 'notes'));
        processEnvelope(write('agent-abc', 'notes/new-file.yml'), root);
        expect(ledgerLines()).toMatchObject([{ event: 'memory_child_write_attempt', target: 'curated' }]);
    });

    it('a symlink in the store into intake is classed intake', () => {
        mkdirSync(join(root, 'agents', 'memory', 'intake'), { recursive: true });
        symlinkSync(join(root, 'agents', 'memory', 'intake'), join(root, 'agents', 'memory', 'raw'));
        processEnvelope(write('agent-abc', 'agents/memory/raw/s.jsonl'), root);
        expect(ledgerLines()).toMatchObject([{ target: 'intake' }]);
    });

    it('a write path deeper than the resolution bound is not resolved and not recorded', () => {
        const deep = Array.from({ length: MAX_RESOLVE_DEPTH + 50 }, (_, i) => `d${i}`).join('/');
        expect(processEnvelope(write('agent-abc', `agents/memory/${deep}/x.yml`), root)).toBe(EXIT_ALLOW);
        expect(ledgerLines()).toHaveLength(0);
    });

    describe('an intake directory that is itself a symlink out of the store', () => {
        beforeEach(() => {
            mkdirSync(join(root, 'raw-logs'), { recursive: true });
            writeFileSync(join(root, 'raw-logs', 'x.yml'), 'r'.repeat(4000));
            symlinkSync(join(root, 'raw-logs'), join(root, 'agents', 'memory', 'intake'));
        });

        it('a child write into it is classed intake', () => {
            processEnvelope(write('agent-abc', 'agents/memory/intake/s.jsonl'), root);
            expect(ledgerLines()).toMatchObject([{ target: 'intake' }]);
        });

        it('a write straight to its real directory is classed intake', () => {
            processEnvelope(write('agent-abc', 'raw-logs/s.jsonl'), root);
            expect(ledgerLines()).toMatchObject([{ target: 'intake' }]);
        });

        it('a curated name resolving into it is not part of the slice', () => {
            symlinkSync(join(root, 'raw-logs', 'x.yml'), join(root, 'agents', 'memory', 'alias.yml'));
            processEnvelope(spawn('agents/memory/alias.yml'), root);
            expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, est_tokens: 0 });
        });
    });

    it('an intake symlinked to a directory inside the store keeps its files out of the slice', () => {
        mkdirSync(join(root, 'agents', 'memory', 'raw'), { recursive: true });
        writeFileSync(join(root, 'agents', 'memory', 'raw', 'x.yml'), 'r'.repeat(4000));
        symlinkSync(join(root, 'agents', 'memory', 'raw'), join(root, 'agents', 'memory', 'intake'));
        processEnvelope(spawn('agents/memory/raw/x.yml'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, est_tokens: 0 });
        processEnvelope(write('agent-abc', 'agents/memory/raw/s.jsonl'), root);
        expect(ledgerLines()[1]).toMatchObject({ target: 'intake' });
    });

    it.each([
        ['a dangling symlink in the store', () => symlinkSync(join(root, 'nowhere'), join(root, 'agents', 'memory', 'dead')), 'agents/memory/dead/x.yml'],
        ['a dangling intake link', () => symlinkSync(join(root, 'nowhere'), join(root, 'agents', 'memory', 'intake')), 'agents/memory/intake/s.jsonl'],
        [
            'a symlink loop',
            () => {
                symlinkSync(join(root, 'agents', 'memory', 'b'), join(root, 'agents', 'memory', 'a'));
                symlinkSync(join(root, 'agents', 'memory', 'a'), join(root, 'agents', 'memory', 'b'));
            },
            'agents/memory/a/x.yml',
        ],
    ])('a write whose destination cannot be resolved (%s) is not classified', (_label, arrange, target) => {
        arrange();
        expect(processEnvelope(write('agent-abc', target), root)).toBe(EXIT_ALLOW);
        expect(ledgerLines()).toHaveLength(0);
    });

    it('a write below a regular file (ENOTDIR, not a missing component) is not classified', () => {
        // Any resolution error other than a genuinely missing component leaves the
        // destination unknown; ENOTDIR exercises that branch on every runner, root included.
        expect(processEnvelope(write('agent-abc', 'agents/memory/product-rules.yml/x.yml'), root)).toBe(EXIT_ALLOW);
        expect(ledgerLines()).toHaveLength(0);
    });

    it('a traversal that leaves agents/memory/ is not counted as a memory write', () => {
        processEnvelope(write('agent-abc', 'agents/memory/../../src/x.ts'), root);
        expect(ledgerLines()).toHaveLength(0);
    });

    it('a traversal that lands in intake is classed intake', () => {
        processEnvelope(write('agent-abc', 'agents/memory/a/../intake/s.jsonl'), root);
        expect(ledgerLines()).toMatchObject([{ target: 'intake' }]);
    });

    it('the same write without agent_id produces no record', () => {
        expect(processEnvelope(write(null, 'agents/memory/intake/signals-2026-11.jsonl'), root)).toBe(EXIT_ALLOW);
        expect(ledgerLines()).toHaveLength(0);
    });

    it('a child write outside agents/memory/ produces no record', () => {
        processEnvelope(write('agent-abc', 'src/agents/memory-notes.ts'), root);
        processEnvelope(write('agent-abc', 'agents/memoryx/a.yml'), root);
        expect(ledgerLines()).toHaveLength(0);
    });
});

describe('2.3 — counts-only slice shadow at the orchestrator spawn', () => {
    it('a prompt naming two curated paths logs ref_count: 2 and emits no context', () => {
        const out = vi.spyOn(process.stdout, 'write');
        const prompt =
            'Fix the checkout bug. See agents/memory/historical-patterns.yml and ' +
            'agents/memory/product-rules.yml, and again agents/memory/product-rules.yml.';
        expect(processEnvelope(spawn(prompt), root)).toBe(EXIT_ALLOW);
        expect(out).not.toHaveBeenCalled();
        const lines = ledgerLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({
            event: 'memory_slice_shadow',
            ref_count: 2,
            dropped: 0,
            est_tokens: 300,
            delivered: false,
            posture: 'shadow',
        });
        expect(JSON.stringify(lines[0])).not.toContain('checkout');
    });

    it('caps the slice at the spawn contract maximum and counts the rest as dropped', () => {
        const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => `agents/memory/${n}.yml`);
        for (const n of names) writeFileSync(join(root, n), 'q'.repeat(40));
        processEnvelope(spawn(`refs: ${names.join(' ')}`), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 5, dropped: 2, est_tokens: 50 });
    });

    it('a file whose name starts with two dots is inside the store', () => {
        writeFileSync(join(root, 'agents', 'memory', '..notes.yml'), 'n'.repeat(40));
        processEnvelope(spawn('see agents/memory/..notes.yml'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 1, est_tokens: 10 });
    });

    it('a named ref that does not exist is not part of the slice', () => {
        processEnvelope(spawn('agents/memory/missing.yml agents/memory/product-rules.yml'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 1, dropped: 0, est_tokens: 200 });
    });

    it('ineligible refs ahead of valid ones never take a slot under the cap', () => {
        writeFileSync(join(root, 'outside.yml'), 'z'.repeat(4000));
        const bad = ['o1', 'o2', 'o3', 'o4', 'o5'].map((n) => {
            symlinkSync(join(root, 'outside.yml'), join(root, 'agents', 'memory', `${n}.yml`));
            return `agents/memory/${n}.yml`;
        });
        processEnvelope(spawn(`${bad.join(' ')} agents/memory/product-rules.yml`), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 1, dropped: 0, est_tokens: 200 });
    });

    it('two names for one file count once', () => {
        symlinkSync(join(root, 'agents', 'memory', 'product-rules.yml'), join(root, 'agents', 'memory', 'alias.yml'));
        processEnvelope(spawn('agents/memory/product-rules.yml agents/memory/alias.yml'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 1, est_tokens: 200 });
    });

    it('intake lines are never part of the curated slice', () => {
        processEnvelope(spawn('look at agents/memory/intake/signals-2026-11.jsonl'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, dropped: 0 });
    });

    it('a ref that climbs out of the store or into intake is not counted and stats nothing', () => {
        writeFileSync(join(root, 'secret.yml'), 'z'.repeat(4000));
        mkdirSync(join(root, 'agents', 'memory', 'intake'), { recursive: true });
        writeFileSync(join(root, 'agents', 'memory', 'intake', 'x.yml'), 'z'.repeat(4000));
        processEnvelope(spawn('agents/memory/../../secret.yml agents/memory/a/../intake/x.yml'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, dropped: 0, est_tokens: 0 });
    });

    it('a symlink in the store pointing outside it adds nothing to the estimate', () => {
        writeFileSync(join(root, 'outside.yml'), 'z'.repeat(4000));
        symlinkSync(join(root, 'outside.yml'), join(root, 'agents', 'memory', 'link.yml'));
        processEnvelope(spawn('agents/memory/link.yml'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, est_tokens: 0 });
    });

    it('a symlink in the store pointing into intake adds nothing to the estimate', () => {
        mkdirSync(join(root, 'agents', 'memory', 'intake'), { recursive: true });
        writeFileSync(join(root, 'agents', 'memory', 'intake', 'raw.jsonl'), 'z'.repeat(4000));
        symlinkSync(join(root, 'agents', 'memory', 'intake', 'raw.jsonl'), join(root, 'agents', 'memory', 'into-intake.yml'));
        processEnvelope(spawn('agents/memory/into-intake.yml'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, est_tokens: 0 });
    });

    it('a longer name sharing a curated prefix is not that file', () => {
        processEnvelope(spawn('agents/memory/product-rules.yml.bak agents/memory/product-rules.yml~'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, est_tokens: 0 });
    });

    it.each([
        ['sentence-final', 'See agents/memory/product-rules.yml.'],
        ['in parentheses', '(agents/memory/product-rules.yml)'],
        ['in backticks', 'read `agents/memory/product-rules.yml`, then act'],
        ['dot-slash', 'open ./agents/memory/product-rules.yml now'],
        ['quoted, comma', '"agents/memory/product-rules.yml", and more'],
        ['followed by an ellipsis', 'maybe agents/memory/product-rules.yml...'],
    ])('a ref %s is counted', (_label, prompt) => {
        processEnvelope(spawn(prompt), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 1, est_tokens: 200 });
    });

    it.each([
        ['under another directory', 'src/agents/memory/product-rules.yml'],
        ['glued to a word', 'xagents/memory/product-rules.yml'],
        ['with a repeated-dot suffix', 'agents/memory/product-rules.yml..bak'],
        ['with a dot-underscore suffix', 'agents/memory/product-rules.yml._bak'],
        ['with a dot-tilde suffix', 'agents/memory/product-rules.yml.~1'],
    ])('a ref %s is not counted', (_label, prompt) => {
        processEnvelope(spawn(prompt), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, examined: 0 });
    });

    it('a pathological run of name characters is scanned in bounded time', () => {
        const prompt = 'agents/memory/'.concat('a'.repeat(20000), ' ').repeat(50);
        const t0 = Date.now();
        processEnvelope(spawn(prompt), root);
        expect(Date.now() - t0).toBeLessThan(500);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0 });
    });

    it('a name cut by the scan boundary is never counted as the shorter name', () => {
        const prefix = 'x'.repeat(MAX_SCAN_CHARS - 'agents/memory/product-rules.yml'.length - 1);
        processEnvelope(spawn(`${prefix} agents/memory/product-rules.yml.bak and more`), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, scan_truncated: true });
    });

    it('scans a bounded prefix of the prompt and says when it stopped', () => {
        const filler = 'x '.repeat(MAX_SCAN_CHARS);
        processEnvelope(spawn(`${filler} agents/memory/product-rules.yml`), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, scan_truncated: true });
        processEnvelope(spawn('agents/memory/product-rules.yml'), root);
        expect(ledgerLines()[1]).toMatchObject({ ref_count: 1, scan_truncated: false });
    });

    it('examines a bounded number of names per spawn, whatever the prompt holds', () => {
        const many = Array.from({ length: 500 }, (_, i) => `agents/memory/n${i}.yml`).join(' ');
        processEnvelope(spawn(`${many} agents/memory/product-rules.yml`), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, examined: MAX_EXAMINED_REFS, unexamined: 501 - MAX_EXAMINED_REFS });
    });

    it('a ledger write that fails still allows the call', () => {
        const fileRoot = join(root, 'not-a-dir');
        writeFileSync(fileRoot, 'x');
        expect(processEnvelope(spawn('agents/memory/product-rules.yml'), fileRoot)).toBe(EXIT_ALLOW);
        expect(processEnvelope(write('agent-abc', 'agents/memory/a.yml'), fileRoot)).toBe(EXIT_ALLOW);
    });

    it('the dispatcher projection keeps agent_id and prompt and drops every other input field', () => {
        const spec = manifest().concerns['memory-audience-shadow']!;
        const env = spawn('agents/memory/product-rules.yml', null) as { payload: Record<string, unknown> };
        (env.payload as Record<string, unknown>)['agent_id'] = 'agent-abc';
        (env.payload['tool_input'] as Record<string, unknown>)['description'] = 'drop me';
        const projected = applyPayloadFields(spec as never, env as never) as { payload: Record<string, unknown> };
        expect(projected.payload['agent_id']).toBe('agent-abc');
        expect(projected.payload['tool_input']).toEqual({ prompt: 'agents/memory/product-rules.yml' });
    });

    it("a child's own spawn is not the orchestrator's and is not measured", () => {
        processEnvelope(spawn('agents/memory/product-rules.yml', 'agent-abc'), root);
        expect(ledgerLines()).toHaveLength(0);
    });
});
