import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    AI_TEAM_DEFAULTS,
    AI_TEAM_MODEL_AUTO,
    build_ai_team_config,
    load_ai_team_config,
    TeamConfigError,
} from '../../../src/scripts/ai_team/config';
import {
    load_cli_call_counts,
    record_cli_call,
} from '../../../src/scripts/ai_council/clients';

const tmp_dirs: string[] = [];

function make_tmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-team-cfg-')));
    tmp_dirs.push(dir);
    return dir;
}

afterEach(() => {
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

// === defaults ==============================================================

describe('build_ai_team_config — defaults', () => {
    it('absent block (undefined) → shipped defaults, feature off', () => {
        const c = build_ai_team_config(undefined);
        expect(c).toEqual(AI_TEAM_DEFAULTS);
        expect(c.enabled).toBe(false);
        expect(c.model).toBe(AI_TEAM_MODEL_AUTO);
        expect(c.allow_delegate).toBe(false);
        expect(c.max_calls_per_day).toBe(50);
        expect(c.suppress_setup_hint).toBe(false);
    });

    it('null block → shipped defaults (YAML `ai_team:` with no body)', () => {
        expect(build_ai_team_config(null)).toEqual(AI_TEAM_DEFAULTS);
    });

    it('empty mapping → shipped defaults', () => {
        expect(build_ai_team_config({})).toEqual(AI_TEAM_DEFAULTS);
    });

    it('partial block keeps defaults for absent keys', () => {
        const c = build_ai_team_config({ enabled: true });
        expect(c.enabled).toBe(true);
        expect(c.model).toBe('auto');
        expect(c.allow_delegate).toBe(false);
        expect(c.max_calls_per_day).toBe(50);
        expect(c.suppress_setup_hint).toBe(false);
    });

    it('full valid block round-trips', () => {
        const c = build_ai_team_config({
            enabled: true,
            model: 'gpt-5.5',
            allow_delegate: true,
            max_calls_per_day: 7,
            suppress_setup_hint: true,
        });
        expect(c).toEqual({
            enabled: true,
            model: 'gpt-5.5',
            allow_delegate: true,
            max_calls_per_day: 7,
            suppress_setup_hint: true,
        });
    });

    it('defaults match the template block byte-for-byte', () => {
        // Parity guard: the shipped template is the user-facing source of
        // truth; drift between it and AI_TEAM_DEFAULTS silently changes
        // the loader's absent-key behaviour.
        const template = fs.readFileSync(
            path.resolve(process.cwd(), 'src/config/agent-settings.template.yml'),
            'utf-8',
        );
        expect(template).toMatch(/^ai_team:$/m);
        expect(template).toMatch(/^ {2}enabled: false$/m);
        expect(template).toMatch(/^ {2}model: auto$/m);
        expect(template).toMatch(/^ {2}allow_delegate: false$/m);
        expect(template).toMatch(/^ {2}max_calls_per_day: 50$/m);
        expect(template).toMatch(/^ {2}suppress_setup_hint: false$/m);
    });
});

// === unknown-key rejection (fail-closed) ===================================

describe('build_ai_team_config — unknown keys', () => {
    it('rejects an unknown key', () => {
        expect(() => build_ai_team_config({ enabled: true, revew_gate: {} })).toThrow(
            TeamConfigError,
        );
        expect(() => build_ai_team_config({ revew_gate: {} })).toThrow(
            /ai_team\.revew_gate: unknown key/,
        );
    });

    it('rejects a misspelled gate key instead of silently ignoring it', () => {
        // The canonical failure this loader exists to stop: a typo'd
        // `allow_delegate` must fail the load, never leave the gate
        // silently at its default.
        expect(() => build_ai_team_config({ allow_delegat: true })).toThrow(
            /allow_delegat: unknown key/,
        );
    });

    it('rejects review_gate ahead of its phase (reserved future key)', () => {
        expect(() => build_ai_team_config({ review_gate: { managed: false } })).toThrow(
            /ai_team\.review_gate: unknown key/,
        );
    });
});

// === per-key type validation ===============================================

describe('build_ai_team_config — type errors', () => {
    it('non-mapping block is rejected', () => {
        expect(() => build_ai_team_config('yes')).toThrow(/`ai_team` must be a mapping\./);
        expect(() => build_ai_team_config([1, 2])).toThrow(TeamConfigError);
        expect(() => build_ai_team_config(true)).toThrow(TeamConfigError);
    });

    it.each(['enabled', 'allow_delegate', 'suppress_setup_hint'] as const)(
        '%s must be a boolean',
        (key) => {
            expect(() => build_ai_team_config({ [key]: 'true' })).toThrow(
                new RegExp(`\`ai_team\\.${key}\` must be a boolean`),
            );
            expect(() => build_ai_team_config({ [key]: 1 })).toThrow(TeamConfigError);
        },
    );

    it('model must be a non-empty string', () => {
        expect(() => build_ai_team_config({ model: '' })).toThrow(
            /`ai_team\.model` must be a non-empty string/,
        );
        expect(() => build_ai_team_config({ model: '   ' })).toThrow(TeamConfigError);
        expect(() => build_ai_team_config({ model: 5 })).toThrow(TeamConfigError);
        expect(() => build_ai_team_config({ model: null })).toThrow(TeamConfigError);
    });

    it('max_calls_per_day must be a non-negative integer', () => {
        expect(() => build_ai_team_config({ max_calls_per_day: -1 })).toThrow(
            /`ai_team\.max_calls_per_day` must be a non-negative integer/,
        );
        expect(() => build_ai_team_config({ max_calls_per_day: 1.5 })).toThrow(TeamConfigError);
        expect(() => build_ai_team_config({ max_calls_per_day: '50' })).toThrow(TeamConfigError);
        // bool is not an int here (unlike Python's bool-as-int subclass).
        expect(() => build_ai_team_config({ max_calls_per_day: true })).toThrow(TeamConfigError);
    });

    it('max_calls_per_day: 0 is valid — blocks all team calls', () => {
        expect(build_ai_team_config({ max_calls_per_day: 0 }).max_calls_per_day).toBe(0);
    });
});

// === load_ai_team_config — settings seam ===================================

describe('load_ai_team_config', () => {
    it('reads the ai_team block from an injected settings dict', () => {
        const c = load_ai_team_config({
            settings: { ai_team: { enabled: true, model: 'gpt-5.4' } },
        });
        expect(c.enabled).toBe(true);
        expect(c.model).toBe('gpt-5.4');
    });

    it('settings without an ai_team block → defaults', () => {
        expect(load_ai_team_config({ settings: { personal: { autonomy: 'auto' } } })).toEqual(
            AI_TEAM_DEFAULTS,
        );
    });

    it('reads the block from a real .agent-settings.yml via the cascade', () => {
        const tmp = make_tmp();
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'ai_team:\n  enabled: true\n  max_calls_per_day: 3\n',
            'utf-8',
        );
        const c = load_ai_team_config({ cwd: tmp });
        expect(c.enabled).toBe(true);
        expect(c.max_calls_per_day).toBe(3);
        expect(c.model).toBe('auto');
    });

    it('invalid block in the settings file fails loudly', () => {
        const tmp = make_tmp();
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'ai_team:\n  enabled: true\n  team_mode: reviewer\n',
            'utf-8',
        );
        expect(() => load_ai_team_config({ cwd: tmp })).toThrow(/team_mode: unknown key/);
    });
});

