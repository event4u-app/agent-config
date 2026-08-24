#!/usr/bin/env tsx
/**
 * Enforcement-coverage gate — how many rules have a backstop that actually runs.
 *
 * This package's positioning is falsifiability, and its own doctrine says a MUST
 * that depends on agent self-report is honor-system theatre. That doctrine had
 * no instrument: 107 rules carry `type / tier / description / …` and not one
 * field said what enforces them. This script is that instrument.
 *
 * The load-bearing design choice is **resolution over declaration**. A rule that
 * declares `validator:src/scripts/lint_x.ts` is NOT counted as enforced merely
 * because the file exists — the script must also be *reachable*: referenced from
 * a taskfile, a GitHub workflow, or the hook manifest. A linter that ships and
 * runs nowhere is exactly the defect this gate exists to surface, and a
 * declaration-only checker would rate it green. (Found on the first run:
 * `lint_output_slop.ts` is wired nowhere while `output-discipline` asserts in
 * shipped prose that violations cause a CI exit-code-2.)
 *
 * Second choice: **blocking and instrumenting are different tiers.** A hook
 * registered `fail_closed: false` cannot fail a build; it writes evidence. It
 * resolves to `observer`, never `validator`, and declaring it as one is reported
 * as a misdeclaration rather than silently accepted.
 *
 * `none` is a legal, counted value. An honest recorded gap is worth more than a
 * false claim of coverage — that is the whole point of the exercise.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_enforcement_coverage            # report
 *   ./scripts-run src/scripts/check_enforcement_coverage --json     # machine
 *   ./scripts-run src/scripts/check_enforcement_coverage --check    # ratchet
 *   ./scripts-run src/scripts/check_enforcement_coverage --write-baseline
 *
 * Exit codes: 0 ok · 1 ratchet regression (--check) · 2 usage/env error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { count as count_artefacts } from './update_counts.js';
import { KERNEL_RULE_ID_SET } from './_lib/kernel_rules.js';
import {
    carrier_frequency_by_platform,
    covers,
    covers_any,
    is_frequency,
    parse_hook_platforms,
    type Frequency,
    type PlatformBinding,
} from './_lib/obligation_frequency.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');
const RULES_DIR = path.join(REPO_ROOT, 'src', 'rules');
const HOOK_MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const BASELINE = path.join(REPO_ROOT, 'internal', 'reports', 'enforcement-coverage.json');

/**
 * Two wiring corpora, deliberately separate.
 *
 * The first version treated `taskfiles/` and `.github/workflows/` as one bag, so
 * "named in a taskfile" resolved to `validator` and counted under a headline that
 * read "can actually fail a build". Which build? **No workflow invokes `task ci`,
 * `ci-strict`, or `ci-fast`** — only the narrow `ci-cloud-bundle` and
 * `ci-linear-digest`. So for a taskfile-only validator the honest answer was
 * "a local run someone starts by hand", and the number said otherwise.
 *
 * That is the same defect the coverage gate was built to catch — a check whose
 * wiring is weaker than the claim about it — committed by the gate itself. Hence
 * the split: `validator` means CI runs it, `validator-local` means a human does.
 */
const WORKFLOW_DIRS = [path.join(REPO_ROOT, '.github', 'workflows')];
const TASK_DIRS = [path.join(REPO_ROOT, 'taskfiles')];
const TASK_FILES = [path.join(REPO_ROOT, 'Taskfile.yml'), HOOK_MANIFEST];

export type Resolution =
    | 'validator'       // reachable from a WORKFLOW — CI fails without a human
    | 'validator-local' // reachable only from a taskfile — fails a run someone starts
    | 'test'            // test file exists; the suite runs it
    | 'hook'            // registered in the hook manifest with fail_closed: true
    | 'observer'        // instruments only — never blocks
    | 'unwired'         // declared script exists but nothing runs it  ← the D1 class
    | 'missing'         // declared target does not exist at all
    | 'none';           // honest, recorded gap — `instruction-only: <reason>`, or the retired bare `none`

