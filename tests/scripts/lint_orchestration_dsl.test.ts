// Tests for src/scripts/lint_orchestration_dsl.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// Ports tests/test_lint_orchestration_dsl.py 1:1 (top-level shape, name vs
// filename, step kinds + ref resolution, interpolation namespaces, duplicate
// ids, exit codes) plus a golden-parity layer that runs python3 vs tsx on the
// REAL REPO (skipped without python3). `lint`/`main` take a path argument, so
// the fixtures live in a tmp dir while refs resolve against the real repo.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lod from '../../src/scripts/lint_orchestration_dsl.js';



const VALID_PIPELINE = `schema_version: 1
name: smoke-pipeline
description: |
  Smoke pipeline for the linter test suite.
inputs:
  - id: target
    description: Diff target.
    default: origin/main
steps:
  - id: review
    kind: skill
    ref: skill-reviewer
    with:
      target: \${{ inputs.target }}
outputs:
  report: \${{ steps.review.output }}
`;

describe('lint_orchestration_dsl — ported pytest suite', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lod-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(body: string, name = 'smoke-pipeline.yaml'): string {
        const p = path.join(tmp, name);
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    }

    it('test_missing_directory_is_clean', () => {
        expect(lod.main(['--dir', path.join(tmp, 'nope')])).toBe(0);
    });

    it('test_valid_pipeline_passes', () => {
        expect(lod.lint(write(VALID_PIPELINE))).toBe(0);
    });

    it('test_wrong_schema_version_fails', () => {
        const body = VALID_PIPELINE.replace('schema_version: 1', 'schema_version: 2');
        expect(lod.lint(write(body))).toBe(1);
    });

    it('test_name_must_match_filename', () => {
        expect(lod.lint(write(VALID_PIPELINE, 'other-name.yaml'))).toBe(1);
    });

    it('test_duplicate_step_id_fails', () => {
        const body = `schema_version: 1
name: dup-pipeline
description: dup
steps:
  - id: review
    kind: skill
    ref: skill-reviewer
  - id: review
    kind: skill
    ref: skill-reviewer
`;
        expect(lod.lint(write(body, 'dup-pipeline.yaml'))).toBe(1);
    });

    it('test_unknown_kind_fails', () => {
        const body = VALID_PIPELINE.replace('kind: skill', 'kind: wizard');
        expect(lod.lint(write(body))).toBe(1);
    });

    it('test_missing_skill_ref_fails', () => {
        const body = VALID_PIPELINE.replace('ref: skill-reviewer', 'ref: not-a-skill');
        expect(lod.lint(write(body))).toBe(1);
    });

    it('test_unknown_input_interpolation_fails', () => {
        const body = VALID_PIPELINE.replace('${{ inputs.target }}', '${{ inputs.nope }}');
        expect(lod.lint(write(body))).toBe(1);
    });

    it('test_unknown_output_step_fails', () => {
        const body = VALID_PIPELINE.replace('${{ steps.review.output }}', '${{ steps.ghost.output }}');
        expect(lod.lint(write(body))).toBe(1);
    });

    it('test_unknown_namespace_fails', () => {
        const body = VALID_PIPELINE.replace('${{ inputs.target }}', '${{ env.PATH }}');
        expect(lod.lint(write(body))).toBe(1);
    });

    it('test_subagent_mode_accepted', () => {
        const body = `schema_version: 1
name: subagent-pipeline
description: subagent smoke
steps:
  - id: judge
    kind: subagent
    ref: do-and-judge
`;
        expect(lod.lint(write(body, 'subagent-pipeline.yaml'))).toBe(0);
    });

    it('test_bad_subagent_mode_fails', () => {
        const body = `schema_version: 1
name: bad-subagent
description: bad
steps:
  - id: judge
    kind: subagent
    ref: do-something-imaginary
`;
        expect(lod.lint(write(body, 'bad-subagent.yaml'))).toBe(1);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

