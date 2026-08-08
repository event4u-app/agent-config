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
    expect(a.status, a.stderr).not.toBeNull();
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

describe('check_council_config_location — §3 project-tree placement (ADR-104)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkTmp();
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('violation: un-negated agents/.ai-council.yml placement → exit 1', () => {
        write(
            tmp,
            'src/skills/ai-council/SKILL.md',
            'Copy the reference into your own `agents/.ai-council.yml`.\n',
        );
        const a = runTs(tmp);
        expect(a.status).toBe(1);
        expect(a.stdout).toContain('user-global ONLY');
    });

    it('violation: placement drift in the settings template is scanned (§3 only) → exit 1', () => {
        write(
            tmp,
            'src/config/agent-settings.template.yml',
            '# copy the file to `agents/settings/.ai-council.yml`\n',
        );
        expect(runTs(tmp).status).toBe(1);
    });

    it('clean: a negated placement mention on the same line → exit 0', () => {
        write(
            tmp,
            'docs/contracts/ai-council-config.md',
            'A `<project_root>/agents/settings/.ai-council.yml` is ignored (ADR-104).\n',
        );
        expect(runTs(tmp).status).toBe(0);
    });

    it('clean: negation wraps to the previous line → exit 0', () => {
        write(
            tmp,
            'src/domains/meta/council/default/command.md',
            'The council never reads\n`<project_root>/agents/settings/.ai-council.yml` or any project file.\n',
        );
        expect(runTs(tmp).status).toBe(0);
    });

    it('clean: the user-global path is not project-tree drift → exit 0', () => {
        write(
            tmp,
            'src/skills/ai-council/SKILL.md',
            'Config lives at `~/.event4u/agent-config/settings/.ai-council.yml`.\n',
        );
        expect(runTs(tmp).status).toBe(0);
    });

    it('clean: the copy-from .example path is not flagged → exit 0', () => {
        write(
            tmp,
            'src/skills/ai-council/SKILL.md',
            'Copy the shape from `agents/templates/.ai-council.yml.example`.\n',
        );
        expect(runTs(tmp).status).toBe(0);
    });

    it('clean: an allow-pragma exempts a historical placement line → exit 0', () => {
        write(
            tmp,
            'docs/contracts/ai-council-config.md',
            'New file `agents/settings/.ai-council.yml` checked in <!-- council-config-allowed -->\n',
        );
        expect(runTs(tmp).status).toBe(0);
    });
});

describe('check_council_config_location — golden parity (real repo)', () => {
    it('runs deterministically on the live council surfaces', () => {
        const a = runTs(REPO_ROOT);
        expect(a.status, a.stderr).not.toBeNull();
    });
});

// ── §4 always-loaded carrier check ─────────────────────────────────
// Regression cover for the defect this check exists to catch: a correct
// resolver, a correct skill and a green §1–§3, yet consumer sessions still
// claimed "council not configured (no `.agent-settings.yml`)" because the
// user-global fact reached no always-loaded surface.

const CARRIER_RULE = [
    '---',
    'type: "auto"',
    'triggers:',
    '  - keyword: "council"',
    'workspaces: [engineering, product]',
    '---',
    '',
    'Config lives at `~/.event4u/agent-config/settings/.ai-council.yml`.',
    'NEVER INFER "NOT CONFIGURED" from a missing project file.',
    '',
].join('\n');
// The reach reference §4 compares against; narrower than it → violation.
const REACH_REF = ['---', 'type: "always"', 'workspaces: [engineering, product]', '---', ''].join(
    '\n',
);

describe('check_council_config_location — §4 always-loaded carrier', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkTmp();
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('out of scope: no src/rules/ at all → exit 0 (consumer / fixture tree)', () => {
        write(tmp, 'src/skills/ai-council/SKILL.md', 'Council notes.\n');
        expect(runTs(tmp).status).toBe(0);
    });

    // A council surface must exist in every fixture below, or the scan-scope
    // guard exits 1 first and the assertion would pass for the wrong reason.
    function withSurface(root: string): void {
        write(root, 'src/skills/ai-council/SKILL.md', 'Council notes.\n');
    }

    it('violation: a rule layer with no carrier → exit 1', () => {
        withSurface(tmp);
        write(tmp, 'src/rules/unrelated.md', '---\ntype: "auto"\n---\n\nSomething else.\n');
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('no always-loaded rule carries the council user-global fact');
    });

    it('violation: two of three markers is not a carrier → exit 1', () => {
        withSurface(tmp);
        write(
            tmp,
            'src/rules/half.md',
            '---\ntype: "auto"\ntriggers:\n  - keyword: "council"\n---\n\n' +
                'Config lives at `~/.event4u/agent-config/settings/.ai-council.yml`.\n',
        );
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('no always-loaded rule carries the council user-global fact');
    });

    it('clean: a full carrier with kernel-wide reach → exit 0', () => {
        write(tmp, 'src/rules/council-availability.md', CARRIER_RULE);
        write(tmp, 'src/rules/direct-answers.md', REACH_REF);
        expect(runTs(tmp).status).toBe(0);
    });

    it('violation: carrier scoped narrower than the reach reference → exit 1', () => {
        write(
            tmp,
            'src/rules/council-availability.md',
            CARRIER_RULE.replace('workspaces: [engineering, product]', 'workspaces: [engineering]'),
        );
        write(tmp, 'src/rules/direct-answers.md', REACH_REF);
        const r = runTs(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('scoped more narrowly');
        expect(r.stdout).toContain('product');
    });

    it('real repo: the carrier exists and §4 scope is live (not silently empty)', async () => {
        const mod = await import('../../src/scripts/check_council_config_location.js');
        // Scope liveness — a skipped §4 would also return zero findings.
        expect(fs.existsSync(path.join(REPO_ROOT, 'src', 'rules'))).toBe(true);
        expect([...mod.iter_files(REPO_ROOT, [mod.RULES_GLOB])].length).toBeGreaterThan(0);
        expect(mod.find_carrier_violations(REPO_ROOT)).toEqual([]);
    });
});