/**
 * Whether the carrier's firing set covers the obligation's — the question
 * `effective` does not answer.
 *
 * `covered`      — some declared carrier covers the obligation on every
 *                  hook-capable platform.
 * `gap`          — at least one hook-capable platform where no declared carrier
 *                  covers it. `gap_platforms` names them.
 * `declared-gap` — the rule declares `instruction-only:` (or the retired `none`);
 *                  the gap is stated in
 *                  the rule's own text, so it is honest, not a defect.
 * `unclassified` — no `obligation_frequency` to join against. The nine kernel
 *                  rules sit here: `block_kernel_rule_writes.ts` denies agent
 *                  writes to them, so the field cannot be populated by the same
 *                  pass that populated the other 105.
 * `unmeasured`   — the rule declares no carrier at all; model-carried by design,
 *                  making no claim this join could falsify.
 */
export type FrequencyVerdict = 'covered' | 'gap' | 'declared-gap' | 'unclassified' | 'unmeasured';

export interface RuleCoverage {
    id: string;
    tier: string;
    type: string;
    declared: string[];
    resolutions: Resolution[];
    /** Strongest resolution, by the ordering in `RANK`. */
    effective: Resolution;
    notes: string[];
    /** Declared obligation period (frontmatter), or null when undeclared. */
    obligation_frequency: Frequency | null;
    /**
     * Carrier period per hook-capable platform — never a single scalar.
     *
     * A scalar is wrong twice over: copilot has no hook surface at all, so a
     * weakest-platform collapse turns one platform property into a finding on
     * every hook-carried rule; and cline maps `stop` from `TaskCancel`, so the
     * same slot means per-turn on six platforms and per-interruption there. Both
     * are invisible in one number.
     */
    carrier_frequency: Record<string, string> | null;
    frequency_verdict: FrequencyVerdict;
    /** Hook-capable platforms where no declared carrier covers the obligation. */
    gap_platforms: string[];
}

/** Strength order — a rule is credited with its strongest resolving backstop. */
const RANK: Resolution[] = [
    'validator',
    'test',
    'hook',
    'validator-local',
    'observer',
    'unwired',
    'missing',
    'none',
];

/**
 * A resolution that fails a CI build — the headline number.
 *
 * `validator-local` is NOT here, and that is the whole correction. It ranks above
 * `observer` (it does block *something*) and below `hook` (which fires in the
 * agent runtime without anyone asking), but a gate only a human can start is not
 * what "can fail a build" means to a reader.
 */
const BLOCKING: ReadonlySet<Resolution> = new Set<Resolution>(['validator', 'test', 'hook']);

// ---------------------------------------------------------------- frontmatter

/**
 * Read frontmatter, keeping list values as arrays.
 *
 * `measure_rule_budget.strip_frontmatter` is scalar-only by design; `enforced_by`
 * is a list, so this reader handles both `key: [a, b]` and block `- item` form.
 * Deliberately not a general YAML parser: the accepted shape is exactly what the
 * rule schema permits, and anything else is left for the schema validator to
 * reject rather than silently coerced here.
 */
export function read_frontmatter(text: string): Record<string, string | string[]> {
    if (!text.startsWith('---\n')) return {};
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return {};
    const out: Record<string, string | string[]> = {};
    const lines = text.slice(4, end).split('\n');

    let pending_key: string | null = null;
    let pending_list: string[] = [];

    const flush = (): void => {
        if (pending_key !== null) {
            out[pending_key] = pending_list;
            pending_key = null;
            pending_list = [];
        }
    };

    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.trimStart().startsWith('#')) continue;

        const block_item = /^\s+-\s+(.*)$/.exec(line);
        const item_value = block_item?.[1];
        if (item_value !== undefined && pending_key !== null) {
            pending_list.push(unquote(item_value.trim()));
            continue;
        }
        flush();

        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();

        if (val === '') {
            // Either a block list follows, or an empty scalar. Assume list; if no
            // item follows, flush() records an empty array, which reads as absent.
            pending_key = key;
            pending_list = [];
            continue;
        }
        if (val.startsWith('[') && val.endsWith(']')) {
            const inner = val.slice(1, -1).trim();
            out[key] = inner === '' ? [] : inner.split(',').map((s) => unquote(s.trim()));
            continue;
        }
        out[key] = unquote(val);
    }
    flush();
    return out;
}

function unquote(s: string): string {
    if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
        return s.slice(1, -1);
    }
    return s;
}

