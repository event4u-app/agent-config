/**
 * One synthesis-strategy interface, and the surface it must not touch — step 5.1.
 *
 * The verify clause is *"the user-facing surface gains no new mode names"*, so
 * the central assertions are ABSENCE assertions over the CLI's own option
 * tables, its help text, the synthesis-mode table, and the shipped command
 * markdown — measured, not promised.
 *
 * Pure: no dispatch, no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { all_synthesis_modes } from '../../../src/scripts/ai_council/prompts.js';
import {
    CONFIG_KEYS_READ,
    STRATEGIES,
    SYNTHESIS_STRATEGIES,
    SYNTHESIS_STRATEGY_ARITY,
    reachableStrategies,
    resolveSynthesisStrategy,
} from '../../../src/scripts/ai_council/synthesis_strategy.js';
import type { SynthesisContext } from '../../../src/scripts/ai_council/synthesis_strategy.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** The user-facing council surface: the option tables plus the help they print. */
const CLI_SURFACE = ['src/scripts/council_cli.ts', 'src/scripts/ai_council/cli_help.ts'];

function surfaceText(): string {
    return CLI_SURFACE.map((f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')).join('\n');
}

/** Every `.md` under the shipped command / domain trees — the other user surface. */
function shippedMarkdown(): { rel: string; text: string }[] {
    const out: { rel: string; text: string }[] = [];
    const walk = (dir: string): void => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) walk(abs);
            else if (e.name.endsWith('.md')) out.push({ rel: path.relative(REPO_ROOT, abs), text: fs.readFileSync(abs, 'utf8') });
        }
    };
    walk(path.join(REPO_ROOT, 'src/agent-src/commands'));
    walk(path.join(REPO_ROOT, 'src/domains'));
    return out;
}

const FLAG_LITERAL_RE = /flag:[ \t]*'(--[a-z0-9-]+)'/g;
const CHOICES_RE = /choices:[ \t]*\[([^\]]*)\]/g;

function declaredFlags(): string[] {
    return [...surfaceText().matchAll(FLAG_LITERAL_RE)].map((m) => m[1] as string);
}

function declaredChoices(): string[] {
    return [...surfaceText().matchAll(CHOICES_RE)]
        .flatMap((m) => (m[1] as string).split(','))
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter((s) => s !== '');
}

function ctx(over: Partial<SynthesisContext> = {}): SynthesisContext {
    return {
        chairmanMode: 'auto',
        configuredMember: null,
        deliberated: new Set(['a']),
        candidates: [
            { name: 'a', tier: null },
            { name: 'b', tier: null },
        ],
        ...over,
    };
}

describe('5.1 — one interface, exactly the five candidates the step names', () => {
    it('admits exactly five strategies, and no sixth without a code change', () => {
        expect(SYNTHESIS_STRATEGIES).toEqual([
            'host_convener',
            'external_judge',
            'strongest_model',
            'top_ranked_member',
            'dual_adjudicated',
        ]);
        expect(SYNTHESIS_STRATEGIES).toHaveLength(SYNTHESIS_STRATEGY_ARITY);
        expect(Object.keys(STRATEGIES).sort()).toEqual([...SYNTHESIS_STRATEGIES].sort());
    });

    it('every strategy delegates to select_chairman — no second selection path', () => {
        const src = fs.readFileSync(
            path.join(REPO_ROOT, 'src/scripts/ai_council/synthesis_strategy.ts'),
            'utf8',
        );
        expect(src).toContain("import { select_chairman } from './chairman.js'");
        // One shared resolver, used by all five.
        const resolvers = [...src.matchAll(/resolve:\s*(\w+)/g)].map((m) => m[1]);
        expect(new Set(resolvers).size).toBe(1);
        expect(resolvers).toHaveLength(SYNTHESIS_STRATEGY_ARITY);
    });

    it('resolves each reachable strategy from configuration the engine already reads', () => {
        expect(resolveSynthesisStrategy(ctx({ chairmanMode: 'host' }))?.id).toBe('host_convener');
        expect(resolveSynthesisStrategy(ctx({ chairmanMode: 'member', configuredMember: 'b' }))?.id).toBe(
            'external_judge',
        );
        expect(
            resolveSynthesisStrategy(ctx({ candidates: [{ name: 'a', tier: null }, { name: 'b', tier: 3 }] }))?.id,
        ).toBe('strongest_model');
        expect(resolveSynthesisStrategy(ctx())?.id).toBe('top_ranked_member');
        expect(CONFIG_KEYS_READ.every((k) => k.startsWith('ai_council.'))).toBe(true);
        expect(CONFIG_KEYS_READ).toHaveLength(3);
    });

    it('returns null on an unknown mode rather than guessing a strategy', () => {
        expect(resolveSynthesisStrategy(ctx({ chairmanMode: 'something-else' }))).toBeNull();
    });

    it('names the one unreachable candidate rather than smuggling it behind a flag', () => {
        expect(STRATEGIES.dual_adjudicated.reachable).toBe(false);
        expect(reachableStrategies()).toEqual([
            'host_convener',
            'external_judge',
            'strongest_model',
            'top_ranked_member',
        ]);
        // No configuration reaches it: every mode the loader accepts resolves elsewhere.
        for (const mode of ['host', 'member', 'auto']) {
            expect(resolveSynthesisStrategy(ctx({ chairmanMode: mode, configuredMember: 'b' }))?.id).not.toBe(
                'dual_adjudicated',
            );
        }
    });

    it('the actual selection is chairman.ts’s, including its self-judge refusal', () => {
        // A member that deliberated cannot chair — the property belongs to
        // chairman.ts and this interface must not have weakened it.
        const sel = STRATEGIES.external_judge.resolve(
            ctx({ chairmanMode: 'member', configuredMember: 'a', deliberated: new Set(['a']) }),
        );
        expect(sel.member).toBeNull();
        expect(sel.annotation).toContain('cannot self-judge');
    });
});

