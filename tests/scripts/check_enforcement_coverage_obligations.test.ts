/**
 * Obligation-level credit beside rule-level credit
 * (road-to-enforcement-per-obligation, Phases 3 and 4).
 *
 * The rule-level resolver credits a whole rule for whatever one entry refuses.
 * These cases pin the narrower count: an entry is credited only with the ids it
 * is bound to, an unbound entry keeps its rule-level credit and is reported as
 * unbound, and nothing about the rule-level fields moves.
 */
import { describe, expect, it } from 'vitest';

import {
    collect,
    obligation_credit,
    summarise,
    summarise_obligations,
    type Resolution,
    type RuleCoverage,
} from '../../src/scripts/check_enforcement_coverage.js';
import { KERNEL_RULE_ID_SET } from '../../src/scripts/_lib/kernel_rules.js';
import { loadRuleObligations } from '../../src/scripts/_lib/rule_obligations.js';

const IDS = ['r.alpha', 'r.beta', 'r.gamma'];

describe('obligation_credit — an entry is credited with the ids it is bound to', () => {
    it('credits only the bound ids of a blocking entry', () => {
        const c = obligation_credit(['hook:guard'], ['hook'], {
            obligations: IDS,
            bindings: { 'hook:guard': ['r.beta'] },
        });
        expect(c.blocking).toEqual(['r.beta']);
        expect(c.observer).toEqual([]);
        expect(c.unbound_entries).toEqual([]);
    });

    it('reports an unbound carrying entry and credits nothing for it', () => {
        const c = obligation_credit(['validator:src/scripts/x.ts'], ['validator'], { obligations: IDS });
        expect(c.blocking).toEqual([]);
        expect(c.unbound_entries).toEqual(['validator:src/scripts/x.ts']);
    });

    it('treats a binding to [] as a finding, not as unbound', () => {
        const c = obligation_credit(['hook:guard'], ['hook'], {
            obligations: IDS,
            bindings: { 'hook:guard': [] },
        });
        expect(c.blocking).toEqual([]);
        expect(c.unbound_entries).toEqual([]);
    });

    it('lets a blocking binding win over an observer binding for the same id', () => {
        const c = obligation_credit(['hook:a', 'hook:b'], ['observer', 'hook'], {
            obligations: IDS,
            bindings: { 'hook:a': ['r.alpha', 'r.gamma'], 'hook:b': ['r.alpha'] },
        });
        expect(c.blocking).toEqual(['r.alpha']);
        expect(c.observer).toEqual(['r.gamma']);
    });

    it('credits nothing for an entry that resolves to unwired, even when bound', () => {
        const res: Resolution[] = ['unwired', 'missing', 'validator-local'];
        const c = obligation_credit(['validator:a', 'validator:b', 'validator:c'], res, {
            obligations: IDS,
            bindings: { 'validator:a': ['r.alpha'], 'validator:b': ['r.beta'], 'validator:c': ['r.gamma'] },
        });
        expect(c.blocking).toEqual([]);
        expect(c.observer).toEqual([]);
        expect(c.unbound_entries).toEqual([]);
    });

    it('ignores a bound id the rule does not declare', () => {
        const c = obligation_credit(['hook:guard'], ['hook'], {
            obligations: IDS,
            bindings: { 'hook:guard': ['r.delta'] },
        });
        expect(c.blocking).toEqual([]);
    });

    it('returns empty credit for a rule with no inventory entry', () => {
        const c = obligation_credit(['hook:guard'], ['hook'], undefined);
        expect(c).toEqual({ ids: [], blocking: [], observer: [], unbound_entries: ['hook:guard'] });
    });

    it('keeps declared order, not binding order', () => {
        const c = obligation_credit(['hook:guard'], ['hook'], {
            obligations: IDS,
            bindings: { 'hook:guard': ['r.gamma', 'r.alpha'] },
        });
        expect(c.blocking).toEqual(['r.alpha', 'r.gamma']);
    });
});

describe('summarise_obligations — counts beside the rule counts', () => {
    const row = (id: string, ob: RuleCoverage['obligation']): RuleCoverage =>
        ({ id, obligation: ob }) as unknown as RuleCoverage;

    it('adds per-class counts and leaves the rest as not bound', () => {
        const s = summarise_obligations([
            row('one', { ids: ['one.a', 'one.b'], blocking: ['one.a'], observer: [], unbound_entries: [] }),
            row('two', { ids: ['two.a', 'two.b', 'two.c'], blocking: [], observer: ['two.c'], unbound_entries: ['hook:x'] }),
            row('three', { ids: [], blocking: [], observer: [], unbound_entries: [] }),
        ]);
        expect(s).toMatchObject({
            total: 5,
            blocking: 1,
            observer: 1,
            not_bound: 3,
            rules_with_unbound_entries: 1,
            rules_without_ids: 1,
        });
    });
});

describe('the real tree', () => {
    const rows = collect();
    const summary = summarise(rows);
    const inventory = loadRuleObligations(process.cwd()).rules;

    it('counts exactly the ids the inventory declares', () => {
        const declared = Object.values(inventory).reduce((n, e) => n + e.obligations.length, 0);
        expect(summary.obligations.total).toBe(declared);
        expect(summary.obligations.kernel_rules).toBe(KERNEL_RULE_ID_SET.size);
    });

    it('never credits more obligations than the rule-level blocking rules hold', () => {
        for (const r of rows) {
            if (r.obligation.blocking.length > 0) {
                expect(['validator', 'test', 'hook']).toContain(r.effective);
            }
        }
    });

    it('binds every carrying entry of every rule credited as gated (Phase 4.1)', () => {
        const unbound = rows
            .filter((r) => ['validator', 'test', 'hook'].includes(r.effective))
            // Kernel rules stay at rule granularity; agents cannot bind them.
            .filter((r) => !KERNEL_RULE_ID_SET.has(r.id))
            .filter((r) => r.obligation.unbound_entries.length > 0)
            .map((r) => `${r.id}: ${r.obligation.unbound_entries.join(', ')}`);
        expect(unbound).toEqual([]);
    });
});
