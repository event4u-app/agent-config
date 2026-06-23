
import * as fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { resolve_logical } from '../../src/scripts/_lib/agent_src.js';
import {
    CooldownStore,
    Settings,
    apply_cooldown,
    is_explicit_slash_invocation,
    load_commands,
    match,
    rank,
    render,
} from '../../src/scripts/command_suggester/index.js';
import type { CommandSpec, Match } from '../../src/scripts/command_suggester/types.js';
import { COMMANDS_DIR } from './_command_suggester.js';

const _RULE_RESOLVED = resolve_logical('rules/command-suggestion-policy.md');
if (_RULE_RESOLVED === null) {
    throw new Error('command-suggestion-policy.md missing');
}
const RULE_PATH = _RULE_RESOLVED;

let SPECS: CommandSpec[] = [];
let SPECS_BY_NAME: Map<string, CommandSpec> = new Map();

beforeAll(() => {
    SPECS = load_commands(COMMANDS_DIR);
    SPECS_BY_NAME = new Map(SPECS.map((s) => [s.name, s]));
});

function suggest(
    message: string,
    opts: { settings?: Settings; store?: CooldownStore } = {},
): { ranked: Match[]; block: string } {
    const settings = opts.settings ?? new Settings();
    const store = opts.store ?? new CooldownStore();
    if (!settings.enabled || is_explicit_slash_invocation(message)) {
        return { ranked: [], block: '' };
    }
    const raw = match(message, [], SPECS);
    const ranked = rank(raw, settings, SPECS_BY_NAME, { raw_message: message });
    const cooled = apply_cooldown(ranked, store, settings, SPECS_BY_NAME);
    return { ranked: cooled, block: render(cooled, SPECS_BY_NAME) };
}

describe('GT-CS goldens', () => {
    it('GT-CS1 single match ticket intent', () => {
        const { ranked, block } = suggest('Setze Ticket ABC-123 um');
        const names = ranked.map((m) => m.command);
        expect(names).toContain('implement-ticket');
        expect(ranked[0]!.command).toBe('implement-ticket');
        expect(block).toContain('Just run the prompt as-is, no command');
        expect(block).toContain('Recommendation: 1 — /implement-ticket');
    });

    it('GT-CS2 multi match commit and pr', () => {
        const { ranked, block } = suggest('commit my changes and write a PR description');
        const names = ranked.map((m) => m.command);
        expect(names).toContain('git-commit');
        expect(names).toContain('git-pr-create-description-only');
        expect(block).toContain(`> ${ranked.length + 1}. Just run the prompt as-is, no command`);
    });

    it('GT-CS3 sub-floor vague suppressed', () => {
        const { ranked, block } = suggest('do it now');
        expect(ranked).toEqual([]);
        expect(block).toBe('');
    });

    it('GT-CS4 explicit slash bypasses', () => {
        expect(is_explicit_slash_invocation('/quality-fix')).toBe(true);
        const { ranked, block } = suggest('/quality-fix');
        expect(ranked).toEqual([]);
        expect(block).toBe('');
    });

    it('GT-CS5 pick as-is records cooldown', () => {
        const store = new CooldownStore();
        const { ranked: ranked1 } = suggest('Setze Ticket ABC-123 um', { store });
        expect(ranked1.length).toBeGreaterThan(0);
        store.record_shown(ranked1);
        const { ranked: ranked2, block: block2 } = suggest('Setze Ticket ABC-123 um', { store });
        expect(ranked2).toEqual([]);
        expect(block2).toBe('');
    });

    it('GT-CS6 cooldown silences repeat', () => {
        const store = new CooldownStore();
        const { ranked: ranked1 } = suggest('commit my changes please now', { store });
        expect(ranked1.some((m) => m.command === 'git-commit')).toBe(true);
        store.record_shown(ranked1);
        const { ranked: ranked2 } = suggest('commit my changes please now', { store });
        expect(ranked2.every((m) => m.command !== 'git-commit')).toBe(true);
    });

    it('GT-CS7 settings disabled silences', () => {
        const settings = new Settings({ enabled: false });
        const { ranked, block } = suggest('Setze Ticket ABC-123 um', { settings });
        expect(ranked).toEqual([]);
        expect(block).toBe('');
    });

    it('GT-CS8 clarification wins documented in rule', () => {
        const body = fs.readFileSync(RULE_PATH, 'utf-8').toLowerCase();
        expect(body).toContain('ask-when-uncertain');
        expect(body.includes('clarification wins') || body.includes('clarification is owed')).toBe(true);
    });

    it('GT-CS9 adversarial echo does not trigger', () => {
        const msg = 'explain `/commit` versus `/commit-in-chunks` from the docs';
        const { ranked } = suggest(msg);
        expect(ranked.every((m) => m.command !== 'git-commit' && m.command !== 'git-commit-in-chunks')).toBe(true);
    });
});
