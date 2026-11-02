import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateSecurityOps } from '../../src/scripts/_lib/security_ops.js';

const ok = () => ({
    schema_version: 1,
    operator_path: 'sso',
    break_glass: 'cli',
    levers: [
        { id: 'uploads-off', level: 'L1', fail_mode: 'closed', owner: 'on-call', release: 'control-surface', stops: ['http', 'queue'], packages: ['intervention/image'] },
        { id: 'edge-off', level: 'L4', fail_mode: 'closed', owner: 'on-call', release: 'edge-rule', stops: ['http'] },
    ],
});

describe('validateSecurityOps', () => {
    it('accepts the blueprint example', () => {
        expect(validateSecurityOps(ok())).toEqual([]);
    });

    it('refuses a lever without fail_mode', () => {
        const d = ok();
        delete (d.levers[0] as Record<string, unknown>)['fail_mode'];
        expect(validateSecurityOps(d)).toContain('levers[0] uploads-off: fail_mode must be open|closed — what happens when the lever store cannot be read');
    });

    it('refuses a URL secret as the primary operator path', () => {
        expect(validateSecurityOps({ ...ok(), operator_path: 'url-secret' })).toContain(
            'operator_path must be sso|identity-provider|vpn — a URL secret is break-glass at most, never the primary path',
        );
    });

    it('refuses an L4 lever released through the control surface it takes offline', () => {
        const d = ok();
        d.levers[1]!.release = 'control-surface';
        expect(validateSecurityOps(d)).toContain('levers[1] edge-off: an L4 lever takes the control surface offline — release through edge-rule|infra-flag|cli');
    });

    it('refuses a lever that stops the control surface itself', () => {
        const d = ok();
        d.levers[0]!.stops = ['http', 'control-surface'];
        expect(validateSecurityOps(d)).toContain('levers[0] uploads-off: stops the control surface — the operator would be locked out');
    });

    it('accepts automation off and propose — the default and the one opt-in', () => {
        expect(validateSecurityOps({ ...ok(), automation: 'off' })).toEqual([]);
        expect(validateSecurityOps({ ...ok(), automation: 'propose' })).toEqual([]);
    });

    it.each(['auto', 'throw', true, 'on'])('refuses automation %s — no lever is thrown without an operator confirming', (value) => {
        expect(validateSecurityOps({ ...ok(), automation: value })).toContain(
            'automation must be off|propose — an advisory may propose a lever, an operator confirms it; nothing throws one unattended (ADR-304)',
        );
    });

    it('refuses propose when no lever names the packages an advisory would map to', () => {
        const d = { ...ok(), automation: 'propose' };
        for (const l of d.levers) delete (l as Record<string, unknown>)['packages'];
        expect(validateSecurityOps(d)).toContain(
            'automation: propose needs at least one lever with packages — otherwise no advisory maps to a lever and there is nothing to propose',
        );
    });

    it('propose is not required to name packages when automation is off', () => {
        const d = ok();
        for (const l of d.levers) delete (l as Record<string, unknown>)['packages'];
        expect(validateSecurityOps(d)).toEqual([]);
    });

    it('the shipped JSON schema allows exactly off and propose for automation', () => {
        const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/scripts/schemas/security-ops.schema.json'), 'utf8'));
        expect(schema.properties.automation.enum).toEqual(['off', 'propose']);
    });

    it('the shipped JSON schema names the same required lever fields', () => {
        const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/scripts/schemas/security-ops.schema.json'), 'utf8'));
        expect(schema.properties.levers.items.required).toEqual(expect.arrayContaining(['id', 'level', 'fail_mode', 'owner', 'release']));
    });
});
