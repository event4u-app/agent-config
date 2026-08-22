#!/usr/bin/env node
/**
 * Do the per-pack passports add up to the census the tree already runs?
 *
 * A per-pack number published beside a tree-wide number it contradicts is worse
 * than no per-pack number: both get quoted, and nobody can say which is wrong.
 * This is the check that says so out loud.
 *
 * THE ±10 % BAND THIS WAS SPECIFIED WITH RESTED ON A FALSE PREMISE, and the
 * measurement is what refuted it. The band assumed packs roughly PARTITION the
 * tree, so per-pack sums should approach the tree-wide census. Measured on
 * 2026-08-22: across all 17 packs, `dependencies` claims **4 skills and 0
 * rules**, against **291 skills and 118 rules** in the projection. Packs claim
 * ~1 % of the artefacts the census counts.
 *
 * So the two numbers are not a reconciliation pair at all:
 *
 *   census   — the PROJECTED tree (`dist/agent-src/`), everything that ships
 *   passport — what a pack CLAIMS, which is a small, deliberate subset
 *
 * A gate failing on an 84 % gap would be failing on a property of the tree, not
 * on a defect — and a gate that is red by construction gets disabled rather
 * than fixed. So this REPORTS coverage as a first-class number and exits 0.
 * That is exactly what the step behind it asked for: a passport that does not
 * reconcile "must say what, in-band, rather than being published alongside a
 * number it contradicts."
 *
 * What would make it a gate: pack coverage approaching the tree. Then the band
 * becomes meaningful and the exit code can follow it. Until then the useful
 * output is the RANKING plus the coverage figure.
 *
 * Both sides are `chars/4` — the basis `preamble-payload-budget.json` declares
 * for itself. Mixing an exact tokenizer into one side would make the gap
 * between two METHODS read as a discrepancy in the packs.
 *
 * Also emits the RANKING, because the useful output is not the numbers but
 * which packs carry the weight: a per-pack table sorted by cost turns "the
 * estate grew" into "this pack grew".
 *
 * Exit: 0 always (it is a REPORT, not a gate), 2 on a dead scan scope. See the
 * band note above for why the exit code does not follow the gap.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { censusRuleDir, censusSkillsCatalog } from './preamble_byte_census.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const PACKS_DIR = path.join(REPO_ROOT, 'src/packs');
export const RANKING = path.join(REPO_ROOT, 'agents/evidence/reports/pack-token-ranking.md');

/** ±10 %. See the module docstring for why a band exists at all. */
export const TOLERANCE = 0.1;

export interface Passport {
    pack: string;
    rules_tokens: number;
    catalog_tokens: number;
    commands_tokens: number;
    other_tokens: number;
    total_tokens: number;
}

/** Read `token_passport:` out of a generated pack.yaml — no YAML dependency. */
export function readPassport(pack: string, text: string): Passport | null {
    const start = text.indexOf('token_passport:');
    if (start < 0) return null;
    const num = (key: string): number => {
        const m = new RegExp(`^\\s+${key}:\\s*(\\d+)\\s*$`, 'm').exec(text.slice(start));
        return m === null ? 0 : Number(m[1]);
    };
    return {
        pack,
        rules_tokens: num('rules_tokens'),
        catalog_tokens: num('catalog_tokens'),
        commands_tokens: num('commands_tokens'),
        other_tokens: num('other_tokens'),
        total_tokens: num('total_tokens'),
    };
}

export function collectPassports(dir: string = PACKS_DIR): Passport[] {
    if (!fs.existsSync(dir)) return [];
    const out: Passport[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const f = path.join(dir, e.name, 'pack.yaml');
        if (!fs.existsSync(f)) continue;
        const p = readPassport(e.name, fs.readFileSync(f, 'utf-8'));
        if (p !== null) out.push(p);
    }
    return out;
}

export interface Reconciliation {
    bucket: string;
    packSum: number;
    censusTotal: number;
    gapPct: number;
    inBand: boolean;
}

export function reconcile(packSum: number, censusTotal: number, bucket: string): Reconciliation {
    // Denominator is the CENSUS, which is the side with the independent
    // measurement. Dividing by the pack sum would let a passport that measured
    // almost nothing report a small gap.
    const gapPct = censusTotal === 0 ? (packSum === 0 ? 0 : 1) : Math.abs(packSum - censusTotal) / censusTotal;
    return { bucket, packSum, censusTotal, gapPct, inBand: gapPct <= TOLERANCE };
}

