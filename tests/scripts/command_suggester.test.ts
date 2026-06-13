// Tests for src/scripts/command_suggester/* — the suggestion engine.
//
// 1:1 port of tests/test_command_suggester.py (pytest → vitest, ADR-092
// parity contract). Coverage areas:
//
//  - match.ts    — phrase substring, structural bonus, token overlap, eligibility filter.
//  - rank.ts     — confidence floor, blocklist, vague-input + lonely-band suppression.
//  - cooldown.ts — duration parsing, per-conversation suppression, explicit-invocation reset.
//  - render.ts   — numbered-options block, as-is escape hatch, single-source recommendation line.
//  - loader.ts   — frontmatter → CommandSpec conversion, ineligible flag preserved.
//  - settings.ts — read commands.suggestion.* from .agent-settings.yml.
//  - sanitize.ts — self-echo / quoted-code stripping.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolve_logical } from '../../src/scripts/_lib/agent_src.js';
import {
    CommandSpec,
    CooldownStore,
    Match,
    Settings,
    apply_cooldown,
    detect_disable_directive,
    load_commands,
    load_settings,
    match,
    rank,
    render,
    sanitize_context,
    sanitize_message,
    strip_code_blocks,
    strip_suggestion_echo,
} from '../../src/scripts/command_suggester/index.js';
import { parse_cooldown } from '../../src/scripts/command_suggester/cooldown.js';
import { COMMANDS_DIR, REPO_ROOT } from './_command_suggester.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function _spec(
    name: string,
    opts: {
        eligible?: boolean;
        description?: string;
        trigger_description?: string;
        trigger_context?: string;
        floor?: number | null;
        cooldown?: string | null;
    } = {},
): CommandSpec {
    return new CommandSpec({
        name,
        description: opts.description || `${name} description`,
        eligible: opts.eligible ?? true,
        trigger_description: opts.trigger_description ?? '',
        trigger_context: opts.trigger_context ?? '',
        confidence_floor: opts.floor ?? null,
        cooldown: opts.cooldown ?? null,
    });
}

function makeSpecs(): CommandSpec[] {
    return [
        _spec('implement-ticket', {
            description: 'Drive a ticket end-to-end',
            trigger_description: 'setze ticket x um, implement ticket, work on ticket',
            trigger_context: 'user message contains a ticket key like ABC-123 or PROJ-42',
        }),
        _spec('commit', {
            description: 'Stage and commit all changes',
            trigger_description: 'commit my changes, please commit, save to git',
            trigger_context: 'uncommitted changes are present in the working tree',
        }),
        _spec('fix-ci', {
            description: 'Fetch CI errors and fix them',
            trigger_description: 'ci is failing, fix the ci pipeline, github actions failed',
            trigger_context: 'github actions workflow is in a failed state',
        }),
        _spec('onboard', {
            eligible: false,
            description: 'First-run setup',
        }),
    ];
}

function makeSpecsByName(specs: CommandSpec[]): Map<string, CommandSpec> {
    return new Map(specs.map((s) => [s.name, s]));
}

// ---------------------------------------------------------------------------
// match.py
// ---------------------------------------------------------------------------

describe('match', () => {
    it('skips ineligible commands', () => {
        const out = match('first-run setup wizard please', [], makeSpecs());
        expect(out.every((m) => m.command !== 'onboard')).toBe(true);
    });

    it('long phrase clears floor alone', () => {
        const out = match('commit my changes please', [], makeSpecs());
        const top = out.find((m) => m.command === 'commit')!;
        expect(top.score).toBeGreaterThanOrEqual(0.6);
        expect(['description', 'both']).toContain(top.matched_trigger);
    });

    it('structural bonus on ticket key', () => {
        const out = match('Setze ticket ABC-123 um', [], makeSpecs());
        const top = out.find((m) => m.command === 'implement-ticket')!;
        expect(top.has_structural_bonus).toBe(true);
        expect(top.evidence).toContain('ABC-123');
    });

    it('returns empty for unrelated input', () => {
        const out = match('the weather is nice today', [], makeSpecs());
        expect(out).toEqual([]);
    });

    it('sorted descending by score', () => {
        const out = match('commit my changes and push to git', [], makeSpecs());
        const scores = out.map((m) => m.score);
        const sorted = [...scores].sort((a, b) => b - a);
        expect(scores).toEqual(sorted);
    });
});

// ---------------------------------------------------------------------------
// rank.py
// ---------------------------------------------------------------------------

