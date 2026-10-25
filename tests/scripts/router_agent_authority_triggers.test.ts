/**
 * G1 — a request to give an AI agent, bot or tool authority over someone's
 * account activates the security rules. Compiles the router from the rule
 * sources in memory (nothing is written) and runs the one shared matcher, so
 * the verdict is the one `route:explain` gives once `dist/router.json` is
 * regenerated from the same sources.
 */
import { describe, expect, it } from 'vitest';

import { match_prompt, type Router } from '../../src/scripts/_lib/router_match.js';
import { build } from '../../src/scripts/compile_router.js';

const router = build() as unknown as Router;
const activated = (prompt: string): string[] =>
    match_prompt(router, prompt).activated_rules
        .filter((r) => r.tier !== 'kernel')
        .map((r) => String(r.rule));

// The four measured prompts of defect D1 (one carries two phrasings), then variants.
const D1 = [
    "add a tool to our support chatbot that lets it update the customer's email address",
    'Unser Support-Bot soll die E-Mail-Adresse eines Kunden ändern können',
    'give the AI agent a function to change account settings on behalf of the user',
    'implement account recovery so the user can change their email via the assistant',
    "build an MCP server tool that resets a user's password",
];
const VARIANTS = [
    'let the assistant change the recovery email when the caller asks for it',
    "wire a function calling tool that updates a customer's shipping address",
    'the tool call should reset the password for whichever user the model names',
    'Der Chatbot soll im Namen des Kunden das Konto wiederherstellen',
    'design the email change flow for our support bot',
    'expose an mcp tool that deletes a user by username',
];
// The prompts where a model-filled argument selects whose record a tool writes.
const WRITE_TOOL = [D1[0], D1[2], D1[4], VARIANTS[1], VARIANTS[2], VARIANTS[5]] as string[];
const NEGATIVE = 'add a --verbose flag to our CLI tool that prints the resolved config';

describe('G1 — agent-authority prompts route to the security rules', () => {
    it.each([...D1, ...VARIANTS])('%j activates security-sensitive-stop', (p) => {
        expect(activated(p)).toContain('security-sensitive-stop');
    });

    it.each(WRITE_TOOL)('%j activates broken-access-control', (p) => {
        expect(activated(p)).toContain('broken-access-control');
    });

    it('a prompt about a CLI tool activates neither', () => {
        const rules = activated(NEGATIVE);
        expect(rules).not.toContain('security-sensitive-stop');
        expect(rules).not.toContain('broken-access-control');
    });
});
