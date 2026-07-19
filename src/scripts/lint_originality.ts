#!/usr/bin/env tsx
/**
 * Anti-reskin originality linter.
 *
 * Entity-neutralized shingle-overlap gate over the authored corpus — skills,
 * personas, and domain commands. Catches the failure mode that keyword-cosine
 * (`audit_skill_overlap.ts`) and token-Jaccard (`_lib/text_similarity.ts`)
 * miss: a find-replace re-skin ("Laravel" → "Symfony", "Vietnam" → "Korea")
 * submitted as a "new" artifact. The engine (`_lib/shingle_similarity.ts`)
 * neutralizes framework/vendor/region proper nouns before comparing 8-word
 * shingles, so the swap does not move the score.
 *
 * Corpus is class-scoped: a skill compares only against skills, a persona only
 * against personas, a command only against commands — a persona legitimately
 * shares scaffold phrasing with the persona template, never with a skill.
 * Shared-scaffold shingles are subtracted per class (the class template's
 * shingles are removed from every candidate) so boilerplate never scores.
 * Rules and contexts are OUT of scope by design (their intentional
 * cross-referencing makes shingle overlap structurally noisy).
 *
 * Modes:
 *   (no args)          full pairwise audit → agents/reports/originality.{json,md}
 *   --changed <f...>   CI path: each changed file vs the whole same-class corpus
 *                      AND vs the other changed files of its class
 *
 * Thresholds (env-overridable): ORIGINALITY_FAIL (60), ORIGINALITY_WARN (40).
 * Calibrated 2026-07-19 over 495 artifacts / 56 151 comparisons: after the
 * template + document-frequency boilerplate subtraction the worst legitimate
 * pair is 40 % (`domains/engineering-base/tests` ~ `domains/meta/override` —
 * two cluster-orchestrator commands sharing the family template's
 * "Top-level orchestrator … / Non-interactive & auto-detection" scaffold;
 * triaged as legitimate, not a merge candidate), p95 and median 0 %. A
 * find-replace re-skin scores ~100 % (entities neutralize away), so FAIL 60
 * blocks every real re-skin with a 20-point margin above the legitimate floor
 * and 40-point margin below a re-skin. Distribution in agents/reports/originality.md.
 *
 * TWO PROPERTIES OF THE DF PASS A LATER READER MUST NOT MISTAKE FOR CONSTANTS:
 *   1. Scores are CORPUS-RELATIVE. The DF floor subtracts what is common across
 *      the class, so every overlap number is measured against the corpus as it
 *      stands. The 40 % floor is a 2026-07-19 SNAPSHOT, not a fixed constant —
 *      it drifts as commands/skills are added or removed. Re-run the full audit
 *      after any large corpus change; do not treat 40 % as invariant.
 *   2. Adversarial batch masking is guarded in BOTH modes. A batch of ≥ _dfFloor
 *      near-identical files DF-masks itself (their shared shingles reach the
 *      floor, get subtracted, score 0 on the DF signal). Two defenses close it:
 *      `--changed` computes the boilerplate set from the corpus MINUS the change
 *      set (the diff never defines what is scaffold; see `_changed`); and BOTH
 *      modes carry a second RAW signal (`RAW_FAIL`) computed on the template-only
 *      shingles with NO DF subtraction, so a batch that is ~100 % identical on
 *      raw is flagged regardless of DF. The full-audit sweep — which has no
 *      "changed" notion to exclude — relies on this raw signal for its batch
 *      guard; it is the linter's own armed defense, not only the PR path.
 *
 * CONSOLIDATION: this gate SUPERSEDES the report-only `lint_originality_shingles`
 * (entity-masked 8-word shingles, Jaccard, manual allowlist, never armed) — same
 * anti-re-skin idea, upgraded to containment, class-scoped comparison, commands
 * in the corpus, automatic DF boilerplate subtraction, a `--changed` batch guard,
 * and armed thresholds. It keeps that gate's SUBAGENT coverage (do not drop it).
 * `lint_skill_originality` (ADR-tracked Jaccard + pack-domain severity) is a
 * different mechanism and stays.
 *
 * Exit 0 clean/warn · 1 fail · 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { shingles } from './_lib/shingle_similarity.js';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REPORT_DIR = path.join(ROOT, 'agents', 'reports');
const OUT_JSON = path.join(REPORT_DIR, 'originality.json');
const OUT_MD = path.join(REPORT_DIR, 'originality.md');

const K = 8;

export type ArtifactClass = 'skill' | 'persona' | 'command' | 'subagent';

interface ClassSpec {
    readonly name: ArtifactClass;
    /** Absolute paths of every corpus file in this class (sorted). */
    files(): string[];
    /** Class template file whose shingles are subtracted as shared scaffold. */
    readonly templatePath: string;
    /** Classify an absolute path into this class, or null. */
    matches(abs: string): boolean;
}

