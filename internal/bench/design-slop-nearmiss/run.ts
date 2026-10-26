#!/usr/bin/env node
/**
 * design-slop near-miss bench (road-to-tells-a-near-miss-can-refute Phase 1).
 *
 * The clean corpus cannot refute a rule (26 rules at M1 = 0, `design-slop-fp`).
 * This one can: every file under `tune/` and `holdout/` is a LEGITIMATE use that
 * a naive detector of its tell would flag, written from the catalog prose by an
 * agent that did not see the detectors. M1 per rule per split is the number of
 * those files a rule fires on — a false positive by construction.
 *
 * `dogfood/` is this repository's own UI: the findings it carries today,
 * labelled TP or near-miss by hand in `DOGFOOD-LABELS.json`. Its number is
 * precision on real code, reported on its own and never folded into M1.
 *
 * Pre-registration: `internal/bench/corpora/design-slop-nearmiss-PREREG.md`.
 *
 * Usage:
 *   npx tsx internal/bench/design-slop-nearmiss/run.ts [--json]
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SLOP_RULES } from '../../../src/scripts/design_slop_rules.js';
import { contextFromText, scanFile } from '../../../src/scripts/lint_design_slop.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const CORPUS_DIR = path.join(REPO, 'internal', 'bench', 'corpora', 'design-slop-nearmiss');
export const SPLITS = ['tune', 'holdout'] as const;

const NO_CTX = { raw: '', has: () => false };

export interface Label {
    catalog_id: string;
    split: (typeof SPLITS)[number];
    signal: string;
    basis: string;
    author: string;
    /**
     * The DESIGN.md text a file's legitimacy rests on, where the catalog's own
     * override is a declaration ("declared as such", "document the decision").
     * Without it the detector is right to fire; with it the 0.2 reader decides.
     */
    intent?: string;
    /**
     * `false` when adjudication found the catalog grants the use no exemption,
     * so the file is a true positive by the catalog's own wording and is left
     * out of M1. `adjudication` says why.
     */
    valid?: boolean;
    adjudication?: string;
}

/** The context a near-miss file is scanned in: its declared intent, nothing else. */
export function contextFor(label: Label) {
    return label.intent ? contextFromText(label.intent) : NO_CTX;
}

export interface DogfoodLabel {
    file: string;
    line: number;
    rule: string;
    catalog_id: string;
    label: 'tp' | 'near-miss';
    basis: string;
}

export interface SplitScore {
    split: string;
    files: number;
    /** rule id → near-miss files it fired on */
    m1: Record<string, string[]>;
}

export interface DogfoodScore {
    labelled: number;
    /** rule id → counts over the labelled findings the rule produced today */
    per_rule: Record<string, { tp: number; near_miss: number; precision: number | null }>;
    /** findings the tree produces today that carry no label */
    unlabelled: string[];
    /** labelled findings the tree no longer produces */
    gone: string[];
}

export interface NearMissResult {
    corpus_digest: string;
    rule_count: number;
    splits: SplitScore[];
    /** catalog ids with a near-miss file in the corpus */
    covered_catalog_ids: string[];
    /** registry catalog ids with NO near-miss file — a rule the corpus cannot refute */
    uncovered_catalog_ids: string[];
    dogfood: DogfoodScore;
}

export function loadLabels(dir: string = CORPUS_DIR): Record<string, Label> {
    const p = path.join(dir, 'LABELS.json');
    if (!fs.existsSync(p)) return {};
    return (JSON.parse(fs.readFileSync(p, 'utf8')) as { files: Record<string, Label> }).files;
}

export function digest(dir: string, rels: string[]): string {
    const h = crypto.createHash('sha256');
    for (const rel of [...rels].sort()) {
        h.update(`${rel}:${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex')}\n`);
    }
    return h.digest('hex').slice(0, 16);
}

