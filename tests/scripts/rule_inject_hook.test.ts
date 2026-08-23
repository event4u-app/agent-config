// `rule-inject` — the delivery concern (`road-to-trigger-delivered-rule-bodies`
// Phase 1, steps 1.1/1.2/1.4/1.5).
//
// Every case below drives `main()` with a real envelope over a throwaway tree,
// so what is asserted is the concern's OUTPUT and its state file — not an
// internal helper compared against its own constant, which is the failure the
// `concern_block_exit_parity` test exists over.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    clearHookStdinOverride,
    setHookStdinOverride,
} from '../../src/scripts/hooks/hook_stdin.js';
import {
    CAP_BYTES,
    gateOpen,
    main,
    readSeen,
    statePath,
} from '../../src/scripts/hooks/rule_inject_hook.js';

const ROUTER = {
    kernel: ['kernel-rule'],
    tier_1: [
        { id: 'kernel-rule', triggers: [{ keyword: 'always' }] },
        { id: 'prompt-rule', triggers: [{ keyword: 'migration' }] },
    ],
    tier_2: [
        { id: 'blade-rule', triggers: [{ file_pattern: '*.blade.php' }] },
        { id: 'views-rule', triggers: [{ path_prefix: 'resources/views/' }] },
        { id: 'no-trigger-rule', triggers: [] },
    ],
};

const BODIES: Record<string, string> = {
    'kernel-rule': 'KERNEL BODY\n',
    'prompt-rule': 'PROMPT RULE BODY\n',
    'blade-rule': 'BLADE RULE BODY\n',
    'views-rule': 'VIEWS RULE BODY\n',
    'no-trigger-rule': 'NO TRIGGER BODY\n',
};

/** A tree carrying a router, bodies, and optionally the delivery-mode setting. */
function makeRoot(opts: { delivery: boolean }): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-inject-hook-'));
    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(ROUTER), 'utf-8');
    for (const [id, text] of Object.entries(BODIES)) {
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', `${id}.md`), text, 'utf-8');
    }
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        opts.delivery ? 'lean_projection:\n  mode: delivery\n' : 'lean_projection:\n  mode: thin\n',
        'utf-8',
    );
    return root;
}

/** Run `main` with one envelope, capturing stdout. */
function run(
    envelope: Record<string, unknown>,
    argv: string[] = [],
): { rc: number; out: string } {
    setHookStdinOverride(JSON.stringify(envelope));
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        out += typeof chunk === 'string' ? chunk : String(chunk);
        return true;
    }) as typeof process.stdout.write);
    try {
        const rc = main(argv);
        return { rc, out };
    } finally {
        spy.mockRestore();
        clearHookStdinOverride();
    }
}

function rules(out: string): string[] {
    if (out.trim() === '') return [];
    const parsed = JSON.parse(out) as { additional_context: string };
    return [...parsed.additional_context.matchAll(/<rule id="([^"]+)"/g)].map((m) => m[1] as string);
}

afterEach(() => {
    clearHookStdinOverride();
});

describe('rule-inject — default OFF means zero bytes', () => {
    it('emits nothing when lean_projection.mode is not delivery', () => {
        const root = makeRoot({ delivery: false });
        const { rc, out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 's1',
            prompt: 'fix the failing migration',
        });
        expect(rc).toBe(0);
        expect(out).toBe('');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('gateOpen is false for a thin tree invoked as a non-CLI concern', () => {
        const root = makeRoot({ delivery: false });
        expect(gateOpen(root, false)).toBe(false);
        expect(gateOpen(root, true)).toBe(true); // a direct CLI invocation is a probe
        fs.rmSync(root, { recursive: true, force: true });
    });
});

describe('rule-inject — prompt slot (1.1)', () => {
    it('delivers the matched tier body and never a kernel body', () => {
        const root = makeRoot({ delivery: true });
        const { rc, out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 's-prompt',
            prompt: 'this prompt mentions a migration and says always',
        });
        expect(rc).toBe(2); // the host's advisory context channel, not a deny
        expect(rules(out)).toEqual(['prompt-rule']);
        expect(out).toContain('PROMPT RULE BODY');
        expect(out).not.toContain('KERNEL BODY');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('never delivers a rule the router gives no trigger', () => {
        const root = makeRoot({ delivery: true });
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 's-nt',
            prompt: 'a migration and a no-trigger-rule mention',
        });
        expect(rules(out)).not.toContain('no-trigger-rule');
        fs.rmSync(root, { recursive: true, force: true });
    });
});

