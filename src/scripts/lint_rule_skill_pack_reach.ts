#!/usr/bin/env tsx
/**
 * lint_rule_skill_pack_reach — a rule and the skills it routes to must be able
 * to arrive in the same install.
 *
 * The defect that motivated this is real and was undocumented in the direction
 * it actually runs. `ui-audit-gate` and `design-review-after-ui-write` are
 * `packs: [frontend-design]`; `existing-ui-audit`, `design-review` and
 * `fe-design` are `packs: [engineering-base]`. The direction the rule prose
 * described — frontend-design without engineering-base — cannot happen, because
 * `frontend-design` declares `requires: [engineering-base]`. The reverse can: a
 * plain `laravel` or `react` install carries the skills and **no rule that ever
 * routes to them**, since both packs only *suggest* frontend-design.
 *
 * TWO CHECKS, AND THEY ARE NOT THE SAME QUESTION.
 *
 *   unreachable-route (error) — a rule routes to a skill that a pack-legal
 *   install of that rule cannot receive. The consumer gets the obligation
 *   without the artefact that discharges it.
 *
 *   unrouted-skill (advisory) — a skill that IS routed somewhere reaches a pack
 *   none of its routing rules reach. The consumer has the artefact and no path
 *   to it. This is the measured case above.
 *
 *   Scope, stated because the obvious reading is wider than the scan: the
 *   subject set is skills some rule already routes to. A skill NO rule routes
 *   to anywhere is never examined, deliberately — most of the estate is in
 *   that set by design (a skill invoked by name needs no rule), so reporting
 *   it would bury the finding this check exists for. Advisory for the same
 *   reason: reachability-only-by-invocation is a legitimate design, so a
 *   finding here is a question, not a verdict.
 *
 * The install closure is `pack + requires*` — the transitive expansion the
 * resolver performs. `suggests` is deliberately NOT followed: it is advisory,
 * the wizard may offer it and the user may decline, so an invariant that
 * counted it would pass on installs that do not exist.
 *
 * ADVISORY UNTIL ITS FINDING SET IS EMPTY, AND THE FIRST RUN SAYS WHY.
 * Measured on introduction: 12 `unreachable-route` and 14 `unrouted-skill`
 * findings across 116 rules. The UI pair is one instance of an estate-wide
 * pattern — safety floors routing into packs their own pack does not pull, and
 * skills delivered by a pack whose routing rule ships in a different one.
 * Shipping this as a blocking gate on day one would have meant either 12
 * unrelated fixes smuggled into a feature change or a suppression file created
 * on day one, which is the ratchet-shaped failure this repo has recorded
 * before. So `--strict` exists and the default does not use it: promotion to
 * error is a one-flag change once the set is empty, and the count is printed
 * on every run so "still 12" cannot quietly become "still 30".
 *
 * Exit codes: 0 advisory run (default) or clean · 1 `unreachable-route`
 * findings under `--strict` · 2 usage or IO error. A scan that walked no rules
 * exits 2 rather than green — a gate that scanned nothing must never read as a
 * pass.
 *
 * `--self-test` proves those rejections still fire in the binary a contributor
 * runs, not merely in the imported functions `tests/scripts/pack_reach.test.ts`
 * exercises. `--root <dir>` exists for it: the three inputs are ordinary tree
 * reads, so a temporary fixture repo can reproduce every verdict, which is why
 * this gate adopts the harness rather than claiming the exemption.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

interface Roots {
    rulesDir: string;
    skillsDir: string;
    packsFile: string;
}

/** The three inputs, resolved against `root` so a fixture tree can stand in. */
function rootsFor(root: string): Roots {
    return {
        rulesDir: path.join(root, 'src', 'rules'),
        skillsDir: path.join(root, 'src', 'skills'),
        packsFile: path.join(root, 'src', 'config', 'discovery', 'packs.yml'),
    };
}

export interface PackDef {
    id: string;
    requires: string[];
}

