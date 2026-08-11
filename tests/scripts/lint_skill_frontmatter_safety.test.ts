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

    // The subagent-v1 grant key. Before this was read, the two over-broad-grant
    // checks had never inspected a subagent definition: `src/subagents` was not a
    // scan root and `tools:` was not one of the two spellings the scanner knew.
    // Each case below goes red if either half of that fix is reverted.
    it('flags a bare Bash grant under the top-level subagent tools: key', () => {
        const hits = scanText(
            '---\nschema_version: subagent-v1\ntools:\n  - Read\n  - Bash\n---\nbody\n',
        );
        expect(hits.map((h) => h.message)).toContain(
            'wildcard / bare-Bash tool grant (over-broad)',
        );
        expect(hits[0]!.is_fail).toBe(true);
    });

    it('flags a wildcard under the inline-flow form of tools:', () => {
        const hits = scanText(`---\ntools: [${BASH_WILD}]\n---\nbody\n`);
        expect(hits.map((h) => h.message)).toContain(
            'wildcard / bare-Bash tool grant (over-broad)',
        );
    });

    it('leaves a narrow subagent tools: list alone', () => {
        const hits = scanText('---\ntools:\n  - Read\n  - Grep\n  - Glob\n---\nbody\n');
        expect(hits.map((h) => h.message)).not.toContain(
            'wildcard / bare-Bash tool grant (over-broad)',
        );
    });

    it('does not read a nested tools: key as a grant', () => {
        // Top-level-anchored on purpose: an indented `tools:` belongs to some
        // other block and is not a subagent grant.
        const hits = scanText('---\nsomething:\n  tools:\n    - Bash\n---\nbody\n');
        expect(hits.map((h) => h.message)).not.toContain(
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

// --- The clean-path scope note names the corpus actually walked --------------
//
// This gate replaces `DEFAULT_SCAN_ROOTS` outright, so a hardcoded note made it
// claim two roots it never reads and omit `src/subagents`, the one root holding
// the artefact its over-broad-grant check exists for. Asserted through the real
// `report` on a captured stdout rather than against a pinned string, so the
// property under test is "the note equals the roots passed", for any roots.

describe('security_lint.report — the clean-path scope note', () => {
    function captureCleanNote(scanned_roots?: readonly string[]): string {
        const chunks: string[] = [];
        const original = process.stdout.write.bind(process.stdout);
        (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
            chunks.push(String(s));
            return true;
        };
        try {
            // The key is OMITTED rather than passed as `undefined`: the repo
            // typechecks with `exactOptionalPropertyTypes`, under which those are
            // different types, and "no argument" is the case being exercised.
            const code =
                scanned_roots === undefined
                    ? sl.report([], { check_label: 'scope-note-spec' })
                    : sl.report([], { check_label: 'scope-note-spec', scanned_roots });
            expect(code).toBe(0);
        } finally {
            (process.stdout as unknown as { write: typeof original }).write = original;
        }
        return chunks.join('');
    }

    it('names exactly the roots the caller passed, in order', () => {
        const roots = ['alpha/one', 'beta/two', 'gamma/three'];
        const out = captureCleanNote(roots);
        expect(out).toContain(`clean (scanned ${roots.join(', ')})`);
    });

    it('omits a root the caller did not pass', () => {
        const out = captureCleanNote(['only/this']);
        for (const notScanned of sl.DEFAULT_SCAN_ROOTS) {
            if (notScanned === 'only/this') continue;
            expect(out).not.toContain(notScanned);
        }
    });

    it('falls back to the shared default when the caller passes nothing', () => {
        expect(captureCleanNote()).toContain(
            `clean (scanned ${sl.DEFAULT_SCAN_ROOTS.join(', ')})`,
        );
    });

    it('treats an empty root list as "no answer" rather than an empty scope', () => {
        expect(captureCleanNote([])).toContain(
            `clean (scanned ${sl.DEFAULT_SCAN_ROOTS.join(', ')})`,
        );
    });

    it('is wired: this gate reports the four roots its own main walks', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', '..', 'src', 'scripts', 'lint_skill_frontmatter_safety.ts'),
            'utf-8',
        );
        expect(src).toMatch(/scanned_roots:\s*roots/);
        expect(src).toContain("'src/subagents'");
    });
});