// ------------------------------------------------------------------- wiring

/**
 * Every file whose text decides whether a script is reachable.
 *
 * Read once and concatenated: the question is only ever "does this path appear
 * anywhere that runs things", so a single haystack is both correct and cheap.
 */
function load_corpus(dirs: readonly string[], files: readonly string[] = []): string {
    const parts: string[] = [];
    for (const f of files) {
        if (fs.existsSync(f)) parts.push(fs.readFileSync(f, 'utf-8'));
    }
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        for (const entry of walk(dir)) {
            if (/\.(ya?ml)$/.test(entry)) parts.push(fs.readFileSync(entry, 'utf-8'));
        }
    }
    return parts.join('\n');
}

/**
 * Scripts reachable from a CI entry point, following umbrella indirection.
 *
 * A direct-mention test is not sufficient and the miss is not hypothetical:
 * `lint_skill_frontmatter_safety.ts` is never named in a taskfile, yet it runs on
 * every CI pass as a sub-check of the `lint_agent_security` umbrella, which is.
 * Reporting it unwired would be a false alarm — the same defect class, pointed
 * the other way. So reachability is transitive: seed with the scripts CI names
 * directly, then expand through the scripts those name, to a fixed point.
 *
 * Deliberately NOT part of the seed: `_dispatch.bash`. A CLI subcommand is
 * something a human or agent may invoke; enforcement is something that runs
 * whether or not anyone chooses to. Conflating the two is how a package ends up
 * believing an on-demand tool is a gate.
 */
function reachable_scripts(wiring: string): Set<string> {
    const scripts_dir = path.join(REPO_ROOT, 'src', 'scripts');
    const all: string[] = fs.existsSync(scripts_dir)
        ? walk(scripts_dir).filter((p) => p.endsWith('.ts'))
        : [];

    const rel = (abs: string): string => path.relative(REPO_ROOT, abs);
    const stem = (abs: string): string => path.basename(abs).replace(/\.ts$/, '');

    const reached = new Set<string>();
    for (const abs of all) {
        if (wiring.includes(rel(abs)) || wiring.includes(stem(abs))) reached.add(rel(abs));
    }

    let grew = true;
    while (grew) {
        grew = false;
        const frontier = [...reached];
        const bodies = frontier
            .map((r) => {
                const abs = path.join(REPO_ROOT, r);
                return fs.existsSync(abs) ? strip_comments(fs.readFileSync(abs, 'utf-8')) : '';
            })
            .join('\n');
        for (const abs of all) {
            const r = rel(abs);
            if (reached.has(r)) continue;
            if (mentions_as_code(bodies, path.basename(abs), stem(abs))) {
                reached.add(r);
                grew = true;
            }
        }
    }
    return reached;
}

/**
 * Drop comments before deciding whether one script invokes another.
 *
 * This function exists because its absence produced a live false negative. The
 * first version matched any textual occurrence, so the moment THIS file's own
 * docstring named `lint_output_slop.ts` as an example of an unwired linter, the
 * closure "reached" it and the gate reported the very defect it was built to
 * catch as fixed. A prose mention is not a call.
 *
 * That is the general class: a check that matches on substring presence rather
 * than on the resolved structure is fail-open by construction. Stripping
 * comments and requiring a quoted specifier is the narrow structural test —
 * invocation always goes through a path string or an import specifier.
 */
export function strip_comments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n')
        .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
        .join('\n');
}

/** True when `base`/`stem` appears inside a quoted specifier — an invocation shape. */
export function mentions_as_code(haystack: string, base: string, stem: string): boolean {
    for (const needle of [base, stem]) {
        const q = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`['"\`][^'"\`]*${q}[^'"\`]*['"\`]`).test(haystack)) return true;
    }
    return false;
}

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...walk(p));
        else out.push(p);
    }
    return out;
}

/**
 * Hook name → whether it can fail a build.
 *
 * Parsed with a narrow reader rather than a YAML dependency: the manifest's
 * `concerns:` block is a fixed two-level shape, and the only fact needed is the
 * `fail_closed` flag per concern.
 */
