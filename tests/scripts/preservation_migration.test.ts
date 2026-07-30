// Tests for src/scripts/_lib/preservation_migration.ts — the verifier that
// decides whether a safety-floor rule edit is a P4 migration or a substantive
// change (ADR-203).
//
// The point of this suite is the direction the guard is most likely to be wrong
// in: it must PASS a real migration (or the narrowing is useless and everyone
// routes around it) and BLOCK every shape of loss (or the narrowing is a hole in
// a safety floor). Both directions are asserted; neither is assumed.

import { describe, expect, it } from 'vitest';

import {
    iron_law_units,
    load_context_targets,
    normalise,
    parse_units,
    similarity,
    strip_frontmatter,
    verify_migration,
} from '../../src/scripts/_lib/preservation_migration.js';

const RULE = `---
type: "always"
load_context:
  - contexts/authority/demo-mechanics.md
---

# Demo Rule

## The Iron Law

\`\`\`
NEVER DO THE FORBIDDEN THING.
NO EXCEPTIONS, NO AUTONOMY OVERRIDE.
\`\`\`

Some framing prose that explains the law in ordinary words.

- first obligation the agent carries
- second obligation the agent carries

## Failure modes

A catalogue paragraph that is lookup material rather than obligation.

## See also

Pointer block to neighbouring rules.
`;

const CONTEXT_BEFORE = `---
kind: context
---

# Demo Mechanics

Existing body.
`;

function ctx(map: Record<string, string>): Map<string, string> {
    return new Map(Object.entries(map));
}

const TARGET = 'src/agent-src/contexts/authority/demo-mechanics.md';

describe('parsing', () => {
    it('reads load_context targets from frontmatter', () => {
        expect(load_context_targets(RULE)).toEqual(['contexts/authority/demo-mechanics.md']);
    });

    it('keeps a fenced block as one unit rather than splitting its lines', () => {
        const units = parse_units(strip_frontmatter(RULE));
        const fences = units.filter((u) => u.kind === 'fence');
        expect(fences).toHaveLength(1);
        expect(fences[0]!.raw).toContain('NEVER DO THE FORBIDDEN THING.');
        expect(fences[0]!.raw).toContain('NO EXCEPTIONS, NO AUTONOMY OVERRIDE.');
    });

    it('normalises heading depth and link targets but not wording', () => {
        expect(normalise('## Enforcement')).toBe(normalise('### Enforcement'));
        expect(normalise('see [x](../a/b.md)')).toBe(normalise('see [x](../../c/b.md)'));
        expect(normalise('never do X')).not.toBe(normalise('sometimes do X'));
    });

    it('scopes Iron Law units to the section, not the whole file', () => {
        const iron = iron_law_units(parse_units(strip_frontmatter(RULE)));
        expect(iron.some((u) => u.kind === 'fence')).toBe(true);
        expect(iron.some((u) => u.norm.includes('Pointer block'))).toBe(false);
    });

    it('similarity separates telegraph condensation from rewriting', () => {
        expect(similarity('the agent must always verify the result', 'agent must always verify the result')).toBeGreaterThan(0.6);
        expect(similarity('never commit without asking', 'commit freely whenever useful')).toBeLessThan(0.6);
    });
});

describe('verify_migration — the legitimate case passes', () => {
    it('accepts telegraph condensation that keeps the passage in the rule', () => {
        const head = RULE.replace(
            'Some framing prose that explains the law in ordinary words.',
            'Framing prose explaining the law in ordinary words.',
        );
        expect(verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
            base_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
        })).toEqual([]);
    });

    it('accepts a section moved verbatim into a declared load_context target', () => {
        const head = RULE.replace('## Failure modes\n\nA catalogue paragraph that is lookup material rather than obligation.\n\n', '');
        const target = `${CONTEXT_BEFORE}\n### Failure modes\n\nA catalogue paragraph that is lookup material rather than obligation.\n`;
        expect(verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ [TARGET]: target }),
            base_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
        })).toEqual([]);
    });
});

describe('verify_migration — every shape of loss is blocked', () => {
    it('blocks a deleted passage with no landing site', () => {
        const head = RULE.replace('- second obligation the agent carries\n', '');
        const findings = verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
            base_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
        });
        expect(findings.map((f) => f.code)).toContain('passage-lost');
    });

    it('blocks a passage that only APPEARS to have moved — text already in the target', () => {
        // The landing site must be ADDED by this diff. Pre-existing context text
        // must not be able to launder a deletion.
        const head = RULE.replace('## Failure modes\n\nA catalogue paragraph that is lookup material rather than obligation.\n\n', '');
        const unchanged = `${CONTEXT_BEFORE}\n### Failure modes\n\nA catalogue paragraph that is lookup material rather than obligation.\n`;
        const findings = verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ [TARGET]: unchanged }),
            base_contexts: ctx({ [TARGET]: unchanged }),
        });
        expect(findings.map((f) => f.code)).toContain('passage-lost');
    });

    it('blocks a migration into a file the rule does not declare', () => {
        const head = RULE.replace('## Failure modes\n\nA catalogue paragraph that is lookup material rather than obligation.\n\n', '');
        const elsewhere = `${CONTEXT_BEFORE}\n### Failure modes\n\nA catalogue paragraph that is lookup material rather than obligation.\n`;
        const findings = verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ 'src/agent-src/contexts/authority/undeclared.md': elsewhere }),
            base_contexts: ctx({ 'src/agent-src/contexts/authority/undeclared.md': CONTEXT_BEFORE }),
        });
        expect(findings.map((f) => f.code)).toContain('passage-lost');
    });

    it('blocks any edit inside an Iron Law fence', () => {
        const head = RULE.replace('NO EXCEPTIONS, NO AUTONOMY OVERRIDE.', 'NO EXCEPTIONS.');
        const findings = verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
            base_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
        });
        expect(findings.map((f) => f.code)).toContain('iron-law-fence-changed');
    });

    it('blocks an Iron Law heading demoted to a lower level', () => {
        const head = RULE.replace('## The Iron Law', '### The Iron Law');
        const findings = verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
            base_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
        });
        expect(findings.map((f) => f.code)).toContain('iron-law-heading-lost');
    });

    it('blocks new content — a migration only removes', () => {
        const head = RULE.replace(
            '## Failure modes',
            '## Exception for urgent work\n\nThe agent may skip the law when in a hurry.\n\n## Failure modes',
        );
        const findings = verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
            base_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
        });
        expect(findings.map((f) => f.code)).toContain('unexplained-addition');
    });

    it('blocks a weakened obligation even when length is unchanged', () => {
        const head = RULE.replace(
            '- first obligation the agent carries',
            '- first obligation is optional for the agent',
        );
        const findings = verify_migration({
            base_rule: RULE,
            head_rule: head,
            head_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
            base_contexts: ctx({ [TARGET]: CONTEXT_BEFORE }),
        });
        expect(findings.length).toBeGreaterThan(0);
    });
});
