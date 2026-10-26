/**
 * Interface drift IF-1…IF-8 as data for the one drift engine (`../../drift.ts`).
 *
 * Each row picks the interface lane's records and states the attribute test
 * that makes one a finding and the attribute that holds the second witness.
 * Every class is advice until its precision on planted fixtures is recorded.
 * IF-6 and IF-7 are hand-offs: the lane reports the shape, the threat-model
 * skill judges it.
 */
import type { DriftRule } from '../../drift.js';

export const INTERFACE_DRIFT_RULES: readonly DriftRule[] = [
    {
        id: 'IF-1',
        title: 'call not in contract',
        lane: 'interfaces',
        tier: 'advice',
        handoff: null,
        match: 'fact',
        select: { edge: 'calls-out', where: { in_contract: { eq: false } } },
        counter: 'contract_witness',
        message: '{method} {path} is called but the service contract does not list it',
    },
    {
        id: 'IF-2',
        title: 'contract operation never called',
        lane: 'interfaces',
        tier: 'advice',
        handoff: null,
        match: 'fact',
        select: { kind: 'operation', where: { source: { eq: 'contract' }, called: { eq: false }, service_called: { eq: true } } },
        counter: 'service_call_witness',
        message: '{subject} is in the contract but no call site reaches it',
    },
    {
        id: 'IF-3',
        title: 'parameter mismatch',
        lane: 'interfaces',
        tier: 'advice',
        handoff: null,
        match: 'fact',
        select: { edge: 'calls-out', where: { param_mismatch: { minItems: 1 } } },
        counter: 'contract_witness',
        message: 'call parameters differ from the contract: {param_mismatch} (+ not in contract, - required but not passed)',
    },
    {
        id: 'IF-4',
        title: 'literal base URL in code',
        lane: 'interfaces',
        tier: 'advice',
        handoff: null,
        match: 'fact',
        select: { edge: 'calls-out', where: { literal_base: { truthy: true } } },
        counter: 'literal_witness',
        message: 'base address {literal_base} is written in code instead of read from configuration',
    },
    {
        id: 'IF-4',
        title: 'credential literal in code',
        lane: 'interfaces',
        tier: 'advice',
        handoff: null,
        match: 'fact',
        select: { edge: 'calls-out', where: { credential: { truthy: true } } },
        counter: 'credential_witness',
        message: 'a credential-shaped literal is passed to the call: {credential}',
    },
    {
        id: 'IF-5',
        title: 'outbound call without timeout',
        lane: 'interfaces',
        tier: 'advice',
        handoff: null,
        match: 'fact',
        select: { edge: 'calls-out', where: { timeout: { eq: false } } },
        counter: 'client_witness',
        message: '{method} {path} sets no timeout and its client has no default one',
    },
    {
        id: 'IF-6',
        title: 'user value into host or path',
        lane: 'interfaces',
        tier: 'advice',
        handoff: 'threat-modeling',
        match: 'fact',
        select: { edge: 'calls-out', where: { user_value_in_url: { eq: true } } },
        counter: 'user_value_witness',
        message: 'a request value reaches the outbound address of {method} {path}; hand to the threat-modeling skill',
    },
    {
        id: 'IF-7',
        title: 'webhook without signature check',
        lane: 'interfaces',
        tier: 'advice',
        handoff: 'threat-modeling',
        match: 'fact',
        select: { kind: 'operation', where: { protocol: { eq: 'webhook' }, signature_check: { eq: false } } },
        counter: 'handler_witness',
        message: 'webhook {subject} has no signature check in its handler; hand to the threat-modeling skill',
    },
    {
        id: 'IF-8',
        title: 'one service via two config names',
        lane: 'interfaces',
        tier: 'advice',
        handoff: null,
        match: 'fact',
        select: { kind: 'service', where: { base_names: { minItems: 2 } } },
        counter: 'base_name_witnesses',
        message: '{subject} takes its address from more than one name: {base_names}',
    },
];