export function parse_hook_manifest(text: string): Map<string, boolean> {
    const out = new Map<string, boolean>();
    let in_concerns = false;
    let current: string | null = null;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (/^concerns:\s*$/.test(line)) { in_concerns = true; continue; }
        if (!in_concerns) continue;
        if (/^\S/.test(line)) break; // left the concerns block

        const concern_name = /^ {2}([a-z0-9_-]+):\s*$/.exec(line)?.[1];
        if (concern_name !== undefined) {
            current = concern_name;
            out.set(current, false);
            continue;
        }
        const fc = /^\s+fail_closed:\s*(true|false)\s*$/.exec(line)?.[1];
        if (fc !== undefined && current !== null) out.set(current, fc === 'true');
    }
    return out;
}

// ---------------------------------------------------------------- resolution

export function resolve_one(
    decl: string,
    ctx: {
        /** Scripts reachable from a GitHub workflow (transitively). */
        reachable_ci: Set<string>;
        /** Scripts reachable from a taskfile or the hook manifest (transitively). */
        reachable_local: Set<string>;
        hooks: Map<string, boolean>;
        exists: (rel: string) => boolean;
    },
): { resolution: Resolution; note?: string } {
    // `none` stays legal and counted — an honest gap beats a false claim — but it
    // is the RETIRED spelling. `instruction-only: <reason>` is the same effective
    // level with the triage record attached, because "nothing enforces this" and
    // "nothing enforces this AND here is why that is the right call" are not the
    // same statement, and only the second one survives review. The one remaining
    // `none` is `non-destructive-by-default`, a kernel rule that
    // `block_kernel_rule_writes` denies agent writes to — see
    // `agents/roadmaps/stubs/road-to-kernel-instruction-only-migration.md`.
    if (decl === 'none') return { resolution: 'none' };

    if (decl === 'instruction-only' || decl.startsWith('instruction-only:')) {
        const reason = decl.slice('instruction-only:'.length).trim();
        if (decl === 'instruction-only' || reason === '') {
            // A bare marker is not a triage record. `missing` is the honest slot:
            // the declaration names a mechanism it never supplies, and `missing`
            // is what the `--check` ratchet reds on.
            return {
                resolution: 'missing',
                note:
                    'instruction-only declared with no reason — a reason is a triage record, ' +
                    'not a pass. State in one line why this obligation is model-carried.',
            };
        }
        return { resolution: 'none' };
    }

    const idx = decl.indexOf(':');
    const kind = decl.slice(0, idx);
    const target = decl.slice(idx + 1);

    if (kind === 'observer') return { resolution: 'observer' };

    if (kind === 'hook') {
        if (!ctx.hooks.has(target)) {
            return { resolution: 'missing', note: `hook '${target}' is not registered in hook_manifest.yaml` };
        }
        if (!ctx.hooks.get(target)) {
            // Registered but non-blocking. It instruments; it does not enforce.
            return {
                resolution: 'observer',
                note: `hook '${target}' is fail_closed: false — it instruments, it cannot block; counted as observer`,
            };
        }
        return { resolution: 'hook' };
    }

    if (kind === 'test') {
        return ctx.exists(target)
            ? { resolution: 'test' }
            : { resolution: 'missing', note: `test path does not exist: ${target}` };
    }

    if (kind === 'validator') {
        if (!ctx.exists(target)) {
            return { resolution: 'missing', note: `validator script does not exist: ${target}` };
        }
        // Resolution, not declaration — and now: reachable from WHAT.
        if (ctx.reachable_ci.has(target)) return { resolution: 'validator' };
        if (ctx.reachable_local.has(target)) {
            return {
                resolution: 'validator-local',
                note: `validator '${target}' is reachable only from a taskfile — no workflow runs it, so it fails a local run someone starts, not a CI build`,
            };
        }
        return {
            resolution: 'unwired',
            note: `validator '${target}' exists but is referenced by no taskfile, workflow, or hook manifest — it runs nowhere`,
        };
    }

    return { resolution: 'missing', note: `unrecognised enforced_by form: ${decl}` };
}

export function strongest(resolutions: Resolution[]): Resolution {
    if (resolutions.length === 0) return 'none';
    let best: Resolution = 'none';
    let best_rank = Number.POSITIVE_INFINITY;
    for (const r of resolutions) {
        const rank = RANK.indexOf(r);
        if (rank < best_rank) {
            best = r;
            best_rank = rank;
        }
    }
    return best;
}