export interface Finding {
    kind: 'unreachable-route' | 'unrouted-skill';
    subject: string;
    detail: string;
}

/** Frontmatter block between the leading fences, or "" when absent. */
function frontmatterOf(content: string): string {
    if (!content.startsWith('---')) return '';
    const end = content.indexOf('\n---', 3);
    return end === -1 ? '' : content.slice(3, end);
}

function frontmatterObject(file: string): Record<string, unknown> {
    const raw = frontmatterOf(fs.readFileSync(file, 'utf-8'));
    if (!raw.trim()) return {};
    try {
        const parsed = parseYaml(raw) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function stringList(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
    if (typeof value === 'string') return [value];
    return [];
}

/** Parse the pack registry into id → hard requirements. */
export function readPacks(file: string): Map<string, PackDef> {
    const parsed = parseYaml(fs.readFileSync(file, 'utf-8')) as unknown;
    const out = new Map<string, PackDef>();
    if (!Array.isArray(parsed)) return out;
    for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue;
        const record = entry as Record<string, unknown>;
        const id = record['id'];
        if (typeof id !== 'string') continue;
        out.set(id, { id, requires: stringList(record['requires']) });
    }
    return out;
}

/** `pack + requires*` — what an install selecting `pack` actually receives. */
export function installClosure(pack: string, packs: Map<string, PackDef>): Set<string> {
    const seen = new Set<string>();
    const queue = [pack];
    while (queue.length > 0) {
        const current = queue.pop()!;
        if (seen.has(current)) continue;
        seen.add(current);
        for (const required of packs.get(current)?.requires ?? []) queue.push(required);
    }
    return seen;
}

interface RuleInfo {
    name: string;
    packs: string[];
    routesToSkills: string[];
}

export function readRules(dir: string): RuleInfo[] {
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
            const fm = frontmatterObject(path.join(dir, f));
            return {
                name: f.replace(/\.md$/, ''),
                packs: stringList(fm['packs']),
                routesToSkills: stringList(fm['routes_to'])
                    .filter((r) => r.startsWith('skill:'))
                    .map((r) => r.slice('skill:'.length)),
            };
        });
}

export function readSkillPacks(dir: string): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const name of fs.readdirSync(dir)) {
        const file = path.join(dir, name, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        out.set(name, stringList(frontmatterObject(file)['packs']));
    }
    return out;
}

export function analyze(
    rules: RuleInfo[],
    skillPacks: Map<string, string[]>,
    packs: Map<string, PackDef>,
): Finding[] {
    const findings: Finding[] = [];

    // 1. unreachable-route — the obligation without the artefact.
    for (const rule of rules) {
        if (rule.packs.length === 0) continue; // unscoped rule ships everywhere
        for (const skill of rule.routesToSkills) {
            const target = skillPacks.get(skill);
            if (target === undefined) continue; // a missing skill is check_references' job
            if (target.length === 0) continue; // unscoped skill ships everywhere
            const unreachableFrom = rule.packs.filter((p) => {
                const closure = installClosure(p, packs);
                return !target.some((tp) => closure.has(tp));
            });
            if (unreachableFrom.length === 0) continue;
            findings.push({
                kind: 'unreachable-route',
                subject: `${rule.name} → skill:${skill}`,
                detail: `rule pack(s) [${unreachableFrom.join(', ')}] do not reach skill pack(s) [${target.join(', ')}]`,
            });
        }
    }

    // 2. unrouted-skill — the artefact without a path to it.
    const routedSkills = new Set(rules.flatMap((r) => r.routesToSkills));
    for (const skill of routedSkills) {
        const target = skillPacks.get(skill);
        if (target === undefined || target.length === 0) continue;
        const routingRules = rules.filter((r) => r.routesToSkills.includes(skill));
        for (const skillPack of target) {
            const closure = installClosure(skillPack, packs);
            const reached = routingRules.some(
                (r) => r.packs.length === 0 || r.packs.some((p) => closure.has(p)),
            );
            if (reached) continue;
            findings.push({
                kind: 'unrouted-skill',
                subject: `skill:${skill}`,
                detail: `an install of pack [${skillPack}] receives this skill but none of its routing rule(s) [${routingRules.map((r) => r.name).join(', ')}]`,
            });
        }
    }

    return findings;
}