function _isDir(p: string): boolean {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function _isFile(p: string): boolean {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}
function _rel(abs: string): string {
    return path.relative(ROOT, abs).split(path.sep).join('/');
}

/** Recursive walk collecting files whose basename === `leaf`. */
function _walkLeaf(dir: string, leaf: string, out: string[]): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
            _walkLeaf(full, leaf, out);
        } else if (ent.name === leaf) {
            out.push(full);
        }
    }
}

const SKILLS_DIR = path.join(ROOT, 'src', 'skills');
const PERSONAS_DIR = path.join(ROOT, 'src', 'agent-src', 'personas');
const DOMAINS_DIR = path.join(ROOT, 'src', 'domains');
const SUBAGENTS_DIR = path.join(ROOT, 'src', 'subagents');

const CLASSES: readonly ClassSpec[] = [
    {
        name: 'skill',
        templatePath: path.join(ROOT, 'src', 'agent-src', 'templates', 'skill.md'),
        files() {
            if (!_isDir(SKILLS_DIR)) return [];
            return fs.readdirSync(SKILLS_DIR)
                .map((n) => path.join(SKILLS_DIR, n, 'SKILL.md'))
                .filter(_isFile)
                .sort();
        },
        matches: (abs) => abs.startsWith(SKILLS_DIR + path.sep) && path.basename(abs) === 'SKILL.md',
    },
    {
        name: 'persona',
        templatePath: path.join(PERSONAS_DIR, '_template-specialist', 'persona.md'),
        files() {
            if (!_isDir(PERSONAS_DIR)) return [];
            // Top-level *.md only (subdirs like _template-specialist/, advisors/
            // are not first-class personas — the corpus is the flat set).
            return fs.readdirSync(PERSONAS_DIR)
                .filter((n) => n.endsWith('.md') && !n.startsWith('_'))
                .map((n) => path.join(PERSONAS_DIR, n))
                .filter(_isFile)
                .sort();
        },
        matches: (abs) =>
            path.dirname(abs) === PERSONAS_DIR &&
            abs.endsWith('.md') &&
            !path.basename(abs).startsWith('_'),
    },
    {
        name: 'command',
        templatePath: path.join(ROOT, 'src', 'agent-src', 'templates', 'command.md'),
        files() {
            const out: string[] = [];
            _walkLeaf(DOMAINS_DIR, 'command.md', out);
            return out.sort();
        },
        matches: (abs) => abs.startsWith(DOMAINS_DIR + path.sep) && path.basename(abs) === 'command.md',
    },
    {
        // Coverage parity with the retired lint_originality_shingles gate, which
        // covered subagents; this gate must not regress that. No dedicated
        // template (subagents have none) → template subtraction is a no-op.
        name: 'subagent',
        templatePath: path.join(ROOT, 'src', 'agent-src', 'templates', 'subagent.md'),
        files() {
            if (!_isDir(SUBAGENTS_DIR)) return [];
            return fs.readdirSync(SUBAGENTS_DIR)
                .filter((n) => n.endsWith('.md') && !n.startsWith('_'))
                .map((n) => path.join(SUBAGENTS_DIR, n))
                .filter(_isFile)
                .sort();
        },
        matches: (abs) =>
            path.dirname(abs) === SUBAGENTS_DIR &&
            abs.endsWith('.md') &&
            !path.basename(abs).startsWith('_'),
    },
];

