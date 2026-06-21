// Tests for src/scripts/lint_flows.ts (py2ts Phase 4 / Wave 4b — PORT).
//
// Two layers:
//   1. The pytest suite (tests/test_lint_flows.py) ported 1:1 — the negative
//      cases sandbox only the flow *files* via the `_setFlowsDirForTest` seam
//      (mirrors `monkeypatch.setattr(lf, "FLOWS_DIR", dst)`); `resolve_logical`
//      still targets the real repo, so real commands/skills resolve and only
//      the injected fault trips the lint. Assertions mirror the pytest exit-code
//      checks exactly.
//   2. Golden parity — python3 vs tsx on the REAL REPO across the real CI args
//      (default + --quiet), byte-identical stdout/stderr/exit. Skipped without python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lf from '../../src/scripts/lint_flows.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const REAL_FLOWS = path.join(REPO_ROOT, 'src', 'flows');


// --- pytest port: sandbox the flow files, point the seam at them -------------

let tmpDir: string;

function seedRealFlows(): string {
    const dst = path.join(tmpDir, 'flows');
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(REAL_FLOWS)) {
        if (f.endsWith('.yaml')) {
            fs.copyFileSync(path.join(REAL_FLOWS, f), path.join(dst, f));
        }
    }
    lf._setFlowsDirForTest(dst);
    return dst;
}

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-flows-'));
});

afterEach(() => {
    // Restore the seam to the real flows dir for the next test / process exit.
    lf._setFlowsDirForTest(REAL_FLOWS);
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('lint_flows — ported pytest suite', () => {
    // --- positive: the shipped flows are valid (regression lock) ----------------

    it('test_real_flows_are_valid', () => {
        lf._setFlowsDirForTest(REAL_FLOWS);
        expect(lf.main(['--quiet'])).toBe(0);
    });

    it('test_seeded_copy_is_valid', () => {
        seedRealFlows();
        expect(lf.main(['--quiet'])).toBe(0);
    });

    // --- negative: each fault must fail the lint --------------------------------

    it('test_bad_command_ref_fails', () => {
        const dst = seedRealFlows();
        const p = path.join(dst, 'review.yaml');
        fs.writeFileSync(
            p,
            fs.readFileSync(p, 'utf-8').replace('  - judge\n', '  - judge\n  - not-a-real-command\n'),
        );
        expect(lf.main(['--quiet'])).toBe(1);
    });

    it('test_bad_skill_ref_fails', () => {
        const dst = seedRealFlows();
        const p = path.join(dst, 'review.yaml');
        fs.writeFileSync(
            p,
            fs
                .readFileSync(p, 'utf-8')
                .replace('  - code-review\n', '  - code-review\n  - not-a-real-skill\n'),
        );
        expect(lf.main(['--quiet'])).toBe(1);
    });

    it('test_unknown_id_rejected', () => {
        const dst = seedRealFlows();
        const p = path.join(dst, 'discovery.yaml');
        fs.writeFileSync(
            p,
            fs.readFileSync(p, 'utf-8').replace('id: discovery\n', 'id: exploration\n'),
        );
        expect(lf.main(['--quiet'])).toBe(1);
    });

    it('test_missing_required_field_fails', () => {
        const dst = seedRealFlows();
        const p = path.join(dst, 'delivery.yaml');
        const data = YAML.parse(fs.readFileSync(p, 'utf-8'), { version: '1.1' }) as Record<
            string,
            unknown
        >;
        delete data['skills']; // schema `required` violation
        fs.writeFileSync(p, YAML.stringify(data));
        expect(lf.main(['--quiet'])).toBe(1);
    });

    it('test_incomplete_set_fails', () => {
        const dst = seedRealFlows();
        fs.unlinkSync(path.join(dst, 'delivery.yaml')); // only 3 of 4 closed-set flows present
        expect(lf.main(['--quiet'])).toBe(1);
    });

    // --- suggestion helper ------------------------------------------------------

    it('test_suggest_offers_close_match', () => {
        expect(lf._suggest('pr/creat', new Set(['pr/create', 'commit']))).toContain(
            "did you mean 'pr/create'",
        );
    });

    it('test_suggest_silent_when_no_match', () => {
        expect(lf._suggest('zzzzzzzz', new Set(['pr/create', 'commit']))).toBe('');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

