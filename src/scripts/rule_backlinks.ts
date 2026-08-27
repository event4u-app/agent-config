#!/usr/bin/env tsx
/**
 * Rule → skill/guideline backlink report (feedback-8.11 Phase 6).
 *
 * The P4 pattern moves rule bodies into skills/guidelines with the rule
 * keeping a thin routing stub. The 2026-07-12 council REJECTED a
 * `routed_from_rules` skill-frontmatter key (backwards coupling) — the
 * linkage stays derivable from the RULE side only. This report is that
 * derivation: per target (skill / guideline / context / contract), which
 * rules route to it, so a skill author sees inbound routes without any
 * schema cost.
 *
 * Sources per rule file (src/rules/*.md):
 *   1. frontmatter `routes_to:` list items ("skill:x", "guideline:y", paths)
 *   2. body prose `Body migrated to <target>` lines (backtick or bare
 *      `skill:x` / `guideline:y` tokens, and explicit context/contract paths)
 *
 * Correctness slice (council-adjudicated: correctness NOW, semantic metrics
 * PARKED): every derived target is resolved against the tree — a stub
 * pointing at a deleted target is a broken promise. Resolution map:
 *   skill:<id>        → src/skills/<id>/SKILL.md
 *   guideline:<path>  → docs/guidelines/<path>.md
 *   context:<path>    → src/agent-src/contexts/<path>.md
 *   contract:<id>     → docs/contracts/<id>.md OR
 *                       src/agent-src/contexts/contracts/<id>.md
 *   contexts/<p>.md   → src/agent-src/contexts/<p>.md
 *   docs/… · src/…    → repo-root-relative path
 * Anything else is reported honestly as "unknown-shape" — listed
 * separately, never counted as an orphan.
 *
 * Modes:
 *   default  — write internal/reports/rule-backlinks.md, ALWAYS exit 0
 *              (report-only; regenerate after each migration batch).
 *   --check  — same report, exit 1 iff orphan stubs exist.
 *
 * Design notes — gated future work (round 4). Later-hard-gates list,
 * verbatim: invalid backlinks, cyclic ownership, kernel-budget breach,
 * new setting without profile default, new runtime-state surface without
 * owner, stub without valid target. Precondition: only precise, non-proxy
 * metrics may ever hard-gate. Cycles / competing-owners metrics are PARKED
 * per the complexity report's kill-criterion discipline.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export interface Backlink {
    target: string; // normalized target id, e.g. "skill:laravel" or a repo path
    rule: string; // rule stem, e.g. "docker-commands"
    source: 'frontmatter' | 'prose';
}

export type Resolution =
    | { status: 'resolved'; path: string }
    | { status: 'orphan'; tried: string[] }
    | { status: 'unknown-shape' };

export interface OrphanEntry {
    target: string;
    rules: string[];
    tried: string[]; // repo-relative candidate paths that were checked
}

export interface UnknownShapeEntry {
    target: string;
    rules: string[];
}

export interface ValidationResult {
    orphans: OrphanEntry[];
    unknownShapes: UnknownShapeEntry[];
    resolvedCount: number;
}

const _TARGET_TOKEN_RE = /(?:`)?((?:skill|guideline|context):[a-z0-9][a-z0-9/_.-]*)(?:`)?/gi;
const _PATH_TOKEN_RE = /`((?:contexts|docs|src)\/[a-zA-Z0-9/_.-]+\.md)`/g;

export function extract_backlinks(ruleStem: string, text: string): Backlink[] {
    const out: Backlink[] = [];
    const fmMatch = text.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n/);
    if (fmMatch !== null) {
        const fm = fmMatch[1]!;
        const rt = fm.match(/^routes_to:\s*\n((?:\s+-\s+.*\n?)+)/m);
        if (rt !== null) {
            for (const line of rt[1]!.split('\n')) {
                const item = line.match(/^\s+-\s+["']?([^"'\s]+)["']?/);
                if (item !== null) {
                    out.push({ target: item[1]!, rule: ruleStem, source: 'frontmatter' });
                }
            }
        }
    }
    const body = fmMatch === null ? text : text.slice(fmMatch[0].length);
    for (const line of body.split('\n')) {
        if (!/body migrated to/i.test(line)) {
            continue;
        }
        for (const m of line.matchAll(new RegExp(_TARGET_TOKEN_RE.source, 'gi'))) {
            out.push({ target: m[1]!.toLowerCase(), rule: ruleStem, source: 'prose' });
        }
        for (const m of line.matchAll(new RegExp(_PATH_TOKEN_RE.source, 'g'))) {
            out.push({ target: m[1]!, rule: ruleStem, source: 'prose' });
        }
    }
    return out;
}

export function collect(rulesDir: string): Map<string, Backlink[]> {
    const byTarget = new Map<string, Backlink[]>();
    if (!fs.existsSync(rulesDir)) {
        return byTarget;
    }
    for (const f of fs.readdirSync(rulesDir).sort()) {
        if (!f.endsWith('.md')) {
            continue;
        }
        const stem = f.replace(/\.md$/, '');
        const links = extract_backlinks(stem, fs.readFileSync(path.join(rulesDir, f), 'utf-8'));
        const seen = new Set<string>();
        for (const l of links) {
            const key = `${l.target} ${l.rule}`;
            if (seen.has(key)) {
                continue; // frontmatter + prose naming the same target = one backlink
            }
            seen.add(key);
            (byTarget.get(l.target) ?? byTarget.set(l.target, []).get(l.target)!).push(l);
        }
    }
    return byTarget;
}

/**
 * Map a derived target id to candidate repo-relative paths. Returns the
 * candidate list for a known shape, or null when the shape is not one we
 * know how to place (→ "unknown-shape", honestly listed, never an orphan).
 */
