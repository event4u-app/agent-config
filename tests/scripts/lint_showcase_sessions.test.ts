// Tests for src/scripts/lint_showcase_sessions.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// The Python pytest suite (tests/test_lint_showcase_sessions.py) patches the
// module constants ROOT / SHOWCASE_MD / SESSIONS_DIR to point at a tmp tree.
// The TS twin hard-codes those from `import.meta.url`, so they cannot be
// monkeypatched. We port the 8 scenarios faithfully as DIFFERENTIAL golden
// tests instead: each scenario is staged in a realpath-resolved tmp root with
// the script copied into `<root>/src/scripts/`, so both `python3` and `tsx`
// compute `ROOT == <root>` from their own location and run head-to-head. This
// is strictly stronger than the original (it asserts py == ts byte-for-byte
// AND the expected exit code). A real-repo golden-parity layer rounds it out.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SRC = path.join(REPO_ROOT, 'src', 'scripts', 'lint_showcase_sessions.ts');
const PY_SRC = path.join(REPO_ROOT, 'src', 'scripts', 'lint_showcase_sessions.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const VALID_FRONTMATTER = `---
slug: "demo"
task_class: "implement-ticket"
host_agent: "augment"
model: "claude-opus-4.7"
commit_sha: "abc123"
started: "2026-05-04T10:00:00Z"
ended: "2026-05-04T11:00:00Z"
metrics:
  tool_call_count: 42
  reply_chars_mean: 512.0
  memory_hit_ratio: null
  verify_pass_rate: 1.0
---
body
`;

const py3 = hasPython3();

describe.skipIf(!py3)('lint_showcase_sessions — ported pytest scenarios (differential)', () => {
    let root: string;
    beforeEach(() => {
        // Realpath-resolve so the copied-script CLI-entry guard fires for both
        // python3 (Path.resolve) and tsx (realpath'd import.meta.url).
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lss-')));
        fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
        fs.copyFileSync(TS_SRC, path.join(root, 'src', 'scripts', 'lint_showcase_sessions.ts'));
        fs.copyFileSync(PY_SRC, path.join(root, 'src', 'scripts', 'lint_showcase_sessions.py'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function setup(showcaseText: string, sessions: Record<string, string>): void {
        const docs = path.join(root, 'docs');
        fs.mkdirSync(docs, { recursive: true });
        fs.writeFileSync(path.join(docs, 'showcase.md'), showcaseText, 'utf-8');
        const sessionsDir = path.join(docs, 'showcase', 'sessions');
        fs.mkdirSync(sessionsDir, { recursive: true });
        for (const [slug, content] of Object.entries(sessions)) {
            fs.writeFileSync(path.join(sessionsDir, `${slug}.log`), content, 'utf-8');
        }
    }

    function runBoth(): { rc: number } {
        const pyScript = path.join(root, 'src', 'scripts', 'lint_showcase_sessions.py');
        const tsScript = path.join(root, 'src', 'scripts', 'lint_showcase_sessions.ts');
        const py = spawnSync('python3', [pyScript], { cwd: root, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [tsScript], { cwd: root, encoding: 'utf8' });
        // Byte-for-byte parity across both implementations.
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        return { rc: ts.status ?? -1 };
    }

    it('test_empty_state_passes', () => {
        setup('# showcase — no sessions yet\n', {});
        expect(runBoth().rc).toBe(0);
    });

    it('test_valid_reference_passes', () => {
        setup('see docs/showcase/sessions/demo.log\n', { demo: VALID_FRONTMATTER });
        expect(runBoth().rc).toBe(0);
    });

    it('test_missing_file_fails', () => {
        setup('see docs/showcase/sessions/ghost.log\n', {});
        expect(runBoth().rc).toBe(1);
    });

    it('test_missing_commit_sha_fails', () => {
        const bad = VALID_FRONTMATTER.replace('commit_sha: "abc123"\n', '');
        setup('see docs/showcase/sessions/demo.log\n', { demo: bad });
        expect(runBoth().rc).toBe(1);
    });

    it('test_missing_metrics_block_fails', () => {
        const bad = VALID_FRONTMATTER.split('metrics:')[0] + '---\nbody\n';
        setup('see docs/showcase/sessions/demo.log\n', { demo: bad });
        expect(runBoth().rc).toBe(1);
    });

    it('test_metrics_block_missing_keys_fails', () => {
        const bad = `---
commit_sha: "abc123"
metrics:
  tool_call_count: 1
---
body
`;
        setup('see docs/showcase/sessions/demo.log\n', { demo: bad });
        expect(runBoth().rc).toBe(1);
    });

    it('test_orphan_session_fails', () => {
        setup('# showcase\n', { orphan: VALID_FRONTMATTER });
        expect(runBoth().rc).toBe(1);
    });

    it('test_no_frontmatter_fails', () => {
        setup('see docs/showcase/sessions/raw.log\n', { raw: 'no frontmatter here\n' });
        expect(runBoth().rc).toBe(1);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

describe.skipIf(!py3)('lint_showcase_sessions — golden parity (python3 vs tsx)', () => {
    it('matches the default (no-flag) run byte-for-byte (real CI invocation)', () => {
        const py = spawnSync('python3', [PY_SRC], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SRC], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