describe('THE VERIFY — the user-facing surface gains no new mode names', () => {
    it('no strategy id appears in the CLI option tables or the help text', () => {
        const text = surfaceText();
        for (const id of SYNTHESIS_STRATEGIES) {
            expect(text).not.toContain(id);
            expect(text).not.toContain(id.replace(/_/g, '-'));
        }
    });

    it('no declared flag or choice value names a strategy', () => {
        const flags = declaredFlags();
        const choices = declaredChoices();
        expect(flags.length).toBeGreaterThan(10); // the scan found the real table
        expect(choices.length).toBeGreaterThan(5);
        for (const id of SYNTHESIS_STRATEGIES) {
            const hyphen = id.replace(/_/g, '-');
            expect(flags.some((f) => f.includes(hyphen))).toBe(false);
            expect(choices).not.toContain(id);
            expect(choices).not.toContain(hyphen);
        }
        // …and no flag named for the concept either.
        expect(flags.some((f) => /synthes(is|iser|izer)-(strategy|mode)/.test(f))).toBe(false);
    });

    it('the synthesis-mode table is exactly the pre-existing set', () => {
        // Frozen snapshot: 5.1 may add strategies, never a user-visible mode.
        expect(all_synthesis_modes()).toEqual(['analysis', 'default', 'design', 'optimize', 'pr']);
    });

    it('no shipped command or domain markdown names a strategy', () => {
        const docs = shippedMarkdown();
        expect(docs.length).toBeGreaterThan(100); // the scan found the real trees
        const hits: string[] = [];
        for (const d of docs) {
            for (const id of SYNTHESIS_STRATEGIES) {
                if (d.text.includes(id) || d.text.includes(id.replace(/_/g, '-'))) hits.push(`${d.rel}: ${id}`);
            }
        }
        expect(hits).toEqual([]);
    });
});

describe('DENIAL — the surface scanners fire on a real violation', () => {
    it('the flag scanner extracts a strategy-named flag from constructed text', () => {
        const violating = "{ flag: '--synthesis-strategy', takesValue: true, choices: ['host_convener'] }";
        expect([...violating.matchAll(FLAG_LITERAL_RE)].map((m) => m[1])).toEqual(['--synthesis-strategy']);
        const ch = [...violating.matchAll(CHOICES_RE)].flatMap((m) => (m[1] as string).split(','));
        expect(ch.map((s) => s.trim().replace(/'/g, ''))).toContain('host_convener');
    });

    it('the markdown scanner would catch a strategy name in a command file', () => {
        const violating = 'Run `/council default --synthesis dual_adjudicated` for the hard cases.';
        expect(SYNTHESIS_STRATEGIES.some((id) => violating.includes(id))).toBe(true);
        expect(SYNTHESIS_STRATEGIES.some((id) => 'Run `/council default` for the hard cases.'.includes(id))).toBe(
            false,
        );
    });
});
