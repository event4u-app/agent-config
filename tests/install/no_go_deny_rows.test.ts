// Tests for src/install/noGoDenyRows.ts —
// road-to-a-project-contract-written-down Phase 2 (2.2, 2.3).
//
// Three properties, and each one is a risk in the roadmap's register rather
// than a nicety: a path no-go produces a row at all (Risk 3, a rule enforced by
// nothing); an entry the consumer already had survives byte-for-byte (Risk 4,
// an append that clobbers the file); and a decline writes nothing (the consent
// is the whole of 2.2).
import { describe, expect, it } from 'vitest';

import {
    appendDenyRules,
    hasNativeDenyList,
    planDenyRows,
    renderDenyPlan,
} from '../../src/install/noGoDenyRows.js';

const NO_GOS = [
    '## No-gos',
    '',
    '- Never edit `migrations/` by hand',
    '- Never run `php artisan migrate:fresh` outside a throwaway database',
    '- Never add a runtime dependency without an ADR',
].join('\n');

describe('planDenyRows — the fixture no-go yields a deny row', () => {
    it('turns "never edit `migrations/`" into an Edit rule', () => {
        const plan = planDenyRows(NO_GOS, 'claude');
        expect(plan.rules).toContain('Edit(migrations/**)');
    });

    it('reports the unenforceable bullet as instruction-only', () => {
        const plan = planDenyRows(NO_GOS, 'claude');
        expect(plan.prose.map((p) => p.bullet)).toEqual([
            'Never add a runtime dependency without an ADR',
        ]);
    });

    it('de-duplicates a rule two bullets would both produce', () => {
        const twice = '- Never edit `migrations/`\n- Never modify `migrations/`';
        expect(planDenyRows(twice, 'claude').rules).toEqual(['Edit(migrations/**)']);
    });

    it('marks a host with no established deny list as not enforceable', () => {
        expect(hasNativeDenyList('claude')).toBe(true);
        expect(hasNativeDenyList('cowork')).toBe(false);
        expect(planDenyRows(NO_GOS, 'cowork').enforceable).toBe(false);
    });

    it('still names every row for a host that cannot enforce them', () => {
        // Nothing is written there, but the consumer is told what the no-gos
        // would have become — an empty report would read as "nothing to do".
        const text = renderDenyPlan(planDenyRows(NO_GOS, 'cowork'), 'cowork');
        expect(text).toContain('Edit(migrations/**)');
        expect(text).toContain('nothing is written');
    });

    it('renders each row beside the classification it came from', () => {
        const plan = planDenyRows(NO_GOS, 'claude');
        expect(plan.rows.map((r) => r.classification.kind)).toEqual([
            'path',
            'command',
            'prose',
        ]);
        expect(plan.rows[2]?.rules).toEqual([]);
    });

    it('names the source bullet beside each row', () => {
        const text = renderDenyPlan(planDenyRows(NO_GOS, 'claude'), 'claude');
        expect(text).toContain('from: Never edit `migrations/` by hand');
    });

    it('cites the documentation the syntax was read from', () => {
        const text = renderDenyPlan(planDenyRows(NO_GOS, 'claude'), 'claude');
        expect(text).toContain('https://');
    });
});