interface Artifact {
    cls: ArtifactClass;
    relpath: string;
    /** Human name — frontmatter name/id, else parent dir. */
    label: string;
    /** Template-stripped shingles, then DF-boilerplate-subtracted (the calibrated
     * signal — FAIL 60 / WARN 40). */
    shingles: Set<string>;
    /** Template-stripped shingles WITHOUT DF subtraction. Powers the raw batch
     * guard: a batch of ≥ _dfFloor near-identical files DF-masks each other, but
     * remains ~100 % identical on the raw set (see RAW_FAIL). Frozen at load. */
    rawShingles: Set<string>;
}

/** Cheap frontmatter name/id read for a readable label (no yaml dep needed). */
function _label(text: string, abs: string): string {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (fm) {
        const m = /^(?:name|id):\s*["']?([^"'\n]+)["']?\s*$/m.exec(fm[1] as string);
        if (m) return (m[1] as string).trim();
    }
    return path.basename(path.dirname(abs)) || path.basename(abs);
}

function _templateShingles(spec: ClassSpec): Set<string> {
    if (!_isFile(spec.templatePath)) return new Set();
    return shingles(fs.readFileSync(spec.templatePath, 'utf-8'), K);
}

function _load(abs: string, cls: ArtifactClass, tmpl: Set<string>): Artifact {
    const text = fs.readFileSync(abs, 'utf-8');
    const raw = shingles(text, K);
    // Subtract shared scaffold — a shingle also present in the class template
    // is boilerplate, not authored content.
    const kept = new Set<string>();
    for (const s of raw) if (!tmpl.has(s)) kept.add(s);
    // rawShingles is the template-stripped set frozen BEFORE DF subtraction.
    return { cls, relpath: _rel(abs), label: _label(text, abs), shingles: kept, rawShingles: new Set(kept) };
}

/** Containment over an arbitrary shingle field. */
function _containment(a: Set<string>, b: Set<string>): number {
    const min = Math.min(a.size, b.size);
    if (min === 0) return 0;
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    let shared = 0;
    for (const s of small) if (large.has(s)) shared++;
    return (100 * shared) / min;
}

/** Calibrated signal — DF-boilerplate-subtracted overlap (FAIL 60 / WARN 40). */
export function overlap(a: Artifact, b: Artifact): number {
    return _containment(a.shingles, b.shingles);
}

/** Batch-guard signal — template-only overlap, no DF (RAW_FAIL). */
export function rawOverlap(a: Artifact, b: Artifact): number {
    return _containment(a.rawShingles, b.rawShingles);
}

interface Pair { cls: ArtifactClass; a: string; b: string; a_path: string; b_path: string; overlap: number; raw_overlap: number; }

/** A pair fails the gate if the calibrated DF overlap crosses FAIL, OR the raw
 * (batch-guard) overlap crosses RAW_FAIL. */
function _isFail(dfOverlap: number, rawOverlap: number): boolean {
    return dfOverlap >= FAIL || rawOverlap >= RAW_FAIL;
}

function _round1(x: number): number { return Math.round(x * 10) / 10; }

// --- thresholds --------------------------------------------------------------

function _threshold(env: string, dflt: number): number {
    const v = process.env[env];
    if (v === undefined || v === '') return dflt;
    const n = Number(v);
    return Number.isFinite(n) ? n : dflt;
}
export const FAIL = _threshold('ORIGINALITY_FAIL', 60);
export const WARN = _threshold('ORIGINALITY_WARN', 40);
// Raw batch-guard threshold — template-only overlap, NO DF subtraction. Arms
// the full audit (which has no "changed set" to exclude) against the same
// batch-masking the --changed path guards structurally: a batch of ≥ _dfFloor
// near-identical files DF-masks itself to overlap 0, but is ~100 % identical on
// the raw set. Calibrated 2026-07-19: the legit raw ceiling is 67.9 % (command
// cluster-orchestrator scaffold), so RAW_FAIL 85 catches batches/re-skins
// (~100 %) with a 17-point margin above the legit ceiling.
export const RAW_FAIL = _threshold('ORIGINALITY_RAW_FAIL', 85);

// --- corpus ------------------------------------------------------------------

