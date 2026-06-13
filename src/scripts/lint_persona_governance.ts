#!/usr/bin/env tsx
/**
 * Lint persona governance — per-domain cap (hard) + citation floor (warn).
 *
 * TypeScript twin of `src/scripts/lint_persona_governance.py` (ADR-094,
 * Phase 4 / Wave 4b). Mirrors the Python CLI contract EXACTLY — `--quiet`
 * flag read from argv at module load, persona enumeration + sorted ordering,
 * finding messages, output channel (emit → stdout; overflow summary on
 * stderr), exit codes. No behaviour changes — latent bugs replicated.
 *
 * Enforces the mechanical checks in
 * `.agent-src.uncondensed/rules/persona-governance.md`:
 *
 *   1. Per-domain cap (HARD) — ≤ 2 active specialist personas per domain.
 *   2. Skill citation floor (WARN) — every active specialist persona SHOULD
 *      be cited by `personas: [<id>]` in at least one skill SKILL.md.
 *
 * Exit codes: 0 cap clean (citation warnings non-blocking), 1 cap violated.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUIET = process.argv.includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const PERSONA_DIR = path.join(REPO, '.agent-src.uncondensed', 'personas');
const SKILL_ROOTS: readonly string[] = [
    path.join(REPO, '.agent-src.uncondensed', 'skills'),
    path.join(REPO, '.claude', 'skills'),
];

// Per-domain cap — mirrors persona-governance.md § Per-domain cap.
const DOMAIN_MAP: Record<string, string> = {
    'hollywood-director': 'ai-video',
    'ai-video-technical-director': 'ai-video',
    'backend-architect': 'backend',
    'eloquent-tamer': 'backend',
    cmo: 'gtm',
    revops: 'gtm',
    'growth-pm': 'growth',
    'customer-success-lead': 'customer',
    'discovery-lead': 'customer',
    'engineering-manager': 'people',
    'people-strategist': 'people',
    'finance-partner': 'money',
    strategist: 'money',
};
const PER_DOMAIN_CAP = 2;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

/** Immediate `*.md` children of `dir`, sorted (sorted(glob('*.md'))). */
function _globMdSorted(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out.sort();
}

/** Recursively list `SKILL.md` files under `dir` (rglob order — count only). */
function _rglobSkills(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        const dirs: string[] = [];
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                dirs.push(full);
            } else if (entry.isFile() && entry.name === 'SKILL.md') {
                out.push(full);
            }
        }
        for (const d of dirs) {
            walk(d);
        }
    };
    walk(dir);
    return out;
}

function emit(msg: string): void {
    if (!QUIET) {
        process.stdout.write(`${msg}\n`);
    }
}

/** Mirror the Python line-by-line frontmatter scan. */
function parse_frontmatter(p: string): Record<string, string> {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        text = '';
    }
    if (!text.startsWith('---')) {
        return {};
    }
    const end = text.indexOf('\n---', 3);
    if (end === -1) {
        return {};
    }
    const out: Record<string, string> = {};
    for (const line of text.slice(3, end).split('\n')) {
        const m = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(line);
        if (m) {
            out[m[1]!] = _strip(_strip(m[2]!.trim(), '"'), "'");
        }
    }
    return out;
}

/** Mirror Python str.strip(chars) — strip leading/trailing chars. */
function _strip(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) start++;
    while (end > start && s[end - 1] === ch) end--;
    return s.slice(start, end);
}

/** Return (id, tier, status, path) for every persona file. */
function collect_personas(): Array<[string, string, string, string]> {
    const out: Array<[string, string, string, string]> = [];
    if (!_exists(PERSONA_DIR)) {
        return out;
    }
    for (const p of _globMdSorted(PERSONA_DIR)) {
        if (_stem(p) === 'README') {
            continue;
        }
        const fm = parse_frontmatter(p);
        const pid = fm['id'] || _stem(p);
        const tier = fm['tier'] ?? '';
        const status = fm['status'] || 'active';
        out.push([pid, tier, status, p]);
    }
    return out;
}

/** Escape a string for use as a RegExp literal (mirrors re.escape). */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function citations_for(personaId: string): string[] {
    // Python compiles this pattern with NO flags, so `^`/`$` are string
    // anchors (not line anchors) and `\s` does not match across the
    // string by default. `s` (dotAll) is irrelevant here — there is no `.`.
    const pattern = new RegExp(
        `(^|[\\s,\\[])${_reEscape(personaId)}([\\s,\\]]|$)`,
    );
    const hits: string[] = [];
    for (const root of SKILL_ROOTS) {
        if (!_exists(root)) {
            continue;
        }
        for (const skill of _rglobSkills(root)) {
            const text = fs.readFileSync(skill, 'utf-8');
            let fmBlock: string;
            if (text.startsWith('---')) {
                const end = text.indexOf('\n---', 3);
                fmBlock = end !== -1 ? text.slice(3, end) : '';
            } else {
                fmBlock = '';
            }
            if (!fmBlock.includes('personas:')) {
                continue;
            }
            if (pattern.test(fmBlock)) {
                hits.push(skill);
            }
        }
    }
    return hits;
}

function main(): number {
    const personas = collect_personas();
    if (personas.length === 0) {
        emit('persona-governance: no persona files found — nothing to lint.');
        return 0;
    }

    const byDomain = new Map<string, string[]>();
    const missingCitations: string[] = [];

    for (const [pid, tier, status] of personas) {
        if (status === 'deprecated' || tier !== 'specialist') {
            continue;
        }
        const domain = DOMAIN_MAP[pid];
        if (domain) {
            if (!byDomain.has(domain)) {
                byDomain.set(domain, []);
            }
            byDomain.get(domain)!.push(pid);
        }
        if (citations_for(pid).length === 0) {
            missingCitations.push(pid);
        }
    }

    const overflows = new Map<string, string[]>();
    for (const [d, ids] of byDomain) {
        if (ids.length > PER_DOMAIN_CAP) {
            overflows.set(d, ids);
        }
    }

    for (const d of [...byDomain.keys()].sort()) {
        const ids = byDomain.get(d)!;
        const marker = overflows.has(d) ? '❌' : '✅';
        emit(`${marker}  domain=${d}  ${ids.length}/${PER_DOMAIN_CAP}  ${[...ids].sort().join(', ')}`);
    }
    for (const pid of [...missingCitations].sort()) {
        emit(`⚠️   no-skill-citation  ${pid}  (warn — see PR-time gate)`);
    }

    if (overflows.size > 0) {
        process.stderr.write('\npersona-governance: per-domain cap violated.\n');
        for (const d of [...overflows.keys()].sort()) {
            const ids = overflows.get(d)!;
            process.stderr.write(
                `  - domain '${d}' has ${ids.length} specialists (cap ${PER_DOMAIN_CAP}): ${[...ids].sort().join(', ')}\n`,
            );
        }
        return 1;
    }

    let active = 0;
    for (const [, t, s] of personas) {
        if (s !== 'deprecated' && t === 'specialist') {
            active += 1;
        }
    }
    const cited = active - missingCitations.length;
    emit(
        `persona-governance: ${active} active specialist persona(s) — all domains within cap; ${cited}/${active} cited by ≥ 1 skill.`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO,
    PERSONA_DIR,
    DOMAIN_MAP,
    PER_DOMAIN_CAP,
    parse_frontmatter,
    collect_personas,
    citations_for,
    main,
};
