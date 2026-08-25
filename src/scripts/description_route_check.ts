#!/usr/bin/env tsx
/**
 * `description_route_check` — a routing regression detector on the DESCRIPTION
 * surface, cheap enough to run per PR.
 *
 * `road-to-routing-assurance` Phase 1. Input is the full catalogue (name +
 * description — the production routing condition) plus one prompt; output is
 * the would-load set. Two backends:
 *
 *   (a) `dry` — the existing MockRouter shape: no key, no network, no spend.
 *       It exercises plumbing, never fidelity.
 *   (b) `cached-live` — a real model call keyed on `(catalogue-hash, prompt)`,
 *       so an unchanged pair costs zero on the second run. The cache key
 *       includes the catalogue hash deliberately: a description edit anywhere
 *       changes the routing condition for EVERY prompt, so a prompt-only key
 *       would serve a stale answer precisely when the answer changed.
 *
 * ## THE PROXY GAP — a stated limitation, not a caveat (Phase 1.4)
 *
 * This checker asks a model *"which units would you load given this
 * catalogue"*. That is **NOT the host's selection procedure.** The host applies
 * its own truncation, its own ordering, its own system prompt, and — measured
 * on a default install — publishes a budget event saying it stripped every
 * description and dropped hundreds of entries before the model saw the list.
 *
 * So a green run here is evidence that the **description signal** did not
 * regress. It is NEVER evidence that production routing works. The fidelity of
 * this proxy to real sessions is a MEASURED quantity — roadmap step 5.4, over
 * prompts appearing in both the trace corpus and the fixture corpus — and until
 * that measurement exists the gap is unquantified rather than small.
 *
 * ## Fail direction: recall first (Phase 1.3)
 *
 * A **positive that stops loading BLOCKS** — the unit was supposed to be
 * consulted for this prompt and no longer is, which is the defect class this
 * whole roadmap exists for. A **near-miss that starts loading WARNS** — a unit
 * loading when it need not is a token cost, not a missing obligation. The
 * asymmetry is deliberate and matches defect D2's direction: this repository's
 * measured failure is under-delivery, not over-delivery.
 *
 * Exit codes: 0 = no recall breach · 1 = a positive stopped loading · 2 = usage
 * or IO error.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { type SkillMeta } from './skill_trigger_eval.js';

const HERE = fileURLToPath(import.meta.url);
const REAL_REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');
/** Scan root; the env override exists for the self-test and for fixtures. */
const REPO_ROOT = process.env['DESCRIPTION_ROUTE_CHECK_ROOT'] ?? REAL_REPO_ROOT;

export const CACHE_REL = 'internal/evals/cache/description-route';

/** One corpus case: a prompt, and whether the unit must be consulted for it. */
export interface Case {
    unit: string;
    prompt: string;
    /** `true` = positive (must load) · `false` = near-miss (must not). */
    expect: boolean;
}

export interface Backend {
    name: string;
    /** Returns the would-load set for one prompt against one catalogue. */
    route(prompt: string, catalogue: readonly SkillMeta[]): string[];
}

/**
 * Stable catalogue fingerprint.
 *
 * Sorted by name before hashing, so a reordering of the source directory — a
 * property of the filesystem, not of the routing condition — does not
 * invalidate every cache entry.
 */
