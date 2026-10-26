/**
 * Interface drift IF-1…IF-8 as data over the lane's own output.
 *
 * A rule names the records it looks at, the attribute test that makes one a
 * finding, and the attribute that holds the second witness. Adding a class is a
 * new row; the evaluator below never names a rule. Every class is advice: a
 * class gates only after its precision on planted fixtures is recorded.
 * IF-6 and IF-7 are hand-offs — the lane reports the shape, the threat-model
 * skill judges it.
 */
import type { LaneOutput, Witness } from '../lane_fact.js';
import { parseWitnessRef } from './model.js';

type AttrValue = string | number | boolean | string[] | null | undefined;

export type AttrTest = { eq: string | number | boolean | null } | { truthy: true } | { minItems: number } | { in: (string | number | boolean | null)[] };

export interface DriftRule {
    id: string;
    title: string;
    tier: 'advice' | 'gate';
    handoff: 'threat-modeling' | null;
    on: { record: 'fact'; kind: string } | { record: 'relation'; relation: string };
    when: Record<string, AttrTest>;
    /** attribute holding the second witness: a `file:line:hash` ref, or a list of them */
    counterWitness: string;
    /** message template; `{attr}` is replaced by the attribute's value, `{subject}` by the record id */
    message: string;
}

export const INTERFACE_DRIFT_RULES: readonly DriftRule[] = [
    {
        id: 'IF-1',
        title: 'call not in contract',
        tier: 'advice',
        handoff: null,
        on: { record: 'relation', relation: 'calls-out' },
        when: { in_contract: { eq: false } },
        counterWitness: 'contract_witness',
        message: '{method} {path} is called but the service contract does not list it',
    },
    {
        id: 'IF-2',
        title: 'contract operation never called',
        tier: 'advice',
        handoff: null,
        on: { record: 'fact', kind: 'operation' },
        when: { source: { eq: 'contract' }, called: { eq: false }, service_called: { eq: true } },
        counterWitness: 'service_call_witness',
        message: '{subject} is in the contract but no call site reaches it',
    },
    {
        id: 'IF-3',
        title: 'parameter mismatch',
        tier: 'advice',
        handoff: null,
        on: { record: 'relation', relation: 'calls-out' },
        when: { param_mismatch: { minItems: 1 } },
        counterWitness: 'contract_witness',
        message: 'call parameters differ from the contract: {param_mismatch} (+ not in contract, - required but not passed)',
    },
    {
        id: 'IF-4',
        title: 'literal base URL in code',
        tier: 'advice',
        handoff: null,
        on: { record: 'relation', relation: 'calls-out' },
        when: { literal_base: { truthy: true } },
        counterWitness: 'literal_witness',
        message: 'base address {literal_base} is written in code instead of read from configuration',
    },
    {
        id: 'IF-4',
        title: 'credential literal in code',
        tier: 'advice',
        handoff: null,
        on: { record: 'relation', relation: 'calls-out' },
        when: { credential: { truthy: true } },
        counterWitness: 'credential_witness',
        message: 'a credential-shaped literal is passed to the call: {credential}',
    },
    {
        id: 'IF-5',
        title: 'outbound call without timeout',
        tier: 'advice',
        handoff: null,
        on: { record: 'relation', relation: 'calls-out' },
        when: { timeout: { eq: false } },
        counterWitness: 'client_witness',
        message: '{method} {path} sets no timeout and its client has no default one',
    },
    {
        id: 'IF-6',
        title: 'user value into host or path',
        tier: 'advice',
        handoff: 'threat-modeling',
        on: { record: 'relation', relation: 'calls-out' },
        when: { user_value_in_url: { eq: true } },
        counterWitness: 'user_value_witness',
        message: 'a request value reaches the outbound address of {method} {path}; hand to the threat-modeling skill',
    },
    {
        id: 'IF-7',
        title: 'webhook without signature check',
        tier: 'advice',
        handoff: 'threat-modeling',
        on: { record: 'fact', kind: 'operation' },
        when: { protocol: { eq: 'webhook' }, signature_check: { eq: false } },
        counterWitness: 'handler_witness',
        message: 'webhook {subject} has no signature check in its handler; hand to the threat-modeling skill',
    },
    {
        id: 'IF-8',
        title: 'one service via two config names',
        tier: 'advice',
        handoff: null,
        on: { record: 'fact', kind: 'service' },
        when: { base_names: { minItems: 2 } },
        counterWitness: 'base_name_witnesses',
        message: '{subject} takes its address from more than one name: {base_names}',
    },
];

export interface DriftFinding {
    rule: string;
    title: string;
    tier: DriftRule['tier'];
    handoff: DriftRule['handoff'];
    subject: string;
    message: string;
    /** the record's own witness, then the counter-witness (null when the record had none) */
    witnesses: [Witness, Witness | null];
    engine: 'interfaces-drift';
    /** `partial` when the record rests on a guessed service or link */
    completeness: 'complete' | 'partial';
}

export interface DriftReport {
    basis: { lane: string; facts: number; relations: number; skipped: number; rules: string[] };
    findings: DriftFinding[];
}

function passes(v: AttrValue, t: AttrTest): boolean {
    if ('eq' in t) return v === t.eq;
    if ('truthy' in t) return !!v && (!Array.isArray(v) || v.length > 0);
    if ('minItems' in t) return Array.isArray(v) && v.length >= t.minItems;
    return t.in.includes(v as string | number | boolean | null);
}

function fill(template: string, subject: string, attrs: Record<string, AttrValue>): string {
    return template.replace(/\{(\w+)\}/g, (_, k: string) => {
        if (k === 'subject') return subject;
        const v = attrs[k];
        if (Array.isArray(v)) return v.join(', ');
        return v === null || v === undefined || v === '' ? '' : String(v);
    });
}

export function evaluateDrift(out: LaneOutput, rules: readonly DriftRule[] = INTERFACE_DRIFT_RULES): DriftReport {
    const findings: DriftFinding[] = [];
    for (const rule of rules) {
        const records =
            rule.on.record === 'fact'
                ? out.facts.filter((f) => rule.on.record === 'fact' && f.kind === rule.on.kind).map((f) => ({ subject: f.id, attrs: f.attrs, witness: f.witness, guess: f.attrs['guess'] === true }))
                : out.relations
                      .filter((r) => rule.on.record === 'relation' && r.relation === rule.on.relation)
                      .map((r) => ({ subject: `${r.from} -> ${r.to}`, attrs: r.attrs, witness: r.witness, guess: r.guess }));
        for (const rec of records) {
            if (!Object.entries(rule.when).every(([k, t]) => passes(rec.attrs[k], t))) continue;
            const counter = rec.attrs[rule.counterWitness];
            const refs = Array.isArray(counter) ? counter : [counter];
            const own = Array.isArray(counter) ? parseWitnessRef(refs[0]) : rec.witness;
            const other = parseWitnessRef(Array.isArray(counter) ? refs[1] : refs[0]);
            findings.push({
                rule: rule.id,
                title: rule.title,
                tier: rule.tier,
                handoff: rule.handoff,
                subject: rec.subject,
                message: fill(rule.message, rec.subject, rec.attrs),
                witnesses: [own ?? rec.witness, other],
                engine: 'interfaces-drift',
                completeness: rec.guess ? 'partial' : 'complete',
            });
        }
    }
    return {
        basis: { lane: out.lane, facts: out.facts.length, relations: out.relations.length, skipped: out.skipped.length, rules: [...new Set(rules.map((r) => r.id))] },
        findings,
    };
}