// ----------------------------------------------------------- frequency join

/**
 * Join a rule's declared obligation period against its carriers' firing periods.
 *
 * Runs per hook-capable platform, never as one scalar. A rule is covered only
 * when SOME declared carrier covers it on EVERY hook-capable platform; the
 * platforms where none does are named, because "uncovered on windsurf" and
 * "uncovered everywhere" are different findings with different fixes.
 *
 * `validator:` / `test:` carriers are SWEEP carriers — they fire once and read
 * the whole tree, so their reach is bounded by what lands in an artefact rather
 * than by how often they run. Modelling them as per-commit point carriers would
 * make every `validator:`-carried rule with a per-edit obligation a finding at
 * once: one modelling error rendered as a fifth of the corpus.
 */
export function join_frequency(
    obligation: Frequency | null,
    declared: string[],
    binding: PlatformBinding,
): {
    verdict: FrequencyVerdict;
    carrier_frequency: Record<string, string> | null;
    gap_platforms: string[];
} {
    if (obligation === null) {
        return { verdict: 'unclassified', carrier_frequency: null, gap_platforms: [] };
    }
    if (declared.length === 0) {
        return { verdict: 'unmeasured', carrier_frequency: null, gap_platforms: [] };
    }
    // `instruction-only:` is the same declared gap as `none`, with its reason
    // attached; a rule that spelled it the new way must not become a frequency
    // finding for doing so.
    if (declared.every((d) => d === 'none' || d.startsWith('instruction-only:'))) {
        return { verdict: 'declared-gap', carrier_frequency: null, gap_platforms: [] };
    }

    const has_sweep = declared.some((d) => d.startsWith('validator:') || d.startsWith('test:'));
    const hook_concerns = declared
        .filter((d) => d.startsWith('hook:'))
        .map((d) => d.slice('hook:'.length));

    const per_platform: Record<string, string> = {};
    const gap_platforms: string[] = [];

    for (const platform of binding.slots.keys()) {
        if (binding.fallback_only.has(platform)) continue;

        let covered = false;
        const seen: Frequency[] = [];

        if (has_sweep && covers({ frequency: 'per-commit', mode: 'sweep' }, obligation)) {
            covered = true;
        }
        for (const concern of hook_concerns) {
            for (const f of carrier_frequency_by_platform(concern, binding)[platform] ?? []) {
                if (!seen.includes(f)) seen.push(f);
            }
        }
        if (covers_any(seen, obligation)) covered = true;

        per_platform[platform] =
            seen.length > 0 ? seen.join('+') : has_sweep ? 'sweep' : 'absent';
        if (!covered) gap_platforms.push(platform);
    }

    return {
        verdict: gap_platforms.length === 0 ? 'covered' : 'gap',
        carrier_frequency: per_platform,
        gap_platforms,
    };
}

// -------------------------------------------------------------------- report

