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

    it('says whose spelling an unenforceable report is written in', () => {
        // Found by review: the report rendered Claude's rules and closed with
        // Claude's documentation URL, so a consumer on another host read them
        // as their own.
        const text = renderDenyPlan(planDenyRows(NO_GOS, 'cowork'), 'cowork');
        expect(text).toContain('the way `claude` spells a deny');
        expect(text).toContain('NOT the way cowork does');
    });

    it('tells the consumer where the enforcement stops', () => {
        // A consent screen that shows only the rows invites the reader to
        // believe the rows are the whole of it.
        const text = renderDenyPlan(planDenyRows(NO_GOS, 'claude'), 'claude');
        expect(text).toContain('prefix-matched');
        expect(text).toContain('not a script that opens the file itself');
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

    it('refuses rather than writing a SECOND `permissions` key', () => {
        // Found by review, and it was the worst shape in the change: with a
        // non-object `permissions`, `locate` finds no span, the root branch
        // inserted a second key, `JSON.parse` kept the LAST one, and the rule
        // the consumer consented to was silently discarded while the command
        // reported success.
        for (const body of [
            '{\n  "permissions": null,\n  "model": "opus"\n}\n',
            '{\n  "permissions": "none"\n}\n',
            '{\n  "permissions": 1\n}\n',
            '{\n  "permissions": ["Edit(x/**)"]\n}\n',
        ]) {
            expect(() => appendDenyRules(body, ['Edit(migrations/**)'])).toThrow(
                /not an object/,
            );
        }
    });

    it('does not mis-key the second object of an array', () => {
        // `pendingKey` survived a closing brace, so the second element
        // inherited the first element's last key and the splice landed inside
        // it — producing invalid JSON.
        const body = '{\n  "hooks": [{"deny": 1}, {"a": 2}],\n  "model": "opus"\n}\n';
        const out = appendDenyRules(body, ['Edit(migrations/**)']);
        const parsed = JSON.parse(out.text) as {
            hooks: unknown[];
            permissions: { deny: string[] };
        };
        expect(parsed.hooks).toEqual([{ deny: 1 }, { a: 2 }]);
        expect(parsed.permissions.deny).toEqual(['Edit(migrations/**)']);
    });

    it('refuses a body that is not an object', () => {
        expect(() => appendDenyRules('[1, 2]', ['Edit(x/**)'])).toThrow(/not a JSON object/);
    });
});

describe('a declined consent leaves the file unchanged', () => {
    // An earlier version of this block asserted a `const` against its own
    // literal and called `appendDenyRules(body, [])`, which early-returns.
    // Neither line could fail, and the property it claimed to pin — that the
    // planning half performs no write — was untestable here anyway, since
    // `planDenyRows` takes a string and has no path to write to. The real
    // property is on the CLI and lives in `no_go_deny_rows_cli.test.ts`.

    it('adds nothing when the caller passes no rule', () => {
        const body =
            '{\n    "permissions": {\n        "deny": [\n            "Read(./.env)"\n        ]\n    }\n}\n';
        const out = appendDenyRules(body, []);
        expect(out.text).toBe(body);
        expect(out.added).toEqual([]);
    });

    it('reports no rules at all for a section with no enforceable bullet', () => {
        const plan = planDenyRows('- Never add a runtime dependency without an ADR', 'claude');
        expect(plan.rules).toEqual([]);
        expect(renderDenyPlan(plan, 'claude')).toContain('nothing to enforce');
    });
});
