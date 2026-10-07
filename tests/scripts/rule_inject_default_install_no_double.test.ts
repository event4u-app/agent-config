// `road-to-a-default-install-served-once` step 1.1 — a default install is not
// served twice.
//
// The carrier's gate opens on the template's `delivery`, while the installer
// thins `~/.claude/rules` only on an explicit user-global choice. So a default
// install holds every routed body in its rule files; delivering the same body
// by injection is a second copy of text already standing. Each case drives
// `main()` with a real envelope and counts what the carrier emitted.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THIN_ENTRY_MARKER } from '../../src/scripts/_lib/thin_rules.js';
import {
    clearHookStdinOverride,
    setHookStdinOverride,
} from '../../src/scripts/hooks/hook_stdin.js';
import { installedFullIds, main } from '../../src/scripts/hooks/rule_inject_hook.js';

const ROUTER = {
    kernel: [],
    tier_1: [
        { id: 'alpha-rule', triggers: [{ keyword: 'migration' }] },
        { id: 'beta-rule', triggers: [{ keyword: 'migration' }] },
    ],
    tier_2: [],
};

const BODIES: Record<string, string> = {
    'alpha-rule': 'ALPHA RULE BODY\n',
    'beta-rule': 'BETA RULE BODY\n',
};

const MADE: string[] = [];

function mkdtemp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    MADE.push(d);
    return d;
}

/**
 * A project whose resolved mode is `delivery` — the shape every default
 * install has, because the shipped template says so. The PROJECT layer is not
 * consent to thin, so this value opens the gate and grants nothing else.
 */
function makeRoot(): string {
    const root = mkdtemp('rule-inject-once-');
    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(ROUTER), 'utf-8');
    for (const [id, text] of Object.entries(BODIES)) {
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', `${id}.md`), text, 'utf-8');
    }
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        'lean_projection:\n  mode: delivery\n  hosts: [claude-code]\n',
        'utf-8',
    );
    return root;
}

/** `~/.claude/rules` as an install wrote it: `full` ids carry bodies, `stub` ids stubs. */
function installLayer(home: string, full: string[], stub: string[]): void {
    const dir = path.join(home, '.claude', 'rules');
    fs.mkdirSync(dir, { recursive: true });
    for (const id of full) fs.writeFileSync(path.join(dir, `${id}.md`), BODIES[id] as string, 'utf-8');
    for (const id of stub) {
        fs.writeFileSync(path.join(dir, `${id}.md`), `# ${id}\n\n${THIN_ENTRY_MARKER}\n`, 'utf-8');
    }
}

/** The explicit user-global choice the installer reads as consent to thin. */
function optIn(home: string): void {
    const dir = path.join(home, '.event4u', 'agent-config', 'settings');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, '.agent-settings.yml'),
        'lean_projection:\n  mode: delivery\n  hosts: [claude-code]\n',
        'utf-8',
    );
}

function run(root: string, session: string): string {
    setHookStdinOverride(
        JSON.stringify({
            event: 'user_prompt_submit',
            workspace: root,
            session_id: session,
            payload: { prompt: 'plan the migration' },
        }),
    );
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        out += typeof chunk === 'string' ? chunk : String(chunk);
        return true;
    }) as typeof process.stdout.write);
    try {
        main([]);
    } finally {
        spy.mockRestore();
        clearHookStdinOverride();
    }
    return out.trim() === '' ? '' : (JSON.parse(out) as { additional_context: string }).additional_context;
}

/** Characters injected for rules whose full body already stands in the install. */
function duplicatedChars(context: string, fullInstalled: string[]): number {
    let n = 0;
    for (const id of fullInstalled) {
        const m = new RegExp(`<rule id="${id}"[^>]*>([\\s\\S]*?)</rule>`).exec(context);
        if (m !== null) n += (m[1] as string).length;
    }
    return n;
}

let home = '';

beforeEach(() => {
    home = mkdtemp('rule-inject-once-home-');
    vi.stubEnv('HOME', home);
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

describe('rule-inject — a default install is served once (1.1)', () => {
    it('a default (unthinned) install receives ZERO duplicated bodies', () => {
        const root = makeRoot();
        installLayer(home, ['alpha-rule', 'beta-rule'], []);
        const context = run(root, 'once-1');
        expect(duplicatedChars(context, ['alpha-rule', 'beta-rule'])).toBe(0);
        expect(context).toBe('');
    });

    it('a stub on a default install still gets its body — the installed form decides', () => {
        // A stale stub from an earlier opted-in deploy is not a full body, so
        // starving it would leave the rule with nothing in context at all.
        const root = makeRoot();
        installLayer(home, ['alpha-rule'], ['beta-rule']);
        const context = run(root, 'once-2');
        expect(duplicatedChars(context, ['alpha-rule'])).toBe(0);
        expect(context).toContain('<rule id="beta-rule"');
        expect(context).toContain('BETA RULE BODY');
        expect(context).not.toContain('ALPHA RULE BODY');
    });

    it('one full copy in EITHER layer is enough — the host loads both', () => {
        const root = makeRoot();
        installLayer(home, [], ['alpha-rule', 'beta-rule']);
        const projectRules = path.join(root, '.claude', 'rules');
        fs.mkdirSync(projectRules, { recursive: true });
        fs.writeFileSync(path.join(projectRules, 'alpha-rule.md'), BODIES['alpha-rule'] as string, 'utf-8');
        expect([...installedFullIds(root, ['alpha-rule', 'beta-rule'])]).toEqual(['alpha-rule']);
        const context = run(root, 'once-3');
        expect(context).not.toContain('ALPHA RULE BODY');
        expect(context).toContain('BETA RULE BODY');
    });

    it('an opted-in install delivers exactly what it delivered before', () => {
        // The pre-change carrier delivered every in-scope match regardless of
        // installed form. With consent recorded, that is still the behaviour —
        // a full-bodied file included, which is how a `no_stub` rule is
        // installed on a thinned layer.
        const root = makeRoot();
        optIn(home);
        installLayer(home, ['alpha-rule'], ['beta-rule']);
        const optedIn = run(root, 'once-4');
        expect(optedIn).toContain('ALPHA RULE BODY');
        expect(optedIn).toContain('BETA RULE BODY');

        // Byte-identical to the same delivery from an all-stub layer, which the
        // filter never touches on either side of the change.
        fs.writeFileSync(
            path.join(home, '.claude', 'rules', 'alpha-rule.md'),
            `# alpha-rule\n\n${THIN_ENTRY_MARKER}\n`,
            'utf-8',
        );
        const allStubs = run(root, 'once-5');
        expect(optedIn).toBe(allStubs);
    });
});
