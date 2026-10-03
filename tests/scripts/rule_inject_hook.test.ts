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

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearHookStdinOverride,
    setHookStdinOverride,
} from '../../src/scripts/hooks/hook_stdin.js';
import {
    buildInjection,
    CAP_BYTES,
    COMPOSED_CHARS,
    gateOpen,
    main,
    readSeen,
    recordDelivered,
    statePath,
} from '../../src/scripts/hooks/rule_inject_hook.js';
import { readDelivered } from '../../src/scripts/_lib/obligations.js';
import { lawText, ruleBody } from '../../src/scripts/_lib/rule_law_section.js';

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
function makeRoot(opts: { delivery: boolean; hosts?: string }): string {
    const root = mkdtemp('rule-inject-hook-');
    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(ROUTER), 'utf-8');
    for (const [id, text] of Object.entries(BODIES)) {
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', `${id}.md`), text, 'utf-8');
    }
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        `lean_projection:\n  mode: ${opts.delivery ? 'delivery' : 'thin'}\n`
            + (opts.hosts === undefined ? '' : `  hosts: ${opts.hosts}\n`),
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

/**
 * A home directory with no `~/.claude/rules` in it.
 *
 * NOT a convenience. Since step 1.3 the carrier scopes delivery to the host's
 * rule layers, and `os.homedir()` reads `$HOME` on POSIX — so without this every
 * case below would read the DEVELOPER's installed corpus and answer differently
 * on a maintainer machine than in CI. A fixture whose verdict depends on who ran
 * it is not a fixture.
 */
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-inject-home-'));

/** Every throwaway tree this file makes, removed at the end of the run. */
const MADE: string[] = [HOME];

function mkdtemp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    MADE.push(d);
    return d;
}

beforeEach(() => {
    vi.stubEnv('HOME', HOME);
    // `event4u_root()` honours `EVENT4U_CONFIG_HOME` AHEAD of `$HOME`, and
    // `hermetic-env.ts` deliberately does not neutralise it. Unstubbed, a
    // developer or runner carrying that variable reds the state-location cases
    // — the same machine-dependence `$HOME` had before step 1.3 exposed it.
    vi.stubEnv('EVENT4U_CONFIG_HOME', '');
});

afterEach(() => {
    vi.unstubAllEnvs();
    clearHookStdinOverride();
});

