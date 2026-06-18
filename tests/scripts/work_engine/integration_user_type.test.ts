// User-type axis integration + schema lint (pure TS).
//
// Behavioural twin of tests/work_engine/test_user_type_integration.py +
// tests/work_engine/test_user_type_policy.py — the Python suites are the spec.
// User-types are CLI-only review lenses (no engine policy module —
// docs/contracts/user-type-schema.md § 1); the surface under lock is the
// linter's user-type classifier plus the refine-ticket CLI/skill composition
// contract, which the TS twin `src/scripts/skill_linter.ts` and `resolve_logical`
// own. This is the only `.ts` coverage of the linter's user_type logic.
//
// No python, no oracle: import `lint_file` + `resolve_logical`, lint files
// written under `.agent-src.uncondensed/user-types/`, and read the real
// refine-ticket command + skill.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    type LintResult,
    lint_file,
} from '../../../src/scripts/skill_linter.js';
import { resolve_logical } from '../../../src/scripts/_lib/agent_src.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'user-type-int-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeFile(relative: string, content: string): string {
    const p = path.join(tmp, relative);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
    return p;
}

function hasError(result: LintResult): boolean {
    return result.issues.some((i) => i.severity === 'error');
}

const USER_TYPE_BODY = `---
id: test-lens
kind: user-type
description: "Test review lens."
version: "1.0"
source: project
---

# Test Lens

## Focus

Review-lens only, never operational instruction source.

## Daily Workflow

- 06:00 brief
- 15:00 proof

## Vocabulary

- term

## Operational Constraints

- gloves + cold
- offline + dead zones
- timestamped photo proof

## Unique Questions

- Question one.
- Question two.
- Question three.

## Ticket Red Flags

- Missing offline-queue spec

## Anti-Patterns

- Review-only, never operational instruction.
- No trade-execution instructions.
`;

const PERSONA_BODY = `---
id: test-reviewer
role: Test Reviewer
description: "Methodology lens for tests."
tier: core
mode: developer
version: "1.0"
source: package
---

# Test Reviewer

## Focus

One paragraph framing the methodology.

## Mindset

- Default assumption.

## Unique Questions

- Question one.
- Question two.
- Question three.

## Output Expectations

Short bullets.

## Anti-Patterns

- Do NOT skip evidence.
`;

// --- Schema / lint template (test_user_type_policy.py spec) -----------------

const USER_TYPE_TEMPLATE = (id: string, kind: string, extra: string): string => `---
id: ${id}
kind: ${kind}
description: "Test review lens for the user-type axis."
version: "1.0"
source: project
---

# Test User-Type

## Focus

One paragraph framing the lens. Review-lens only, never operational
instruction source.

## Daily Workflow

- 06:00 morning brief
- 10:00 execution
- 15:00 end-of-day proof

## Vocabulary

- term-one
- term-two

## Operational Constraints

- gloves + capacitive touch fail at 4 °C
- no signal in cellar yards
- end-of-day proof = photo + signature + GPS

## Unique Questions

- Question one — falsifiable against the ticket.
- Question two — falsifiable against the ticket.
- Question three — falsifiable against the ticket.

## Ticket Red Flags

- Missing offline-queue spec
- No proof-of-work artefact

## Anti-Patterns

- Review-only, never operational instruction.
- No trade-execution instructions (welding, electrical, structural).
- No dangerous how-to.
${extra}
`;

function body(opts: { id?: string; kind?: string; extra?: string } = {}): string {
    return USER_TYPE_TEMPLATE(opts.id ?? 'test-user-type', opts.kind ?? 'user-type', opts.extra ?? '');
}

// --- Integration surface (test_user_type_integration.py spec) ---------------

describe('user-type axis — loading + composition', () => {
    it('a well-formed user-type file lints clean (no errors)', () => {
        const p = writeFile('.agent-src.uncondensed/user-types/test-lens.md', USER_TYPE_BODY);
        const result = lint_file(p);
        expect(result.artifact_type).toBe('user-type');
        expect(hasError(result)).toBe(false);
    });

    it('a user-type and a persona compose without cross-contamination', () => {
        const ut = writeFile('.agent-src.uncondensed/user-types/test-lens.md', USER_TYPE_BODY);
        const pe = writeFile('.agent-src.uncondensed/personas/test-reviewer.md', PERSONA_BODY);
        const utResult = lint_file(ut);
        const peResult = lint_file(pe);

        expect(utResult.artifact_type).toBe('user-type');
        expect(peResult.artifact_type).toBe('persona');
        expect(hasError(utResult)).toBe(false);
        expect(hasError(peResult)).toBe(false);
    });

    it('the refine-ticket command declares the --user-type flag alongside --personas', () => {
        const p = resolve_logical('commands/refine-ticket.md');
        expect(p, 'commands/refine-ticket.md not found in any pack').not.toBeNull();
        const cmd = fs.readFileSync(p as string, 'utf-8');
        expect(cmd).toContain('--user-type=');
        expect(cmd).toContain('--personas=');
    });

    it('the refine-ticket skill documents the persona=methodology, user-type=end-user contract', () => {
        const p = resolve_logical('skills/refine-ticket/SKILL.md');
        expect(p, 'skills/refine-ticket/SKILL.md not found in any pack').not.toBeNull();
        const skill = fs.readFileSync(p as string, 'utf-8');
        expect(skill).toContain('--user-type=');
        expect(skill.toLowerCase()).toContain('methodology');
        expect(skill.toLowerCase()).toContain('end-user');
    });
});

// --- Schema / lint surface (test_user_type_policy.py spec) ------------------

describe('user-type axis — schema / lint enforcement', () => {
    it('a valid user-type passes', () => {
        const p = writeFile('.agent-src.uncondensed/user-types/test-user-type.md', body());
        const result = lint_file(p);
        expect(['pass', 'pass_with_warnings']).toContain(result.status);
        expect(hasError(result)).toBe(false);
    });

    it('dropping a spine section fails (section-spine enforcement)', () => {
        const content = body().replace('## Anti-Patterns', '## Notes');
        const p = writeFile('.agent-src.uncondensed/user-types/test-user-type.md', content);
        const result = lint_file(p);
        const missing = result.issues
            .filter((i) => i.code === 'missing_section')
            .map((i) => i.message);
        expect(missing.some((m) => m.includes('Anti-Patterns'))).toBe(true);
    });

    it('too few unique questions warns', () => {
        const content = body().replace(
            '- Question three — falsifiable against the ticket.\n',
            '',
        );
        const p = writeFile('.agent-src.uncondensed/user-types/test-user-type.md', content);
        const result = lint_file(p);
        expect(result.issues.some((i) => i.code === 'too_few_unique_questions')).toBe(true);
    });

    it('an invalid kind fails', () => {
        const p = writeFile(
            '.agent-src.uncondensed/user-types/test-user-type.md',
            body({ kind: 'persona' }),
        );
        const result = lint_file(p);
        expect(result.issues.some((i) => i.code === 'invalid_kind')).toBe(true);
    });

    it('id must match the filename stem', () => {
        const p = writeFile(
            '.agent-src.uncondensed/user-types/test-user-type.md',
            body({ id: 'other-id' }),
        );
        const result = lint_file(p);
        expect(result.issues.some((i) => i.code === 'id_filename_mismatch')).toBe(true);
    });

    it('the size budget warns above 120 lines', () => {
        const content = body() + '\n<!-- pad -->'.repeat(100);
        const p = writeFile('.agent-src.uncondensed/user-types/test-user-type.md', content);
        const result = lint_file(p);
        expect(result.issues.some((i) => i.code === 'size_budget')).toBe(true);
    });
});