/**
 * Document-frequency boilerplate floor. A shingle that recurs across many
 * artifacts of a class is shared scaffold the single template file does not
 * capture (command orchestrators especially share structural prose). A
 * find-replace re-skin, by contrast, is a PAIR: its distinctive shingles live
 * in ≤ 2 files, so DF-filtering keeps exactly the content a re-skin copies while
 * dropping the class boilerplate — a per-class IDF stopword pass at shingle
 * granularity. Floor = max(4, 3% of the class size).
 */
export function _dfFloor(n: number): number {
    return Math.max(4, Math.round(0.03 * n));
}

/** The high-DF shingle set — class boilerplate to subtract from every artifact. */
export function _boilerplateSet(arts: Artifact[]): Set<string> {
    const floor = _dfFloor(arts.length);
    const df = new Map<string, number>();
    for (const a of arts) for (const s of a.shingles) df.set(s, (df.get(s) ?? 0) + 1);
    const boiler = new Set<string>();
    for (const [s, c] of df) if (c >= floor) boiler.add(s);
    return boiler;
}

function _subtract(a: Artifact, boiler: Set<string>): void {
    if (boiler.size === 0) return;
    const kept = new Set<string>();
    for (const s of a.shingles) if (!boiler.has(s)) kept.add(s);
    a.shingles = kept;
}

/** Per-class artifacts with the class template + DF-boilerplate subtracted. */
function _corpus(): Map<ArtifactClass, Artifact[]> {
    const byClass = new Map<ArtifactClass, Artifact[]>();
    for (const spec of CLASSES) {
        const tmpl = _templateShingles(spec);
        const arts = spec.files().map((f) => _load(f, spec.name, tmpl));
        const boiler = _boilerplateSet(arts);
        for (const a of arts) _subtract(a, boiler);
        byClass.set(spec.name, arts);
    }
    return byClass;
}

function _classify(abs: string): ClassSpec | null {
    for (const spec of CLASSES) if (spec.matches(abs)) return spec;
    return null;
}

// --- full audit --------------------------------------------------------------

function _fullPairs(byClass: Map<ArtifactClass, Artifact[]>): Pair[] {
    const pairs: Pair[] = [];
    for (const arts of byClass.values()) {
        for (let i = 0; i < arts.length; i++) {
            for (let j = i + 1; j < arts.length; j++) {
                const a = arts[i] as Artifact;
                const b = arts[j] as Artifact;
                const o = overlap(a, b);
                const r = rawOverlap(a, b);
                // Surface a pair if the calibrated signal warns, or the raw
                // batch guard fails (the latter catches DF-masked clusters whose
                // DF overlap is 0).
                if (o >= WARN || r >= RAW_FAIL) {
                    pairs.push({ cls: a.cls, a: a.label, b: b.label, a_path: a.relpath, b_path: b.relpath, overlap: _round1(o), raw_overlap: _round1(r) });
                }
            }
        }
    }
    return pairs.sort((x, y) => Math.max(y.overlap, y.raw_overlap) - Math.max(x.overlap, x.raw_overlap) || (x.a_path < y.a_path ? -1 : 1));
}

/** worst / p95 / median over EVERY pair (not just the >= WARN ones). */
function _distribution(byClass: Map<ArtifactClass, Artifact[]>): { worst: number; p95: number; median: number; comparisons: number } {
    const scores: number[] = [];
    for (const arts of byClass.values()) {
        for (let i = 0; i < arts.length; i++) {
            for (let j = i + 1; j < arts.length; j++) {
                scores.push(overlap(arts[i] as Artifact, arts[j] as Artifact));
            }
        }
    }
    if (scores.length === 0) return { worst: 0, p95: 0, median: 0, comparisons: 0 };
    scores.sort((a, b) => a - b);
    const at = (q: number): number => _round1(scores[Math.min(scores.length - 1, Math.floor(q * scores.length))] as number);
    return { worst: _round1(scores[scores.length - 1] as number), p95: at(0.95), median: at(0.5), comparisons: scores.length };
}