afterAll(() => {
    while (MADE.length > 0) {
        const d = MADE.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
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

    // R2 finding 5: the gate keyed on `mode` alone while the PROJECTOR gates
    // stub-writing on mode AND `hosts` (`thinsHost`). With `mode: delivery` and
    // a hosts list that does not carry `claude-code`, this host keeps a
    // FULL-BODIED tree and the hook still injected on a match — every matched
    // rule delivered twice, standing plus injected.
    it('gateOpen is false when hosts does not carry claude-code', () => {
        const root = makeRoot({ delivery: true, hosts: '[cursor]' });
        expect(gateOpen(root, false)).toBe(false);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('gateOpen is false when a fully-invalid hosts list thins nothing', () => {
        // The documented "thin no host" state, which a typo'd list also
        // produces (`resolveLeanProjectionHosts` never falls back to the
        // default from a non-empty list).
        const root = makeRoot({ delivery: true, hosts: '[clod-code]' });
        expect(gateOpen(root, false)).toBe(false);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('gateOpen is true when hosts explicitly carries claude-code', () => {
        const root = makeRoot({ delivery: true, hosts: '[claude-code]' });
        expect(gateOpen(root, false)).toBe(true);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('gateOpen is true for an absent hosts key — absent resolves to [claude-code]', () => {
        const root = makeRoot({ delivery: true });
        expect(gateOpen(root, false)).toBe(true);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('a hosts list carrying claude-code does not open the gate under thin', () => {
        // `thin` writes the same stubs and binds NO delivery concern; only
        // `delivery` may inject. `thinsHost` alone is true for both.
        const root = makeRoot({ delivery: false, hosts: '[claude-code]' });
        expect(gateOpen(root, false)).toBe(false);
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
        // The de-duplication is cleared, which is what "re-armed" means. The
        // FILE survives since step 1.6: it now carries the ids forward in
        // `pending` so the restore slot can send their laws. Asserting the file
        // was unlinked was asserting an implementation detail of the clearing.
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

    it('a tree with no router reports the gap rather than throwing', () => {
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
        // Until step 1.1 this returned allow and emitted nothing, which is the
        // silence the step exists to end: a tree configured for delivery that
        // cannot find a corpus now SAYS so. Still never throws, and the host
        // exit is still 0 — an advisory warn is not a block, which
        // `rule_inject_foreign_matrix.test.ts` asserts through the dispatcher.
        expect(rc).toBe(2);
        expect(out).toContain('no rule source');
        expect(out).not.toContain('<rule id=');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('an unwritable state directory still delivers rather than failing the turn', () => {
        const root = makeRoot({ delivery: true });
        // A FILE where the state directory must go: mkdir fails, write fails,
        // and the concern must still emit. Derived from `statePath` rather than
        // written out by hand, so that moving the state (step 1.7 did) cannot
        // leave this case blocking a directory nothing uses any more.
        const dir = path.dirname(statePath(root, 's-ro'));
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        fs.writeFileSync(dir, 'x', 'utf-8');
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

    it('the per-prompt cap is the measured p90 FIRE SIZE in bytes', () => {
        // 16,384 B — the p90 gate-open fire size rounded up to 512, which is
        // the activation charge owner ruling E2 specifies and the number the
        // `user_prompt_submit` slot sum already carried. It was 20,480 until
        // 2026-09-08 (R2 finding 3): the p90 of the matched-body TOKEN
        // distribution converted at ~4 B/tok, i.e. a second statistic in a
        // second unit that licensed this one concern 25 % above the whole
        // slot's registered sum. Bytes, not tokens, so the concern's module
        // graph carries no tokenizer into a dispatch it will not use — see the
        // constant's own docstring.
        expect(CAP_BYTES).toBe(16384);
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

describe('the runtime cap and the registered budget rows are ONE number (R2 finding 3)', () => {
    /**
     * The three numbers used to be two statistics in two units: `CAP_BYTES` was
     * the p90 of the matched-body TOKEN distribution rounded to 500 tok and
     * converted at ~4 B/tok (20,480 B), while the `user_prompt_submit` slot sum
     * was the p90 gate-open FIRE SIZE in bytes rounded up to 512 (16,384 B) —
     * the activation charge owner ruling E2 specifies. With the concern's own
     * cap 25 % above the whole slot's registered sum, the top decile of fires
     * alone exceeded the slot budget for a slot carrying 12 other concerns, so
     * the overrun was designed in rather than accidental.
     */
    const budget = JSON.parse(
        fs.readFileSync(
            path.join(process.cwd(), 'src', 'config', 'hook-token-budget.json'),
            'utf-8',
        ),
    ) as {
        per_concern_caps_bytes: Record<string, number | string>;
        per_slot_sum_caps_bytes: Record<string, number | string>;
    };

    it('CAP_BYTES equals the registered rule-inject concern row', () => {
        expect(budget.per_concern_caps_bytes['rule-inject']).toBe(CAP_BYTES);
    });

    it('CAP_BYTES does not exceed the user_prompt_submit slot sum', () => {
        // One concern may not be licensed to emit more than the whole slot is
        // registered for. Equality is the ceiling case, not the target.
        expect(CAP_BYTES).toBeLessThanOrEqual(
            budget.per_slot_sum_caps_bytes['user_prompt_submit'] as number,
        );
    });
});

describe('recordDelivered writes the ledger row for each delivered rule', () => {
    /** A tree whose bodies carry real frontmatter, so a class can be read off one. */
    function rootWithClasses(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-inject-ledger-'));
        const dir = path.join(root, 'dist', 'agent-src', 'rules');
        fs.mkdirSync(dir, { recursive: true });
        const write = (id: string, fm: string): void => {
            fs.writeFileSync(path.join(dir, `${id}.md`), `---\n${fm}---\n\nBODY\n`, 'utf-8');
        };
        write('hooked', 'enforced_by:\n  - "hook:design-pass"\n');
        write('validated', 'enforced_by:\n  - "validator:src/scripts/lint_x.ts"\n');
        write('observed', 'enforced_by:\n  - "observer:maintainer-review"\n');
        write('honest', 'enforced_by:\n  - "instruction-only: no gate reads prose"\n');
        write('silent', 'type: "auto"\n');
        write('inline', 'enforced_by: ["test:tests/x.test.ts"]\n');
        write('multi', 'enforced_by:\n  - "observer:x"\n  - "validator:y"\n');
        return root;
    }

    it('carries the class each rule declares in its frontmatter', () => {
        const root = rootWithClasses();
        recordDelivered(root, 's1', ['hooked', 'validated', 'observed', 'honest', 'inline']);
        const byRule = Object.fromEntries(
            readDelivered(root, 's1').map((r) => [r.rule, r.cls]),
        );
        expect(byRule).toEqual({
            hooked: 'hook',
            validated: 'validator',
            observed: 'observer',
            honest: 'instruction-only',
            inline: 'test',
        });
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('carries `none` when the rule declares none', () => {
        const root = rootWithClasses();
        recordDelivered(root, 's1', ['silent']);
        expect(readDelivered(root, 's1')[0]?.cls).toBe('none');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('takes the strongest declaration when a rule names several carriers', () => {
        const root = rootWithClasses();
        recordDelivered(root, 's1', ['multi']);
        expect(readDelivered(root, 's1')[0]?.cls).toBe('validator');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('records `none` for a rule with no projected body rather than dropping it', () => {
        // A delivered rule whose body cannot be read still happened. Dropping
        // the row would under-count deliveries; guessing a class would invent one.
        const root = rootWithClasses();
        expect(recordDelivered(root, 's1', ['nonexistent'])).toBe(1);
        expect(readDelivered(root, 's1')[0]?.cls).toBe('none');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('is idempotent across fires in one session', () => {
        const root = rootWithClasses();
        expect(recordDelivered(root, 's1', ['hooked'])).toBe(1);
        expect(recordDelivered(root, 's1', ['hooked'])).toBe(0);
        expect(readDelivered(root, 's1')).toHaveLength(1);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('never throws, whatever the tree looks like', () => {
        const wall = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-inject-wall-'));
        const blocked = path.join(wall, 'not-a-dir');
        fs.writeFileSync(blocked, 'x');
        expect(() => recordDelivered(blocked, 's1', ['anything'])).not.toThrow();
        fs.rmSync(wall, { recursive: true, force: true });
    });
});

/**
 * A tree shaped like a CONSUMER project: no `dist/`, no router, no bodies.
 * This is what every installed copy of the package actually runs in, and the
 * shape under which the shipped carrier delivered nothing at all.
 */
function makeForeignProject(opts: { settings?: string } = {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-inject-foreign-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.ts'), 'export const x = 1;\n', 'utf-8');
    if (opts.settings !== undefined) {
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), opts.settings, 'utf-8');
    }
    return root;
}

/** A tree shaped like an INSTALLED package: router + projected bodies, no settings. */
function makePackageRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-inject-pkg-'));
    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(ROUTER), 'utf-8');
    for (const [id, text] of Object.entries(BODIES)) {
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', `${id}.md`), text, 'utf-8');
    }
    return root;
}

/** Run `main` with `AGENT_CONFIG_PACKAGE_ROOT` pinned for the call, capturing stderr. */
function runWithPackage(
    pkgRoot: string | null,
    envelope: Record<string, unknown>,
    argv: string[] = [],
): { rc: number; out: string; err: string } {
    const prev = process.env['AGENT_CONFIG_PACKAGE_ROOT'];
    if (pkgRoot === null) delete process.env['AGENT_CONFIG_PACKAGE_ROOT'];
    else process.env['AGENT_CONFIG_PACKAGE_ROOT'] = pkgRoot;
    let err = '';
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
        err += typeof chunk === 'string' ? chunk : String(chunk);
        return true;
    }) as typeof process.stderr.write);
    try {
        const { rc, out } = run(envelope, argv);
        return { rc, out, err };
    } finally {
        errSpy.mockRestore();
        if (prev === undefined) delete process.env['AGENT_CONFIG_PACKAGE_ROOT'];
        else process.env['AGENT_CONFIG_PACKAGE_ROOT'] = prev;
    }
}

const DELIVERY_SETTINGS = 'lean_projection:\n  mode: delivery\n  hosts: [claude-code]\n';

describe('rule-inject — foreign-project resolution (1.1)', () => {
    it('delivers a matched body in a project that carries no corpus of its own', () => {
        const project = makeForeignProject({ settings: DELIVERY_SETTINGS });
        const pkg = makePackageRoot();
        const { rc, out } = runWithPackage(pkg, {
            event: 'user_prompt_submit',
            workspace: project,
            session_id: 'foreign-1',
            payload: { prompt: 'plan the migration' },
        });
        expect(rc).toBe(2);
        expect(rules(out)).toEqual(['prompt-rule']);
        expect(out).toContain('PROMPT RULE BODY');
    });

    it('agents/overrides/ wins over the package copy', () => {
        const project = makeForeignProject({ settings: DELIVERY_SETTINGS });
        const pkg = makePackageRoot();
        fs.mkdirSync(path.join(project, 'agents', 'overrides'), { recursive: true });
        fs.writeFileSync(
            path.join(project, 'agents', 'overrides', 'prompt-rule.md'),
            'OVERRIDDEN BODY\n',
            'utf-8',
        );
        const { out } = runWithPackage(pkg, {
            event: 'user_prompt_submit',
            workspace: project,
            session_id: 'foreign-override',
            payload: { prompt: 'plan the migration' },
        });
        expect(out).toContain('OVERRIDDEN BODY');
        expect(out).not.toContain('PROMPT RULE BODY');
    });

    it('no package root resolves — one diagnostic reason, and no rule body', () => {
        const project = makeForeignProject({ settings: DELIVERY_SETTINGS });
        const { rc, out } = runWithPackage(null, {
            event: 'user_prompt_submit',
            workspace: project,
            session_id: 'foreign-2',
            payload: { prompt: 'plan the migration' },
        });
        // A warn carrying a `reason` and no body. The dispatcher turns that
        // into `additionalContext` at exit 0 on this host — asserted end to end
        // in `rule_inject_foreign_matrix.test.ts`, which is the only place that
        // can see the translation.
        expect(rc).toBe(2);
        const reply = JSON.parse(out) as Record<string, unknown>;
        expect(reply['reason']).toContain('AGENT_CONFIG_PACKAGE_ROOT');
        expect(reply['additional_context']).toBeUndefined();
        expect(out).not.toContain('<rule id=');
    });

    it('a package root moved after install names both trees it looked in', () => {
        const project = makeForeignProject({ settings: DELIVERY_SETTINGS });
        const pkg = makePackageRoot();
        fs.rmSync(pkg, { recursive: true, force: true });
        const { rc, out } = runWithPackage(pkg, {
            event: 'user_prompt_submit',
            workspace: project,
            session_id: 'foreign-3',
            payload: { prompt: 'plan the migration' },
        });
        expect(rc).toBe(2);
        const reason = (JSON.parse(out) as { reason: string }).reason;
        // A set-but-gone root is a DIFFERENT operator action from an unset one,
        // so it must not produce the unset wording. It names both trees.
        expect(reason).toContain(project);
        expect(reason).toContain(pkg);
        expect(reason).not.toContain('unset');
    });

    it('the maintainer checkout still answers from its own tree', () => {
        const root = makeRoot({ delivery: true });
        const pkg = makePackageRoot();
        const { out } = runWithPackage(pkg, {
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'maintainer-1',
            payload: { prompt: 'plan the migration' },
        });
        expect(rules(out)).toEqual(['prompt-rule']);
    });
});

/**
 * Write `ids` as `.md` files into one host rule layer.
 *
 * Each case stages its own layer rather than reading the machine's, because
 * `os.homedir()` reads `$HOME`: a fixture that read the developer's installed
 * corpus would answer differently in CI.
 */
function hostLayer(root: string, ids: string[]): void {
    const dir = path.join(root, '.claude', 'rules');
    fs.mkdirSync(dir, { recursive: true });
    for (const id of ids) fs.writeFileSync(path.join(dir, `${id}.md`), 'INSTALLED STUB\n', 'utf-8');
}

describe('rule-inject — delivery scope is what the install carries (1.3)', () => {
    it('a rule the project rule layer does not carry is NOT delivered', () => {
        const root = makeRoot({ delivery: true });
        hostLayer(root, ['some-other-rule']);
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'scope-1',
            payload: { prompt: 'plan the migration' },
        });
        expect(rules(out)).toEqual([]);
    });

    it('a rule the project rule layer DOES carry is delivered, body from the package corpus', () => {
        const root = makeRoot({ delivery: true });
        hostLayer(root, ['prompt-rule']);
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'scope-2',
            payload: { prompt: 'plan the migration' },
        });
        expect(rules(out)).toEqual(['prompt-rule']);
        // The installed file says WHICH rule is in scope and never what it
        // says: under `delivery` it is a thin stub, so a carrier reading the
        // body from there would ship the stub.
        expect(out).toContain('PROMPT RULE BODY');
        expect(out).not.toContain('INSTALLED STUB');
    });

    it('the USER layer counts too — the host loads both, so the scope is their union', () => {
        const root = makeRoot({ delivery: true });
        const home = mkdtemp('rule-inject-userhome-');
        hostLayer(home, ['prompt-rule']);
        vi.stubEnv('HOME', home);
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'scope-3',
            payload: { prompt: 'plan the migration' },
        });
        expect(rules(out)).toEqual(['prompt-rule']);
    });

    it('an EMPTY host rule layer scopes to nothing — a declaration, not an absence', () => {
        const root = makeRoot({ delivery: true });
        fs.mkdirSync(path.join(root, '.claude', 'rules'), { recursive: true });
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'scope-4',
            payload: { prompt: 'plan the migration' },
        });
        expect(rules(out)).toEqual([]);
    });

    it('NO host rule layer anywhere applies no filter — never the silence 1.1 repaired', () => {
        // `null` from `hostRuleLayerIds` is a different answer from an empty
        // set: scoping to empty in a tree that declares no layer would make the
        // carrier silent again in exactly the tree 1.1 taught it to speak in.
        const root = makeRoot({ delivery: true });
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'scope-5',
            payload: { prompt: 'plan the migration' },
        });
        expect(rules(out)).toEqual(['prompt-rule']);
    });
});

/** Overwrite one rule's projected body in the package corpus of `root`. */
function putBody(root: string, id: string, text: string): void {
    fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', `${id}.md`), text, 'utf-8');
}

describe('rule-inject — host-form: the delivered text (1.4)', () => {
    const RAW = [
        '---',
        'description: routing surface, never payload',
        'type: auto',
        'triggers:',
        '  - keyword: migration',
        '---',
        '',
        '# Prompt Rule',
        '',
        '<!-- risk-review: v1 | reviewed: 2026-10-03 -->',
        '',
        'THE OBLIGATION LINE.',
        '',
        '<!-- harvest:some-id -->',
        '',
    ].join('\n');

    it('frontmatter and HTML comments never reach the payload', () => {
        const root = makeRoot({ delivery: true });
        putBody(root, 'prompt-rule', RAW);
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'host-form-1',
            payload: { prompt: 'plan the migration' },
        });
        expect(rules(out)).toEqual(['prompt-rule']);
        expect(out).toContain('THE OBLIGATION LINE.');
        // The router already read the frontmatter; shipping it again charges the
        // delivery for bytes the model cannot act on.
        expect(out).not.toContain('routing surface, never payload');
        expect(out).not.toContain('risk-review');
        expect(out).not.toContain('harvest:some-id');
        expect(out).not.toContain('---');
    });

    it('is the same parser the thin projector uses — not a second regex', () => {
        const root = makeRoot({ delivery: true });
        putBody(root, 'prompt-rule', RAW);
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'host-form-2',
            payload: { prompt: 'plan the migration' },
        });
        const body = (JSON.parse(out) as { additional_context: string }).additional_context;
        const inner = /<rule id="prompt-rule"[^>]*>\n([\s\S]*)\n<\/rule>/.exec(body)?.[1];
        expect(inner).toBe(ruleBody(RAW));
    });

    it('a file that is nothing but frontmatter and comments delivers no rule element', () => {
        const root = makeRoot({ delivery: true });
        putBody(root, 'prompt-rule', '---\ntype: auto\n---\n\n<!-- nothing else -->\n');
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'host-form-3',
            payload: { prompt: 'plan the migration' },
        });
        // An empty `<rule>` element is framing with no content inside it. The
        // match is still REPORTED — step 1.5's manifest labels it rather than
        // dropping it, because a silent drop is indistinguishable from no match.
        expect(out).not.toContain('<rule id=');
        expect(out).toContain('prompt-rule=source_unavailable');
    });
});

/** Parse the manifest block out of a delivery, as `id -> form`. */
function manifest(out: string): Record<string, string> {
    const block = /<rule-manifest>\n([\s\S]*?)\n<\/rule-manifest>/.exec(composed(out))?.[1] ?? '';
    const rows: Record<string, string> = {};
    for (const line of block.split('\n')) {
        const [id, form] = line.split('=');
        if (id !== undefined && form !== undefined) rows[id] = form;
    }
    return rows;
}

/** The whole rule-produced string, which is what the budget bounds. */
function composed(out: string): string {
    return (JSON.parse(out) as { additional_context: string }).additional_context;
}

/** Replace the router so a case can state exactly which rules compete. */
function putRouter(root: string, tier1: string[], tier2: string[]): void {
    const t = (ids: string[], extra = false): unknown[] =>
        ids.map((id) => ({
            id,
            triggers: extra
                ? [{ keyword: 'migration' }, { keyword: 'plan' }]
                : [{ keyword: 'migration' }],
        }));
    fs.writeFileSync(
        path.join(root, 'dist', 'router.json'),
        JSON.stringify({ kernel: [], tier_1: t(tier1, true), tier_2: t(tier2) }),
        'utf-8',
    );
}

/**
 * A body whose law section is SHORT and whose tail is long.
 *
 * The `## Notes` heading is load-bearing: a law section runs to the next
 * heading of the same or shallower depth, so without one the law would be the
 * whole body and a demotion would save nothing.
 */
/** A body whose LAW is long, for the cases where the law is what competes. */
function withLongLaw(id: string, law: number): string {
    return (
        `# ${id}\n\n## Iron Law\n\n\`\`\`\nLAW OF ${id.toUpperCase()}.\n${'law '.repeat(law)}\n\`\`\`\n\n`
        + `## Notes\n\nshort tail\n`
    );
}

function withLaw(id: string, tail: number): string {
    return (
        `# ${id}\n\n## Iron Law\n\n\`\`\`\nLAW OF ${id.toUpperCase()}.\n\`\`\`\n\n`
        + `## Notes\n\n${'tail '.repeat(tail)}`
    );
}

const PROMPT = { prompt: 'plan the migration' };

describe('rule-inject — composed-budget: one string, and a manifest (1.5)', () => {
    it('every matched rule appears in the manifest, delivered or not', () => {
        const root = makeRoot({ delivery: true });
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-1',
            payload: PROMPT,
        });
        expect(manifest(out)).toEqual({ 'prompt-rule': 'full' });
    });

    it('a body the byte cap dropped is reported, never silently gone', () => {
        // Before this step `selectForInjection`'s `dropped` list was read by
        // nothing, so a consumer could not tell a rule that did not match from
        // one that matched and was discarded.
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], ['blade-rule', 'views-rule']);
        for (const id of ['prompt-rule', 'blade-rule', 'views-rule']) {
            putBody(root, id, `# ${id}\n\n${'x '.repeat(CAP_BYTES)}`);
        }
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-2',
            payload: PROMPT,
        });
        const rows = manifest(out);
        // `blade-rule` and `views-rule` lose the byte cap to the higher-scoring
        // rule. Their sources are readable, so `omitted_budget` is the only
        // honest label — `source_unavailable` would blame the install for a
        // budget decision.
        expect(rows).toEqual({
            'prompt-rule': 'omitted_budget',
            'blade-rule': 'omitted_budget',
            'views-rule': 'omitted_budget',
        });
        expect(composed(out).length).toBeLessThanOrEqual(COMPOSED_CHARS);
    });

    it('a rule with no readable source is reported as such, never as delivered', () => {
        const root = makeRoot({ delivery: true });
        fs.rmSync(path.join(root, 'dist', 'agent-src', 'rules', 'prompt-rule.md'));
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-3',
            payload: PROMPT,
        });
        expect(manifest(out)['prompt-rule']).toBe('source_unavailable');
        expect(rules(out)).toEqual([]);
        // A path alone is never labelled delivered.
        expect(composed(out)).not.toContain('form="full"');
    });

    it('a body that does not fit is DEMOTED to its law, never truncated', () => {
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], ['blade-rule']);
        putBody(root, 'prompt-rule', withLaw('prompt-rule', 900));
        putBody(root, 'blade-rule', withLaw('blade-rule', 900));
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-5',
            payload: PROMPT,
        });
        const text = composed(out);
        expect(text.length).toBeLessThanOrEqual(COMPOSED_CHARS);
        const rows = manifest(out);
        expect(rows['prompt-rule']).toBe('full');
        expect(rows['blade-rule']).toBe('law');
        // Demoted, not cut: the law is whole and the body's tail is absent.
        const lawPart = /<rule id="blade-rule"[^>]*form="law">\n([\s\S]*?)\n<\/rule>/.exec(text)?.[1];
        expect(lawPart).toBe(lawText(ruleBody(withLaw('blade-rule', 900))));
    });

    it('a high-consequence law goes FIRST, ahead of a higher-scoring full body (D1)', () => {
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], ['blade-rule']);
        putBody(root, 'prompt-rule', withLaw('prompt-rule', 900));
        putBody(root, 'blade-rule', withLaw('blade-rule', 900));
        // `blade-rule` scores lower and sorts later, and is declared
        // high-consequence — so its LAW is admitted before the other rule's body
        // competes for what is left. Without phase 1 the budget would be spent
        // on `prompt-rule` first and this law would not be in the string.
        const cfg = path.join(root, 'src', 'config');
        fs.mkdirSync(cfg, { recursive: true });
        fs.writeFileSync(
            path.join(cfg, 'rule-consequence-class.json'),
            JSON.stringify({
                members: { 'blade-rule': { clause: 'security-boundary', why: 'fixture' } },
            }),
            'utf-8',
        );
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-6',
            payload: PROMPT,
        });
        const text = composed(out);
        expect(manifest(out)['blade-rule']).toBe('law');
        expect(text.indexOf('LAW OF BLADE-RULE.')).toBeLessThan(
            text.indexOf('<rule id="prompt-rule"'),
        );
    });

    it('the character budget is the registered row, and the byte row still bounds it', () => {
        const repo = path.resolve(__dirname, '..', '..');
        const budget = JSON.parse(
            fs.readFileSync(path.join(repo, 'src', 'config', 'hook-token-budget.json'), 'utf-8'),
        ) as {
            per_concern_caps_chars: Record<string, number>;
            per_concern_caps_bytes: Record<string, number>;
        };
        expect(budget.per_concern_caps_chars['rule-inject']).toBe(COMPOSED_CHARS);
        expect(budget.per_concern_caps_bytes['rule-inject']).toBe(CAP_BYTES);

        // The claim the two-unit registration rests on, re-measured here rather
        // than quoted: no projected rule file is dense enough for a composed
        // string of COMPOSED_CHARS to reach the byte row.
        const dir = path.join(repo, 'dist', 'agent-src', 'rules');
        let worst = 0;
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.md')) continue;
            const t = fs.readFileSync(path.join(dir, f), 'utf-8');
            worst = Math.max(worst, Buffer.byteLength(t, 'utf-8') / t.length);
        }
        expect(worst).toBeLessThan(CAP_BYTES / COMPOSED_CHARS);
    });
});