describe('rank', () => {
    it('drops below floor', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.55, matched_trigger: 'both', evidence: 'x' }),
            new Match({ command: 'fix-ci', score: 0.85, matched_trigger: 'both', evidence: 'y' }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, {
            raw_message: 'long enough message here',
        });
        expect(out.map((m) => m.command)).toEqual(['fix-ci']);
    });

    it('blocklist filters out', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'x' }),
        ];
        const settings = new Settings({ blocklist: ['commit'] });
        expect(rank(raw, settings, specs_by_name, { raw_message: 'commit my changes now' })).toEqual([]);
    });

    it('disabled returns empty', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'x' }),
        ];
        const settings = new Settings({ enabled: false });
        expect(rank(raw, settings, specs_by_name, { raw_message: 'commit my changes now' })).toEqual([]);
    });

    it('per-command floor overrides global', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        specs_by_name.set(
            'commit',
            _spec('commit', { trigger_description: 'commit my changes', floor: 0.9 }),
        );
        const raw = [
            new Match({ command: 'commit', score: 0.7, matched_trigger: 'both', evidence: 'x' }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, {
            raw_message: 'commit my changes today',
        });
        expect(out).toEqual([]);
    });

    it('lonely match just above floor suppressed', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.62, matched_trigger: 'both', evidence: 'x' }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, {
            raw_message: 'commit my changes today',
        });
        expect(out).toEqual([]);
    });

    it('lonely match with structural bonus kept', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({
                command: 'implement-ticket',
                score: 0.62,
                matched_trigger: 'both',
                evidence: 'ABC-123',
                has_structural_bonus: true,
            }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, { raw_message: 'ABC-123 work' });
        expect(out.map((m) => m.command)).toEqual(['implement-ticket']);
    });

    it('vague short input suppressed', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.7, matched_trigger: 'both', evidence: 'x' }),
            new Match({ command: 'fix-ci', score: 0.7, matched_trigger: 'both', evidence: 'y' }),
            new Match({ command: 'implement-ticket', score: 0.7, matched_trigger: 'both', evidence: 'z' }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, { raw_message: 'do it now' });
        expect(out).toEqual([]);
    });

    it('vague input with structural bonus kept', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({
                command: 'implement-ticket', score: 0.7, matched_trigger: 'both',
                evidence: 'ABC-123', has_structural_bonus: true,
            }),
            new Match({ command: 'commit', score: 0.7, matched_trigger: 'both', evidence: 'x' }),
            new Match({ command: 'fix-ci', score: 0.7, matched_trigger: 'both', evidence: 'y' }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, { raw_message: 'ABC-123 jetzt' });
        expect(out.some((m) => m.command === 'implement-ticket')).toBe(true);
    });

    it('caps at max_options', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = Array.from({ length: 10 }, (_unused, i) =>
            new Match({
                command: `cmd${i}`,
                score: 0.9 - i * 0.01,
                matched_trigger: 'description',
                evidence: 'x',
            }),
        );
        const out = rank(raw, new Settings({ max_options: 3 }), specs_by_name, {
            raw_message: 'long enough message here for sure',
        });
        expect(out.length).toBe(3);
    });

    it('tie-break structural bonus wins', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.8, matched_trigger: 'description', evidence: 'commit' }),
            new Match({
                command: 'implement-ticket', score: 0.8, matched_trigger: 'both',
                evidence: 'ABC-123', has_structural_bonus: true,
            }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, {
            raw_message: 'commit ABC-123 jetzt please run',
        });
        expect(out.map((m) => m.command)).toEqual(['implement-ticket', 'commit']);
    });

    it('tie-break longer evidence wins', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.8, matched_trigger: 'description', evidence: 'commit my changes' }),
            new Match({ command: 'fix-ci', score: 0.8, matched_trigger: 'description', evidence: 'ci' }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, {
            raw_message: 'commit my changes and check ci pipeline',
        });
        expect(out.map((m) => m.command)).toEqual(['commit', 'fix-ci']);
    });

    it('lonely match at old threshold now suppressed', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.65, matched_trigger: 'description', evidence: 'commit my changes' }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, {
            raw_message: 'commit my changes please now',
        });
        expect(out).toEqual([]);
    });

    it('lonely match clears band kept', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({ command: 'commit', score: 0.71, matched_trigger: 'both', evidence: 'commit my changes' }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, {
            raw_message: 'commit my changes please now',
        });
        expect(out.map((m) => m.command)).toEqual(['commit']);
    });

    it.each(['ok', 'Ok.', 'weiter', 'mach weiter', 'continue', 'go on', 'ja', '  yes!  '])(
        'continuation phrase suppressed: %j',
        (msg) => {
            const specs_by_name = makeSpecsByName(makeSpecs());
            const raw = [
                new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'commit changes' }),
                new Match({ command: 'fix-ci', score: 0.85, matched_trigger: 'both', evidence: 'ci' }),
            ];
            const out = rank(raw, new Settings(), specs_by_name, { raw_message: msg });
            expect(out).toEqual([]);
        },
    );

    it('continuation with structural bonus kept', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const raw = [
            new Match({
                command: 'implement-ticket', score: 0.85, matched_trigger: 'both',
                evidence: 'ABC-123', has_structural_bonus: true,
            }),
        ];
        const out = rank(raw, new Settings(), specs_by_name, { raw_message: 'weiter mit ABC-123' });
        expect(out.map((m) => m.command)).toEqual(['implement-ticket']);
    });
});

