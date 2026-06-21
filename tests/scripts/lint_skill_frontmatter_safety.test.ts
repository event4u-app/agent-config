// Tests for src/scripts/lint_skill_frontmatter_safety.ts (py2ts Phase 1 — VERIFY).
//
// No pytest suite exists. Golden-parity layer runs python3 vs tsx and asserts
// byte-identical stdout/stderr/exit. Two parity surfaces:
//   1. the REAL repo `src/` tree (clean or non-clean — whatever python3 says),
//   2. a self-contained fixture repo carrying its own _lib + linter so the
//      linter's `ROOT = parents[3]` resolves to the fixture (crafted-hit
//      exit-1 path; default + --json).
//
// Dangerous-frontmatter tokens are assembled from fragments so this test file
// itself is not flagged when the linter scans the real src/ tree.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as sl from '../../src/scripts/_lib/security_lint.js';
import * as fms from '../../src/scripts/lint_skill_frontmatter_safety.js';



// Assembled from fragments so the test file's own prose isn't a live grant.
const STAR = '*';
const BASH_WILD = 'Bash(' + STAR + ')';
const BYPASS = 'bypass' + 'Permissions';

// --- Unit spec over exported _scan ------------------------------------------

describe('lint_skill_frontmatter_safety — _scan over a built ScannedFile', () => {
    let tmp: string;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    });
    function scanText(body: string): sl.Finding[] {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fms-unit-'));
        const p = path.join(tmp, 'SKILL.md');
        fs.writeFileSync(p, body, 'utf-8');
        return fms._scan(sl.scan_file(p));
    }

    it('flags permissionMode bypassPermissions as HIGH', () => {
        const hits = scanText(`---\npermissionMode: ${BYPASS}\n---\nbody\n`);
        expect(hits.map((h) => h.message)).toContain(
            'permissionMode: bypassPermissions (consent bypass)',
        );
        expect(hits[0]!.is_fail).toBe(true);
    });

    it('flags a wildcard allowed-tools (Claude hyphen format) as HIGH', () => {
        const hits = scanText(`---\nallowed-tools: [${BASH_WILD}]\n---\nbody\n`);
        expect(hits.map((h) => h.message)).toContain(
            'wildcard / bare-Bash tool grant (over-broad)',
        );
    });

    it('flags automated execution missing the runtime-safety floor as HIGH', () => {
        const hits = scanText(
            '---\nexecution:\n  type: automated\n  handler: none\n---\nbody\n',
        );
        const msgs = hits.map((h) => h.message);
        expect(msgs).toContain('automated execution with handler none/missing (runtime-safety)');
        expect(msgs).toContain(
            'automated execution without safety_mode: strict (runtime-safety)',
        );
        expect(msgs).toContain(
            'automated execution without an explicit allowed_tools declaration',
        );
    });

    it('flags an execution.allowed_tools wildcard grant as HIGH', () => {
        const hits = scanText(
            `---\nexecution:\n  type: assisted\n  handler: shell\n  allowed_tools: [${BASH_WILD}]\n---\nbody\n`,
        );
        expect(hits.map((h) => h.message)).toContain(
            'execution.allowed_tools wildcard (* / Bash(*)) grant',
        );
    });

    it('does not flag a clean frontmatter', () => {
        const hits = scanText('---\nname: ok\ndescription: clean\n---\nbody\n');
        expect(hits).toHaveLength(0);
    });

    it('respects the allow pragma', () => {
        const hits = scanText(
            `---\npermissionMode: ${BYPASS}\n---\n<!-- security-lint: allow dangerous-frontmatter "teaching" -->\n`,
        );
        expect(hits).toHaveLength(0);
    });
});
