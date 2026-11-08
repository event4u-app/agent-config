/**
 * Round-12 ratification findings: a contract that names a trigger vocabulary
 * only by summary ("privilege marker", "7 siblings") cannot be matched by an
 * agent that holds the contract alone. Each literal must sit in the contract,
 * and each must on its own route the body in — the second half runs the
 * compiled router, so a prompt carrying nothing but the literal is the input.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { match_prompt, type Router } from '../../src/scripts/_lib/router_match.js';
import { startupContract, ruleBody } from '../../src/scripts/_lib/rule_law_section.js';
import { build } from '../../src/scripts/compile_router.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const contract = (id: string): string =>
    startupContract(ruleBody(fs.readFileSync(path.join(REPO, 'src', 'rules', `${id}.md`), 'utf8'))) as string;
const router = build() as unknown as Router;
const activated = (prompt: string): string[] => match_prompt(router, prompt).activated_rules.map((r) => String(r.rule));

const PRIVILEGE_MARKERS = [
    'ATTORNEY-CLIENT PRIVILEGED',
    'ATTORNEY WORK PRODUCT',
    'PREPARED AT REQUEST OF COUNSEL',
    'LITIGATION HOLD',
    'CONFIDENTIAL — INTERNAL LEGAL ANALYSIS',
];
const STRATEGY_SKILLS = [
    'vision-articulation',
    'positioning-strategy',
    'competitive-moat-analysis',
    'market-entry-analysis',
    'build-buy-partner',
    'okr-tree-modeling',
    'org-design',
    'fundraising-narrative',
];

describe('domain-safety-pii — privilege markers', () => {
    it.each(PRIVILEGE_MARKERS)('the contract names %j', (m) => {
        expect(contract('domain-safety-pii')).toContain(m);
    });
    it.each(PRIVILEGE_MARKERS)('a document headed only %j routes the rule', (m) => {
        expect(activated(`summarize this PDF and send it on; its header reads ${m}`)).toContain('domain-safety-pii');
    });
});

describe('strategy-safety-floor — every founder-strategy skill', () => {
    it.each(STRATEGY_SKILLS)('the contract names %j', (s) => {
        expect(contract('strategy-safety-floor')).toContain(s);
    });
    it.each(STRATEGY_SKILLS)('a request naming only %j routes the rule', (s) => {
        expect(activated(`run the ${s} skill on our company`)).toContain('strategy-safety-floor');
    });
});

describe('low-impact-corpus-privacy-floor — the body and the contract agree on masking', () => {
    it('the body forbids echoing the matched value, as the contract does', () => {
        const body = fs.readFileSync(path.join(REPO, 'src', 'rules', 'low-impact-corpus-privacy-floor.md'), 'utf8');
        const beforeContract = body.slice(0, body.indexOf('## Startup contract'));
        expect(beforeContract).toContain('never the matched value itself');
        expect(contract('low-impact-corpus-privacy-floor')).toContain('never echo the matched secret/PII');
    });
});

// Round 13 (both seats): the model-card check depended on already knowing the
// card restricts output — an ordinary subject on an unchecked model met no
// activation condition. The check now runs on every generation.
describe('image-likeness-and-rights — the model card is checked whatever the subject', () => {
    it('the contract activates on every image generation and orders the check before it', () => {
        const c = contract('image-likeness-and-rights');
        expect(c).toContain('every AI image gen/edit');
        expect(c).toContain('whatever the subject');
        expect(c).toContain('before every gen/edit, check model card');
        expect(c).not.toMatch(/\bw\/ real person's face\/body.*or license-restricted model\./);
    });
    it('an ordinary-subject image request routes the rule', () => {
        expect(activated('generate an image of a mountain landscape at dawn')).toContain('image-likeness-and-rights');
    });
});

describe('low-impact-corpus-privacy-floor — no matched value of any class is echoed', () => {
    it('the contract limits the preview to category and length for every class', () => {
        expect(contract('low-impact-corpus-privacy-floor')).toContain('category + match length only, for every class');
    });
});