export function candidate_paths(target: string): string[] | null {
    const skill = target.match(/^skill:([a-z0-9][a-z0-9_.-]*)$/i);
    if (skill !== null) {
        return [path.join('src', 'skills', skill[1]!, 'SKILL.md')];
    }
    const guideline = target.match(/^guideline:([a-z0-9][a-z0-9/_.-]*)$/i);
    if (guideline !== null) {
        return [path.join('docs', 'guidelines', `${guideline[1]!.replace(/\.md$/, '')}.md`)];
    }
    const context = target.match(/^context:([a-z0-9][a-z0-9/_.-]*)$/i);
    if (context !== null) {
        return [path.join('src', 'agent-src', 'contexts', `${context[1]!.replace(/\.md$/, '')}.md`)];
    }
    const contract = target.match(/^contract:([a-z0-9][a-z0-9_.-]*)$/i);
    if (contract !== null) {
        const id = contract[1]!.replace(/\.md$/, '');
        return [
            path.join('docs', 'contracts', `${id}.md`),
            path.join('src', 'agent-src', 'contexts', 'contracts', `${id}.md`),
        ];
    }
    if (/^contexts\/[a-zA-Z0-9/_.-]+\.md$/.test(target)) {
        return [path.join('src', 'agent-src', target)];
    }
    if (/^(?:docs|src)\/[a-zA-Z0-9/_.-]+\.md$/.test(target)) {
        return [target];
    }
    return null;
}

export function resolve_target(target: string, root: string = ROOT): Resolution {
    const candidates = candidate_paths(target);
    if (candidates === null) {
        return { status: 'unknown-shape' };
    }
    for (const rel of candidates) {
        if (fs.existsSync(path.join(root, rel))) {
            return { status: 'resolved', path: rel };
        }
    }
    return { status: 'orphan', tried: candidates };
}

export function validate_targets(
    byTarget: Map<string, Backlink[]>,
    root: string = ROOT,
): ValidationResult {
    const orphans: OrphanEntry[] = [];
    const unknownShapes: UnknownShapeEntry[] = [];
    let resolvedCount = 0;
    for (const target of [...byTarget.keys()].sort()) {
        const rules = [...new Set(byTarget.get(target)!.map((l) => l.rule))].sort();
        const res = resolve_target(target, root);
        if (res.status === 'resolved') {
            resolvedCount += 1;
        } else if (res.status === 'orphan') {
            orphans.push({ target, rules, tried: res.tried });
        } else {
            unknownShapes.push({ target, rules });
        }
    }
    return { orphans, unknownShapes, resolvedCount };
}

interface FanOut {
    perRule: Map<string, number>; // rule stem → distinct backlink targets
    max: number;
    highFanOut: { rule: string; targets: number }[]; // >2 targets — info, NOT failures
}

function _fan_out(byTarget: Map<string, Backlink[]>): FanOut {
    const perRule = new Map<string, number>();
    for (const links of byTarget.values()) {
        for (const l of links) {
            perRule.set(l.rule, (perRule.get(l.rule) ?? 0) + 1);
        }
    }
    const max = perRule.size === 0 ? 0 : Math.max(...perRule.values());
    const highFanOut = [...perRule.entries()]
        .filter(([, n]) => n > 2)
        .map(([rule, targets]) => ({ rule, targets }))
        .sort((a, b) => b.targets - a.targets || a.rule.localeCompare(b.rule));
    return { perRule, max, highFanOut };
}

