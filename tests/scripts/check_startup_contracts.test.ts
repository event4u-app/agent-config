/**
 * Startup contracts carry every audited clause of their rule
 * (road-to-a-session-start-under-the-host-limit 1.1–1.3).
 *
 * Two layers: fixture cases that pin each failure the gate names, and a
 * committed-tree pass that runs every audited clause as its own case and
 * proves, per clause, that removing its carrier from the contract turns the
 * gate red — the sabotage check of step 1.3.
 */
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    contractProblems,
    orphanContracts,
    readRuleTexts,
    requiredRules,
    type ContractConfig,
    type RuleText,
} from '../../src/scripts/check_startup_contracts.js';
import { startupContract } from '../../src/scripts/_lib/rule_law_section.js';
import { build_thin } from '../../src/scripts/_lib/thin_rules.js';
import { rule_in_scope } from '../../src/install/ruleInScope.js';
import * as fs from 'node:fs';
import * as os from 'node:os';

const REPO = path.resolve(import.meta.dirname, '..', '..');

const CONTRACT = '## Startup contract\n\n- **When:** a secret is about to be staged.\n- **Never:** commit it; stop and ask.';
const FILE = `---\nid: r\n---\n# R\n\nNEVER commit a secret.\n\n${CONTRACT}\n`;
const clause = (over: Record<string, unknown> = {}) => ({
    id: 'c1',
    kind: 'prohibition',
    source: 'NEVER commit a secret.',
    in_law: true,
    response: 'stop',
    witness: 'commit it; stop and ask',
    unresolved_ref: null,
    ...over,
});
const config = (clauses = [clause()], over: Partial<ContractConfig> = {}): ContractConfig => ({
    per_rule_max_chars: 2000,
    total_max_chars: 34000,
    rules: { r: { clauses } },
    ...over,
});
const texts = (file = FILE): Map<string, RuleText> => new Map([['r', { file, contract: startupContract(file.split('\n---\n')[1] ?? file) }]]);

describe('contractProblems', () => {
    it('is green when every clause has a source in the rule and a witness in the contract', () => {
        expect(contractProblems(['r'], texts(), config())).toEqual([]);
    });

    it('is red when a witness is missing from the contract', () => {
        const p = contractProblems(['r'], texts(), config([clause({ witness: 'refuse and report' })]));
        expect(p.some((m) => m.includes('no carrier'))).toBe(true);
    });

    it('is red when a source is not a span of the rule', () => {
        const p = contractProblems(['r'], texts(), config([clause({ source: 'ALWAYS commit' })]));
        expect(p.some((m) => m.includes('source is not a span'))).toBe(true);
    });

    it('is red when a required rule has no contract section', () => {
        const p = contractProblems(['r'], texts('---\nid: r\n---\n# R\n\nNEVER commit a secret.\n'), config());
        expect(p.some((m) => m.includes('no `## Startup contract`'))).toBe(true);
    });

    it('is red on a dangling reference, an oversize contract and an oversize total', () => {
        const dangling = FILE.replace('a secret is about', 'the table says a secret is about');
        expect(contractProblems(['r'], texts(dangling), config()).some((m) => m.includes('the table'))).toBe(true);
        expect(contractProblems(['r'], texts(), config(undefined, { per_rule_max_chars: 20 })).some((m) => m.includes('over 20'))).toBe(true);
        expect(contractProblems(['r'], texts(), config(undefined, { total_max_chars: 20 })).some((m) => m.includes('total'))).toBe(true);
    });

    it('is red for a contract on a rule outside the required set, and for an unknown kind or response', () => {
        expect(contractProblems([], texts(), config()).some((m) => m.includes('not a consequence-class'))).toBe(true);
        const bad = contractProblems(['r'], texts(), config([clause({ kind: 'mood', response: 'shrug' })]));
        expect(bad.some((m) => m.includes('unknown kind'))).toBe(true);
        expect(bad.some((m) => m.includes('unknown response'))).toBe(true);
    });
});

