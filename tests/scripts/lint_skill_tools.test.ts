// Tests for src/scripts/lint_skill_tools.ts (py2ts Phase 4 / Wave 4b).
//
// The pytest suite tests/test_lint_skill_tools.py is ported 1:1 over the
// `lint(toolsDir) -> [code, findings]` surface, plus a golden-parity layer
// running python3 vs tsx on the REAL REPO (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as st from '../../src/scripts/lint_skill_tools.js';



const VALID = `#!/usr/bin/env python3
"""Sample tool that obeys all D1 invariants."""
from __future__ import annotations
import argparse, json, sys

_SAMPLE = {"hello": "world"}


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json", action="store_true")
    p.parse_args(argv)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`;

function firstFindings(findings: Record<string, string[]>): string[] {
    const k = Object.keys(findings)[0]!;
    return findings[k]!;
}

describe('lint_skill_tools.lint — ported pytest', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lst-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(name: string, body: string): void {
        fs.mkdirSync(tmp, { recursive: true });
        fs.writeFileSync(path.join(tmp, name), body, 'utf-8');
    }

    it('valid tool passes', () => {
        write('do_thing.py', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(0);
        expect(findings).toEqual({});
    });

    it('third-party import fails', () => {
        write('do_thing.py', VALID.replace('import argparse, json, sys', 'import argparse, json, sys\nimport requests'));
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('requests'))).toBe(true);
    });

    it('third-party from-import fails', () => {
        write('do_thing.py', VALID + 'from yaml import safe_load\n');
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('yaml'))).toBe(true);
    });

    it('internal scripts import passes', () => {
        write('do_thing.py', VALID + 'from scripts.skill_tools import score_skill_relevance  # type: ignore\n');
        const [code] = st.lint(tmp);
        expect(code).toBe(0);
    });

    it('missing --json flag fails', () => {
        write('do_thing.py', VALID.replace('p.add_argument("--json", action="store_true")', ''));
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('--json'))).toBe(true);
    });

    it('missing argparse fails', () => {
        const body = `#!/usr/bin/env python3
"""No argparse."""
import sys
_SAMPLE = {}
if __name__ == "__main__":
    print("hi")
`;
        write('do_thing.py', body);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('argparse'))).toBe(true);
    });

    it('naming violation fails (uppercase + dash)', () => {
        write('Bad-Name.py', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('naming'))).toBe(true);
    });

    it('naming with no underscore fails', () => {
        write('lonely.py', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('naming'))).toBe(true);
    });

    it('size cap is enforced', () => {
        const extra = Array.from({ length: 220 }, (_, i) => `x${i} = ${i}`).join('\n') + '\n';
        write('do_thing.py', VALID + extra);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('size'))).toBe(true);
    });

    it('no sample + no main fails', () => {
        const body = `#!/usr/bin/env python3
"""No sample, no main."""
import argparse
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--json", action="store_true")
    p.parse_args()
`;
        write('do_thing.py', body);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('sample'))).toBe(true);
    });

    it('add_help disabled fails', () => {
        write(
            'do_thing.py',
            VALID.replace(
                'p = argparse.ArgumentParser()',
                'p = argparse.ArgumentParser(add_help=False)',
            ),
        );
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(1);
        expect(firstFindings(findings).some((v) => v.includes('add_help'))).toBe(true);
    });

    it('__init__.py is skipped', () => {
        write('__init__.py', '# pkg marker\n');
        write('do_thing.py', VALID);
        const [code, findings] = st.lint(tmp);
        expect(code).toBe(0);
        expect(findings).toEqual({});
    });

    it('missing dir returns usage error (code 2)', () => {
        const [code, findings] = st.lint(path.join(tmp, 'nope'));
        expect(code).toBe(2);
        expect('_error' in findings).toBe(true);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