function _writeReport(byClass: Map<ArtifactClass, Artifact[]>, pairs: Pair[], dist: ReturnType<typeof _distribution>): void {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const scanned = [...byClass.values()].reduce((n, a) => n + a.length, 0);
    const json = {
        fail_threshold: FAIL,
        warn_threshold: WARN,
        artifacts_scanned: scanned,
        distribution: dist,
        pairs,
    };
    fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2) + '\n', 'utf-8');

    const fails = pairs.filter((p) => _isFail(p.overlap, p.raw_overlap)).length;
    const L: string[] = [
        '# Originality audit — entity-neutralized shingle overlap\n',
        `> Anti-reskin gate over ${scanned} authored artifacts (skills · personas · commands · subagents), `,
        `class-scoped, scaffold-subtracted, k=${K}. Thresholds: FAIL ${FAIL} / WARN ${WARN} / RAW_FAIL ${RAW_FAIL}. `,
        'The full audit is armed (FAIL + the raw batch guard); `--changed` adds the ' +
            'corpus-excluded batch guard for the PR path.\n',
        `\n- Artifacts scanned: **${scanned}**`,
        `\n- Pairwise comparisons: **${dist.comparisons}**`,
        `\n- Overlap distribution (DF): worst **${dist.worst}%** · p95 **${dist.p95}%** · median **${dist.median}%**`,
        `\n- Surfaced pairs: **${pairs.length}** (${fails} ≥ FAIL/RAW_FAIL)\n`,
        '\n## Surfaced pairs (DF ≥ WARN, or raw ≥ RAW_FAIL)\n',
    ];
    if (pairs.length === 0) {
        L.push('None — no same-class pair crosses the warn or raw threshold.\n');
    } else {
        L.push('| Class | A | B | overlap | raw |');
        L.push('|---|---|---|--:|--:|');
        for (const p of pairs) {
            const flag = _isFail(p.overlap, p.raw_overlap) ? ' ❌' : '';
            L.push(`| ${p.cls} | \`${p.a}\` | \`${p.b}\` | ${p.overlap}%${flag} | ${p.raw_overlap}% |`);
        }
    }
    fs.writeFileSync(OUT_MD, L.join('\n') + '\n', 'utf-8');
}

// --- changed mode ------------------------------------------------------------

function _changed(files: string[]): { pairs: Pair[]; fails: number } {
    // The boilerplate DF set is derived from the ESTABLISHED corpus only — the
    // change set under review is excluded. Without this, a batch of ≥ _dfFloor
    // near-identical re-skins submitted together would lift its OWN shared
    // shingles over the floor, be reclassified as boilerplate, subtracted from
    // every copy, and score 0 against each other — the gate blinds itself on
    // exactly the attack it exists to catch. "What is scaffold" must be defined
    // by the corpus as it stands, never by the diff proposing to change it.
    const changedRel = new Set(files.map((f) => _rel(path.resolve(ROOT, f))));

    // Build the corpus in RAW (template-subtracted, pre-DF) form per class so we
    // can derive the same boilerplate set the candidate is filtered against.
    const byClass = new Map<ArtifactClass, Artifact[]>();
    const boilerByClass = new Map<ArtifactClass, Set<string>>();
    const templateCache = new Map<ArtifactClass, Set<string>>();
    for (const spec of CLASSES) {
        const tmpl = _templateShingles(spec);
        templateCache.set(spec.name, tmpl);
        const arts = spec.files().map((f) => _load(f, spec.name, tmpl));
        // Established corpus = on-disk arts minus the change set.
        const boiler = _boilerplateSet(arts.filter((a) => !changedRel.has(a.relpath)));
        for (const a of arts) _subtract(a, boiler);
        byClass.set(spec.name, arts);
        boilerByClass.set(spec.name, boiler);
    }

    // Load each changed file as an artifact (skip un-classifiable ones) and
    // subtract the same class boilerplate so the comparison is apples-to-apples.
    const changedArts: Artifact[] = [];
    for (const f of files) {
        const abs = path.resolve(ROOT, f);
        const spec = _classify(abs);
        if (!spec || !_isFile(abs)) continue;
        const a = _load(abs, spec.name, templateCache.get(spec.name) as Set<string>);
        _subtract(a, boilerByClass.get(spec.name) as Set<string>);
        changedArts.push(a);
    }

    const pairs: Pair[] = [];
    const seen = new Set<string>();
    const record = (a: Artifact, b: Artifact): void => {
        if (a.relpath === b.relpath) return;
        const key = [a.relpath, b.relpath].sort().join(' ');
        if (seen.has(key)) return;
        const o = overlap(a, b);
        const r = rawOverlap(a, b);
        if (o >= WARN || r >= RAW_FAIL) {
            seen.add(key);
            const [x, y] = a.relpath <= b.relpath ? [a, b] : [b, a];
            pairs.push({ cls: a.cls, a: x.label, b: y.label, a_path: x.relpath, b_path: y.relpath, overlap: _round1(o), raw_overlap: _round1(r) });
        }
    };

    for (const cand of changedArts) {
        // vs the whole same-class corpus
        for (const other of byClass.get(cand.cls) ?? []) record(cand, other);
        // vs the other changed files of the same class
        for (const other of changedArts) if (other.cls === cand.cls) record(cand, other);
    }
    pairs.sort((x, y) => Math.max(y.overlap, y.raw_overlap) - Math.max(x.overlap, x.raw_overlap) || (x.a_path < y.a_path ? -1 : 1));
    return { pairs, fails: pairs.filter((p) => _isFail(p.overlap, p.raw_overlap)).length };
}

