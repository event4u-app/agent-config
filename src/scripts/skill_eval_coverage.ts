#!/usr/bin/env tsx
/**
 * Behavioural-eval coverage metric + ratchet
 * (road-to-skill-eval-coverage Phase 1 + Phase 3).
 *
 * Counts, per tier, how many skills carry a behavioural `evals.json`
 * (`src/skills/<skill>/evals/evals.json`). This is the BEHAVIOURAL axis
 * (does the skill produce good output), distinct from the trigger/activation
 * axis (`triggers.json` — does the right skill fire); never conflate the two
 * coverage numbers.
 *
 * Tiers are derived from source, never hardcoded, so the metric stays honest
 * as profiles / rich-tagging change:
 *   - `rich`            — skills with `token_budget_class: rich` (highest cost).
 *   - `default-surface` — union of every profile's `skills_hint` (what a fresh
 *                         installer hits first).
 *   - `router`          — the routing skills a mis-fire poisons downstream
 *                         (`analysis-skill-router`, `command-routing`).
 *   - `priority`        — the union of the three gated tiers above.
 *   - `other`           — everything else (the long tail).
 *
 * Modes:
 *   (default)      human report: overall + per-tier covered/total.
 *   --json         machine-readable JSON (wired into discovery reporting).
 *   --check        ratchet gate (CI): fail if overall OR any tier coverage
 *                  drops below the pinned floor (internal/evals/coverage-floor.json).
 *                  A missing floor file is treated as an all-zero floor
 *                  (bootstrap-inert: never fails before the first --write-floor).
 *   --write-floor  pin the current coverage as the new floor. Maintainer action
 *                  after authoring evals — the ratchet only ever rises.
 *
 * Exit codes: 0 ok / 1 ratchet regression / 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The two router skills whose mis-routing poisons everything downstream. */
const ROUTER_SKILLS: readonly string[] = ['analysis-skill-router', 'command-routing'];

export interface CoverageOptions {
    skillsDir?: string;
    profilesDir?: string;
    floorPath?: string;
}

export interface TierCoverage {
    covered: number;
    total: number;
    uncovered: string[];
}