// === quota — the shared openai bucket ======================================
//
// Contract (docs/contracts/ai-team-config.md § Quota): team calls count
// into the EXISTING cli_call_budget openai bucket via the generic
// per-provider counter in src/scripts/ai_council/clients.ts — one
// subscription, one counter, never a parallel count. These tests exercise
// the exact read/increment seams a /team invocation uses, against a tmp
// state file (no billable calls, no global state).

describe('quota — shared openai bucket read/increment', () => {
    it('record_cli_call("openai") increments the same bucket load_cli_call_counts reads', () => {
        const state = path.join(make_tmp(), 'cli-calls.json');
        expect(load_cli_call_counts(state)).toEqual({});

        expect(record_cli_call('openai', state)).toBe(1);
        expect(record_cli_call('openai', state)).toBe(2);
        expect(load_cli_call_counts(state)['openai']).toBe(2);
    });

    it('council and team calls share the one openai counter (no parallel bucket)', () => {
        const state = path.join(make_tmp(), 'cli-calls.json');
        // a council-side call…
        record_cli_call('openai', state);
        // …and a team-side call land on the SAME count.
        const total = record_cli_call('openai', state);
        expect(total).toBe(2);
        // Nothing team-specific exists in the state file.
        const parsed = JSON.parse(fs.readFileSync(state, 'utf-8')) as {
            counts: Record<string, number>;
        };
        expect(Object.keys(parsed.counts)).toEqual(['openai']);
    });

    it('ai_team.max_calls_per_day is enforceable against the shared count', () => {
        const state = path.join(make_tmp(), 'cli-calls.json');
        const cfg = build_ai_team_config({ enabled: true, max_calls_per_day: 2 });
        record_cli_call('openai', state);
        record_cli_call('openai', state);
        const used = load_cli_call_counts(state)['openai'] ?? 0;
        // The pre-flight check a /team invocation performs:
        expect(used >= cfg.max_calls_per_day).toBe(true);
    });
});
