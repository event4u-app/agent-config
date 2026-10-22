/**
 * road-to-skills-that-arrive-when-called 4.1 — a resident set for the second host.
 *
 * The step's verify asks for three things and this file checks all three:
 * projected listing characters ≤ the modelled budget, a fresh session shows no
 * omission warning (checked as its cause — the listing fitting the budget —
 * because the warning itself is a host string this suite cannot emit), and the
 * host's AGENTS.md projection byte-equal to before (checked as: this step adds
 * nothing to `GLOBAL_DEPLOY_SOURCES['codex']`).
 *
 * The second check is MODELLED, not observed. `CODEX_BUDGET_CHARS` and the
 * per-entry overhead are upstream-prose assumptions, so a pass supports "the
 * listing fits the model", never "the host shows no warning". Any proof or
 * claim built on this file inherits that wording.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    CODEX_BUDGET_CHARS,
    codexSkillRoots,
    POLICY_BODY,
    POLICY_REL,
    computeCodexResidentSet,
    ensureCodexResidentSet,
    ownedCatalogue,
    removeCodexResidentSet,
} from '../../src/scripts/_lib/codex_resident_set.js';
import { GLOBAL_DEPLOY_SOURCES } from '../../src/install/wizard-plan.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function scratch(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'codex-resident-'));
}

function writeSkill(skillsDir: string, name: string, description: string): void {
    const dir = path.join(skillsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\nbody\n`);
}

describe('codex resident set — the split', () => {
    it('keeps the listing inside the budget and pushes the rest out of it', () => {
        const catalogue = Array.from({ length: 300 }, (_, i) => ({
            name: `skill-${String(i).padStart(3, '0')}`,
            descriptionChars: 120,
        }));
        const r = computeCodexResidentSet(catalogue);
        expect(r.budgetChars).toBe(CODEX_BUDGET_CHARS);
        expect(r.listingChars).toBeLessThanOrEqual(r.budgetChars);
        expect(r.resident.length + r.nonResident.length).toBe(300);
        // Enough entries do not fit that the split is doing real work — a split
        // that kept everything would pass the budget assertion vacuously.
        expect(r.nonResident.length).toBeGreaterThan(200);
    });

    it('fills alphabetically, the order the host itself drops by', () => {
        const r = computeCodexResidentSet([
            { name: 'zebra', descriptionChars: 10 },
            { name: 'alpha', descriptionChars: 10 },
            { name: 'mid', descriptionChars: 10 },
        ], { budgetChars: 40 });
        expect(r.resident).toEqual(['alpha', 'mid']);
        expect(r.nonResident).toEqual(['zebra']);
    });

    it('stops at the first overflow rather than packing a shorter later entry in', () => {
        const r = computeCodexResidentSet([
            { name: 'a', descriptionChars: 100 },
            { name: 'b', descriptionChars: 1 },
        ], { budgetChars: 50, perEntryOverheadChars: 0 });
        expect(r.resident).toEqual([]);
        expect(r.nonResident).toEqual(['a', 'b']);
    });

    it('needs no split at all when everything fits', () => {
        const r = computeCodexResidentSet([{ name: 'a', descriptionChars: 10 }]);
        expect(r.nonResident).toEqual([]);
        expect(r.resident).toEqual(['a']);
    });

    it('names the per-entry overhead as an assumption, not a measurement', () => {
        const r = computeCodexResidentSet([]);
        const overhead = r.assumptions.find((a) => a.id === 'per-entry-overhead');
        expect(overhead?.provenance).toBe('upstream-prose');
        const order = r.assumptions.find((a) => a.id === 'fill-order-alphabetical');
        expect(order?.provenance).toBe('first-party-observation');
    });
});

describe('codex resident set — the effect on disk', () => {
    it('disables implicit invocation for exactly the non-resident skills, and is idempotent', () => {
        const anchor = scratch();
        const skills = path.join(anchor, 'skills');
        writeSkill(skills, 'keep', 'short');
        writeSkill(skills, 'drop-a', 'short');
        writeSkill(skills, 'drop-b', 'short');
        const record = path.join(anchor, 'record.json');

        const first = ensureCodexResidentSet(anchor, record, ['drop-a', 'drop-b']);
        expect(first.changed).toBe(true);
        expect(first.disabled).toEqual(['drop-a', 'drop-b']);
        expect(fs.readFileSync(path.join(skills, 'drop-a', POLICY_REL), 'utf-8')).toBe(POLICY_BODY);
        expect(fs.existsSync(path.join(skills, 'keep', POLICY_REL))).toBe(false);

        const second = ensureCodexResidentSet(anchor, record, ['drop-a', 'drop-b']);
        expect(second.changed).toBe(false);
        expect(second.disabled).toEqual([]);
    });

    it('relists a skill that rejoins the resident set, and prunes the directory it made', () => {
        const anchor = scratch();
        const skills = path.join(anchor, 'skills');
        writeSkill(skills, 'a', 'short');
        const record = path.join(anchor, 'record.json');
        ensureCodexResidentSet(anchor, record, ['a']);
        const res = ensureCodexResidentSet(anchor, record, []);
        expect(res.reenabled).toEqual(['a']);
        expect(fs.existsSync(path.join(skills, 'a', 'agents'))).toBe(false);
        expect(fs.existsSync(record)).toBe(false);
    });

    it('never touches a policy file it did not write', () => {
        const anchor = scratch();
        const skills = path.join(anchor, 'skills');
        writeSkill(skills, 'a', 'short');
        const foreign = path.join(skills, 'a', POLICY_REL);
        fs.mkdirSync(path.dirname(foreign), { recursive: true });
        fs.writeFileSync(foreign, 'policy:\n  allow_implicit_invocation: true\n');
        const record = path.join(anchor, 'record.json');

        const res = ensureCodexResidentSet(anchor, record, ['a']);
        expect(res.skipped_foreign).toEqual(['a']);
        expect(fs.readFileSync(foreign, 'utf-8')).toContain('true');
    });

    it('never writes into a skill directory the deploy does not hold', () => {
        const anchor = scratch();
        fs.mkdirSync(path.join(anchor, 'skills'), { recursive: true });
        const record = path.join(anchor, 'record.json');
        const res = ensureCodexResidentSet(anchor, record, ['not-deployed']);
        expect(res.disabled).toEqual([]);
        expect(fs.existsSync(path.join(anchor, 'skills', 'not-deployed'))).toBe(false);
    });

    it('removes exactly what it wrote on uninstall and keeps what the user edited', () => {
        const anchor = scratch();
        const skills = path.join(anchor, 'skills');
        writeSkill(skills, 'ours', 'short');
        writeSkill(skills, 'theirs', 'short');
        const record = path.join(anchor, 'record.json');
        ensureCodexResidentSet(anchor, record, ['ours', 'theirs']);
        fs.writeFileSync(path.join(skills, 'theirs', POLICY_REL), 'policy:\n  allow_implicit_invocation: true\n');

        const res = removeCodexResidentSet(anchor, record);
        expect(res.removed).toEqual([path.join('skills', 'ours', POLICY_REL)]);
        expect(res.kept_user).toEqual([path.join('skills', 'theirs', POLICY_REL)]);
        expect(fs.existsSync(path.join(skills, 'ours', POLICY_REL))).toBe(false);
        expect(fs.existsSync(path.join(skills, 'theirs', POLICY_REL))).toBe(true);
        expect(fs.existsSync(record)).toBe(false);
    });

    it('lists only the roots that actually hold a skills directory', () => {
        const home = scratch();
        expect(codexSkillRoots(home)).toEqual([]);
        fs.mkdirSync(path.join(home, '.agents', 'skills'), { recursive: true });
        expect(codexSkillRoots(home)).toEqual([path.join(home, '.agents')]);
        fs.mkdirSync(path.join(home, '.codex', 'skills'), { recursive: true });
        // Precedence: the root the package deploys for this host comes first,
        // so a duplicate is disabled in the OTHER one.
        expect(codexSkillRoots(home)).toEqual([path.join(home, '.codex'), path.join(home, '.agents')]);
    });

    it('is a no-op without a record', () => {
        const anchor = scratch();
        const res = removeCodexResidentSet(anchor, path.join(anchor, 'absent.json'));
        expect(res.changed).toBe(false);
        expect(res.removed).toEqual([]);
    });
});

describe('codex resident set — against the real projection', () => {
    it('brings the projected catalogue inside the budget it is over today', () => {
        const projection = path.join(REPO_ROOT, 'dist', 'agent-src', 'skills');
        // `dist/agent-src/` is tracked, so its absence is a broken checkout
        // rather than a reason to pass on nothing.
        expect(fs.existsSync(projection), `${projection} is missing`).toBe(true);
        const owned = fs
            .readdirSync(projection, { withFileTypes: true })
            .filter((d) => d.isDirectory() && fs.existsSync(path.join(projection, d.name, 'SKILL.md')))
            .map((d) => d.name);
        const catalogue = ownedCatalogue(projection, owned);
        expect(catalogue.length).toBeGreaterThan(100);

        // The defect: the whole catalogue does not fit, which is what makes the
        // host print its omission warning.
        const whole = catalogue.reduce((n, e) => n + e.name.length + e.descriptionChars + 5, 0);
        expect(whole).toBeGreaterThan(CODEX_BUDGET_CHARS);

        const r = computeCodexResidentSet(catalogue);
        expect(r.listingChars).toBeLessThanOrEqual(CODEX_BUDGET_CHARS);
        expect(r.resident.length).toBeGreaterThan(0);
        expect(r.resident.length + r.nonResident.length).toBe(catalogue.length);
    });

    it("leaves the host's agents-md projection exactly as it was", () => {
        // 4.1: "Its `agents-md` projection stays exactly as today." This step adds
        // no deploy source, so the row is the same four entries as claude-code's.
        expect(GLOBAL_DEPLOY_SOURCES['codex']).toEqual(GLOBAL_DEPLOY_SOURCES['claude-code']);
        expect(GLOBAL_DEPLOY_SOURCES['codex']?.map(([, dest]) => dest)).toEqual([
            'rules',
            'skills',
            'commands',
            'personas',
        ]);
    });
});
