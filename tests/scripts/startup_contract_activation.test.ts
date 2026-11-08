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
import { readStartupContract } from '../../src/scripts/_lib/rule_law_section.js';
import { build } from '../../src/scripts/compile_router.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const contract = (id: string): string =>
    readStartupContract(path.join(REPO, 'src', 'rules'), id) as string;
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
        expect(body).toContain('Never the matched value, whatever the class.');
        expect(body).toContain('<masked, N chars>');
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

// Round 14 (both seats): legal's contract forbade single-model output but did
// not require the council pass to run; pii compressed `card_number` to "card".
describe('round 14 — the council pass is run, the scrub keys are exact', () => {
    it('legal: a configured but unused council does not satisfy the contract', () => {
        const c = contract('legal-safety-floor');
        expect(c).toContain('produce every legal work-product via a multi-model council / research:deep pass, actually run');
        expect(c).toContain("a configured but unused council, or several models consulted ad hoc, doesn't count");
    });
    it('pii: the logger scrub keys are the body\'s exact identifiers', () => {
        const c = contract('domain-safety-pii');
        for (const k of ['email', 'phone', 'name', 'address', 'token', 'password', 'card_number', 'iban']) {
            expect(c, k).toContain(`\`${k}\``);
        }
    });
});

// Round 17 (openai): "PII → placeholders" did not cover the sector fields the
// body replaces although they are not personal data (amounts, cost centers…).
describe('domain-safety-pii — sector placeholders that are not personal data', () => {
    it.each(['order/account IDs', 'payment details', 'customer company', 'current employer', 'university', 'comp target', 'counterparty', 'bank account', 'tax ID', 'cost center', 'amount'])(
        'the contract replaces %s before drafting',
        (field) => {
            const c = contract('domain-safety-pii');
            expect(c).toContain('even if not personal data');
            expect(c).toContain(field);
        },
    );
});

// Round 18 (openai): the Must list covered non-personal values, but the When
// line still required personal data, so a draft holding only those fell outside.
describe('domain-safety-pii — activation covers the non-personal sector values', () => {
    it('the When line names them', () => {
        expect(contract('domain-safety-pii')).toMatch(/\*\*When:\*\* every AI draft, log code and data export, whatever it holds/);
    });
    it('a finance draft with only a counterparty, cost center and amount routes the rule', () => {
        expect(activated('draft a finance memo to the counterparty with the cost center and the invoice amount')).toContain('domain-safety-pii');
    });
});

// Round 19 (openai): the body treats tokens, API keys and webhook secrets under
// the same log rule, but the When line reached them only through personal data.
describe('domain-safety-pii — activation covers a credential with no personal data', () => {
    it('the When line names secrets on their own', () => {
        expect(contract('domain-safety-pii')).toMatch(/\*\*When:\*\* every AI draft, log code and data export, whatever it holds[^\n]*tokens\/API keys/);
    });
    it('a log line holding only a webhook secret routes the rule', () => {
        expect(activated('add a log line to the logger that prints the webhook secret on startup')).toContain('domain-safety-pii');
    });
});

// The body's log surface binds every log stream, not only one holding personal data.
describe('domain-safety-pii — every log code activates the contract', () => {
    it('the When line opens with any log code, unconditioned', () => {
        expect(contract('domain-safety-pii')).toMatch(/\*\*When:\*\* every AI draft, log code and data export, whatever it holds/);
    });
});

// Round 20 (openai): an export of only B2B quasi-identifiers fell outside the
// conditional When. The body's law binds every draft, log line and export, so
// the When line now does too.
describe('domain-safety-pii — activation is unconditional, as the body law is', () => {
    it('names B2B quasi-identifiers among what an export may hold', () => {
        expect(contract('domain-safety-pii')).toContain('B2B quasi-IDs like company size/industry/region/founding year');
    });
    it('an export of only B2B quasi-identifiers routes the rule', () => {
        expect(activated('data export to CSV with company size, industry, region and founding year per row')).toContain('domain-safety-pii');
    });
});

// Round 27 (openai): two contracts were stricter than their bodies, which
// contradicts "no obligation changed". Both now carry the body's own scope.
describe('contracts no stricter than their bodies', () => {
    it('runtime-safety: assisted execution needs a proposal first, not "never beyond a proposal"', () => {
        const c = contract('runtime-safety');
        expect(c).toContain('`assisted` without first producing a proposal, or executing silently');
        expect(c).not.toContain('beyond a proposal');
    });
    it('engineering-safety-floor: the reset gate covers a pushed ref, as the body says', () => {
        const c = contract('engineering-safety-floor');
        expect(c).toContain('`git reset --hard <pushed>` w/o explicit named authorization');
        expect(c).not.toMatch(/\/reset --hard w\/o/);
    });
});

// Round 28 (openai): tool-safety's contract made two recommendations mandatory.
describe('tool-safety keeps the body modality', () => {
    it('read-only is a preference and logging a should, as the body says', () => {
        const c = contract('tool-safety');
        expect(c).toContain('prefer read-only actions; writes need explicit approval');
        expect(c).toContain('tool usage should be observable and logged');
        expect(c).not.toContain('keep usage logged');
    });
});

// Round 29 (openai): three body/contract mismatches in scope or precedence.
describe('round 29 — body and contract say the same thing', () => {
    const body = (id: string): string => fs.readFileSync(path.join(REPO, 'src', 'rules', `${id}.md`), 'utf8');
    it('tool-safety keeps "where the host supports it" on scoped grants', () => {
        expect(contract('tool-safety')).toContain('prefer scoped grants where the host supports it');
    });
    it('image-likeness-and-rights: the body states the model-card check is universal, as the contract does', () => {
        expect(body('image-likeness-and-rights')).toContain('Check model card on every gen/edit');
        expect(contract('image-likeness-and-rights')).toContain('before every gen/edit, check model card');
    });
    it('question-not-instruction: the body names the marker and greeting precedence the contract carries', () => {
        expect(body('question-not-instruction')).toContain('first token (after any fast-path marker and canary greeting');
        expect(contract('question-not-instruction')).toContain('first token after any fast-path marker and canary greeting');
    });
});

// Round 30 (openai): two contracts said more than their bodies.
describe('round 30 — no restriction or number the body does not state', () => {
    it('decision-revisit-gate keeps the transition test on commitments', () => {
        const c = contract('decision-revisit-gate');
        expect(c).toContain('creates/removes/weakens a legal/regulatory/contractual/licensing/compat/public commitment');
        expect(c).not.toContain('compat/public pledge');
    });
    it('domain-safety-retention names the response clock without a number the body does not give', () => {
        const c = contract('domain-safety-retention');
        expect(c).toContain("regime's response clock (GDPR Art. 12(3))");
        expect(c).not.toContain('1 month');
    });
});