describe('rule-inject — file slot (1.2)', () => {
    it('fires path_prefix and file_pattern off the tool input path', () => {
        const root = makeRoot({ delivery: true });
        const { rc, out } = run(
            {
                workspace: root,
                session_id: 's-file',
                tool_name: 'Edit',
                tool_input: { file_path: 'resources/views/events/show.blade.php' },
            },
            ['--event', 'pre_tool_use'],
        );
        expect(rc).toBe(2);
        expect(rules(out).sort()).toEqual(['blade-rule', 'views-rule']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('a tool call is NOT a restatement of the prompt — keyword rules stay silent', () => {
        const root = makeRoot({ delivery: true });
        const { rc, out } = run(
            {
                workspace: root,
                session_id: 's-file2',
                tool_name: 'Edit',
                tool_input: { file_path: 'src/migration/notes.txt' },
            },
            ['--event', 'pre_tool_use'],
        );
        expect(rc).toBe(0);
        expect(out).toBe('');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('ignores tools that name no file', () => {
        const root = makeRoot({ delivery: true });
        const { rc } = run(
            { workspace: root, session_id: 's-file3', tool_name: 'Bash', tool_input: { command: 'ls' } },
            ['--event', 'pre_tool_use'],
        );
        expect(rc).toBe(0);
        fs.rmSync(root, { recursive: true, force: true });
    });
});

describe('rule-inject — once per session per rule, re-armed on compaction (1.4)', () => {
    it('two prompts tripping the same rule emit its body ONCE', () => {
        const root = makeRoot({ delivery: true });
        const env = {
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 's-dedup',
            prompt: 'fix the failing migration',
        };
        const first = run(env);
        expect(rules(first.out)).toEqual(['prompt-rule']);
        const second = run(env);
        expect(second.rc).toBe(0);
        expect(second.out).toBe('');
        expect([...readSeen(root, 's-dedup')]).toEqual(['prompt-rule']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('--event pre_compact empties the seen-set and the next prompt re-injects', () => {
        const root = makeRoot({ delivery: true });
        const env = {
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 's-compact',
            prompt: 'fix the failing migration',
        };
        run(env);
        expect(fs.existsSync(statePath(root, 's-compact'))).toBe(true);
        const cleared = run({ workspace: root, session_id: 's-compact' }, ['--event', 'pre_compact']);
        expect(cleared.rc).toBe(0);
        expect(cleared.out).toBe('');
        expect(fs.existsSync(statePath(root, 's-compact'))).toBe(false);
        expect([...readSeen(root, 's-compact')]).toEqual([]);
        // Re-armed: the same prompt delivers again.
        expect(rules(run(env).out)).toEqual(['prompt-rule']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('the seen-set is per session', () => {
        const root = makeRoot({ delivery: true });
        const base = { event: 'user_prompt_submit', workspace: root, prompt: 'a migration' };
        run({ ...base, session_id: 'a' });
        expect(rules(run({ ...base, session_id: 'b' }).out)).toEqual(['prompt-rule']);
        fs.rmSync(root, { recursive: true, force: true });
    });
});

describe('rule-inject — never blocks (1.5)', () => {
    it('malformed JSON on stdin returns allow', () => {
        setHookStdinOverride('{not json at all');
        expect(main([])).toBe(0);
        clearHookStdinOverride();
    });

    it('empty stdin returns allow', () => {
        setHookStdinOverride('');
        expect(main([])).toBe(0);
        clearHookStdinOverride();
    });

    it('a tree with no router returns allow rather than throwing', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-inject-norouter-'));
        fs.writeFileSync(
            path.join(root, '.agent-settings.yml'),
            'lean_projection:\n  mode: delivery\n',
            'utf-8',
        );
        const { rc, out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 's-x',
            prompt: 'fix the failing migration',
        });
        expect(rc).toBe(0);
        expect(out).toBe('');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('an unwritable state directory still delivers rather than failing the turn', () => {
        const root = makeRoot({ delivery: true });
        // A FILE where the state directory must go: mkdir fails, write fails,
        // and the concern must still emit.
        fs.mkdirSync(path.join(root, 'agents', 'runtime', 'state'), { recursive: true });
        fs.writeFileSync(path.join(root, 'agents', 'runtime', 'state', 'rule-inject'), 'x', 'utf-8');
        const { rc, out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 's-ro',
            prompt: 'fix the failing migration',
        });
        expect(rc).toBe(2);
        expect(rules(out)).toEqual(['prompt-rule']);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('the per-prompt cap is the derived p90, expressed in the budget row\'s unit', () => {
        // 5,000 exact-BPE tok (the measured p90 rounded up to 500) at the ~4
        // bytes/token this corpus reads. Bytes, not tokens, so the concern's
        // module graph carries no tokenizer into a dispatch it will not use —
        // see the constant's own docstring.
        expect(CAP_BYTES).toBe(20480);
    });

    it('carries no tokenizer in its module graph — the hot-path invariant', () => {
        // `_lib/token_count.ts` resolves js-tiktoken AT MODULE LOAD, and this
        // concern is statically reachable from concern_registry.ts, so an
        // import here is paid by every dispatch on every slot. Asserted as a
        // property of the source rather than trusted to review.
        const lib = fs.readFileSync(
            path.join(process.cwd(), 'src', 'scripts', '_lib', 'rule_injection.ts'),
            'utf-8',
        );
        const hook = fs.readFileSync(
            path.join(process.cwd(), 'src', 'scripts', 'hooks', 'rule_inject_hook.ts'),
            'utf-8',
        );
        expect(lib).not.toMatch(/^import .*token_count/m);
        expect(hook).not.toMatch(/^import .*token_count/m);
    });
});