export function render(
    byTarget: Map<string, Backlink[]>,
    validation: ValidationResult = validate_targets(byTarget),
): string {
    const L: string[] = [];
    L.push('<!-- GENERATED by rule_backlinks — do NOT hand-edit.');
    L.push('     Regenerate after each P4 migration batch. Report-only. -->');
    L.push('');
    L.push('# Rule backlinks — which rules route here');
    L.push('');
    L.push('Derived from rule frontmatter `routes_to:` + "Body migrated to" prose.');
    L.push('No skill frontmatter carries this (council 2026-07-12: routed_from_rules');
    L.push('REJECTED — linkage stays rule-side and derivable).');
    L.push('');
    const targets = [...byTarget.keys()].sort();
    L.push(`${targets.length} routing targets · ${[...byTarget.values()].reduce((a, v) => a + v.length, 0)} backlinks`);
    L.push('');
    L.push('## Orphan stubs');
    L.push('');
    L.push('A stub pointing at a deleted target is a broken promise. `--check` exits 1');
    L.push('iff this section is non-empty; report mode always exits 0.');
    L.push('');
    if (validation.orphans.length === 0) {
        L.push(`None — all ${validation.resolvedCount} resolvable targets resolve.`);
        L.push('');
    } else {
        L.push('| Target | Routing rules | Candidate paths checked |');
        L.push('|---|---|---|');
        for (const o of validation.orphans) {
            L.push(
                `| \`${o.target}\` | ${o.rules.map((r) => `\`${r}\``).join(', ')} | ${o.tried.map((t) => `\`${t}\``).join(', ')} |`,
            );
        }
        L.push('');
    }
    if (validation.unknownShapes.length > 0) {
        L.push('## Unknown-shape targets');
        L.push('');
        L.push('Shapes the resolution map cannot place — listed honestly, NOT counted');
        L.push('as orphans. Extend `candidate_paths()` when a shape becomes real.');
        L.push('');
        for (const u of validation.unknownShapes) {
            L.push(`- \`${u.target}\` — ${u.rules.map((r) => `\`${r}\``).join(', ')}`);
        }
        L.push('');
    }
    const fanOut = _fan_out(byTarget);
    L.push('## Fan-out (info)');
    L.push('');
    L.push(`Backlink targets per rule. ${fanOut.perRule.size} routing rules · max fan-out ${fanOut.max}.`);
    L.push('Rules with >2 targets are listed as info, NOT failures.');
    L.push('');
    if (fanOut.highFanOut.length === 0) {
        L.push('No rule routes to more than 2 targets.');
        L.push('');
    } else {
        L.push('| Rule | Targets |');
        L.push('|---|---|');
        for (const h of fanOut.highFanOut) {
            L.push(`| \`${h.rule}\` | ${h.targets} |`);
        }
        L.push('');
    }
    for (const t of targets) {
        L.push(`## ${t}`);
        L.push('');
        for (const l of byTarget.get(t)!.sort((a, b) => a.rule.localeCompare(b.rule))) {
            L.push(`- \`${l.rule}\` (${l.source})`);
        }
        L.push('');
    }
    L.push('## Design notes — gated future work');
    L.push('');
    L.push('Round-4 later-hard-gates list, verbatim: invalid backlinks, cyclic');
    L.push('ownership, kernel-budget breach, new setting without profile default,');
    L.push('new runtime-state surface without owner, stub without valid target.');
    L.push('Precondition: only precise, non-proxy metrics may ever hard-gate.');
    L.push("Cycles / competing-owners metrics are PARKED per the complexity report's");
    L.push('kill-criterion discipline.');
    L.push('');
    return `${L.join('\n')}\n`;
}

export function main(argv: readonly string[] = process.argv.slice(2), root: string = ROOT): number {
    const rulesDir = path.join(root, 'src', 'rules');
    const outPath = path.join(root, 'internal', 'reports', 'rule-backlinks.md');
    const byTarget = collect(rulesDir);
    const validation = validate_targets(byTarget, root);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, render(byTarget, validation));
    if (!argv.includes('--quiet')) {
        process.stdout.write(
            `rule_backlinks: wrote ${path.relative(root, outPath)} — ${byTarget.size} targets, ` +
                `${validation.orphans.length} orphans, ${validation.unknownShapes.length} unknown-shape\n`,
        );
        for (const o of validation.orphans) {
            process.stdout.write(`  ORPHAN: ${o.target} ← ${o.rules.join(', ')}\n`);
        }
    }
    if (argv.includes('--check') && validation.orphans.length > 0) {
        return 1;
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv1;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
