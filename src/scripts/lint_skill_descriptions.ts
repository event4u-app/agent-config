#!/usr/bin/env -S node --import tsx
/**
 * lint_skill_descriptions — description-quality gate (ecosystem-harvest
 * skill-quality-gates, Phase 1).
 *
 * Description-driven routing is the suite's core asset: the agent picks a skill
 * from its `description`. A circular or condition-free description ("Triggers on
 * X, X" / a description that is just the skill name) makes routing a coin-flip.
 * This linter rejects the four description defects that break routing:
 *
 *   (a) desc-equals-name   — normalized description ≡ normalized name
 *   (b) duplicated-trigger — the same multi-word trigger phrase repeated verbatim
 *   (c) triggers-are-name  — every trigger phrase is a substring of the name
 *                            (no new routing signal beyond the name)
 *   (d) no-routing-signal  — the description gives the router nothing to
 *                            disambiguate on: no condition marker (when / before /
 *                            after / only / for …), no specifics enumeration
 *                            (em-dash / colon / comma list), no quoted example,
 *                            no imperative-verb lead. A bare topic restatement.
 *
 * (a)–(d) are signal-ABSENCE checks over every skill: an imperative house-style
 * description ("Writes Laravel PHP — Eloquent, Artisan …") carries routing
 * signal and passes. The farm-generator's name-echo frontmatter is the
 * must-fail specimen.
 *
 * Two further checks are POSITIVE — they demand something be present — and are
 * therefore scoped to CLUSTERED skills only (road-to-overlap-truth-and-skill-cut
 * Phase 5):
 *
 *   (e) clustered-no-sibling-routing — the canonical overlap tool pairs this
 *                            skill with a same-pack sibling at >= the canonical
 *                            threshold, and the description never names that
 *                            sibling. Two skills the router cannot tell apart,
 *                            neither of which says which one loses.
 *   (f) clustered-no-quoted-phrase — same cluster condition, and the description
 *                            carries no quoted literal user phrase. In a cluster,
 *                            the user's own words are the only tie-break the
 *                            router gets.
 *
 * The cluster condition is what keeps these honest. A quoted-phrase mandate
 * across all ~287 skills is noise, not routing — it would fire on skills with no
 * neighbour to be confused with. Today the cluster set is EMPTY (the corpus has
 * no same-pack pair at or above threshold), so (e) and (f) are dormant by
 * construction and wake up exactly when a new skill lands close to an existing
 * one. That is the point.
 *
 * A seventh check runs on EVERY skill and is neither absence nor presence — it
 * is a prohibition:
 *
 *   (g) preemption-phrase  — the description claims priority over a sibling, or
 *                            instructs activation regardless of the request.
 *                            Unlike (a)-(f), this defect harms OTHER skills: it
 *                            wins turns that belonged to them, and the loss is
 *                            invisible at the source. See PREEMPTION_PATTERNS
 *                            for why every pattern is anchored on the directive
 *                            rather than on a vocabulary word.
 *
 * Deterministic, static-config only. Allowlist mirrors lint_skill_originality:
 * `lint_skill_descriptions_allowlist.json`, capped at 20 (autonomous-execution
 * allowlist-growth antipattern — over-cap means the linter is wrong).
 *
 * Exit codes: 0 = clean (or only allowlisted), 1 = at least one non-allowlisted
 * violation, 2 = allowlist over cap / usage error.
 *
 * Usage:
 *   ./scripts-run src/scripts/lint_skill_descriptions [--quiet] [--json <path>] [--root <dir>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
    ALLOWLIST as OVERLAP_ALLOWLIST,
    OVERLAP_THRESHOLD,
    _cosine,
    _loadAllowlist,
    _pairKey,
    collect,
} from './audit_skill_overlap.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { parse_frontmatter } from './skill_overlap.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_SKILLS = path.join(REPO, 'src', 'skills');
const ALLOWLIST = path.join(path.dirname(_HERE), 'lint_skill_descriptions_allowlist.json');
const ALLOWLIST_CAP = 20;

// A condition / trigger marker — one of the ways a description signals WHEN it routes.
const CONDITION_RE =
    /\b(use when|use to|use for|use on|use during|when |before |after |only when|only for|triggers on|fires when|activ|for [a-z])/i;
// An imperative / gerund lead verb — the house-style "Writes X", "Convert X" form
// carries WHAT-it-does routing signal even without a "when" clause.
const IMPERATIVE_LEAD_RE =
    /^["'`]*\s*(write|author|convert|review|run|add|build|generate|create|fix|wire|detect|analy[sz]e|optimi[sz]e|draft|extract|route|turn|produce|score|consolidate|rate|model|estimate|plan|check|audit|ship|emit|render|guide|poll|capture|explain|map|prepare|handle|manage|track|compare|validate|verify|enforce|choose|pick|enumerate|investigate|format|scaffold|design|define|describe|gate|block|refactor|migrate|transcribe|summari[sz]e|orchestrate|surface|propose|walk|stress-test|red-team|challenge|bootstrap|seed|install|deploy|package|split|merge|condense|harvest|evaluate|assess|diagnose|reproduce|trace|inspect|lint|test)/i;

/**
 * (g) Preemption phrases — a description that argues for itself against the
 * rest of the catalogue.
 *
 * Every other check here asks whether a description carries ENOUGH signal.
 * This one is the opposite: a description claiming priority over a sibling, or
 * instructing activation regardless of the request, degrades routing **globally
 * and invisibly**. It does not misroute its own skill — it wins turns that
 * belonged to other skills, and the loss surfaces as those skills mysteriously
 * under-firing. The sweep behind this check found the class live in a shipped
 * third-party description and in a second suite's own catalogue.
 *
 * Every pattern is anchored on the **directive**, never on a vocabulary word,
 * and that is the whole design. A first pass keyed on the words alone
 * (`overrides`, `supersedes`, `for every …`) returned three hits on this corpus
 * and **all three were false positives**: `override-management` manages
 * overrides, `decision-review` asks whether an ADR should be superseded, and
 * `prediction-pool-optimizer` answers "every question" in a prediction pool.
 * Those are subjects, not claims. The patterns below therefore require the
 * shape of an instruction to the router (`always use`, `use this instead of`,
 * `this skill takes precedence`), which no domain noun produces.
 */