describe('rule-inject — re-deliver after a compact (1.6)', () => {
    /** Deliver `prompt-rule`, then cross a compaction boundary. */
    function upToCompaction(session: string): string {
        const root = makeRoot({ delivery: true });
        putBody(root, 'prompt-rule', withLaw('prompt-rule', 200));
        run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: session,
            payload: PROMPT,
        });
        run({ event: 'pre_compact', workspace: root, session_id: session, payload: {} });
        return root;
    }

    it('session_start with source compact sends the LAW of each rule the boundary took', () => {
        const root = upToCompaction('cp-1');
        const { rc, out } = run({
            event: 'session_start',
            workspace: root,
            session_id: 'cp-1',
            payload: { source: 'compact' },
        });
        expect(rc).toBe(2);
        expect(manifest(out)).toEqual({ 'prompt-rule': 'law' });
        expect(composed(out)).toContain('LAW OF PROMPT-RULE.');
        // The law, not the body: its tail stays out.
        expect(composed(out)).not.toContain('tail tail');
    });

    it('any other source sends nothing — the host already has that context', () => {
        for (const source of ['startup', 'resume', 'clear', 'fork', 'wat']) {
            const root = upToCompaction(`cp-src-${source}`);
            const { rc, out } = run({
                event: 'session_start',
                workspace: root,
                session_id: `cp-src-${source}`,
                payload: { source },
            });
            expect([rc, out]).toEqual([0, '']);
        }
    });

    it('the restore fires once — a second session_start on the same boundary is silent', () => {
        const root = upToCompaction('cp-2');
        const first = run({
            event: 'session_start',
            workspace: root,
            session_id: 'cp-2',
            payload: { source: 'compact' },
        });
        expect(first.rc).toBe(2);
        const second = run({
            event: 'session_start',
            workspace: root,
            session_id: 'cp-2',
            payload: { source: 'compact' },
        });
        expect([second.rc, second.out]).toEqual([0, '']);
    });

    it('a restore does NOT re-arm the de-duplication — a re-matching trigger still sends the body', () => {
        // The pre-1.6 contract, unchanged: `pre_compact` empties `rules`, so a
        // rule whose trigger fires again gets its whole body back. The restore
        // is for the rules whose trigger does not recur.
        const root = upToCompaction('cp-3');
        run({
            event: 'session_start',
            workspace: root,
            session_id: 'cp-3',
            payload: { source: 'compact' },
        });
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cp-3',
            payload: PROMPT,
        });
        expect(manifest(out)).toEqual({ 'prompt-rule': 'full' });
        expect(composed(out)).toContain('tail tail');
    });

    it('the seen-set carries ids across the boundary, never body copies', () => {
        const root = upToCompaction('cp-4');
        const state = JSON.parse(fs.readFileSync(statePath(root, 'cp-4'), 'utf-8')) as {
            rules: string[];
            pending: string[];
        };
        expect(state).toEqual({ rules: [], pending: ['prompt-rule'] });
        // A state file that cached bodies would be a second copy of the rule
        // layer in the consumer's tree, going stale on every upgrade.
        expect(fs.readFileSync(statePath(root, 'cp-4'), 'utf-8')).not.toContain('LAW OF');
    });

    it('a compaction with nothing delivered yet restores nothing', () => {
        const root = makeRoot({ delivery: true });
        run({ event: 'pre_compact', workspace: root, session_id: 'cp-5', payload: {} });
        const { rc, out } = run({
            event: 'session_start',
            workspace: root,
            session_id: 'cp-5',
            payload: { source: 'compact' },
        });
        expect([rc, out]).toEqual([0, '']);
    });

    it('a restored rule whose source is gone is reported, never silently absent', () => {
        const root = upToCompaction('cp-6');
        fs.rmSync(path.join(root, 'dist', 'agent-src', 'rules', 'prompt-rule.md'));
        const { out } = run({
            event: 'session_start',
            workspace: root,
            session_id: 'cp-6',
            payload: { source: 'compact' },
        });
        expect(manifest(out)).toEqual({ 'prompt-rule': 'source_unavailable' });
    });

    it('the restore obeys the same character budget', () => {
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], ['blade-rule', 'views-rule']);
        for (const id of ['prompt-rule', 'blade-rule', 'views-rule']) {
            // LONG laws, not long bodies. A restore sends laws, so a fixture
            // whose laws are forty characters asserts a 400-character string
            // against an 8,000 cap and stays green with the budget code deleted.
            // Three 3,500-character laws cannot all fit, so the cap binds.
            putBody(root, id, withLongLaw(id, 700));
        }
        run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cp-7',
            payload: PROMPT,
        });
        run({ event: 'pre_compact', workspace: root, session_id: 'cp-7', payload: {} });
        const { out } = run({
            event: 'session_start',
            workspace: root,
            session_id: 'cp-7',
            payload: { source: 'compact' },
        });
        expect(composed(out).length).toBeLessThanOrEqual(COMPOSED_CHARS);
    });
});

