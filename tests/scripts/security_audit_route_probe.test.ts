/**
 * A casual "is my app secure?" must rank `security-audit` first. Before this
 * probe existed, three German/launch phrasings ranked it nowhere and three
 * others put `agent-security-review` — "the agent's own config", not app code —
 * on top. The near-misses pin the other direction: the description change must
 * not pull agent-config or pre-implementation prompts onto the audit skill.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { rank } from '../../src/scripts/skill_tools/score_skill_relevance.js';

const SKILLS = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'src', 'skills');
const top = (q: string): string => (rank(q, SKILLS)[0] as [string, number, string[]])[0];

const APP_PROMPTS = [
    'check meine App auf Sicherheit',
    'prüf meine App auf Sicherheitslücken bevor ich sie launche',
    'is my app secure? check it before launch',
    'check my app for security issues',
    'find security vulnerabilities in my whole app',
    'mach einen Security-Audit dieses Moduls und finde die Schwachstellen im Code',
];

const NEAR_MISSES = [
    'red-team my agent config — could someone weaponise my CLAUDE.md or MCP servers?',
    // Ranks a 23-point tie with or without this change; threat-modeling is not
    // reached by the ranker at all, so only the audit skill's absence is pinned.
    'threat-model this new payments endpoint before I build it',
];

describe('casual security questions reach security-audit', () => {
    it.each(APP_PROMPTS)('%j ranks security-audit first', (q) => {
        expect(top(q)).toBe('security-audit');
    });

    it.each(NEAR_MISSES)('%j does not rank security-audit first', (q) => {
        expect(top(q)).not.toBe('security-audit');
    });

    it('the agent-config near-miss stays on agent-security-review', () => {
        expect(top(NEAR_MISSES[0] as string)).toBe('agent-security-review');
    });
});
