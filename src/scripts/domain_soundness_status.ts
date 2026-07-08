#!/usr/bin/env tsx
/**
 * Domain-soundness validation status + ratchet
 * (road-to-domain-soundness Phase 1 + Phase 3).
 *
 * The four non-coding profiles (finance, founder, ops, content_creator) SELL
 * concrete domain value (DCF, runway, RICE, incident command, messaging), but
 * the skills are forged on TS/PHP — "promising, not proven" off those stacks.
 * A disclaimer floor bounds liability, NOT correctness. This tool makes the
 * provenance honest and machine-checkable: it enumerates the default-surface
 * domain skills those profiles ship (from source — each profile's
 * `skills_hint`, never hardcoded) and reports each as:
 *
 *   - `validated`   — ships `evals/domain-truth.json` (a sourced answer key,
 *                     authored by domain competence, distinct from behavioural
 *                     evals.json). Presence is the machine signal; a passing
 *                     run against it is the maintainer's Phase-3 gate.
 *   - `unvalidated` — no domain-truth fixture: general-purpose scaffold, domain
 *                     correctness not independently validated.
 *
 * A domain skill can pass a format/behavioural eval AND carry a disclaimer AND
 * still embed a wrong domain assumption — this axis is the one that catches it.
 *
 * Modes:
 *   (default)      human report.
 *   --json         machine-readable.
 *   --check        ratchet gate (CI): the count of `validated` skills may not
 *                  drop below the pinned floor (internal/evals/domain-soundness-floor.json);
 *                  a missing floor is an all-zero floor (bootstrap-inert). The
 *                  floor only rises via --write-floor after a fixture lands and
 *                  passes. This is the enforced-honesty gate: it makes a claimed
 *                  validation impossible to assert without the fixture on disk.
 *   --write-floor  pin the current validated count as the floor (maintainer
 *                  action after authoring + running a domain-truth fixture).
 *
 * Exit codes: 0 ok / 1 ratchet regression / 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The non-coding profiles whose default surface this tool scopes. */
export const NON_CODING_PROFILES: readonly string[] = [
    'finance',
    'founder',
    'ops',
    'content_creator',
];

export interface StatusOptions {
    skillsDir?: string;
    profilesDir?: string;
    floorPath?: string;
}

export interface SkillStatus {
    skill: string;
    status: 'validated' | 'unvalidated';
}

export interface SoundnessReport {
    validationSet: SkillStatus[];
    validated: number;
    unvalidated: number;
    total: number;
}

function _skillsDir(o: StatusOptions): string {
    return o.skillsDir ?? path.join(REPO_ROOT, 'src', 'skills');
}
function _profilesDir(o: StatusOptions): string {
    return o.profilesDir ?? path.join(REPO_ROOT, 'src', 'agent-src', 'profiles');
}
export function _floorPath(o: StatusOptions = {}): string {
    return (
        o.floorPath ??
        path.join(REPO_ROOT, 'internal', 'evals', 'domain-soundness-floor.json')
    );
}

/** Union of the non-coding profiles' `skills_hint`, restricted to real skills. */
export function validationSet(o: StatusOptions = {}): string[] {
    const profilesDir = _profilesDir(o);
    const skillsDir = _skillsDir(o);
    const out = new Set<string>();
    for (const p of NON_CODING_PROFILES) {
        const f = path.join(profilesDir, `${p}.yml`);
        let doc: unknown;
        try {
            doc = parseYaml(fs.readFileSync(f, 'utf-8'));
        } catch {
            continue;
        }
        const profile = (doc as { profile?: unknown } | null)?.profile;
        const defaults = (profile as { defaults?: unknown } | null)?.defaults;
        const hint = (defaults as { skills_hint?: unknown } | null)?.skills_hint;
        if (Array.isArray(hint)) {
            for (const s of hint) {
                if (typeof s === 'string' && fs.existsSync(path.join(skillsDir, s, 'SKILL.md'))) {
                    out.add(s);
                }
            }
        }
    }
    return [...out].sort();
}

function _isValidated(skillsDir: string, skill: string): boolean {
    return fs.existsSync(path.join(skillsDir, skill, 'evals', 'domain-truth.json'));
}

export function computeStatus(o: StatusOptions = {}): SoundnessReport {
    const skillsDir = _skillsDir(o);
    const set = validationSet(o);
    const validationSetStatus: SkillStatus[] = set.map((skill) => ({
        skill,
        status: _isValidated(skillsDir, skill) ? 'validated' : 'unvalidated',
    }));
    const validated = validationSetStatus.filter((s) => s.status === 'validated').length;
    return {
        validationSet: validationSetStatus,
        validated,
        unvalidated: validationSetStatus.length - validated,
        total: validationSetStatus.length,
    };
}

function _readFloor(floorPath: string): number {
    try {
        const raw = JSON.parse(fs.readFileSync(floorPath, 'utf-8')) as { validated?: number };
        return raw.validated ?? 0;
    } catch {
        return 0;
    }
}

export function writeFloor(o: StatusOptions = {}): SoundnessReport {
    const report = computeStatus(o);
    const p = _floorPath(o);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(
        p,
        JSON.stringify(
            {
                _comment:
                    'Domain-soundness ratchet floor (road-to-domain-soundness Phase 3). ' +
                    'domain_soundness_status --check fails if the validated count drops below this. ' +
                    'Regenerate with --write-floor ONLY after a domain-truth fixture lands and passes.',
                validated: report.validated,
            },
            null,
            2,
        ) + '\n',
    );
    return report;
}

export function checkRatchet(o: StatusOptions = {}): { ok: boolean; message: string } {
    const report = computeStatus(o);
    const floor = _readFloor(_floorPath(o));
    if (report.validated < floor) {
        return {
            ok: false,
            message: `validated domain skills ${report.validated} < floor ${floor}`,
        };
    }
    return { ok: true, message: `validated ${report.validated}/${report.total} (floor ${floor})` };
}

function _renderHuman(r: SoundnessReport): string {
    const lines = [
        'Domain-soundness status — non-coding default-surface skills',
        `  validated:   ${r.validated}/${r.total}`,
        `  unvalidated: ${r.unvalidated}/${r.total}`,
        '',
    ];
    for (const s of r.validationSet) {
        const mark = s.status === 'validated' ? '✅' : '·';
        lines.push(`  ${mark} ${s.skill.padEnd(28)} ${s.status}`);
    }
    return lines.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const known = new Set(['--json', '--check', '--write-floor']);
    for (const a of argv) {
        if (!known.has(a)) {
            process.stderr.write('usage: domain_soundness_status [--json | --check | --write-floor]\n');
            return 2;
        }
    }
    if (argv.includes('--write-floor')) {
        const r = writeFloor();
        process.stdout.write(`✅  domain-soundness floor pinned: validated ${r.validated}/${r.total}\n`);
        return 0;
    }
    if (argv.includes('--check')) {
        const { ok, message } = checkRatchet();
        if (!ok) {
            process.stdout.write(`❌  domain-soundness ratchet regressed: ${message}\n`);
            return 1;
        }
        process.stdout.write(`✅  domain-soundness ratchet: ${message}.\n`);
        return 0;
    }
    const report = computeStatus();
    if (argv.includes('--json')) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return 0;
    }
    process.stdout.write(_renderHuman(report) + '\n');
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