interface Args {
    quiet: boolean;
    strict: boolean;
    selfTest: boolean;
    root: string;
}

function _parseArgs(argv: readonly string[]): Args {
    const args: Args = { quiet: false, strict: false, selfTest: false, root: REPO };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--quiet') args.quiet = true;
        else if (a === '--strict') args.strict = true;
        else if (a === '--self-test') args.selfTest = true;
        else if (a === '--root') {
            // Never fall back to the real repo. A self-test whose root argument
            // went missing would otherwise scan the live tree instead of its
            // fixture and could still exit 0 — a green run proving nothing,
            // which is the exact failure `_lib/gate_self_test.ts` exists for.
            const value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                throw new Error('--root requires a directory argument');
            }
            args.root = value;
            i += 1;
        }
    }
    return args;
}

/**
 * Build a fixture tree. `packsYml` is written verbatim; each rule and skill is
 * a minimal frontmatter block, which is all `readRules` / `readSkillPacks`
 * ever look at.
 */
function _fixture(
    tmp: string,
    name: string,
    packsYml: string,
    rules: ReadonlyArray<{ name: string; packs?: string[]; routes: string[] }>,
    skills: ReadonlyArray<{ name: string; packs?: string[] }>,
): string {
    const root = path.join(tmp, name);
    const { rulesDir, skillsDir, packsFile } = rootsFor(root);
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(path.dirname(packsFile), { recursive: true });
    fs.writeFileSync(packsFile, packsYml, 'utf-8');
    const list = (key: string, values?: string[]): string =>
        values === undefined ? '' : `${key}: [${values.join(', ')}]\n`;
    for (const rule of rules) {
        fs.writeFileSync(
            path.join(rulesDir, `${rule.name}.md`),
            `---\n${list('packs', rule.packs)}${list('routes_to', rule.routes)}---\n\n# ${rule.name}\n`,
            'utf-8',
        );
    }
    for (const skill of skills) {
        fs.mkdirSync(path.join(skillsDir, skill.name), { recursive: true });
        fs.writeFileSync(
            path.join(skillsDir, skill.name, 'SKILL.md'),
            `---\n${list('packs', skill.packs)}---\n\n# ${skill.name}\n`,
            'utf-8',
        );
    }
    return root;
}