const PREEMPTION_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
    [
        'unconditional activation',
        /\b(?:always|invariably|unconditionally)\s+(?:use|load|apply|run|activate|invoke|prefer)\b/i,
    ],
    [
        'activation regardless of the request',
        /\b(?:regardless of|no matter)\s+(?:the|what|which)\b|\b(?:for|on)\s+(?:every|all|any)\s+(?:request|turn|prompt|conversation|session)s?\b|\beven if not (?:asked|requested)\b/i,
    ],
    [
        'priority over a sibling',
        /\b(?:use|load|apply|invoke|prefer)\s+(?:this|these|it)\b[^.;]{0,60}?\b(?:instead of|rather than|over|in preference to)\b/i,
    ],
    [
        'authority claim over the catalogue',
        /\bthis (?:skill|one|artifact)\s+(?:takes precedence|outranks|supersedes|overrides|wins)\b|\b(?:takes precedence over|outranks)\s+(?:all|any|every)\b/i,
    ],
    [
        'load-order claim',
        /\b(?:before|prior to)\s+(?:any|all)\s+other\s+(?:skill|tool|rule)s?\b|\bload (?:this )?first\b/i,
    ],
];

/** The first preemption claim in a description, or null. */
function preemptionPhrase(desc: string): { kind: string; match: string } | null {
    for (const [kind, rx] of PREEMPTION_PATTERNS) {
        const m = rx.exec(desc);
        if (m) {
            return { kind: kind as string, match: m[0] };
        }
    }
    return null;
}

interface Violation {
    slug: string;
    code:
        | 'desc-equals-name'
        | 'duplicated-trigger'
        | 'triggers-are-name'
        | 'no-routing-signal'
        | 'clustered-no-sibling-routing'
        | 'clustered-no-quoted-phrase'
        | 'preemption-phrase';
    detail: string;
}

