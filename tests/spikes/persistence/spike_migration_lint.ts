#!/usr/bin/env tsx
/**
 * Spike S0.3 — raw-SQL migration linter (road-to-scale-and-history-discipline
 * Phase 0). R-A6 migration-safety + R-A7 growth-budget on the fixture matrix,
 * plus a crash-test over a harvest of real-world migration files (the harvest
 * lives in a scratch dir, never committed; pass --harvest <dir> to point at it).
 *
 * PASS: every unsafe fixture yields exactly its labeled finding (rule + tier
 * parsed from the fixture's own `EXPECTED:` header), safe fixtures yield zero
 * non-waived findings, and the harvest scan crashes on zero files with at
 * least one file scanned.
 *
 * Verdict is data, not a gate — exit 0 always.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan_sql_files, collect_sql_files } from '../../../src/scripts/_lib/persistence/adapter_raw_sql.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '..', '..', 'fixtures', 'persistence', 'migrations');

interface UnsafeCheck {
    file: string;
    expected_rule: string;
    expected_tier: string;
    ok: boolean;
    got: string[];
}

function check_unsafe(): UnsafeCheck[] {
    const dir = path.join(FIXTURES, 'unsafe');
    const out: UnsafeCheck[] = [];
    for (const f of collect_sql_files(dir).sort()) {
        const head = fs.readFileSync(f, 'utf8').split('\n').slice(0, 4).join('\n');
        const m = head.match(/EXPECTED:\s*1 finding, rule (R-A\d+), (gate|advice) tier/);
        const expected_rule = m ? m[1]! : '?';
        const expected_tier = m ? m[2]! : '?';
        const res = scan_sql_files([f]);
        const findings = res.findings.filter((x) => !x.waived);
        const ok =
            findings.length === 1 &&
            findings[0]!.rule === expected_rule &&
            findings[0]!.tier === expected_tier;
        out.push({
            file: path.basename(f),
            expected_rule,
            expected_tier,
            ok,
            got: findings.map((x) => `${x.rule}/${x.tier}: ${x.message}`),
        });
    }
    return out;
}

function main(): void {
    const unsafe = check_unsafe();
    const unsafe_detected = unsafe.filter((u) => u.ok).length;

    const safe_res = scan_sql_files(collect_sql_files(path.join(FIXTURES, 'safe')));
    const safe_fp = safe_res.findings.filter((x) => !x.waived);

    const harvest_arg = process.argv.indexOf('--harvest');
    const harvest_dir = harvest_arg !== -1 ? process.argv[harvest_arg + 1] : '';
    let harvest_files = 0;
    let harvest_crashes = 0;
    if (harvest_dir && fs.existsSync(harvest_dir)) {
        const files = collect_sql_files(harvest_dir);
        harvest_files = files.length;
        harvest_crashes = scan_sql_files(files).crashed_files.length;
    }

    const pass =
        unsafe_detected === unsafe.length &&
        unsafe.length === 15 &&
        safe_fp.length === 0 &&
        harvest_crashes === 0 &&
        harvest_files > 0;

    const verdict = {
        spike: 'S0.3',
        unsafe_detected,
        unsafe_total: unsafe.length,
        unsafe_misses: unsafe.filter((u) => !u.ok),
        safe_false_positives: safe_fp.length,
        safe_fp_detail: safe_fp.map((x) => `${x.file}:${x.line} ${x.rule} ${x.message}`),
        harvest_dir: harvest_dir || null,
        harvest_files,
        harvest_crashes,
        pass,
    };
    process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
    process.stdout.write(
        `${pass ? '✅' : '❌'}  S0.3 migration-lint: unsafe ${unsafe_detected}/${unsafe.length}, ` +
            `safe FPs ${safe_fp.length}, harvest ${harvest_files} files / ${harvest_crashes} crashes\n`,
    );
}

main();
