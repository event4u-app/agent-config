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
 *   unrouted-skill (advisory) — some pack delivers a skill while delivering no
 *   rule that routes to it. The consumer has the artefact and no path to it.
 *   This is the measured case above. Advisory on purpose: a skill reachable
 *   only by explicit user invocation is a legitimate design, so a finding here
 *   is a question, not a verdict.
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
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const RULES_DIR = path.join(REPO, 'src', 'rules');
const SKILLS_DIR = path.join(REPO, 'src', 'skills');
const PACKS_FILE = path.join(REPO, 'src', 'config', 'discovery', 'packs.yml');

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

function main(): number {
    const packs = readPacks(PACKS_FILE);
    const rules = readRules(RULES_DIR);
    const skillPacks = readSkillPacks(SKILLS_DIR);

    if (rules.length === 0 || skillPacks.size === 0 || packs.size === 0) {
        process.stderr.write(
            `❌  lint_rule_skill_pack_reach scanned nothing (rules=${rules.length}, skills=${skillPacks.size}, packs=${packs.size}) — refusing to report a pass\n`,
        );
        return 2;
    }

    const findings = analyze(rules, skillPacks, packs);
    const errors = findings.filter((f) => f.kind === 'unreachable-route');
    const advisories = findings.filter((f) => f.kind === 'unrouted-skill');

    for (const finding of errors) {
        process.stdout.write(`❌  ${finding.subject} — ${finding.detail}\n`);
    }
    for (const finding of advisories) {
        process.stdout.write(`⚠️  ${finding.subject} — ${finding.detail}\n`);
    }

    const strict = process.argv.includes('--strict');
    process.stdout.write(
        `scanned: ${rules.length} rule(s), ${skillPacks.size} skill(s), ${packs.size} pack(s) — ${errors.length} unreachable-route, ${advisories.length} unrouted-skill\n`,
    );
    if (errors.length > 0 && !strict) {
        process.stdout.write(
            `advisory run: ${errors.length} unreachable-route finding(s) reported, exit 0. Promote with --strict once the set is empty.\n`,
        );
    }
    return strict && errors.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    try {
        process.exit(main());
    } catch (error) {
        process.stderr.write(`❌  ${(error as Error).message}\n`);
        process.exit(2);
    }
}
