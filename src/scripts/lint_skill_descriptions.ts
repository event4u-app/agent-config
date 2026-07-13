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
 * (d) is signal-ABSENCE, not a phrase mandate: an imperative house-style
 * description ("Writes Laravel PHP — Eloquent, Artisan …") carries routing
 * signal and passes. The farm-generator's name-echo frontmatter is the
 * must-fail specimen.
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

interface Violation {
    slug: string;
    code: 'desc-equals-name' | 'duplicated-trigger' | 'triggers-are-name' | 'no-routing-signal';
    detail: string;
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

function analyseSkill(slug: string, fm: Record<string, string>): Violation[] {
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
    const violations: Violation[] = [];
    let scanned = 0;
    for (const md of skillMds(args.root)) {
        scanned += 1;
        const slug = path.basename(path.dirname(md));
        const [fm] = parse_frontmatter(fs.readFileSync(md, 'utf-8'));
        for (const v of analyseSkill(slug, fm)) {
            if (!allow.has(`${v.slug}::${v.code}`)) violations.push(v);
        }
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
        process.stdout.write(`✅  lint_skill_descriptions: ${scanned} skill(s) scanned, no description defects.\n`);
    }
    return 0;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}

export { analyseSkill, normalize, triggerPhrases, main };
