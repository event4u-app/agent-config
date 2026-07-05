// Tests for src/scripts/lint_showcase_sessions.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). The 8 pytest scenarios are staged in a realpath-resolved tmp root
// with the .ts copied into `<root>/src/scripts/` so `ROOT == <root>` resolves
// from the script's own location; each asserts the expected exit code. A
// real-repo CLI-contract layer rounds it out.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SRC = path.join(REPO_ROOT, 'src', 'scripts', 'lint_showcase_sessions.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

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

describe('lint_showcase_sessions — ported pytest scenarios (differential)', () => {
    let root: string;
    beforeEach(() => {
        // Realpath-resolve so the copied-script CLI-entry guard fires for both
        // python3 (Path.resolve) and tsx (realpath'd import.meta.url).
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lss-')));
        fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
        fs.copyFileSync(TS_SRC, path.join(root, 'src', 'scripts', 'lint_showcase_sessions.ts'));
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
        const tsScript = path.join(root, 'src', 'scripts', 'lint_showcase_sessions.ts');
        const ts = spawnSync(TSX_BIN, [tsScript], { cwd: root, encoding: 'utf8' });
        expect(ts.status, ts.stderr).not.toBeNull();
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

// --- CLI contract on the REAL REPO ------------------------------------------

describe('lint_showcase_sessions — CLI contract (real repo)', () => {
    it('runs the default (no-flag) invocation deterministically', () => {
        const a = spawnSync(TSX_BIN, [TS_SRC], { cwd: REPO_ROOT, encoding: 'utf8' });
        const b = spawnSync(TSX_BIN, [TS_SRC], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(a.status, a.stderr).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    });
});