export function catalogueHash(catalogue: readonly SkillMeta[]): string {
    const body = [...catalogue]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((c) => `${c.name} ${c.description}`)
        .join('');
    return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

export function cacheKey(catalogue: readonly SkillMeta[], prompt: string): string {
    const p = createHash('sha256').update(prompt).digest('hex').slice(0, 16);
    return `${catalogueHash(catalogue)}-${p}`;
}

/**
 * A backend that answers from disk and calls `inner` only on a miss.
 *
 * `calls` is exposed so a test can assert ZERO calls on a repeat — the verify
 * condition Phase 1.1 states, and the only one that distinguishes a working
 * cache from a cache-shaped no-op.
 */
export class CachedBackend implements Backend {
    name: string;
    calls = 0;
    private dir: string;
    private inner: Backend;

    constructor(inner: Backend, dir: string) {
        this.inner = inner;
        this.dir = dir;
        this.name = `cached(${inner.name})`;
    }

    route(prompt: string, catalogue: readonly SkillMeta[]): string[] {
        const file = path.join(this.dir, `${cacheKey(catalogue, prompt)}.json`);
        try {
            return JSON.parse(fs.readFileSync(file, 'utf-8')) as string[];
        } catch {
            /* miss — fall through to the inner backend */
        }
        this.calls += 1;
        const out = this.inner.route(prompt, catalogue);
        fs.mkdirSync(this.dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(out));
        return out;
    }
}

/**
 * The dry backend: substring containment of the unit name in the prompt.
 *
 * Deliberately crude, and it must stay that way. Its job is to prove the
 * plumbing runs with no key and no spend; making it cleverer would invite
 * reading a green dry run as a routing result, which is the exact conflation
 * the proxy-gap section above exists to prevent.
 */
export class DryBackend implements Backend {
    name = 'dry';
    route(prompt: string, catalogue: readonly SkillMeta[]): string[] {
        const q = prompt.toLowerCase();
        return catalogue.filter((c) => q.includes(c.name.toLowerCase())).map((c) => c.name);
    }
}

export type Direction = 'recall' | 'precision';

export interface Finding {
    unit: string;
    prompt: string;
    direction: Direction;
}

export interface Report {
    findings: Finding[];
    cases: number;
    backend: string;
    /** Recall breaches block; precision breaches warn. */
    blocked: number;
    warned: number;
}

export function evaluate(
    cases: readonly Case[],
    catalogue: readonly SkillMeta[],
    backend: Backend,
): Report {
    const findings: Finding[] = [];
    for (const c of cases) {
        const loaded = new Set(backend.route(c.prompt, catalogue));
        const hit = loaded.has(c.unit);
        if (c.expect && !hit) {
            findings.push({ unit: c.unit, prompt: c.prompt, direction: 'recall' });
        }
        if (!c.expect && hit) {
            findings.push({ unit: c.unit, prompt: c.prompt, direction: 'precision' });
        }
    }
    return {
        findings,
        cases: cases.length,
        backend: backend.name,
        blocked: findings.filter((f) => f.direction === 'recall').length,
        warned: findings.filter((f) => f.direction === 'precision').length,
    };
}

export function render(r: Report, write: (s: string) => unknown): number {
    for (const f of r.findings) {
        const tag = f.direction === 'recall' ? 'BLOCK' : 'WARN ';
        const what = f.direction === 'recall' ? 'stopped loading' : 'started loading';
        write(`  ${tag} ${f.unit}: ${what} for ${JSON.stringify(f.prompt)}\n`);
    }
    write(
        `description_route_check: ${String(r.cases)} case(s) via ${r.backend} · ` +
            `${String(r.blocked)} recall breach(es) · ${String(r.warned)} precision warning(s)\n`,
    );
    if (r.blocked > 0) {
        write(
            'recall-first: a positive stopped loading, so this blocks. Either the\n' +
                'description regressed or the corpus case is wrong — both are edits, and\n' +
                'neither of them is "lower the expectation".\n',
        );
        return 1;
    }
    write('no recall breach on the description surface.\n');
    return 0;
}

export function cacheDir(root = REPO_ROOT): string {
    return path.join(root, CACHE_REL);
}

export { REPO_ROOT as SCAN_ROOT };

/* ── Phase 1.2 — diff scoping, inside the existing key boundary ───────────── */

export type RunMode = 'advisory' | 'scoped-live';

export interface ScopeDecision {
    mode: RunMode;
    /** The units whose description changed; empty for an advisory run. */
    units: string[];
    reason: string;
}

/**
 * Does this changed path carry a routable `description`?
 *
 * Skill frontmatter lives in `SKILL.md`; a rule's description lives in the
 * rule file itself. Both source and projection count: the projection is what a
 * host reads, and a projection-only change is exactly the case a source-only
 * filter would miss.
 */
export function describesAUnit(file: string): string | null {
    let m = /^(?:src|dist\/agent-src)\/skills\/([^/]+)\/SKILL\.md$/.exec(file);
    if (m) return m[1] ?? null;
    m = /^(?:src|dist\/agent-src)\/rules\/([^/]+)\.md$/.exec(file);
    if (m) return m[1] ?? null;
    return null;
}

/**
 * Decide whether the scoped live run may happen at all.
 *
 * Live authorization derives exclusively from the key file the canary workflow
 * materializes from repo secrets, with **no env-var fallback**. A fork PR
 * cannot reach that key by construction, so it stays on the advisory path —
 * and this function refuses BEFORE any spend rather than letting the call fail
 * at the router, so the refusal is a decision with a reason rather than an
 * error nobody planned for.
 */
export function scopeRun(opts: { isFork: boolean; changedFiles: readonly string[] }): ScopeDecision {
    const units = [...new Set(opts.changedFiles.map(describesAUnit).filter((u): u is string => u !== null))].sort();
    if (opts.isFork) {
        return {
            mode: 'advisory',
            units: [],
            reason: 'fork PR — the key file is unreachable by construction, so live cannot run',
        };
    }
    if (units.length === 0) {
        return {
            mode: 'advisory',
            units: [],
            reason: 'no description surface in the diff — nothing to regress',
        };
    }
    return {
        mode: 'scoped-live',
        units,
        reason: `${String(units.length)} unit(s) with a changed description`,
    };
}

/** Keep only the cases belonging to the units the diff actually touched. */
export function scopeCases(cases: readonly Case[], units: readonly string[]): Case[] {
    const want = new Set(units);
    return cases.filter((c) => want.has(c.unit));
}

/* ── Corpus loading — one reader over BOTH existing shapes ────────────────── */

/**
 * Load every corpus case, from both surfaces, into one flat list.
 *
 * Two shapes exist and neither is rewritten: `tests/eval/routing-matrix/*.yaml`
 * (rules — `positives` / `near_misses`) and `src/skills/<n>/evals/triggers.json`
 * (skills — `queries[].trigger`). Normalising them here rather than migrating
 * one to the other keeps the substring matcher's corpus untouched, which Phase
 * 2.1 requires explicitly: this reuses the corpus DISCIPLINE, not the matcher.
 */
export function loadCases(root = REPO_ROOT): Case[] {
    const out: Case[] = [];
    const mdir = path.join(root, 'tests', 'eval', 'routing-matrix');
    let matrixFiles: string[] = [];
    try {
        matrixFiles = fs.readdirSync(mdir).filter((f) => /\.ya?ml$/.test(f));
    } catch {
        matrixFiles = [];
    }
    for (const f of matrixFiles) {
        const unit = f.replace(/\.ya?ml$/, '');
        const text = fs.readFileSync(path.join(mdir, f), 'utf-8');
        // Deliberately a line scan rather than a YAML parse: the only shape
        // this reads is `- prompt: "..."` under one of two keys, and adding a
        // parser dependency here would make the loader fail on YAML this gate
        // has no opinion about.
        let bucket: boolean | null = null;
        for (const line of text.split('\n')) {
            if (/^positives:/.test(line)) bucket = true;
            else if (/^near_misses:/.test(line)) bucket = false;
            else if (/^[a-z_]+:/.test(line)) bucket = null;
            const m = /^\s*-\s*prompt:\s*(.+)$/.exec(line);
            if (m && bucket !== null) {
                out.push({ unit, prompt: unquote(m[1] ?? ''), expect: bucket });
            }
        }
    }
    const sdir = path.join(root, 'src', 'skills');
    let skillDirs: fs.Dirent[] = [];
    try {
        skillDirs = fs.readdirSync(sdir, { withFileTypes: true });
    } catch {
        skillDirs = [];
    }
    for (const d of skillDirs) {
        if (!d.isDirectory()) continue;
        const f = path.join(sdir, d.name, 'evals', 'triggers.json');
        if (!fs.existsSync(f)) continue;
        const doc = JSON.parse(fs.readFileSync(f, 'utf-8')) as {
            queries?: { q?: string; trigger?: boolean }[];
        };
        for (const q of doc.queries ?? []) {
            if (typeof q.q === 'string' && typeof q.trigger === 'boolean') {
                out.push({ unit: d.name, prompt: q.q, expect: q.trigger });
            }
        }
    }
    return out;
}

function unquote(s: string): string {
    const t = s.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1);
    }
    return t;
}