export function collect(): RuleCoverage[] {
    const ci_corpus = load_corpus(WORKFLOW_DIRS);
    const local_corpus = load_corpus(TASK_DIRS, TASK_FILES);
    const manifest_text = fs.existsSync(HOOK_MANIFEST)
        ? fs.readFileSync(HOOK_MANIFEST, 'utf-8')
        : '';
    const hooks = manifest_text ? parse_hook_manifest(manifest_text) : new Map<string, boolean>();
    const binding = parse_hook_platforms(manifest_text);
    const exists = (rel: string): boolean => fs.existsSync(path.join(REPO_ROOT, rel));
    // Seeded separately so the umbrella expansion answers "reachable from CI"
    // rather than "reachable from anything". The expansion itself was correct;
    // it was the seed that conflated the two.
    const reachable_ci = reachable_scripts(ci_corpus);
    const reachable_local = reachable_scripts(`${ci_corpus}\n${local_corpus}`);

    const out: RuleCoverage[] = [];
    for (const name of fs.readdirSync(RULES_DIR).sort()) {
        if (!name.endsWith('.md')) continue;
        const fm = read_frontmatter(fs.readFileSync(path.join(RULES_DIR, name), 'utf-8'));
        const raw = fm['enforced_by'];
        const declared = Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? [raw] : [];

        const resolutions: Resolution[] = [];
        const notes: string[] = [];
        for (const d of declared) {
            const { resolution, note } = resolve_one(d, { reachable_ci, reachable_local, hooks, exists });
            resolutions.push(resolution);
            if (note) notes.push(note);
        }
        const id = name.replace(/\.md$/, '');
        const raw_freq = fm['obligation_frequency'];
        const obligation: Frequency | null = is_frequency(raw_freq) ? raw_freq : null;
        const { verdict, carrier_frequency, gap_platforms } = join_frequency(
            obligation,
            declared,
            binding,
        );
        // Say WHY a row is unclassified. For the nine kernel rules the answer is
        // structural rather than an authoring lapse — block_kernel_rule_writes
        // denies the write — and a reader who cannot tell those apart will read
        // the same bucket as either "expected" or "someone forgot".
        if (verdict === 'unclassified' && KERNEL_RULE_ID_SET.has(id)) {
            notes.push(
                'no obligation_frequency: kernel rule, and block_kernel_rule_writes denies ' +
                    'the write with no agent-accessible override',
            );
        }
        out.push({
            id,
            tier: String(fm['tier'] ?? '—'),
            type: String(fm['type'] ?? '—'),
            declared,
            resolutions,
            effective: strongest(resolutions),
            notes,
            obligation_frequency: obligation,
            carrier_frequency,
            frequency_verdict: verdict,
            gap_platforms,
        });
    }
    return out;
}

export interface Summary {
    total: number;
    declared: number;
    /** Fails a CI build without a human starting anything. The headline. */
    blocking: number;
    /** Reachable only from a taskfile — reported beside the headline, never folded in. */
    local_only: number;
    observer: number;
    unwired: number;
    missing: number;
    undeclared: number;
    blocking_pct: number;
    /**
     * Rules whose declared carrier does not fire often enough to cover their
     * declared obligation, on at least one hook-capable platform. The number
     * this roadmap exists to produce — and the one `--check` ratchets, because
     * `blocking` cannot see it: `session-canary` is declared, wired, firing, and
     * in this bucket.
     */
    frequency_gap: number;
    /** Rules with no `obligation_frequency` to join — the nine kernel rules. */
    frequency_unclassified: number;
    /**
     * The denominator every figure above is taken over, WITH its frame. See
     * {@link denominator_frames} for why the frame ships even when the two
     * populations agree.
     */
    frames: DenominatorFrames;
}

export function summarise(rows: RuleCoverage[]): Summary {
    const declared = rows.filter((r) => r.declared.length > 0);
    const count = (p: (r: RuleCoverage) => boolean): number => rows.filter(p).length;
    const blocking = count((r) => BLOCKING.has(r.effective));
    return {
        total: rows.length,
        declared: declared.length,
        blocking,
        local_only: count((r) => r.effective === 'validator-local'),
        observer: count((r) => r.effective === 'observer'),
        unwired: count((r) => r.effective === 'unwired'),
        missing: count((r) => r.effective === 'missing'),
        undeclared: rows.length - declared.length,
        blocking_pct: rows.length === 0 ? 0 : Math.round((blocking / rows.length) * 1000) / 10,
        frequency_gap: count((r) => r.frequency_verdict === 'gap'),
        frequency_unclassified: count((r) => r.frequency_verdict === 'unclassified'),
        frames: denominator_frames(rows.length),
    };
}

/**
 * The denominator, WITH the frame that produced it.
 *
 * WHY A FRAME AND NOT JUST A NUMBER. Until 2026-08-23 the tree published five
 * different figures for one property — `docs/proof.md` carried an 86 and an 89
 * for "rules that declare no backstop" in two places, a frontmatter grep said
 * 87 and an any-line grep said 82 — and a reader had no way to tell which was
 * the answer. The cause was not arithmetic. It was that every figure was
 * quoted without saying WHICH population it was taken over: the resolver was
 * once scoped narrower than the governed-rule corpus, so "in-scope" and
 * "governed total" were genuinely different numbers, and prose copied one under
 * a heading that meant the other.
 *
 * They agree today, because the resolver now reads the whole of `src/rules/`.
 * That agreement is exactly why the frame must still be printed: a silent
 * agreement is indistinguishable from a silent conflation, and the next
 * narrowing of either side would reintroduce the plurality with nothing
 * reporting it. So the two frames are computed from INDEPENDENT sources — this
 * resolver's own row count, and `update_counts.count('rules')`, the same
 * function that keeps the published artefact counts honest — and their
 * agreement is asserted rather than assumed.
 */