export interface CoverageReport {
    overall: TierCoverage;
    tiers: {
        rich: TierCoverage;
        'default-surface': TierCoverage;
        router: TierCoverage;
        priority: TierCoverage;
        other: TierCoverage;
    };
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Split a leading `---\n…\n---` frontmatter block; `[frontmatter, body]`. */
function _splitFrontmatter(text: string): [Record<string, Json>, string] {
    if (!text.startsWith('---\n')) return [{}, text];
    const end = text.indexOf('\n---', 4);
    if (end === -1) return [{}, text];
    const fmText = text.slice(4, end);
    const body = text.slice(end + 4).replace(/^\n+/, '');
    let parsed: unknown = {};
    try {
        parsed = parseYaml(fmText);
    } catch {
        parsed = {};
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return [{}, body];
    }
    return [parsed as Record<string, Json>, body];
}

function _skillsDir(opts: CoverageOptions): string {
    return opts.skillsDir ?? path.join(REPO_ROOT, 'src', 'skills');
}

function _profilesDir(opts: CoverageOptions): string {
    return opts.profilesDir ?? path.join(REPO_ROOT, 'src', 'agent-src', 'profiles');
}

export function _floorPath(opts: CoverageOptions = {}): string {
    return opts.floorPath ?? path.join(REPO_ROOT, 'internal', 'evals', 'coverage-floor.json');
}

/** Every skill slug that ships a SKILL.md, with its token_budget_class. */
function _allSkills(skillsDir: string): Array<{ name: string; richTagged: boolean }> {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: Array<{ name: string; richTagged: boolean }> = [];
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        const skillMd = path.join(skillsDir, e.name, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;
        const [fm] = _splitFrontmatter(fs.readFileSync(skillMd, 'utf-8'));
        out.push({ name: e.name, richTagged: fm['token_budget_class'] === 'rich' });
    }
    out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out;
}

/** Union of every profile's `skills_hint` — the default surface. */
function _defaultSurface(profilesDir: string): Set<string> {
    const out = new Set<string>();
    let files: string[];
    try {
        files = fs.readdirSync(profilesDir).filter((f) => f.endsWith('.yml'));
    } catch {
        return out;
    }
    for (const f of files) {
        let doc: unknown;
        try {
            doc = parseYaml(fs.readFileSync(path.join(profilesDir, f), 'utf-8'));
        } catch {
            continue;
        }
        const profile = (doc as { profile?: Json } | null)?.profile;
        const defaults = (profile as { defaults?: Json } | null)?.defaults;
        const hint = (defaults as { skills_hint?: Json } | null)?.skills_hint;
        if (Array.isArray(hint)) {
            for (const s of hint) if (typeof s === 'string') out.add(s);
        }
    }
    return out;
}

function _isCovered(skillsDir: string, name: string): boolean {
    return fs.existsSync(path.join(skillsDir, name, 'evals', 'evals.json'));
}

function _tier(members: string[], covered: (n: string) => boolean): TierCoverage {
    const sorted = [...new Set(members)].sort();
    const uncovered = sorted.filter((n) => !covered(n));
    return { covered: sorted.length - uncovered.length, total: sorted.length, uncovered };
}

export function computeCoverage(opts: CoverageOptions = {}): CoverageReport {
    const skillsDir = _skillsDir(opts);
    const skills = _allSkills(skillsDir);
    const names = skills.map((s) => s.name);
    const richSet = new Set(skills.filter((s) => s.richTagged).map((s) => s.name));
    const defaultSet = _defaultSurface(_profilesDir(opts));
    const routerSet = new Set(ROUTER_SKILLS.filter((r) => names.includes(r)));
    const prioritySet = new Set<string>([...richSet, ...defaultSet, ...routerSet]);
    const covered = (n: string): boolean => _isCovered(skillsDir, n);

    return {
        overall: _tier(names, covered),
        tiers: {
            rich: _tier([...richSet], covered),
            'default-surface': _tier([...defaultSet].filter((n) => names.includes(n)), covered),
            router: _tier([...routerSet], covered),
            priority: _tier([...prioritySet].filter((n) => names.includes(n)), covered),
            other: _tier(
                names.filter((n) => !prioritySet.has(n)),
                covered,
            ),
        },
    };
}

interface Floor {
    overall: number;
    tiers: Record<string, number>;
}

function _readFloor(floorPath: string): Floor {
    try {
        const raw = JSON.parse(fs.readFileSync(floorPath, 'utf-8')) as Partial<Floor>;
        return { overall: raw.overall ?? 0, tiers: raw.tiers ?? {} };
    } catch {
        return { overall: 0, tiers: {} };
    }
}

/** Pin current coverage as the ratchet floor. */
export function writeFloor(opts: CoverageOptions = {}): CoverageReport {
    const report = computeCoverage(opts);
    const floor: Floor = {
        overall: report.overall.covered,
        tiers: Object.fromEntries(
            Object.entries(report.tiers).map(([k, v]) => [k, v.covered]),
        ),
    };
    const p = _floorPath(opts);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(
        p,
        JSON.stringify(
            {
                _comment:
                    'Behavioural-eval coverage ratchet floor (road-to-skill-eval-coverage Phase 3). ' +
                    'skill_eval_coverage --check fails if coverage drops below these counts. ' +
                    'Regenerate with `--write-floor` ONLY after authoring evals — the floor only rises.',
                ...floor,
            },
            null,
            2,
        ) + '\n',
    );
    return report;
}

/** Ratchet: current coverage must be >= floor, overall and per tier. */
export function checkRatchet(opts: CoverageOptions = {}): { ok: boolean; regressions: string[] } {
    const report = computeCoverage(opts);
    const floor = _readFloor(_floorPath(opts));
    const regressions: string[] = [];
    if (report.overall.covered < floor.overall) {
        regressions.push(
            `overall coverage ${report.overall.covered} < floor ${floor.overall}`,
        );
    }
    for (const [tier, cov] of Object.entries(report.tiers)) {
        const f = floor.tiers[tier] ?? 0;
        if (cov.covered < f) {
            regressions.push(`tier '${tier}' coverage ${cov.covered} < floor ${f}`);
        }
    }
    return { ok: regressions.length === 0, regressions };
}

function _pct(c: TierCoverage): string {
    if (c.total === 0) return 'n/a';
    return `${((c.covered / c.total) * 100).toFixed(1)}%`;
}

function _renderHuman(r: CoverageReport): string {
    const row = (label: string, c: TierCoverage): string =>
        `  ${label.padEnd(16)} ${String(c.covered).padStart(3)}/${String(c.total).padEnd(3)}  ${_pct(c)}`;
    return [
        'Behavioural-eval coverage (src/skills/*/evals/evals.json)',
        row('overall', r.overall),
        row('rich', r.tiers.rich),
        row('default-surface', r.tiers['default-surface']),
        row('router', r.tiers.router),
        row('priority', r.tiers.priority),
        row('other', r.tiers.other),
    ].join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const known = new Set(['--json', '--check', '--write-floor']);
    for (const a of argv) {
        if (!known.has(a)) {
            process.stderr.write(
                `usage: skill_eval_coverage [--json | --check | --write-floor]\n`,
            );
            return 2;
        }
    }

    if (argv.includes('--write-floor')) {
        const report = writeFloor();
        process.stdout.write(
            `✅  coverage floor pinned: overall ${report.overall.covered}/${report.overall.total}\n`,
        );
        return 0;
    }

    if (argv.includes('--check')) {
        const { ok, regressions } = checkRatchet();
        if (!ok) {
            process.stdout.write('❌  eval-coverage ratchet regressed:\n');
            for (const r of regressions) process.stdout.write(`    - ${r}\n`);
            return 1;
        }
        process.stdout.write('✅  eval-coverage ratchet: no regression.\n');
        return 0;
    }

    const report = computeCoverage();
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