describe('rule-inject — state-location: the seen-set leaves the consumer tree (1.7)', () => {
    function fire(root: string, session: string): void {
        run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: session,
            payload: PROMPT,
        });
    }

    it('writes nothing under the workspace', () => {
        const root = makeRoot({ delivery: true });
        fire(root, 'st-1');
        expect(fs.existsSync(path.join(root, 'agents', 'runtime', 'state', 'rule-inject'))).toBe(
            false,
        );
        expect([...readSeen(root, 'st-1')]).toEqual(['prompt-rule']);
    });

    it('writes under the user-global root, keyed by project', () => {
        const root = makeRoot({ delivery: true });
        fire(root, 'st-2');
        const p = statePath(root, 'st-2');
        expect(fs.existsSync(p)).toBe(true);
        expect(p.startsWith(path.join(HOME, '.event4u', 'agent-config'))).toBe(true);
        expect(p).toContain(path.join('state', 'rule-inject'));
        // Readable AND unique: the basename is there for a human opening the
        // directory, the digest is there because two projects can share one.
        expect(path.basename(path.dirname(p))).toMatch(/^.+-[0-9a-f]{12}$/);
    });

    it('two projects with the same session id do not share a seen-set', () => {
        const a = makeRoot({ delivery: true });
        const b = makeRoot({ delivery: true });
        fire(a, 'st-3');
        expect(statePath(a, 'st-3')).not.toBe(statePath(b, 'st-3'));
        expect([...readSeen(a, 'st-3')]).toEqual(['prompt-rule']);
        // B never fired, so B's rule is still deliverable under the same id.
        expect([...readSeen(b, 'st-3')]).toEqual([]);
    });

    it('the delivered-row ledger stays in the project and keeps its session join', () => {
        // `road-to-a-stop-that-holds` Phase 3 reads these rows and joins them on
        // the session id. The seen-set moving must not touch that, and the two
        // were never keyed on each other — this asserts it rather than assuming
        // it, because "nothing else changed" is exactly what a join break says
        // right up until it is found.
        const root = makeRoot({ delivery: true });
        fire(root, 'st-4');
        const rows = readDelivered(root, 'st-4');
        expect(rows.map((r) => r.rule)).toEqual(['prompt-rule']);
        // In the PROJECT tree, read back by project root plus session id — the
        // same two arguments the reader on the other side of the join uses.
        expect(readDelivered(root, 'st-other')).toEqual([]);
    });

    it('a restore after a compaction reads the moved state, not the old path', () => {
        const root = makeRoot({ delivery: true });
        putBody(root, 'prompt-rule', withLaw('prompt-rule', 200));
        fire(root, 'st-5');
        run({ event: 'pre_compact', workspace: root, session_id: 'st-5', payload: {} });
        const { out } = run({
            event: 'session_start',
            workspace: root,
            session_id: 'st-5',
            payload: { source: 'compact' },
        });
        expect(manifest(out)).toEqual({ 'prompt-rule': 'law' });
    });
});