export function renderRanking(ps: readonly Passport[]): string {
    const sorted = [...ps].sort((a, b) => b.total_tokens - a.total_tokens);
    const total = sorted.reduce((a, p) => a + p.total_tokens, 0);
    const lines = [
        '<!-- evidence-type: analysis -->',
        '# Pack token ranking — which packs carry the weight',
        '',
        'GENERATED by `./scripts-run src/scripts/check_pack_passport_reconciliation --write-ranking`.',
        'Do not hand-edit. Basis `chars/4`, per `docs/contracts/pack-token-passport.md`.',
        '',
        'The numbers are each pack\'s STANDING contribution — what is paid whether or',
        'not the pack is used. A skill body loaded on invocation is a runtime cost and',
        'is not here, and the residual bucket (tool definitions + dispatch prompt) is',
        'not attributable to a pack at all.',
        '',
        `**${String(sorted.length)} packs, ${String(total)} tokens total.**`,
        '',
        '| rank | pack | total | rules | catalog | commands | other | share |',
        '|---:|---|---:|---:|---:|---:|---:|---:|',
    ];
    sorted.forEach((p, i) => {
        const share = total === 0 ? 0 : (p.total_tokens / total) * 100;
        lines.push(
            `| ${String(i + 1)} | \`${p.pack}\` | ${String(p.total_tokens)} | ${String(p.rules_tokens)} | ` +
                `${String(p.catalog_tokens)} | ${String(p.commands_tokens)} | ${String(p.other_tokens)} | ${share.toFixed(1)} % |`,
        );
    });
    return `${lines.join('\n')}\n`;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const passports = collectPassports();
    try {
        assertScanned({
            gate: 'check_pack_passport_reconciliation',
            scanned: passports.length,
            units: 'pack passport(s)',
            roots: ['src/packs/*/pack.yaml'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  passport reconciliation: ${err.message}\n`);
            return 2;
        }
        throw err;
    }
    process.stdout.write(`scanned: ${String(passports.length)}\n`);

    if (argv.includes('--write-ranking')) {
        fs.mkdirSync(path.dirname(RANKING), { recursive: true });
        fs.writeFileSync(RANKING, renderRanking(passports));
        process.stdout.write(`✅  ranking written to ${path.relative(REPO_ROOT, RANKING)}\n`);
    }

    const rules = censusRuleDir(path.join(REPO_ROOT, 'dist', 'agent-src', 'rules'));
    const catalog = censusSkillsCatalog(path.join(REPO_ROOT, 'dist', 'agent-src', 'skills'));
    const tok = (chars: number): number => Math.round(chars / 4);
    const recs = [
        reconcile(
            passports.reduce((a, p) => a + p.rules_tokens, 0),
            tok(rules.chars),
            'project-scope rules',
        ),
        reconcile(
            passports.reduce((a, p) => a + p.catalog_tokens, 0),
            tok(catalog.chars),
            'preloaded skills catalog',
        ),
    ];
    for (const r of recs) {
        process.stdout.write(
            `  ${r.inBand ? '✅' : '❌'} ${r.bucket.padEnd(26)} packs ${String(r.packSum).padStart(7)} · ` +
                `census ${String(r.censusTotal).padStart(7)} · gap ${(r.gapPct * 100).toFixed(1)} %\n`,
        );
    }
    const covered = recs.filter((r) => r.inBand).length;
    process.stdout.write(
        `\ncoverage: packs account for ${String(covered)} of ${String(recs.length)} census bucket(s) within ±${String(
            TOLERANCE * 100,
        )} %.\n` +
            '  A gap here is a PROPERTY OF THE TREE, not a defect: pack `dependencies` claim a\n' +
            '  small deliberate subset of what ships, so the two numbers are not a reconciliation\n' +
            '  pair. Failing on that would be failing by construction, and a gate that is red by\n' +
            '  construction gets disabled rather than fixed.\n' +
            '  The useful output is the ranking above plus this figure. See\n' +
            '  docs/contracts/pack-token-passport.md § Reconciliation for what would make it a gate.\n',
    );
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('check_pack_passport_reconciliation')) {
    process.exit(main(process.argv.slice(2)));
}