function _selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrspr-selftest-'));
    const runRaw = (args: readonly string[]): number =>
        runGateCli(REPO, 'src/scripts/lint_rule_skill_pack_reach.ts', args, REPO);
    const run = (root: string, extra: readonly string[] = []): number =>
        runRaw(['--root', root, '--quiet', ...extra]);

    // `alpha` stands alone; `beta` pulls `alpha` in transitively.
    const PACKS = '- id: alpha\n- id: beta\n  requires: [alpha]\n- id: gamma\n';

    try {
        const unreachable = _fixture(
            tmp,
            'unreachable',
            PACKS,
            [{ name: 'r', packs: ['gamma'], routes: ['skill:s'] }],
            [{ name: 's', packs: ['alpha'] }],
        );
        const viaRequires = _fixture(
            tmp,
            'via-requires',
            PACKS,
            [{ name: 'r', packs: ['beta'], routes: ['skill:s'] }],
            [{ name: 's', packs: ['alpha'] }],
        );
        const unscopedRule = _fixture(
            tmp,
            'unscoped-rule',
            PACKS,
            [{ name: 'r', routes: ['skill:s'] }],
            [{ name: 's', packs: ['alpha'] }],
        );
        const unscopedSkill = _fixture(
            tmp,
            'unscoped-skill',
            PACKS,
            [{ name: 'r', packs: ['gamma'], routes: ['skill:s'] }],
            [{ name: 's' }],
        );
        const empty = _fixture(tmp, 'empty', PACKS, [], [{ name: 's', packs: ['alpha'] }]);

        return runSelfTest({
            gate: 'lint_rule_skill_pack_reach',
            minCases: 6,
            minRejectCases: 3,
            cases: [
                {
                    name: 'a rule routing into a pack its own closure never reaches is rejected under --strict',
                    expect: 'reject',
                    run: () => run(unreachable, ['--strict']),
                },
                {
                    name: 'an empty rule corpus refuses to report a pass',
                    expect: 'reject',
                    run: () => run(empty, ['--strict']),
                },
                {
                    name: 'the same route passes when `requires` pulls the skill pack in transitively',
                    expect: 'accept',
                    run: () => run(viaRequires, ['--strict']),
                },
                {
                    name: 'an unscoped rule ships everywhere, so its route is always reachable',
                    expect: 'accept',
                    run: () => run(unscopedRule, ['--strict']),
                },
                {
                    name: 'an unscoped skill ships everywhere, so no route into it can be unreachable',
                    expect: 'accept',
                    run: () => run(unscopedSkill, ['--strict']),
                },
                {
                    name: '--root with no value is refused rather than silently scanning the real tree',
                    expect: 'reject',
                    run: () => runRaw(['--quiet', '--root']),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = _parseArgs(argv);
    if (args.selfTest) return _selfTest();

    const { rulesDir, skillsDir, packsFile } = rootsFor(args.root);
    const packs = readPacks(packsFile);
    const rules = readRules(rulesDir);
    const skillPacks = readSkillPacks(skillsDir);

    if (rules.length === 0 || skillPacks.size === 0 || packs.size === 0) {
        process.stderr.write(
            `❌  lint_rule_skill_pack_reach scanned nothing (rules=${rules.length}, skills=${skillPacks.size}, packs=${packs.size}) — refusing to report a pass\n`,
        );
        return 2;
    }

    const findings = analyze(rules, skillPacks, packs);
    const errors = findings.filter((f) => f.kind === 'unreachable-route');
    const advisories = findings.filter((f) => f.kind === 'unrouted-skill');

    // --quiet suppresses the per-finding lines but never the count line: this
    // gate is expected to stay non-empty for a while, and a quiet run that
    // printed nothing at all would read as clean.
    if (!args.quiet) {
        for (const finding of errors) {
            process.stdout.write(`❌  ${finding.subject} — ${finding.detail}\n`);
        }
        for (const finding of advisories) {
            process.stdout.write(`⚠️  ${finding.subject} — ${finding.detail}\n`);
        }
    }

    // Two lines on purpose. `check_gate_coverage`'s SCANNED_RE is
    // `/^\s*scanned:\s*(\d+)\s*$/m` — the count must END the line — so the
    // detailed breakdown below can never satisfy it. This gate was registered
    // `enforced` with `min_scanned: 90` and had therefore reported `null` since
    // 924cad87f: an enforced floor that no output could ever meet. Emit the
    // machine-readable contract line first, then the human breakdown.
    process.stdout.write(`scanned: ${rules.length}\n`);
    process.stdout.write(
        `${rules.length} rule(s), ${skillPacks.size} skill(s), ${packs.size} pack(s) — ${errors.length} unreachable-route, ${advisories.length} unrouted-skill\n`,
    );
    if (errors.length > 0 && !args.strict) {
        process.stdout.write(
            `advisory run: ${errors.length} unreachable-route finding(s) reported, exit 0. Promote with --strict once the set is empty.\n`,
        );
    }
    return args.strict && errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    try {
        process.exit(main());
    } catch (error) {
        process.stderr.write(`❌  ${(error as Error).message}\n`);
        process.exit(2);
    }
}
