/**
 * Contract tests binding the three outcome vocabularies to their contracts.
 *
 * `road-to-experience-loop-broadening` step 1.3. That step's `verify:` clause
 * asks for one authoritative module plus a CHECK rather than an import,
 * because two of the three binding targets cannot import anything:
 *
 *  - `docs/contracts/audit-log-v1.md` is markdown.
 *  - `src/agent-src/contexts/execution/terminal-states.md` is markdown.
 *  - `src/agent-src/templates/scripts/work_engine/delivery_state.ts` is a
 *    TEMPLATE, self-contained by contract — no file under
 *    `src/agent-src/templates/scripts/` imports from `src/scripts/`, and this
 *    file asserts that too, so the reason the check exists cannot silently
 *    stop being true.
 *
 * These are the four bindings, plus the anti-duplicate rule. They read the
 * files rather than a remembered claim, which is the only reason they can
 * catch drift: the defect they were written against was a contract sentence
 * that had been false since the contract was created.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CROSS_DOMAIN_MAPPINGS,
    isPhaseOutcome,
    isRunTerminalState,
    PHASE_OUTCOMES,
    RUN_TERMINAL_STATES,
    STEP_OUTCOMES,
} from '../../src/scripts/_lib/outcome_vocabularies.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const AUDIT_CONTRACT = 'docs/contracts/audit-log-v1.md';
const TERMINAL_CONTRACT = 'src/agent-src/contexts/execution/terminal-states.md';
const DELIVERY_STATE = 'src/agent-src/templates/scripts/work_engine/delivery_state.ts';
const REGISTRY = 'src/scripts/_lib/outcome_vocabularies.ts';

describe('phase vocabulary <-> audit-log-v1 contract', () => {
    it('the contract outcome row lists exactly the registry values', () => {
        const src = read(AUDIT_CONTRACT);
        const row = src.split('\n').find((l) => l.startsWith('| `outcome` |'));
        expect(row, `no \`outcome\` row in ${AUDIT_CONTRACT}`).toBeDefined();
        // Values in the row are written as `` `value` `` inside the Meaning cell.
        const listed = [...(row as string).matchAll(/`([a-z][a-z-]*)`/g)]
            .map((m) => m[1])
            .filter((v) => v !== 'outcome' && v !== 'enum');
        expect(listed.sort()).toEqual([...PHASE_OUTCOMES].sort());
    });

    it('the contract does not claim a mirror the tree does not have', () => {
        const src = read(AUDIT_CONTRACT);
        // The original text claimed the enum "Mirrors `Outcome` from
        // `work_engine.directives`". Both halves were false: that module path
        // does not exist, and work_engine's own `Outcome` carries `partial`
        // and neither `skipped` nor `error`. A revived claim must not point at
        // a module whose member set differs.
        expect(src).not.toMatch(/work_engine\.directives/);
    });

    it('every enforcer the contract names exists', () => {
        const src = read(AUDIT_CONTRACT);
        // The privacy floor named `tests/contracts/test_audit_log_redaction.py`,
        // which is in no tree this repository has. A contract asserting an
        // enforcement it does not have is the defect class this file exists for.
        const named = [...src.matchAll(/`(tests\/[^`]+)`/g)].map((m) => m[1]);
        expect(named.length).toBeGreaterThan(0);
        for (const rel of named) {
            expect(fs.existsSync(path.join(REPO_ROOT, rel)), `${AUDIT_CONTRACT} names a non-existent enforcer: ${rel}`).toBe(true);
        }
    });
});

describe('step vocabulary <-> the work-engine template', () => {
    it('the template Outcome members are exactly the registry step values', () => {
        const src = read(DELIVERY_STATE);
        const block = /export const Outcome = \{([\s\S]*?)\} as const;/.exec(src);
        expect(block, `no \`export const Outcome\` in ${DELIVERY_STATE}`).not.toBeNull();
        const values = [...(block as RegExpExecArray)[1].matchAll(/'([a-z][a-z-]*)'/g)].map((m) => m[1]);
        expect(values.sort()).toEqual([...STEP_OUTCOMES].sort());
    });

    it('the template tree imports nothing from src/scripts — which is why this is a check, not an import', () => {
        const dir = path.join(REPO_ROOT, 'src/agent-src/templates/scripts');
        const offenders: string[] = [];
        const walk = (d: string): void => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) walk(full);
                else if (e.name.endsWith('.ts') && /from '[^']*src\/scripts\//.test(fs.readFileSync(full, 'utf8'))) {
                    offenders.push(path.relative(REPO_ROOT, full));
                }
            }
        };
        walk(dir);
        expect(offenders).toEqual([]);
    });
});

describe('run vocabulary <-> terminal-states contract', () => {
    it('the contract table lists exactly the registry values', () => {
        const src = read(TERMINAL_CONTRACT);
        for (const state of RUN_TERMINAL_STATES) {
            expect(src, `${TERMINAL_CONTRACT} does not mention \`${state}\``).toContain(`\`${state}\``);
        }
    });
});

describe('no inline duplicate declares a vocabulary outside the registry', () => {
    const VOCAB_SETS: ReadonlyArray<readonly [string, readonly string[]]> = [
        ['phase', PHASE_OUTCOMES],
        ['run', RUN_TERMINAL_STATES],
    ];

    it('no file under src/scripts re-declares a full vocabulary as a union or literal array', () => {
        const offenders: string[] = [];
        const walk = (d: string): void => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!e.name.endsWith('.ts')) continue;
                const rel = path.relative(REPO_ROOT, full);
                if (rel === REGISTRY) continue;
                const src = fs.readFileSync(full, 'utf8');
                for (const [name, values] of VOCAB_SETS) {
                    // A declaration is a `type X =` / `const X = [` whose body
                    // carries EVERY member of the vocabulary. Referring to one
                    // or two values is normal and is not a duplicate.
                    for (const m of src.matchAll(/(?:type|const)\s+\w+\s*(?::[^=]*)?=\s*([\s\S]{0,400}?);/g)) {
                        const body = m[1];
                        if (values.every((v) => body.includes(`'${v}'`))) {
                            offenders.push(`${rel} re-declares the ${name} vocabulary`);
                        }
                    }
                }
            }
        };
        walk(path.join(REPO_ROOT, 'src/scripts'));
        expect([...new Set(offenders)]).toEqual([]);
    });
});

describe('the registry itself', () => {
    it('records only crossings that exist in the tree, and each one resolves', () => {
        expect(CROSS_DOMAIN_MAPPINGS.length).toBeGreaterThan(0);
        for (const m of CROSS_DOMAIN_MAPPINGS) {
            const src = read(m.at);
            expect(src, `${m.at} does not define ${m.fn}`).toContain(m.fn);
        }
    });

    it('the guards accept every member and reject an off-vocabulary value', () => {
        for (const v of PHASE_OUTCOMES) expect(isPhaseOutcome(v)).toBe(true);
        for (const v of RUN_TERMINAL_STATES) expect(isRunTerminalState(v)).toBe(true);
        expect(isPhaseOutcome('partial')).toBe(false);
        expect(isPhaseOutcome('sucess')).toBe(false);
        expect(isRunTerminalState('skipped')).toBe(false);
        expect(isPhaseOutcome(undefined)).toBe(false);
    });
});