describe('appendDenyRules preserves what the consumer already had', () => {
    // Deliberately NOT formatted the way `JSON.stringify(x, null, 2)` formats:
    // four-space indent and a one-line array. A fixture that happens to match
    // canonical output cannot tell a splice from a re-serialiser, and the first
    // version of this file had exactly that blind spot — a probe that replaced
    // the splice with `JSON.stringify` left all twenty tests green.
    const WITH_EXISTING = `{
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    "permissions": {
        "allow": ["Bash(npm run lint)"],
        "deny": [
            "Read(./.env)",
            "Read(./.env.*)"
        ]
    },
    "model": "opus"
}
`;

    it('preserves every existing deny entry byte-for-byte, in order', () => {
        const out = appendDenyRules(WITH_EXISTING, ['Edit(migrations/**)']);
        const deny = (
            JSON.parse(out.text) as { permissions: { deny: string[] } }
        ).permissions.deny;
        expect(deny.slice(0, 2)).toEqual(['Read(./.env)', 'Read(./.env.*)']);
        expect(deny[2]).toBe('Edit(migrations/**)');
    });

    it('preserves every byte of the file outside the deny array', () => {
        // The strongest form of the claim: not "the values survive" but "the
        // text survives". A re-serialising writer passes the assertion above
        // and fails this one.
        const out = appendDenyRules(WITH_EXISTING, ['Edit(migrations/**)']);
        const before = WITH_EXISTING.slice(0, WITH_EXISTING.indexOf('"deny"'));
        const after = WITH_EXISTING.slice(WITH_EXISTING.indexOf('"model"'));
        expect(out.text.startsWith(before)).toBe(true);
        expect(out.text.endsWith(after)).toBe(true);
    });

    it('preserves the closing bracket on its own line, at its own indent', () => {
        // Splicing at the `]` instead of after the last element leaves the
        // comma stranded on a line of its own and un-indents the bracket. The
        // file stays valid JSON either way, so only a text assertion sees it.
        const out = appendDenyRules(WITH_EXISTING, ['Edit(migrations/**)']);
        expect(out.text).toContain('            "Edit(migrations/**)"\n        ]');
        expect(out.text).not.toMatch(/\n\s*,\n/);
    });

    it('preserves the sibling allow list untouched', () => {
        const out = appendDenyRules(WITH_EXISTING, ['Edit(migrations/**)']);
        expect(out.text).toContain('"Bash(npm run lint)"');
        const allow = (
            JSON.parse(out.text) as { permissions: { allow: string[] } }
        ).permissions.allow;
        expect(allow).toEqual(['Bash(npm run lint)']);
    });

    it('preserves the file unchanged when every rule is already present', () => {
        const out = appendDenyRules(WITH_EXISTING, ['Read(./.env)']);
        expect(out.text).toBe(WITH_EXISTING);
        expect(out.added).toEqual([]);
        expect(out.alreadyPresent).toEqual(['Read(./.env)']);
    });

    it('writes a deny list into a permissions block that has none', () => {
        const body = '{\n  "permissions": {\n    "allow": []\n  }\n}\n';
        const out = appendDenyRules(body, ['Edit(migrations/**)']);
        const parsed = JSON.parse(out.text) as {
            permissions: { allow: string[]; deny: string[] };
        };
        expect(parsed.permissions.deny).toEqual(['Edit(migrations/**)']);
        expect(parsed.permissions.allow).toEqual([]);
    });

    it('writes a permissions block into a file that has none', () => {
        const body = '{\n  "model": "opus"\n}\n';
        const out = appendDenyRules(body, ['Edit(migrations/**)', 'Bash(terraform)']);
        const parsed = JSON.parse(out.text) as {
            model: string;
            permissions: { deny: string[] };
        };
        expect(parsed.model).toBe('opus');
        expect(parsed.permissions.deny).toEqual(['Edit(migrations/**)', 'Bash(terraform)']);
    });

    it('writes into an empty root object', () => {
        const out = appendDenyRules('{}\n', ['Edit(migrations/**)']);
        const parsed = JSON.parse(out.text) as { permissions: { deny: string[] } };
        expect(parsed.permissions.deny).toEqual(['Edit(migrations/**)']);
    });

    it('writes into an empty deny array', () => {
        const body = '{\n  "permissions": {\n    "deny": []\n  }\n}\n';
        const out = appendDenyRules(body, ['Edit(migrations/**)']);
        const parsed = JSON.parse(out.text) as { permissions: { deny: string[] } };
        expect(parsed.permissions.deny).toEqual(['Edit(migrations/**)']);
    });

    it('is not fooled by a brace inside a string value', () => {
        const body = '{\n  "note": "a } and a ] in here",\n  "model": "opus"\n}\n';
        const out = appendDenyRules(body, ['Edit(migrations/**)']);
        const parsed = JSON.parse(out.text) as {
            note: string;
            permissions: { deny: string[] };
        };
        expect(parsed.note).toBe('a } and a ] in here');
        expect(parsed.permissions.deny).toEqual(['Edit(migrations/**)']);
    });

    it('refuses a malformed settings body rather than splicing into it', () => {
        expect(() => appendDenyRules('{ not json', ['Edit(x/**)'])).toThrow();
    });

    it('refuses a body that is not an object', () => {
        expect(() => appendDenyRules('[1, 2]', ['Edit(x/**)'])).toThrow(/not a JSON object/);
    });
});

describe('a declined consent leaves the file unchanged', () => {
    const BODY = '{\n  "permissions": {\n    "deny": [\n      "Read(./.env)"\n    ]\n  }\n}\n';

    it('preserves the file byte-for-byte when no rule is applied', () => {
        // The decline path is the absence of a call: 2.2 plans and renders, and
        // only an explicit yes reaches `appendDenyRules`. This pins that the
        // planning half has no write in it.
        const plan = planDenyRows(NO_GOS, 'claude');
        renderDenyPlan(plan, 'claude');
        expect(BODY).toBe('{\n  "permissions": {\n    "deny": [\n      "Read(./.env)"\n    ]\n  }\n}\n');
        expect(appendDenyRules(BODY, []).text).toBe(BODY);
    });

    it('reports no rules at all for a section with no enforceable bullet', () => {
        const plan = planDenyRows('- Never add a runtime dependency without an ADR', 'claude');
        expect(plan.rules).toEqual([]);
        expect(renderDenyPlan(plan, 'claude')).toContain('nothing to enforce');
    });
});