// ---------------------------------------------------------------------------
// cooldown.py
// ---------------------------------------------------------------------------

describe('cooldown', () => {
    it.each([
        ['10m', 600],
        ['30s', 30],
        ['1h', 3600],
        ['2d', 172800],
        ['', 600],
        [null, 600],
        ['garbage', 600],
    ] as const)('parse_cooldown %j → %d', (value, expected) => {
        expect(parse_cooldown(value, 600)).toBe(expected);
    });

    it('apply_cooldown suppresses recent match', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const now = [1000.0];
        const store = new CooldownStore({ now: () => now[0]! });
        store.record_shown([
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'changes' }),
        ]);
        now[0] = 1100.0; // 100s later, well within default 600s window
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'changes' }),
        ];
        const out = apply_cooldown(raw, store, new Settings(), specs_by_name);
        expect(out).toEqual([]);
    });

    it('apply_cooldown releases after window', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const now = [1000.0];
        const store = new CooldownStore({ now: () => now[0]! });
        store.record_shown([
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'changes' }),
        ]);
        now[0] = 1000.0 + 700; // past the 600s default
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'changes' }),
        ];
        const out = apply_cooldown(raw, store, new Settings(), specs_by_name);
        expect(out.map((m) => m.command)).toEqual(['commit']);
    });

    it('apply_cooldown explicit invocation clears', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const store = new CooldownStore();
        store.record_shown([
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'changes' }),
        ]);
        store.record_explicit_invocation('commit');
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'changes' }),
        ];
        const out = apply_cooldown(raw, store, new Settings(), specs_by_name);
        expect(out.map((m) => m.command)).toEqual(['commit']);
    });

    it('apply_cooldown disabled for conversation', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const store = new CooldownStore();
        store.state.disabled_for_conversation = true;
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'changes' }),
        ];
        expect(apply_cooldown(raw, store, new Settings(), specs_by_name)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// render.py
// ---------------------------------------------------------------------------

describe('render', () => {
    it('empty matches returns empty string', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        expect(render([], specs_by_name)).toBe('');
    });

    it('includes as-is option last', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const matches = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'commit my changes' }),
        ];
        const out = render(matches, specs_by_name);
        const optionLines = out.split('\n').filter((ln) => ln.startsWith('> '));
        expect(optionLines[optionLines.length - 1]!.endsWith('Just run the prompt as-is, no command')).toBe(true);
    });

    it('recommendation line present for clear winner', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const matches = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'commit my changes' }),
            new Match({ command: 'fix-ci', score: 0.7, matched_trigger: 'both', evidence: 'ci' }),
        ];
        const out = render(matches, specs_by_name);
        expect(out).toContain('**Recommendation: 1 — /commit**');
    });

    it('recommendation omitted on tight tie', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const matches = [
            new Match({ command: 'commit', score: 0.71, matched_trigger: 'both', evidence: 'x' }),
            new Match({ command: 'fix-ci', score: 0.70, matched_trigger: 'both', evidence: 'y' }),
        ];
        const out = render(matches, specs_by_name);
        expect(out).not.toContain('Recommendation:');
    });
});

// ---------------------------------------------------------------------------
// loader.py — exercises real frontmatter
// ---------------------------------------------------------------------------