export interface DenominatorFrames {
    /** Rules this resolver actually resolved. Every percentage uses this frame. */
    in_scope: number;
    /** The governed-rule total, counted independently by `update_counts`. */
    governed_total: number;
    /** `false` means the two populations have diverged and prose must say which. */
    agree: boolean;
    /** Where the in-scope frame comes from, for a reader re-deriving it. */
    source: string;
}

export function denominator_frames(
    in_scope: number,
    governed = (): number => count_artefacts('rules'),
): DenominatorFrames {
    let governed_total: number;
    try {
        governed_total = governed();
    } catch {
        // An unreadable second source is reported as a divergence, never as
        // agreement: "I could not check" and "they match" must not print alike.
        governed_total = -1;
    }
    return {
        in_scope,
        governed_total,
        agree: governed_total === in_scope,
        source: 'src/rules/*.md',
    };
}

/** The one sanctioned sentence for the denominator. Prose quotes this, never a literal. */
export function denominator_line(f: DenominatorFrames): string {
    if (f.governed_total < 0) {
        return (
            `denominator: ${String(f.in_scope)} rule(s), frame in-scope (${f.source}) — ` +
            `governed-total UNAVAILABLE, so agreement is unverified`
        );
    }
    if (f.agree) {
        return (
            `denominator: ${String(f.in_scope)} rule(s), frame in-scope (${f.source}) ` +
            `== governed-total ${String(f.governed_total)}`
        );
    }
    return (
        `denominator: ${String(f.in_scope)} rule(s) in-scope (${f.source}) vs ` +
        `${String(f.governed_total)} governed-total — FRAMES DIVERGE, name the frame on every figure`
    );
}