describe('rule-inject — composed-budget over the FROZEN corpus (AC-2)', () => {
    it('no composed string exceeds the budget, against this repository own router and bodies', () => {
        // The acceptance criterion asks for a measurement, not an argument. The
        // composer cannot exceed the cap by construction, and a construction
        // argument is exactly what a reserve-then-fill loop gets wrong in the
        // one case nobody wrote down. So this sweeps every prompt in
        // `tests/eval/routing-matrix` against the REAL router and the REAL
        // bodies and reads the number off.
        const repo = path.resolve(__dirname, '..', '..');
        const dir = path.join(repo, 'tests', 'eval', 'routing-matrix');
        const prompts: string[] = [];
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.yaml')) continue;
            for (const line of fs.readFileSync(path.join(dir, f), 'utf-8').split('\n')) {
                const m = /^\s*-\s*prompt:\s*"([\s\S]*)"\s*$/.exec(line);
                if (m) prompts.push((m[1] as string).replace(/\\"/g, '"'));
            }
        }
        // A sweep that silently found nothing would pass vacuously.
        expect(prompts.length).toBeGreaterThan(200);

        // Routed from an EMPTY workspace with the repository as the package
        // root, so the sweep measures the whole router rather than whatever
        // `.claude/rules` the machine running it happens to carry. The scope
        // filter is a per-consumer narrowing; the budget has to hold for the
        // widest fire the corpus can produce, not the narrowest.
        const ws = mkdtemp('rule-inject-corpus-');
        vi.stubEnv('AGENT_CONFIG_PACKAGE_ROOT', repo);

        let worst = 0;
        let fires = 0;
        for (const prompt of prompts) {
            const inj = buildInjection(ws, prompt, null, null, new Set());
            if (inj === null) continue;
            fires += 1;
            worst = Math.max(worst, inj.body.length);
        }
        expect(fires).toBeGreaterThan(100);
        // Measured 2026-10-03: 444 fires over 588 prompts, worst 7,943 chars.
        expect(worst).toBeLessThanOrEqual(COMPOSED_CHARS);
        // And under the host's own replacement threshold, which is what the
        // budget exists to stay below.
        expect(worst).toBeLessThan(10_000);
    });
});

describe('rule-inject — composed-budget at the boundary and in bytes (council round 1)', () => {
    /** A body of exactly `n` characters, with no law section. */
    function sized(id: string, n: number): string {
        const head = `# ${id}\n\n`;
        return head + 'x'.repeat(Math.max(0, n - head.length));
    }

    it('admits the body that lands the string exactly ON the budget, and refuses the one over it', () => {
        // The boundary itself rather than a wide fire, because an off-by-one in
        // a reserve-then-fill loop is invisible to every case that is not at
        // the edge.
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], []);
        const framing = '<rule id="prompt-rule" tier="tier_1" form="full">\n\n</rule>\n\n'.length;
        const reserve = '<rule-manifest>\nprompt-rule=source_unavailable\n</rule-manifest>'.length;

        putBody(root, 'prompt-rule', sized('prompt-rule', COMPOSED_CHARS - framing - reserve));
        const exact = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-edge-1',
            payload: PROMPT,
        });
        expect(manifest(exact.out)['prompt-rule']).toBe('full');
        expect(composed(exact.out).length).toBeLessThanOrEqual(COMPOSED_CHARS);

        putBody(root, 'prompt-rule', sized('prompt-rule', COMPOSED_CHARS - framing - reserve + 1));
        const over = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-edge-2',
            payload: PROMPT,
        });
        // One character more and it is reported, never shortened to fit.
        expect(manifest(over.out)['prompt-rule']).toBe('omitted_budget');
        expect(composed(over.out).length).toBeLessThanOrEqual(COMPOSED_CHARS);
    });

    it('the BYTE row binds independently — a dense payload under the char budget is still capped', () => {
        // The measured 1.0346 bytes-per-character maximum over today's corpus is
        // evidence, not an invariant: one BMP code point is one character and
        // three UTF-8 bytes, so 6,000 of them are 6,000 characters and 18,000
        // bytes — under the character budget and over the byte row. Built from
        // a code point rather than written as a literal so the file stays ASCII.
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], []);
        const dense = `# prompt-rule\n\n${String.fromCharCode(0x3042).repeat(6000)}`;
        expect(dense.length).toBeLessThan(COMPOSED_CHARS);
        expect(Buffer.byteLength(dense, 'utf-8')).toBeGreaterThan(CAP_BYTES);
        putBody(root, 'prompt-rule', dense);
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-dense',
            payload: PROMPT,
        });
        expect(manifest(out)['prompt-rule']).toBe('omitted_budget');
        expect(Buffer.byteLength(composed(out), 'utf-8')).toBeLessThanOrEqual(CAP_BYTES);
    });
});

