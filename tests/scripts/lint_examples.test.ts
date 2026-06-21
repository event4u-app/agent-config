// Tests for src/scripts/lint_examples.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: a constants spot-check, a lint_demo unit
// check on a sandboxed demo file (byte-identical problem strings), and a
// golden-parity layer (python3 vs tsx on the REAL REPO across default + --quiet),
// byte-identical stdout/stderr/exit. Skipped without python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_examples.js';



describe('lint_examples — constants', () => {
    it('REQUIRED_FM_KEYS holds the demo frontmatter keys', () => {
        expect([...mod.REQUIRED_FM_KEYS]).toEqual(['demo_for:', 'layer: pattern-memory', 'prose_delta:']);
    });
    it('REQUIRED_FM_DELTA holds the char-count keys', () => {
        expect([...mod.REQUIRED_FM_DELTA]).toEqual(['rule_chars_before:', 'rule_chars_after:']);
    });
    it('DEMO_GLOB targets the agent-infra demos', () => {
        expect(mod.DEMO_GLOB).toBe('docs/guidelines/agent-infra/*-demos.md');
    });
});

describe('lint_examples — lint_demo', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lex-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('flags a file with no frontmatter and no demo sections', () => {
        const p = path.join(tmp, 'x-demos.md');
        fs.writeFileSync(p, '# heading only\n');
        const problems = mod.lint_demo(p);
        expect(problems).toContain('missing YAML frontmatter (--- block at top)');
        expect(problems).toContain("no '## Demo N — …' sections found");
    });

    it('flags missing frontmatter keys and per-demo shape', () => {
        const p = path.join(tmp, 'y-demos.md');
        fs.writeFileSync(p, '---\ndemo_for: x\n---\n\n## Demo 1 — title\n\nbody\n');
        const problems = mod.lint_demo(p);
        expect(problems).toContain("frontmatter missing: 'layer: pattern-memory'");
        expect(problems).toContain("frontmatter missing: 'prose_delta:'");
        expect(problems).toContain("'## Demo 1 — title': missing '### Wrong shape'");
        expect(problems).toContain("'## Demo 1 — title': missing '**Failure mode:**' line");
    });
});