describe('loader', () => {
    it('returns specs for real directory', () => {
        const specs = load_commands(COMMANDS_DIR);
        expect(specs.length).toBeGreaterThan(50);
        const eligible = specs.filter((s) => s.eligible);
        expect(eligible.length).toBeGreaterThan(0);
        const ineligible = specs.filter((s) => !s.eligible);
        expect(ineligible.length).toBeGreaterThan(0);
    });

    it('eligible have triggers', () => {
        const specs = load_commands(COMMANDS_DIR);
        for (const spec of specs) {
            if (!spec.eligible) {
                continue;
            }
            expect(spec.trigger_description, `${spec.name} missing trigger_description`).toBeTruthy();
            expect(spec.trigger_context, `${spec.name} missing trigger_context`).toBeTruthy();
        }
    });
});

// ---------------------------------------------------------------------------
// settings.py — read commands.suggestion.* from .agent-settings.yml
// ---------------------------------------------------------------------------

describe('settings', () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const d of tmpDirs) {
            fs.rmSync(d, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function tmpPath(): string {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-settings-'));
        tmpDirs.push(d);
        return d;
    }

    function writeSettings(dir: string, body: string): string {
        const p = path.join(dir, '.agent-settings.yml');
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    }

    it('missing file returns defaults', () => {
        const out = load_settings(path.join(tmpPath(), 'does-not-exist.yml'));
        expect(out.equals(new Settings())).toBe(true);
    });

    it('no section returns defaults', () => {
        const p = writeSettings(tmpPath(), 'personal:\n  user_name: alice\n');
        const out = load_settings(p);
        expect(out.equals(new Settings())).toBe(true);
    });

    it('full block', () => {
        const p = writeSettings(
            tmpPath(),
            'commands:\n' +
                '  suggestion:\n' +
                '    enabled: false\n' +
                '    confidence_floor: 0.75\n' +
                '    cooldown_seconds: 120\n' +
                '    max_options: 3\n' +
                '    blocklist:\n' +
                '      - /commit\n' +
                '      - /create-pr\n',
        );
        const out = load_settings(p);
        expect(out.enabled).toBe(false);
        expect(out.confidence_floor).toBeCloseTo(0.75);
        expect(out.cooldown_seconds).toBe(120);
        expect(out.max_options).toBe(3);
        expect(out.blocklist).toEqual(['/commit', '/create-pr']);
    });

    it('partial keeps defaults', () => {
        const p = writeSettings(tmpPath(), 'commands:\n  suggestion:\n    enabled: false\n');
        const out = load_settings(p);
        expect(out.enabled).toBe(false);
        expect(out.confidence_floor).toBe(new Settings().confidence_floor);
        expect(out.max_options).toBe(new Settings().max_options);
        expect(out.blocklist).toEqual([]);
    });

    it('floor clamped (high)', () => {
        const p = writeSettings(tmpPath(), 'commands:\n  suggestion:\n    confidence_floor: 1.5\n');
        expect(load_settings(p).confidence_floor).toBe(1.0);
    });

    it('negative floor clamped', () => {
        const p = writeSettings(tmpPath(), 'commands:\n  suggestion:\n    confidence_floor: -0.2\n');
        expect(load_settings(p).confidence_floor).toBe(0.0);
    });

    it('garbage int falls back', () => {
        const p = writeSettings(
            tmpPath(),
            'commands:\n  suggestion:\n    cooldown_seconds: not-a-number\n    max_options: nope\n',
        );
        const out = load_settings(p);
        expect(out.cooldown_seconds).toBe(new Settings().cooldown_seconds);
        expect(out.max_options).toBe(new Settings().max_options);
    });

    it('blocklist filters non-strings', () => {
        const p = writeSettings(
            tmpPath(),
            'commands:\n' +
                '  suggestion:\n' +
                '    blocklist:\n' +
                '      - /commit\n' +
                '      - 42\n' +
                "      - ''\n" +
                '      - /create-pr\n',
        );
        expect(load_settings(p).blocklist).toEqual(['/commit', '/create-pr']);
    });

    it('malformed yaml returns defaults', () => {
        const p = writeSettings(tmpPath(), ':\n  this is: not\nvalid yaml: [\n');
        const out = load_settings(p);
        expect(out.equals(new Settings())).toBe(true);
    });

    it('then rank honours blocklist', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const p = writeSettings(tmpPath(), 'commands:\n  suggestion:\n    blocklist:\n      - commit\n');
        const settings = load_settings(p);
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'commit my changes' }),
            new Match({ command: 'fix-ci', score: 0.85, matched_trigger: 'both', evidence: 'fix the ci' }),
        ];
        const out = rank(raw, settings, specs_by_name, {
            raw_message: 'commit my changes and fix the ci',
        });
        expect(out.map((m) => m.command)).toEqual(['fix-ci']);
    });

    it('disabled short-circuits rank', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const p = writeSettings(tmpPath(), 'commands:\n  suggestion:\n    enabled: false\n');
        const settings = load_settings(p);
        const raw = [
            new Match({ command: 'commit', score: 0.95, matched_trigger: 'both', evidence: 'commit my changes' }),
        ];
        const out = rank(raw, settings, specs_by_name, {
            raw_message: 'commit my changes please now',
        });
        expect(out).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Per-conversation opt-out directive (Phase 5)
// ---------------------------------------------------------------------------

describe('detect_disable_directive', () => {
    it.each([
        '/command-suggestion-off',
        '  /command-suggestion-off  ',
        'please /command-suggestion-off thanks',
        '/COMMAND-SUGGESTION-OFF',
    ])('off: %j', (msg) => {
        expect(detect_disable_directive(msg)).toBe(true);
    });

    it.each(['/command-suggestion-on', 're-enable: /command-suggestion-on'])('on: %j', (msg) => {
        expect(detect_disable_directive(msg)).toBe(false);
    });

    it.each([
        '',
        'implement the feature',
        'command-suggestion-off without a slash',
        '/command-suggestion-offline',
    ])('none: %j', (msg) => {
        expect(detect_disable_directive(msg)).toBe(null);
    });

    it('last wins', () => {
        expect(
            detect_disable_directive('/command-suggestion-off then later /command-suggestion-on'),
        ).toBe(false);
    });

    it('directive disables for conversation', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const store = new CooldownStore();
        if (detect_disable_directive('/command-suggestion-off')) {
            store.state.disabled_for_conversation = true;
        }
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'commit my changes' }),
        ];
        expect(apply_cooldown(raw, store, new Settings(), specs_by_name)).toEqual([]);
    });

    it('directive re-enable clears disabled', () => {
        const specs_by_name = makeSpecsByName(makeSpecs());
        const store = new CooldownStore();
        store.state.disabled_for_conversation = true;
        if (detect_disable_directive('/command-suggestion-on') === false) {
            store.state.disabled_for_conversation = false;
        }
        const raw = [
            new Match({ command: 'commit', score: 0.9, matched_trigger: 'both', evidence: 'commit my changes' }),
        ];
        const out = apply_cooldown(raw, store, new Settings(), specs_by_name);
        expect(out.map((m) => m.command)).toEqual(['commit']);
    });
});

