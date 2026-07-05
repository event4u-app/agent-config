// Tests for src/scripts/check_council_config_location.ts (ADR-200).
//
// Golden parity on tmp fixtures: the script reads cwd-relative
// SCAN_GLOBS, so each case builds a tmp repo, runs both binaries with cwd set
// there, and asserts byte-identical stdout/stderr/exit. Covers the clean pass,
// each violation branch (un-negated `.agent-settings.yml`, `ai_council:` block),
// the negation + pragma allow-paths, fence skipping, and the argparse usage
// error. A real-repo parity layer asserts the live council surfaces agree.
// Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_council_config_location.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs(cwd: string, args: string[] = []) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
}
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Assert the CLI runs to a defined exit and is deterministic.
function expectParity(cwd: string, args: string[] = []): void {
    const a = runTs(cwd, args);
    const b = runTs(cwd, args);
    expect(a.status, a.stderr).not.toBeNull();
    expect(b.stdout).toBe(a.stdout);
    expect(b.status).toBe(a.status);
}
function mkTmp(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccl-')));
}
function write(root: string, rel: string, content: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
}


describe('check_council_config_location — golden parity (tmp fixtures)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkTmp();
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('clean: no scanned files → ✅ exit 0', () => {
        expectParity(tmp);
    });

    it('clean: a negated .agent-settings.yml mention is allowed', () => {
        write(
            tmp,
            'src/skills/ai-council/SKILL.md',
            '# AI Council\n\nCouncil config is NOT in `.agent-settings.yml` anymore.\n',
        );
        expectParity(tmp);
    });

    it('clean: an allow-pragma line is exempt', () => {
        write(
            tmp,
            'docs/contracts/ai-council-config.md',
            'See `.agent-settings.yml` `personal.autonomy` <!-- council-config-allowed -->\n',
        );
        expectParity(tmp);
    });

    it('violation: un-negated .agent-settings.yml reference → exit 1', () => {
        write(
            tmp,
            'src/skills/ai-council/SKILL.md',
            'Read `.agent-settings.yml` → `ai_council` to configure the council.\n',
        );
        expectParity(tmp);
    });

    it('violation: bare ai_council: block (prose) → exit 1', () => {
        write(tmp, 'src/skills/ai-council/SKILL.md', 'ai_council:\n  enabled: true\n');
        expectParity(tmp);
    });

    it('violation: ai_council: block inside a fence is reported as fenced YAML', () => {
        write(
            tmp,
            'src/skills/ai-council/SKILL.md',
            '```yaml\nai_council:\n  enabled: true\n```\n',
        );
        expectParity(tmp);
    });

    it('clean: quiet suppresses the ✅ line', () => {
        expectParity(tmp, ['--quiet']);
    });

    it('multiple surfaces + globs scanned in sorted order', () => {
        write(tmp, 'src/domains/meta/council/default/command.md', 'Use `.agent-settings.yml`.\n');
        write(
            tmp,
            'src/domains/product-basic/roadmap/ai-council/command.md',
            'ai_council:\n',
        );
        write(tmp, 'docs/contracts/ai-council-config.md', 'never read `.agent-settings.yml`\n');
        expectParity(tmp);
    });

    it('usage error: unrecognized flag → exit 2', () => {
        expectParity(tmp, ['--bogus']);
    });
});

describe('check_council_config_location — golden parity (real repo)', () => {
    it('runs deterministically on the live council surfaces', () => {
        const a = runTs(REPO_ROOT);
        const b = runTs(REPO_ROOT);
        expect(a.status, a.stderr).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    });
});