export function scoreSplits(dir: string = CORPUS_DIR, labels = loadLabels(dir)): SplitScore[] {
    return SPLITS.map((split) => {
        const rels = Object.keys(labels)
            .filter((r) => labels[r]!.split === split && labels[r]!.valid !== false)
            .sort();
        const m1: Record<string, string[]> = {};
        for (const rel of rels) {
            const abs = path.join(dir, rel);
            if (!fs.existsSync(abs)) continue;
            const fired = new Set(
                scanFile(fs.readFileSync(abs, 'utf8'), path.basename(rel), contextFor(labels[rel]!)).map((f) => f.rule),
            );
            for (const rule of fired) (m1[rule] ??= []).push(rel);
        }
        return { split, files: rels.length, m1 };
    });
}

export function scoreDogfood(dir: string = CORPUS_DIR, repo: string = REPO): DogfoodScore {
    const p = path.join(dir, 'DOGFOOD-LABELS.json');
    const labels = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as { findings: DogfoodLabel[] }).findings : [];
    const key = (file: string, line: number, rule: string) => `${file}:${line}:${rule}`;
    const byKey = new Map(labels.map((l) => [key(l.file, l.line, l.rule), l]));
    const seen = new Set<string>();
    const unlabelled: string[] = [];
    const per_rule: DogfoodScore['per_rule'] = {};
    for (const file of [...new Set(labels.map((l) => l.file))].sort()) {
        const abs = path.join(repo, file);
        if (!fs.existsSync(abs)) continue;
        for (const f of scanFile(fs.readFileSync(abs, 'utf8'), file, NO_CTX)) {
            const k = key(file, f.line, f.rule);
            const l = byKey.get(k);
            if (!l) {
                unlabelled.push(k);
                continue;
            }
            seen.add(k);
            const r = (per_rule[f.rule] ??= { tp: 0, near_miss: 0, precision: null });
            if (l.label === 'tp') r.tp += 1;
            else r.near_miss += 1;
        }
    }
    for (const r of Object.values(per_rule)) r.precision = r.tp + r.near_miss === 0 ? null : r.tp / (r.tp + r.near_miss);
    return {
        labelled: labels.length,
        per_rule,
        unlabelled,
        gone: [...byKey.keys()].filter((k) => !seen.has(k)),
    };
}

export function scoreAll(dir: string = CORPUS_DIR): NearMissResult {
    const labels = loadLabels(dir);
    const rels = Object.keys(labels).filter((r) => fs.existsSync(path.join(dir, r)));
    const covered = [...new Set(rels.map((r) => labels[r]!.catalog_id))].sort();
    const registry = [...new Set(SLOP_RULES.map((r) => r.catalogId))].sort();
    return {
        corpus_digest: digest(dir, rels),
        rule_count: SLOP_RULES.length,
        splits: scoreSplits(dir, labels),
        covered_catalog_ids: covered,
        uncovered_catalog_ids: registry.filter((c) => !covered.includes(c)),
        dogfood: scoreDogfood(dir),
    };
}

function report(r: NearMissResult): string {
    const out: string[] = [];
    out.push(`design-slop near-miss bench · ${r.rule_count} rules · corpus ${r.corpus_digest}`);
    for (const s of r.splits) {
        const fired = Object.entries(s.m1);
        out.push(`${s.split}: ${s.files} near-miss file(s); M1 > 0 for ${fired.length} rule(s)`);
        for (const [rule, files] of fired) out.push(`  ${rule} — ${files.length}: ${files.join(', ')}`);
    }
    if (r.uncovered_catalog_ids.length) out.push(`no near-miss yet for: ${r.uncovered_catalog_ids.join(', ')}`);
    out.push(`dogfood: ${r.dogfood.labelled} labelled finding(s)`);
    for (const [rule, c] of Object.entries(r.dogfood.per_rule)) {
        out.push(`  ${rule} — TP ${c.tp}, near-miss ${c.near_miss}, precision ${c.precision === null ? 'n/a' : c.precision.toFixed(2)}`);
    }
    if (r.dogfood.unlabelled.length) out.push(`  unlabelled today: ${r.dogfood.unlabelled.length}`);
    if (r.dogfood.gone.length) out.push(`  labelled but gone: ${r.dogfood.gone.length}`);
    return out.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (Object.keys(loadLabels()).length === 0) {
        process.stderr.write('design-slop near-miss bench: no LABELS.json — a bench that scans nothing is an error, not a pass\n');
        return 1;
    }
    const r = scoreAll();
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(r, null, 2)}\n` : `${report(r)}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