/** A quoted literal phrase — `'expand this scene'` / `"film-grade scene"`. */
const QUOTED_PHRASE_RE = /['"`][^'"`]{3,}['"`]/;

/**
 * Same-pack neighbours at or above the canonical overlap threshold, keyed by
 * directory slug.
 *
 * Uses the canonical instrument, not a second implementation — one metric, one
 * threshold, one answer. Cross-pack pairs are excluded for the same reason a
 * cross-pack merge is out of scope: they do not compete for the same install.
 *
 * "One answer" includes the canonical EXCEPTIONS. A pair in
 * `audit_skill_overlap_allowlist.json` is one a human read both sides of and
 * ruled structural — shared domain vocabulary, distinct responsibility. Reading
 * the same metric at the same threshold while ignoring its reviewed exceptions
 * would be a second implementation wearing the first one's numbers, and it
 * would ask an author to satisfy (e)/(f) for an overlap the project already
 * decided is not a routing hazard.
 */
function computeClusters(root: string, threshold: number = OVERLAP_THRESHOLD): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    const reviewed = _loadAllowlist(OVERLAP_ALLOWLIST);
    const skills = collect(root).map((s) => ({
        slug: path.basename(path.dirname(s.relpath)),
        packs: s.packs,
        vector: s.vector,
    }));
    for (let i = 0; i < skills.length; i += 1) {
        for (let j = i + 1; j < skills.length; j += 1) {
            const a = skills[i]!;
            const b = skills[j]!;
            let sharesPack = false;
            for (const p of a.packs) {
                if (b.packs.has(p)) {
                    sharesPack = true;
                    break;
                }
            }
            if (!sharesPack) continue;
            if (_cosine(a.vector, b.vector) < threshold) continue;
            if (reviewed.has(_pairKey(a.slug, b.slug))) continue;
            clusters.set(a.slug, [...(clusters.get(a.slug) ?? []), b.slug]);
            clusters.set(b.slug, [...(clusters.get(b.slug) ?? []), a.slug]);
        }
    }
    return clusters;
}

/** A description carries routing signal if it names a condition, leads with an
 * imperative verb, enumerates specifics (em-dash / colon / ≥2 comma segments),
 * or embeds an example query (a quoted phrase). Absence of all four is the defect. */
function hasRoutingSignal(desc: string): boolean {
    if (CONDITION_RE.test(desc)) return true;
    if (IMPERATIVE_LEAD_RE.test(desc.trim())) return true;
    if (/[—–:;→]/.test(desc)) return true; // specifics enumeration
    if (/['"][^'"]{3,}['"]/.test(desc)) return true; // quoted example query
    if (desc.split(',').filter((s) => s.trim().length >= 3).length >= 2) return true;
    return false;
}

function normalize(s: string): string {
    return s
        .toLowerCase()
        .replace(/[`"'*_.,:;!?()[\]{}]/g, ' ')
        .replace(/[-\s]+/g, ' ')
        .trim();
}

/** Split a description into candidate trigger phrases on sentence/list punctuation. */
function triggerPhrases(desc: string): string[] {
    return desc
        .split(/[.;·,|]|\bor\b|\band\b|\/|—|–/i)
        .map((p) => normalize(p))
        .filter((p) => p.length >= 3);
}

function analyseSkill(slug: string, fm: Record<string, string>, siblings: readonly string[] = []): Violation[] {
    const out: Violation[] = [];
    const name = fm['name'] ?? slug;
    const desc = (fm['description'] ?? '').trim();
    if (desc === '') {
        // Empty description is a frontmatter-schema failure, not this linter's job.
        return out;
    }
    const nName = normalize(name);
    const nDesc = normalize(desc);

    // (a) description ≡ name
    if (nDesc === nName) {
        out.push({ slug, code: 'desc-equals-name', detail: `description normalizes to the name "${name}"` });
    }

    const phrases = triggerPhrases(desc);

    // (b) duplicated MULTI-WORD trigger phrase repeated verbatim (the farm-specimen
    // "Triggers on: X, X" defect) — a single recurring domain word is not a defect.
    const multiWord = phrases.filter((p) => p.includes(' '));
    const seen = new Set<string>();
    for (const p of multiWord) {
        if (seen.has(p)) {
            out.push({ slug, code: 'duplicated-trigger', detail: `trigger phrase repeated verbatim: "${p}"` });
            break;
        }
        seen.add(p);
    }

    // (c) every trigger phrase is a substring of the name (no signal beyond name)
    if (phrases.length > 0 && phrases.every((p) => nName.includes(p) || p.includes(nName))) {
        out.push({
            slug,
            code: 'triggers-are-name',
            detail: 'every trigger phrase is contained in the skill name — no routing signal beyond the name',
        });
    }

    // (d) no routing signal at all — bare topic restatement
    if (!hasRoutingSignal(desc)) {
        out.push({
            slug,
            code: 'no-routing-signal',
            detail: 'no condition marker, imperative-verb lead, specifics enumeration, or example query — the router has nothing to disambiguate on',
        });
    }

    // (g) a claim of priority over the rest of the catalogue. Unlike (a)-(d),
    // this defect harms OTHER skills, so it is checked on every skill and is
    // never scoped to a cluster — a preemption phrase costs turns regardless of
    // whether the router already had a near-neighbour to confuse it with.
    const preemption = preemptionPhrase(desc);
    if (preemption) {
        out.push({
            slug,
            code: 'preemption-phrase',
            detail:
                `description claims ${preemption.kind} ("${preemption.match}") — a description ` +
                'argues for its own routing conditions, never against its siblings; this wins ' +
                'turns that belonged to other skills and the loss is invisible at the source',
        });
    }

    // (e) + (f) fire ONLY for skills the canonical tool put in a cluster.
    if (siblings.length > 0) {
        const unrouted = siblings.filter((s) => !desc.includes(s));
        if (unrouted.length > 0) {
            out.push({
                slug,
                code: 'clustered-no-sibling-routing',
                detail: `overlaps ${unrouted.map((s) => `\`${s}\``).join(', ')} at or above the canonical threshold, but the description never names ${unrouted.length === 1 ? 'it' : 'them'} — add a sibling-routing clause so the router knows which one loses`,
            });
        }
        if (!QUOTED_PHRASE_RE.test(desc)) {
            out.push({
                slug,
                code: 'clustered-no-quoted-phrase',
                detail: `clustered with ${siblings.map((s) => `\`${s}\``).join(', ')} but carries no quoted literal user phrase — in a cluster the user's own words are the tie-break`,
            });
        }
    }

    return out;
}