// --- main --------------------------------------------------------------------

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        process.stdout.write(_usage());
        return 0;
    }
    let quiet = false;
    let changedFiles: string[] | null = null;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--quiet') { quiet = true; }
        else if (a === '--changed') { changedFiles = args.slice(i + 1).filter((x) => !x.startsWith('-')); break; }
        else if (a.startsWith('-')) { process.stderr.write(`unrecognized argument: ${a}\n${_usage()}`); return 2; }
        else { process.stderr.write(`unexpected argument: ${a} (did you mean --changed ${a}?)\n${_usage()}`); return 2; }
    }

    if (changedFiles !== null) {
        const { pairs, fails } = _changed(changedFiles);
        if (pairs.length > 0) {
            const stream = fails > 0 ? process.stderr : process.stdout;
            stream.write(`lint_originality: ${pairs.length} overlap(s) surfaced (${fails} ≥ FAIL ${FAIL}% / RAW_FAIL ${RAW_FAIL}%):\n`);
            for (const p of pairs) {
                stream.write(`  [${p.cls}] ${p.a_path}  ~  ${p.b_path}  df ${p.overlap}% raw ${p.raw_overlap}%${_isFail(p.overlap, p.raw_overlap) ? '  ❌' : ''}\n`);
            }
        } else if (!quiet) {
            process.stdout.write(`lint_originality: OK — ${changedFiles.length} changed file(s), no overlap ≥ WARN ${WARN}% / RAW_FAIL ${RAW_FAIL}%.\n`);
        }
        return fails > 0 ? 1 : 0;
    }

    // Full audit
    const byClass = _corpus();
    const scanned = [...byClass.values()].reduce((n, a) => n + a.length, 0);
    if (scanned === 0) {
        process.stderr.write('❌  No artifacts found under the corpus roots.\n');
        return 3;
    }
    const dist = _distribution(byClass);
    const pairs = _fullPairs(byClass);
    _writeReport(byClass, pairs, dist);
    const fails = pairs.filter((p) => _isFail(p.overlap, p.raw_overlap)).length;
    if (!quiet) {
        process.stdout.write(
            `lint_originality: ${scanned} artifacts, worst ${dist.worst}% · p95 ${dist.p95}% · median ${dist.median}%; ` +
                `${pairs.length} pair(s) surfaced (${fails} ≥ FAIL ${FAIL}% / RAW_FAIL ${RAW_FAIL}%).\n`,
        );
        process.stdout.write(`   JSON: ${_rel(OUT_JSON)}\n`);
        process.stdout.write(`   MD:   ${_rel(OUT_MD)}\n`);
    }
    return fails > 0 ? 1 : 0;
}

function _usage(): string {
    return 'usage: lint_originality [--quiet] [--changed <file...>]\n';
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch { return false; }
}

if (_isCliEntry()) {
    process.exit(main());
}