function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    const check = argv.includes('--check');
    const write = argv.includes('--write-baseline');

    if (!fs.existsSync(RULES_DIR)) {
        process.stderr.write(`❌  check_enforcement_coverage: no rules dir at ${RULES_DIR}\n`);
        return 2;
    }

    const rows = collect();
    // Count every rule read, not the declared subset: with an empty rules dir
    // the report renders "0/0 rules (0%)" and exits green, and `summarise`
    // special-cases the zero denominator rather than rejecting it. Exit 2 is
    // the code the missing-rules-dir guard above already uses for this class.
    try {
        assertScanned({
            gate: 'check_enforcement_coverage',
            scanned: rows.length,
            units: 'rule file(s)',
            roots: ['src/rules'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    const summary = summarise(rows);

    if (as_json) {
        process.stdout.write(JSON.stringify({ summary, rules: rows }, null, 2) + '\n');
        return 0;
    }

    if (write) {
        fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
        fs.writeFileSync(
            BASELINE,
            JSON.stringify(
                {
                    _doc:
                        'Enforcement-coverage baseline. `blocking` counts rules whose strongest ' +
                        'enforced_by resolves to something that can fail a build. `frequency_gap` ' +
                        'counts rules whose carrier does not fire often enough to cover their ' +
                        'declared obligation on some hook-capable platform — a rule can be ' +
                        'blocking and in that bucket at once. Coverage is a ratchet: --check fails ' +
                        'when blocking falls, or unwired / local_only / missing / frequency_gap ' +
                        'rises. Regenerate intentionally with --write-baseline when the change is ' +
                        'the point.',
                    summary,
                },
                null,
                2,
            ) + '\n',
        );
        process.stdout.write(`✅  wrote baseline → ${path.relative(REPO_ROOT, BASELINE)}\n`);
        return 0;
    }

    // Human report.
    const lines: string[] = [];
    lines.push(
        `enforcement coverage · ${summary.blocking}/${summary.total} rules (${summary.blocking_pct}%) ` +
            `have a backstop that fails a CI build`,
    );
    lines.push(
        `  declared ${summary.declared} · local-only ${summary.local_only} · observer ${summary.observer} · ` +
            `unwired ${summary.unwired} · missing ${summary.missing} · undeclared ${summary.undeclared}`,
    );
    if (summary.local_only > 0) {
        lines.push(
            `  local-only = a validator no workflow runs. It fails \`task ci\` if someone types it; ` +
                `it does not fail the build. Counted separately, never in the headline.`,
        );
    }

    lines.push(
        `  frequency: ${summary.frequency_gap} gap · ${summary.frequency_unclassified} unclassified ` +
            `(kernel — block_kernel_rule_writes denies the field)`,
    );
    // The denominator is published WITH its frame, and it is the only sanctioned
    // source for that number: `check_enforcement_denominator` reds when a
    // tracked doc carries an enforcement count this resolver did not produce.
    lines.push(`  ${denominator_line(summary.frames)}`);

    const gaps = rows.filter((r) => r.frequency_verdict === 'gap');
    if (gaps.length > 0) {
        lines.push('');
        lines.push('  frequency gaps — carrier fires, but not often enough:');
        for (const r of gaps) {
            const where =
                r.gap_platforms.length === Object.keys(r.carrier_frequency ?? {}).length
                    ? 'every hook-capable platform'
                    : r.gap_platforms.join(', ');
            lines.push(
                `    · ${r.id}: obligation ${r.obligation_frequency}, carrier ` +
                    `${r.declared.join(' + ')} — uncovered on ${where}`,
            );
        }
    }

    const problems = rows.filter((r) => r.notes.length > 0);
    if (problems.length > 0) {
        lines.push('');
        lines.push('  resolution findings:');
        for (const r of problems) {
            for (const n of r.notes) lines.push(`    · ${r.id}: ${n}`);
        }
    }
    process.stdout.write(lines.join('\n') + '\n');

    if (check) {
        if (!fs.existsSync(BASELINE)) {
            process.stderr.write(
                `❌  check_enforcement_coverage --check: no baseline at ${path.relative(REPO_ROOT, BASELINE)}; ` +
                    `run --write-baseline first\n`,
            );
            return 2;
        }
        const base = JSON.parse(fs.readFileSync(BASELINE, 'utf-8')).summary as Summary;
        const regressions: string[] = [];
        if (summary.blocking < base.blocking) {
            regressions.push(`blocking coverage fell: ${base.blocking} → ${summary.blocking}`);
        }
        if (summary.unwired > base.unwired) {
            regressions.push(`unwired declarations rose: ${base.unwired} → ${summary.unwired}`);
        }
        // The bucket `blocking` structurally cannot see: a rule can be declared,
        // wired, firing and still mis-slotted. `??` tolerates a pre-frequency
        // baseline so the field's own introduction does not red the ratchet.
        if (summary.frequency_gap > (base.frequency_gap ?? Number.POSITIVE_INFINITY)) {
            regressions.push(
                `frequency gaps rose: ${base.frequency_gap} → ${summary.frequency_gap} ` +
                    `(a rule's carrier no longer fires often enough for its obligation)`,
            );
        }
        // A validator dropping out of a workflow back into taskfile-only is the
        // exact regression this split was built to name. Without this line the
        // headline would fall and only the `blocking` check would notice, which
        // reports the symptom rather than the cause.
        if (summary.local_only > (base.local_only ?? 0)) {
            regressions.push(
                `validators fell back to taskfile-only: ${base.local_only ?? 0} → ${summary.local_only} ` +
                    `(a gate left .github/workflows/ — add it back to rule-backstops.yml)`,
            );
        }
        if (summary.missing > base.missing) {
            regressions.push(`missing targets rose: ${base.missing} → ${summary.missing}`);
        }
        if (regressions.length > 0) {
            process.stderr.write('❌  enforcement-coverage ratchet:\n');
            for (const r of regressions) process.stderr.write(`    · ${r}\n`);
            process.stderr.write(
                '    Raise coverage, or regenerate the baseline with --write-baseline if the drop is the point.\n',
            );
            return 1;
        }
        process.stdout.write('✅  enforcement-coverage ratchet holds\n');
    }
    return 0;
}

// Main-guard (realpath-compared, mirrors the repo convention).
if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main(process.argv.slice(2)));
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exit(main(process.argv.slice(2)));
        }
    }
}