// ---------------------------------------------------------------------------
// sanitize.py — Phase 6 hardening
// ---------------------------------------------------------------------------

describe('sanitize', () => {
    it('strip_code_blocks removes fenced', () => {
        const msg = 'before\n```bash\ngit commit -m fix\n```\nafter';
        const out = strip_code_blocks(msg);
        expect(out).not.toContain('git commit');
        expect(out).toContain('before');
        expect(out).toContain('after');
    });

    it('strip_code_blocks removes inline', () => {
        const msg = 'use `/implement-ticket` somehow';
        const out = strip_code_blocks(msg);
        expect(out).not.toContain('/implement-ticket');
        expect(out).toContain('use');
        expect(out).toContain('somehow');
    });

    it('strip_code_blocks preserves plain text', () => {
        const msg = 'commit my changes please now';
        expect(strip_code_blocks(msg)).toBe(msg);
    });

    it('strip_code_blocks handles multiple fences', () => {
        const msg = '```a\ncommit\n```\nmid\n```b\nfix-ci\n```';
        const out = strip_code_blocks(msg);
        expect(out).not.toContain('commit');
        expect(out).not.toContain('fix-ci');
        expect(out).toContain('mid');
    });

    it('strip_suggestion_echo removes full block', () => {
        const block =
            '> 💡 Your request matches a command. Pick one or run the prompt as-is:\n' +
            '>\n' +
            '> 1. /implement-ticket — drive ticket end-to-end\n' +
            '> 2. /refine-ticket — tighten AC\n' +
            '> 3. Just run the prompt as-is, no command\n' +
            '\n' +
            '**Recommendation: 1 — /implement-ticket** — the request matches.\n';
        const out = strip_suggestion_echo(block).trim();
        expect(out).not.toContain('/implement-ticket');
        expect(out).not.toContain('/refine-ticket');
        expect(out).not.toContain('Recommendation:');
        expect(out).not.toContain('Just run the prompt');
    });

    it('strip_suggestion_echo preserves user quotes', () => {
        const msg = "> the docs say '/commit stages everything'";
        expect(strip_suggestion_echo(msg)).toBe(msg);
    });

    it('sanitize_message combines both', () => {
        const msg =
            'please look at this output:\n' +
            '```\n' +
            'ci is failing on main\n' +
            '```\n' +
            '> 1. /fix-ci — fetch CI errors and fix them\n' +
            '> 2. Just run the prompt as-is, no command\n';
        const out = sanitize_message(msg);
        expect(out).not.toContain('fix-ci');
        expect(out).not.toContain('ci is failing');
        expect(out).toContain('please look at this output');
    });

    it('sanitize_context drops empty lines', () => {
        const ctx = [
            'real intent: commit my changes',
            '```\nirrelevant\n```',
            '> 1. /commit — Stage and commit\n> 2. Just run the prompt as-is, no command',
        ];
        const out = sanitize_context(ctx);
        expect(out.some((line) => line.includes('commit my changes'))).toBe(true);
        expect(out.every((line) => line.trim().length > 0)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Adversarial inputs at the matcher level (Phase 6 Step 6)
// ---------------------------------------------------------------------------

describe('match adversarial', () => {
    it('ignores command inside fenced code', () => {
        const msg =
            'what does this script do?\n' +
            '```bash\n' +
            './agent-config /implement-ticket ABC-123\n' +
            '```';
        const out = match(msg, [], makeSpecs());
        expect(out.every((m) => m.command !== 'implement-ticket')).toBe(true);
    });

    it('ignores command inside inline code', () => {
        const msg = 'explain `/commit` versus `/commit-in-chunks`';
        const out = match(msg, [], makeSpecs());
        expect(out.every((m) => m.command !== 'commit')).toBe(true);
    });

    it('ignores previous suggestion block in context', () => {
        const prev =
            '> 💡 Your request matches a command.\n' +
            '> 1. /commit — Stage and commit all changes\n' +
            '> 2. Just run the prompt as-is, no command\n' +
            '**Recommendation: 1 — /commit** — both match (`commit`).';
        const out = match('the weather is nice today', [prev], makeSpecs());
        expect(out).toEqual([]);
    });

    it('match/render roundtrip does not re-trigger', () => {
        const specs = makeSpecs();
        const specs_by_name = makeSpecsByName(specs);
        const matchesIn = match('commit my changes please', [], specs);
        const block = render(matchesIn, specs_by_name);
        expect(block.length).toBeGreaterThan(0);
        const out = match('the cat sat on the mat', [block], specs);
        expect(out).toEqual([]);
    });

    it('sanitize off exposes raw path', () => {
        const msg = 'see `commit my changes` literal';
        const raw = match(msg, [], makeSpecs(), { sanitize: false });
        expect(raw.some((m) => m.command === 'commit')).toBe(true);
        const safe = match(msg, [], makeSpecs(), { sanitize: true });
        expect(safe.every((m) => m.command !== 'commit')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Rule-contract self-check (Phase 6 Steps 1, 5)
// ---------------------------------------------------------------------------

const RULE_PATH =
    resolve_logical('rules/command-suggestion-policy.md') ??
    path.join(REPO_ROOT, '.agent-src.uncondensed', 'rules', 'command-suggestion-policy.md');

describe('rule contract', () => {
    it('contains iron law no auto-execute', () => {
        const body = fs.readFileSync(RULE_PATH, 'utf-8');
        expect(body).toContain('SUGGEST. NEVER INVOKE.');
        expect(body.toLowerCase()).toContain('auto-execute');
    });

    it('lists subordination targets', () => {
        const body = fs.readFileSync(RULE_PATH, 'utf-8').toLowerCase();
        for (const target of [
            'scope-control',
            'ask-when-uncertain',
            'verify-before-complete',
            'role-mode-adherence',
        ]) {
            expect(body, `rule must reference ${target}`).toContain(target);
        }
    });

    it('states as-is option always present', () => {
        const body = fs.readFileSync(RULE_PATH, 'utf-8');
        expect(body.toLowerCase()).toContain('as-is');
        const lower = body.toLowerCase();
        expect(lower.includes('always last') || lower.includes('always present')).toBe(true);
    });
});