function loadAllowlist(): Set<string> {
    if (!fs.existsSync(ALLOWLIST)) {
        return new Set();
    }
    const data = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf-8')) as {
        entries?: Array<{ slug: string; code: string }>;
    };
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (entries.length > ALLOWLIST_CAP) {
        process.stderr.write(
            `❌  lint_skill_descriptions: allowlist has ${entries.length} entries (> ${ALLOWLIST_CAP}). ` +
                `Per the autonomous-execution allowlist-growth antipattern, the linter is wrong, ` +
                `not the content — tighten the heuristic, do not grow the allowlist.\n`,
        );
        process.exit(2);
    }
    return new Set(entries.map((e) => `${e.slug}::${e.code}`));
}

function* skillMds(root: string): Generator<string> {
    if (!fs.existsSync(root)) return;
    for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory()) continue;
        const md = path.join(root, entry.name, 'SKILL.md');
        if (fs.existsSync(md)) yield md;
    }
}

interface Args {
    quiet: boolean;
    json: string | null;
    root: string;
}

function parseArgs(argv: string[]): Args {
    const a: Args = { quiet: false, json: null, root: DEFAULT_SKILLS };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--quiet') a.quiet = true;
        else if (arg === '--json') a.json = argv[(i += 1)] ?? '';
        else if (arg === '--root') a.root = argv[(i += 1)] ?? DEFAULT_SKILLS;
        else {
            process.stderr.write(`lint_skill_descriptions: unrecognized argument: ${arg}\n`);
            process.exit(2);
        }
    }
    return a;
}

function main(argv: string[]): number {
    const args = parseArgs(argv);
    const allow = loadAllowlist();
    const clusters = computeClusters(args.root);
    const violations: Violation[] = [];
    let scanned = 0;
    for (const md of skillMds(args.root)) {
        scanned += 1;
        const slug = path.basename(path.dirname(md));
        const [fm] = parse_frontmatter(fs.readFileSync(md, 'utf-8'));
        for (const v of analyseSkill(slug, fm, clusters.get(slug) ?? [])) {
            if (!allow.has(`${v.slug}::${v.code}`)) violations.push(v);
        }
    }

    // `skillMds` yields nothing for a root that does not exist, so a moved
    // `src/skills` would report "no description defects" over zero skills —
    // routing quality certified against an empty corpus.
    try {
        assertScanned({
            gate: 'lint_skill_descriptions',
            scanned,
            units: 'skill(s)',
            roots: [path.relative(REPO, args.root) || args.root],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (args.json) {
        fs.mkdirSync(path.dirname(args.json), { recursive: true });
        fs.writeFileSync(args.json, JSON.stringify({ scanned, violations }, null, 2) + '\n');
    }

    if (violations.length > 0) {
        process.stderr.write(`❌  lint_skill_descriptions: ${violations.length} description defect(s):\n`);
        for (const v of violations) {
            process.stderr.write(`   ${v.slug} [${v.code}] — ${v.detail}\n`);
        }
        return 1;
    }
    if (!args.quiet) {
        process.stdout.write(
            `✅  lint_skill_descriptions: ${scanned} skill(s) scanned (${clusters.size} clustered), no description defects.\n`,
        );
    }
    return 0;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}

export { analyseSkill, normalize, triggerPhrases, preemptionPhrase, main };