describe('rule-inject — composed-budget: the manifest is bounded too', () => {
    it('a fire whose REPORT alone would exceed the budget still emits within it', () => {
        // The reserve is taken at the longest label, so the manifest always fits
        // what was reserved. The case this covers is the reserve itself being
        // over the cap: enough matched rules that the report alone is more than
        // 8,000 characters. No router today comes close, and "no corpus today
        // comes close" is exactly the shape of claim the byte check beside this
        // one exists because of — so it is a property here, not an observation.
        const root = makeRoot({ delivery: true });
        const many = Array.from({ length: 400 }, (_, i) => `wide-rule-${String(i).padStart(4, '0')}`);
        putRouter(root, many.slice(0, 1), many.slice(1));
        for (const id of many) putBody(root, id, `# ${id}\n\nbody\n`);
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'cb-wide',
            payload: PROMPT,
        });
        const text = composed(out);
        expect(text.length).toBeLessThanOrEqual(COMPOSED_CHARS);
        // And it says how many rows it could not show, rather than dropping
        // them where a reader would read the list as complete.
        expect(text).toMatch(/\n\+\d+=omitted_budget\n<\/rule-manifest>$/);
    });
});

describe('rule-inject — composed-budget: phase 1 is a floor, never a ceiling', () => {
    /** Declare `ids` as the high-consequence class, with `noStub` carved out. */
    function declareClass(root: string, ids: string[], noStub: string[] = []): void {
        const cfg = path.join(root, 'src', 'config');
        fs.mkdirSync(cfg, { recursive: true });
        const row = { clause: 'security-boundary', why: 'fixture' };
        fs.writeFileSync(
            path.join(cfg, 'rule-consequence-class.json'),
            JSON.stringify({
                members: Object.fromEntries(ids.map((id) => [id, row])),
                no_stub: Object.fromEntries(noStub.map((id) => [id, { ...row, reason: 'fixture' }])),
            }),
            'utf-8',
        );
    }

    it('a high-consequence rule gets its WHOLE body when the budget has room', () => {
        // The regression this exists for: phase 1 emits the law and sets
        // `form = 'law'`, phase 2 skips anything not `omitted_budget`, and the
        // 23 class members with a law section could then never receive their
        // body however empty the budget was. Their id still enters the seen-set,
        // so the body would not come back on a later turn either.
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], []);
        declareClass(root, ['prompt-rule']);
        putBody(root, 'prompt-rule', withLaw('prompt-rule', 100));
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'floor-1',
            payload: PROMPT,
        });
        expect(manifest(out)).toEqual({ 'prompt-rule': 'full' });
        expect(composed(out)).toContain('tail tail');
        // Upgraded in place, not emitted twice.
        expect(composed(out).match(/<rule id="prompt-rule"/g)).toHaveLength(1);
    });

    it('and keeps the law when the budget has room for that and nothing more', () => {
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], []);
        declareClass(root, ['prompt-rule']);
        putBody(root, 'prompt-rule', withLaw('prompt-rule', 3000));
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'floor-2',
            payload: PROMPT,
        });
        expect(manifest(out)).toEqual({ 'prompt-rule': 'law' });
        expect(composed(out)).toContain('LAW OF PROMPT-RULE.');
        expect(composed(out)).not.toContain('tail tail');
    });

    it('a no_stub member does NOT take the guaranteed phase-1 slot', () => {
        // `stubLawIds` and not `Object.keys(members)`: the `no_stub` subset is
        // exactly the members whose law is missing or too long to carry the
        // obligation, which is why the projector ships them full-bodied.
        //
        // Sized so the difference is observable: `prompt-rule` scores higher and
        // its body nearly fills the budget. Read through `stubLawIds`,
        // `blade-rule` is not in phase 1 and the higher-scoring body lands
        // whole. Read through `Object.keys(members)`, `blade-rule`'s law takes
        // the guaranteed slot first and `prompt-rule` no longer fits — a rule
        // whose law was declared unable to stand would have pre-empted one that
        // can.
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], ['blade-rule']);
        declareClass(root, ['blade-rule'], ['blade-rule']);
        putBody(root, 'prompt-rule', `# prompt-rule\n\n${'x '.repeat(3900)}`);
        putBody(root, 'blade-rule', withLongLaw('blade-rule', 700));
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'floor-3',
            payload: PROMPT,
        });
        expect(manifest(out)['prompt-rule']).toBe('full');
        expect(manifest(out)['blade-rule']).toBe('omitted_budget');
    });

    it('a class member the BYTE cap dropped still gets its law — D1 says every matched', () => {
        // `selectForInjection` ranks on score alone and knows nothing about the
        // class, so a high-consequence rule can lose that race and land in
        // `dropped`. D1 guarantees the law of EVERY matched member, so the text
        // for a dropped member is loaded rather than left unreachable.
        const root = makeRoot({ delivery: true });
        putRouter(root, ['prompt-rule'], ['blade-rule']);
        // `prompt-rule` scores higher and is alone big enough to exhaust the
        // byte cap, so `blade-rule` is dropped by the selection.
        putBody(root, 'prompt-rule', `# prompt-rule\n\n${'x '.repeat(CAP_BYTES)}`);
        putBody(root, 'blade-rule', withLaw('blade-rule', 50));
        declareClass(root, ['blade-rule']);
        const { out } = run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'floor-4',
            payload: PROMPT,
        });
        // DELIVERED, in some form — not reported. `law` is the floor D1
        // guarantees; phase 2 upgrades it to `full` here because the oversized
        // `prompt-rule` body never fit the character budget and left room. What
        // this pins is that a dropped class member is reachable at all: without
        // the dropped-set read it has no text loaded, phases 2 and 3 skip it,
        // and it comes back `omitted_budget`.
        expect(['law', 'full']).toContain(manifest(out)['blade-rule']);
        expect(composed(out)).toContain('LAW OF BLADE-RULE.');
    });
});

