// TypeScript twin of tests/install/test_consumer_model_tier.py (ADR-200 py2ts).
//
// Step 19b — consumer model-tier auto-switch reaches the installed tree.
// `install.finalize_claude_model_tiers` rewrites the payload-synced
// `.claude/skills/<skill>` symlinks so model-tier-bearing skills carry a native
// Claude `model:` key when the consumer opted into `model.auto_switch: auto`.
// Mirrors the repo generator (`condense generate_claude_skills`).
//
// Regression guard: 5.10.0 shipped `~/.claude/skills/` with raw `model_tier:`
// and zero native `model:`, so Claude Code never performed the per-turn switch.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as install from '../../src/scripts/install.js';

let tmp: string;

beforeEach(() => {
    // Python monkeypatches install.QUIET = True; the TS twin exposes QUIET on
    // the mutable `state` global. Cache + restore around each test.
    install.state.QUIET = true;
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'consumer-model-tier-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

// Stage a consumer with two augment skills (one model-tier, one inherit),
// each symlinked into .claude/skills/ exactly as install.sh does.
function stageConsumer(root: string, autoSwitch: string): void {
    const settings = path.join(root, 'agents', 'settings', '.agent-settings.yml');
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, `model:\n  auto_switch: ${autoSwitch}\n`, 'utf-8');

    const augment = path.join(root, '.augment', 'skills');
    const claude = path.join(root, '.claude', 'skills');
    fs.mkdirSync(augment, { recursive: true });
    fs.mkdirSync(claude, { recursive: true });

    const skill = (name: string, tierLine: string): void => {
        const sdir = path.join(augment, name);
        fs.mkdirSync(sdir, { recursive: true });
        fs.writeFileSync(
            path.join(sdir, 'SKILL.md'),
            `---\nname: ${name}\n${tierLine}\n---\n\n# ${name}\n\nbody\n`,
            'utf-8',
        );
        fs.writeFileSync(path.join(sdir, 'reference.md'), 'ref\n', 'utf-8');
        // install.sh shape: .claude/skills/<name> -> ../../.augment/skills/<name>
        fs.symlinkSync(path.join('../../.augment/skills', name), path.join(claude, name));
    };

    skill('tiered-skill', 'model_tier: medium');
    skill('inherit-skill', 'model_tier: inherit');
}

describe('finalize_claude_model_tiers', () => {
    it('auto_switch renders native model', () => {
        stageConsumer(tmp, 'auto');

        const rendered = install.finalize_claude_model_tiers(tmp);
        expect(rendered).toBe(1); // only the model-tier skill

        const claude = path.join(tmp, '.claude', 'skills');
        // The model-tier skill is now a REAL dir with a rendered SKILL.md.
        const tiered = path.join(claude, 'tiered-skill');
        expect(fs.statSync(tiered).isDirectory()).toBe(true);
        expect(fs.lstatSync(tiered).isSymbolicLink()).toBe(false);
        const skillMd = fs.readFileSync(path.join(tiered, 'SKILL.md'), 'utf-8');
        expect(skillMd).toContain('model: sonnet');
        expect(skillMd).not.toContain('model_tier:');
        // Non-SKILL.md files stay symlinks into .augment/skills.
        expect(fs.lstatSync(path.join(tiered, 'reference.md')).isSymbolicLink()).toBe(true);
        expect(fs.readlinkSync(path.join(tiered, 'reference.md'))).toBe(
            '../../../.augment/skills/tiered-skill/reference.md',
        );

        // The inherit skill is untouched (still a symlink, raw frontmatter).
        const inherit = path.join(claude, 'inherit-skill');
        expect(fs.lstatSync(inherit).isSymbolicLink()).toBe(true);
    });

    it('suggest is a no-op', () => {
        stageConsumer(tmp, 'suggest');

        const rendered = install.finalize_claude_model_tiers(tmp);
        expect(rendered).toBe(0);
        // Both skills remain pure symlinks — no native model: injected.
        expect(
            fs.lstatSync(path.join(tmp, '.claude', 'skills', 'tiered-skill')).isSymbolicLink(),
        ).toBe(true);
        expect(
            fs.lstatSync(path.join(tmp, '.claude', 'skills', 'inherit-skill')).isSymbolicLink(),
        ).toBe(true);
    });

    it('missing trees is a no-op', () => {
        // No .claude/.augment trees at all → silent 0, never throws.
        expect(install.finalize_claude_model_tiers(tmp)).toBe(0);
    });
});