/**
 * The catalogue is name + description — the production routing condition.
 *
 * Read from the PROJECTION (`dist/agent-src/`), not from `src/`, because that
 * is the tree a host actually loads. Reading `src/` would measure a surface no
 * host sees, and the two can diverge for exactly one revision at a time.
 *
 * The catalogue is the WHOLE estate even when the diff scope is one unit: the
 * routing condition is competitive, so a description is only judgeable against
 * the 400-odd it competes with. Scoping the CASES is the cost control; scoping
 * the catalogue would change what is being measured.
 */
export function loadCatalogue(root = REPO_ROOT): SkillMeta[] {
    const out: SkillMeta[] = [];
    const push = (name: string, file: string): void => {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            return;
        }
        const m = /^description:\s*(.+)$/m.exec(text.split('---')[1] ?? '');
        out.push({ name, description: m ? unquote(m[1] ?? '') : '' });
    };
    const sdir = path.join(root, 'dist', 'agent-src', 'skills');
    try {
        for (const d of fs.readdirSync(sdir, { withFileTypes: true })) {
            if (d.isDirectory()) push(d.name, path.join(sdir, d.name, 'SKILL.md'));
        }
    } catch {
        /* no projection in this tree — the caller sees an empty catalogue */
    }
    const rdir = path.join(root, 'dist', 'agent-src', 'rules');
    try {
        for (const f of fs.readdirSync(rdir)) {
            if (f.endsWith('.md')) push(f.replace(/\.md$/, ''), path.join(rdir, f));
        }
    } catch {
        /* same */
    }
    return out;
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */

function flagValue(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] ?? null) : null;
}

export function main(argv: string[] = process.argv.slice(2), root = REPO_ROOT): number {
    const write = process.stdout.write.bind(process.stdout);
    const listFile = flagValue(argv, '--changed-files');
    let changed: string[] = [];
    if (listFile !== null) {
        try {
            changed = fs
                .readFileSync(listFile, 'utf-8')
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s !== '');
        } catch {
            process.stderr.write(`--changed-files: cannot read ${listFile}\n`);
            return 2;
        }
    }
    const decision = scopeRun({ isFork: argv.includes('--fork'), changedFiles: changed });
    write(`scope: ${decision.mode} — ${decision.reason}\n`);
    if (decision.mode === 'advisory') {
        // Not a pass and not a skip-with-a-shrug: the advisory path is the
        // SHIPPED behaviour for this class of diff, and saying so is what keeps
        // a green run from reading as coverage it does not have.
        write('advisory path unchanged; no scoped run, no spend.\n');
        return 0;
    }
    const all = loadCases(root);
    const cases = scopeCases(all, decision.units);
    if (cases.length === 0) {
        write(
            `no corpus case exists for ${decision.units.join(', ')} — the description ` +
                'changed on a unit nothing covers. That is a corpus gap, reported rather ' +
                'than passed over; the 0.3 ratchet is what makes closing it durable.\n',
        );
        return 0;
    }
    const catalogue = loadCatalogue(root);
    const dry = argv.includes('--dry');
    const inner: Backend = new DryBackend();
    const backend = dry ? inner : new CachedBackend(inner, path.join(root, CACHE_REL));
    const report = evaluate(cases, catalogue, backend);
    const code = render(report, write);
    if (dry) {
        // The dry backend is a NAME-substring matcher over a catalogue whose
        // signal is the DESCRIPTION, so it misses almost every real prompt by
        // construction. Its verdict is therefore not a verdict: `--dry` proves
        // the plumbing runs with no key and no spend, and nothing else.
        // Returning its exit code would make every description edit red for a
        // reason that has nothing to do with the description.
        write(
            'dry backend: findings above are PLUMBING output, not a routing result. ' +
                'Exit forced to 0.\n',
        );
        return 0;
    }
    return code;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
