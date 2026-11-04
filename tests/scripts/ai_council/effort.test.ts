import { describe, expect, it } from 'vitest';

import { LIGHT_LAUNCH_PROBES, lightLaunchFor } from '../../../src/scripts/ai_council/cli_agency_bounds.js';
import { OpenAICliClient } from '../../../src/scripts/ai_council/clients.js';
import { _build_config } from '../../../src/scripts/ai_council/config.js';
import {
    CLAUDE_EFFORT_PROBED_VERSION,
    claudeEffortArgs,
    codexEffortArgs,
    EFFORT_LEVELS,
    LENS_DEFAULT_EFFORT,
    onProbedLine,
    parseEffort,
    resolveEffort,
} from '../../../src/scripts/ai_council/effort.js';

describe('effort resolution', () => {
    it('flag beats member beats lens, and nothing set means vendor default', () => {
        expect(resolveEffort({ flag: 'high', member: 'low', lens: 'default' })).toBe('high');
        expect(resolveEffort({ flag: null, member: 'low', lens: 'debate' })).toBe('low');
        expect(resolveEffort({ lens: 'debate' })).toBe('high');
        expect(resolveEffort({ lens: 'pr' })).toBe('medium');
        expect(resolveEffort({ lens: 'unknown-lens' })).toBeNull();
        expect(resolveEffort({})).toBeNull();
        // An invalid flag value is not an effort; it falls through instead of reaching argv.
        expect(resolveEffort({ flag: 'max', member: null, lens: 'default' })).toBe('low');
    });

    it('every lens default is a known level, and only debate reasons at high', () => {
        for (const [lens, level] of Object.entries(LENS_DEFAULT_EFFORT)) {
            expect(EFFORT_LEVELS, lens).toContain(level);
        }
        const high = Object.entries(LENS_DEFAULT_EFFORT).filter(([, v]) => v === 'high').map(([k]) => k);
        expect(high).toEqual(['debate']);
    });

    it('parseEffort accepts the three levels and null, rejects the rest', () => {
        for (const level of EFFORT_LEVELS) expect(parseEffort(level, 'x')).toEqual({ effort: level });
        expect(parseEffort(null, 'x')).toEqual({ effort: null });
        expect(parseEffort(undefined, 'x')).toEqual({ effort: null });
        for (const bad of ['max', 'HIGH', 3, true, '']) expect('error' in parseEffort(bad, 'x')).toBe(true);
    });
});

describe('version line gating', () => {
    it('accepts the probed patch and later patches on the same line only', () => {
        expect(onProbedLine('2.1.308 (Claude Code)', '2.1.308 (Claude Code)')).toBe(true);
        expect(onProbedLine('2.1.316 (Claude Code)', '2.1.308 (Claude Code)')).toBe(true);
        expect(onProbedLine('2.1.307 (Claude Code)', '2.1.308 (Claude Code)')).toBe(false);
        expect(onProbedLine('2.2.0 (Claude Code)', '2.1.308 (Claude Code)')).toBe(false);
        expect(onProbedLine('3.1.400', '2.1.308')).toBe(false);
        expect(onProbedLine(null, '2.1.308')).toBe(false);
        expect(onProbedLine('garbage', '2.1.308')).toBe(false);
    });

    it('a patch update keeps the light seat launch', () => {
        const probe = LIGHT_LAUNCH_PROBES.find((p) => p.selected && p.member === 'anthropic')!;
        const [maj, min, patch] = /(\d+)\.(\d+)\.(\d+)/.exec(probe.probed_version)!.slice(1).map(Number);
        expect(lightLaunchFor('anthropic', `${maj}.${min}.${patch! + 9} (Claude Code)`)).toEqual(probe.flag);
        expect(lightLaunchFor('anthropic', `${maj}.${min! + 1}.0 (Claude Code)`)).toEqual([]);
    });
});

describe('effort argv', () => {
    it('claude gets --effort only on a binary that knows the flag', () => {
        expect(claudeEffortArgs('low', CLAUDE_EFFORT_PROBED_VERSION)).toEqual(['--effort', 'low']);
        expect(claudeEffortArgs('low', '2.1.200 (Claude Code)')).toEqual([]);
        expect(claudeEffortArgs(null, CLAUDE_EFFORT_PROBED_VERSION)).toEqual([]);
    });

    it('codex gets a config override, and none when unset', () => {
        expect(codexEffortArgs('medium')).toEqual(['-c', 'model_reasoning_effort="medium"']);
        expect(codexEffortArgs(null)).toEqual([]);
    });

    it('the codex seat argv carries the effort before the stdin marker', () => {
        class Probe extends OpenAICliClient {
            argv(): string[] {
                return this._build_command('s', 'u', 100);
            }
        }
        const withEffort = new Probe({ binary: '/bin/echo', effort: 'low' }).argv();
        expect(withEffort.slice(-3)).toEqual(['-c', 'model_reasoning_effort="low"', '-']);
        const without = new Probe({ binary: '/bin/echo' }).argv();
        expect(without.join(' ')).not.toContain('model_reasoning_effort');
    });
});

describe('member effort config', () => {
    const base = (effort: string) => ({
        enabled: true,
        members: { anthropic: { enabled: true, mode: 'cli', model: 'sonnet', effort } },
    });

    it('a configured effort is parsed onto the member', () => {
        const cfg = _build_config(base('medium'), '/tmp/x.yml');
        expect(cfg.members.get('anthropic')?.effort).toBe('medium');
    });

    it('an unknown effort is a config error, never a silent default', () => {
        expect(() => _build_config(base('max'), '/tmp/x.yml')).toThrow(/effort/);
    });
});