describe('rule-inject — state-location: the digest half of the project key', () => {
    it('two projects with the SAME basename do not share a seen-set', () => {
        // The collision the key exists for. Two `mkdtemp` roots already differ
        // by basename, so a test built from those passes with the digest
        // removed — it asserts nothing about the half that does the work.
        const a = path.join(makeRoot({ delivery: true }), 'api');
        const b = path.join(makeRoot({ delivery: true }), 'api');
        fs.mkdirSync(a);
        fs.mkdirSync(b);
        expect(path.basename(a)).toBe(path.basename(b));
        const pa = statePath(a, 'same-id');
        const pb = statePath(b, 'same-id');
        expect(pa).not.toBe(pb);
        // Readable AND unique: both carry the shared basename, and the digests
        // are what separate them.
        expect(path.basename(path.dirname(pa))).toMatch(/^api-[0-9a-f]{12}$/);
        expect(path.basename(path.dirname(pb))).toMatch(/^api-[0-9a-f]{12}$/);
    });
});

describe('rule-inject — the restore keeps its pending set when it cannot build', () => {
    it('a router that disappeared mid-session leaves the pending set intact', () => {
        // Clearing before the build means a build that fails loses the set
        // permanently, on the one slot that does not come round again for that
        // boundary.
        const root = makeRoot({ delivery: true });
        putBody(root, 'prompt-rule', withLaw('prompt-rule', 50));
        run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'keep-1',
            payload: PROMPT,
        });
        run({ event: 'pre_compact', workspace: root, session_id: 'keep-1', payload: {} });
        fs.rmSync(path.join(root, 'dist', 'router.json'));

        const failed = run({
            event: 'session_start',
            workspace: root,
            session_id: 'keep-1',
            payload: { source: 'compact' },
        });
        expect(failed.rc).toBe(0);
        const state = JSON.parse(fs.readFileSync(statePath(root, 'keep-1'), 'utf-8')) as {
            pending: string[];
        };
        expect(state.pending).toEqual(['prompt-rule']);

        // And once the router is back, the restore it was holding still fires.
        fs.writeFileSync(
            path.join(root, 'dist', 'router.json'),
            JSON.stringify(ROUTER),
            'utf-8',
        );
        const { out } = run({
            event: 'session_start',
            workspace: root,
            session_id: 'keep-1',
            payload: { source: 'compact' },
        });
        expect(manifest(out)).toEqual({ 'prompt-rule': 'law' });
    });

    it('a rule with NO law section comes back as its body, not as a budget excuse', () => {
        // A restore sends laws, so a law-less rule has nothing to send in that
        // form — and `omitted_budget` would blame a budget decision nobody made.
        // Those compete for their body instead, so every label on the restore is
        // true of the rule it names.
        const root = makeRoot({ delivery: true });
        run({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: 'nolaw-1',
            payload: PROMPT,
        });
        run({ event: 'pre_compact', workspace: root, session_id: 'nolaw-1', payload: {} });
        const { out } = run({
            event: 'session_start',
            workspace: root,
            session_id: 'nolaw-1',
            payload: { source: 'compact' },
        });
        expect(manifest(out)).toEqual({ 'prompt-rule': 'full' });
        expect(composed(out)).toContain('PROMPT RULE BODY');
    });
});