describe('committed tree', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, 'src/config/startup-contract-clauses.json'), 'utf8')) as ContractConfig;
    const required = requiredRules(REPO);
    const all = readRuleTexts(REPO);

    it('passes the gate', () => {
        expect(contractProblems(required, all, cfg)).toEqual([]);
        expect(orphanContracts(REPO)).toEqual([]);
    });

    it('names a contract file whose rule does not exist', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orphan-contract-'));
        fs.mkdirSync(path.join(tmp, 'src', 'rules'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'src', 'agent-src', 'startup-contracts', 'rules'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'src', 'rules', 'kept.md'), '# kept\n');
        fs.writeFileSync(path.join(tmp, 'src', 'agent-src', 'startup-contracts', 'rules', 'kept.md'), CONTRACT);
        fs.writeFileSync(path.join(tmp, 'src', 'agent-src', 'startup-contracts', 'rules', 'gone.md'), CONTRACT);
        expect(orphanContracts(tmp)).toEqual([expect.stringContaining('gone.md')]);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('no rule body carries its contract — the full rule is delivered without the duplicate', () => {
        for (const id of required) {
            expect(all.get(id)?.file, id).not.toContain('## Startup contract');
        }
    });

    const cases = Object.entries(cfg.rules).flatMap(([id, r]) => r.clauses.map((c) => [id, c] as const));
    it.each(cases)('%s: neutralising the carrier of a clause turns the gate red', (id, c) => {
        const t = all.get(id) as RuleText;
        const sabotaged = new Map(all);
        sabotaged.set(id, { ...t, contract: (t.contract as string).split(c.witness).join('') });
        expect(contractProblems(required, sabotaged, cfg).some((m) => m.startsWith(`${id}#${c.id}:`))).toBe(true);
    });

    it('a contract whose literal lives in the body fails closed when the body is unreadable', () => {
        for (const id of ['finance-safety-floor', 'strategy-safety-floor', 'domain-safety-disclaimer', 'domain-safety-retention']) {
            expect(all.get(id)?.contract, id).toContain("body unreadable → don't deliver, name the missing path");
        }
    });

    it('keeps the scopes round 5 found compressed away', () => {
        expect(all.get('domain-safety-pii')?.contract).toContain('in any drafted artifact');
        expect(all.get('domain-safety-disclaimer')?.contract).toContain('"is this symptom serious?" → refuse');
        expect(all.get('strategy-safety-floor')?.contract).toContain('w/o named competitor + evidenced delta');
        expect(all.get('finance-safety-floor')?.contract).toContain('one sentence on what would invalidate the conclusion');
        expect(all.get('domain-safety-retention')?.contract).toContain('name its expiry and the deletion job that must run');
        expect(all.get('autonomous-execution')?.contract).toContain('new strategy from the escalation');
        expect(all.get('git-history-discipline')?.contract).toContain('conflict resolution forced by a user-invoked');
        expect(all.get('legal-safety-floor')?.contract).toContain('body unreadable → still stop, name the path');
        expect(all.get('strategy-safety-floor')?.contract).toContain('counter-case (one paragraph:');
        expect(all.get('low-impact-corpus-privacy-floor')?.contract).toContain('never echo the matched secret/PII');
        expect(all.get('git-history-discipline')?.contract).toContain('that re-push needs this-turn OK first');
        expect(all.get('doc-screenshot-hygiene')?.contract).toContain('user-supplied screenshot used only as design spec');
        expect(all.get('legal-safety-floor')?.contract).toContain('Art. 28/controller/processor/privilege/work product/privacy');
        expect(all.get('finance-safety-floor')?.contract).toContain('ARR/MRR/NRR, churn rate, gross/contribution margin, EBITDA');
        expect(all.get('strategy-safety-floor')?.contract).toContain('competitive, market entry, OKR, build vs buy, beachhead, GTM');
        expect(all.get('settings-ask-protocol')?.contract).toContain('marked as the no-answer outcome (always present)');
        expect(all.get('settings-ask-protocol')?.contract).toContain('C: not saved, permanent only via human edit/GUI');
        expect(all.get('domain-safety-retention')?.contract).toContain("copy verbatim from domain-safety-disclaimer's financial section");
        expect(all.get('domain-safety-pii')?.contract).toContain('marketing: paraphrase quotes, round metrics');
        expect(all.get('domain-safety-pii')?.contract).toContain('always: logger recursively scrubs');
        expect(all.get('domain-safety-pii')?.contract).toContain('not redact; stop before generating');
        expect(all.get('fast-path-marker-visibility')?.contract).toContain('resolved, unavailable, split or aborted');
        expect(all.get('autonomous-execution')?.contract).toContain('whole fix-loop bound for that target spent');
        expect(all.get('domain-safety-disclaimer')?.contract).toContain('can I stop my medication → refuse + prescriber');
        expect(all.get('domain-safety-disclaimer')?.contract).toContain('High (verifiable from cited data)/Medium (reasoned, unverified)');
        expect(all.get('domain-safety-disclaimer')?.contract).toContain('AI-generated strategic analysis footer, copied likewise');
        expect(all.get('domain-safety-disclaimer')?.contract).toContain('financial only: bookkeeping/');
        expect(all.get('decision-revisit-gate')?.contract).toContain('only owner weakens an owner-reserved invariant');
        expect(all.get('tool-safety')?.contract).toContain('numeric thresholds in descriptions where they apply');
        expect(all.get('legal-safety-floor')?.contract).toContain('"⚠️ Attorney review required on material use.');
        expect(all.get('legal-safety-floor')?.contract).toContain('require_council + no council → refuse');
        expect(all.get('finance-safety-floor')?.contract).toContain("the body's footer copied verbatim (gist only:");
        expect(all.get('finance-safety-floor')?.contract).toContain('runway as one number (give optimistic/base/downside)');
        expect(all.get('command-suggestion-policy')?.contract).toContain('block-always (rate unmeasured, not low)');
        expect(all.get('low-impact-corpus-privacy-floor')?.contract).toContain('secrets (raw-key prefixes, inline api_key: shape)');
    });

    it('the reply-opening duties share one order: marker, greeting, answer', () => {
        expect(all.get('fast-path-marker-visibility')?.contract).toContain('order: marker, greeting, answer');
        expect(all.get('session-canary')?.contract).toContain('after any fast-path marker, before the answer');
        expect(all.get('question-not-instruction')?.contract).toContain('after any fast-path marker and canary greeting');
    });

    it('with no pack active, the D14 floors still arrive, and arrive as their contract only (step 2.3)', () => {
        const stubs = build_thin(path.join(REPO, 'dist', 'agent-src', 'rules'), null, null, null, { packageRoot: REPO });
        for (const id of ['legal-safety-floor', 'finance-safety-floor', 'strategy-safety-floor', 'image-likeness-and-rights']) {
            expect(rule_in_scope(path.join(REPO, 'dist', 'agent-src', 'rules', `${id}.md`), null, [], null), id).toBe(true);
            const stub = stubs.get(`${id}.md`) as string;
            const body = all.get(id)?.file as string;
            expect(stub, id).toContain(all.get(id)?.contract as string);
            expect(stub.length, id).toBeLessThan(2400);
            expect(stub, id).not.toContain(body.slice(body.indexOf('\n# '), body.indexOf('\n# ') + 200));
        }
        for (const id of ['brand-source-of-truth', 'scale-discipline', 'history-discipline']) {
            expect(rule_in_scope(path.join(REPO, 'dist', 'agent-src', 'rules', `${id}.md`), null, [], null), id).toBe(false);
        }
    });

    it('projects each contract-bearing rule as a stub carrying its contract verbatim, body behind the pointer', () => {
        const stubs = build_thin(path.join(REPO, 'dist', 'agent-src', 'rules'), null, null, null, { packageRoot: REPO });
        for (const id of required) {
            const stub = stubs.get(`${id}.md`) as string;
            expect(stub, id).toContain(all.get(id)?.contract as string);
            expect(stub.length, id).toBeLessThan((all.get(id)?.file as string).length);
        }
    });
});
