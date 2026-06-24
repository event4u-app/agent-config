/**
 * Lint the `risk_class` invariant on packs (road-to-capability-governance Phase 2).
 *
 * `risk_class: high` is the regulated-advice-adjacent tier. A high-risk pack MUST
 * ship conservatively — off by default, consent-gated, lab-tier — or it is a
 * governance hole. This linter makes that invariant a hard CI failure.
 *
 *   high  ⇒ default_install: false  AND  requires_explicit_consent: true  AND  surface_tier: lab
 *
 * `medium` / `low` carry no structural requirement here (their disclaimers live
 * in the domain safety floors). Absent `risk_class` = `low`.
 *
 * Pure core (`riskClassViolations`) takes the packs.yml text so it is unit-testable
 * without the filesystem. Exit 0 = clean, 1 = at least one violation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUIET = process.argv.includes('--quiet');
const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const PACKS_YML = path.join(REPO, 'src', 'config', 'discovery', 'packs.yml');

export interface RiskViolation {
    pack: string;
    msg: string;
}

function _field(block: string, key: string): string | undefined {
    return new RegExp(`(^|\\n)\\s*${key}:\\s*([^\\n#]+)`).exec(block)?.[2]?.trim();
}

/** Pure invariant check over packs.yml text. */
export function riskClassViolations(packsYml: string): RiskViolation[] {
    const out: RiskViolation[] = [];
    // Split into per-pack blocks on top-level `- id:` entries.
    const re = /(^|\n)- id:\s*([^\n#]+?)\s*\n([\s\S]*?)(?=\n- id:|\n*$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(packsYml)) !== null) {
        const id = (m[2] ?? '').trim();
        const block = m[3] ?? '';
        const risk = _field(block, 'risk_class') ?? 'low';
        if (risk !== 'high') continue;
        const checks: Array<[string, string, string]> = [
            ['default_install', 'false', `${id}: risk_class high requires default_install: false`],
            ['requires_explicit_consent', 'true', `${id}: risk_class high requires requires_explicit_consent: true`],
            ['surface_tier', 'lab', `${id}: risk_class high requires surface_tier: lab`],
        ];
        for (const [key, want, msg] of checks) {
            if (_field(block, key) !== want) out.push({ pack: id, msg });
        }
    }
    return out;
}

function _print(s: string): void {
    if (!QUIET) process.stdout.write(`${s}\n`);
}

export function main(): number {
    if (!fs.existsSync(PACKS_YML)) {
        _print('⚠️  packs.yml not found — skipping risk_class lint');
        return 0;
    }
    const violations = riskClassViolations(fs.readFileSync(PACKS_YML, 'utf-8'));
    if (violations.length === 0) {
        _print('✅  risk_class invariant OK — every high-risk pack is off-by-default + consent + lab');
        return 0;
    }
    _print(`❌  risk_class invariant — ${violations.length} violation(s):`);
    for (const v of violations) _print(`  - ${v.msg}`);
    return 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
