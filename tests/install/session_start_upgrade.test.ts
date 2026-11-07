// road-to-a-session-start-under-the-host-limit 3.2 — install and upgrade write
// the reduced layer with no opt-in.
//
// A scratch HOME first carries a FULL layer, written the way an older install
// left it: `install --full`, then the pin removed from the receipt, so the
// ledger records full-body digests and nothing on the machine asks for full.
// `agent-config upgrade` re-runs `install --global` (cmd_upgrade step 2), so the
// next install run IS the upgrade under test. One rule is edited in between.
//
// The 80,000-char bound itself is the gate's (`check_session_start_budget`);
// it is red until Phases 1–2 of the roadmap land, so this file pins the
// mechanism — reduction, form per rule, the edit kept, the repeat a no-op —
// and leaves the number to the gate rather than asserting a bound it knows
// the tree does not meet yet.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { measureSessionStartLayer, projectDefaultInstall } from '../../src/scripts/check_session_start_budget.js';
import { KERNEL_RULE_ID_SET } from '../../src/scripts/_lib/kernel_rules.js';
import { THIN_BODY_POINTER_RE, build_thin, is_thin_entry } from '../../src/scripts/_lib/thin_rules.js';
import { USER_PIN_FIELD } from '../../src/install/userPin.js';
import { ruleBody, startupContract } from '../../src/scripts/_lib/rule_law_section.js';
import { RULE_BODIES_INDEX, resolveBodyPointer } from '../../src/install/installThinLayer.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST_RULES = path.join(REPO, 'dist', 'agent-src', 'rules');

function snapshot(dir: string): Map<string, string> {
    const out = new Map<string, string>();
    for (const n of fs.readdirSync(dir).sort()) out.set(n, fs.readFileSync(path.join(dir, n), 'utf8'));
    return out;
}

describe('an upgrade over a full layer writes the reduced layer', () => {
    let home: string;
    let rules: string;
    let edited: string;
    let editedBytes: string;
    let fullTotal: number;
    let afterUpgrade: Map<string, string>;

    beforeAll(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'ssu-home-'));
        rules = path.join(home, '.claude', 'rules');

        const first = projectDefaultInstall(REPO, home, ['--full']);
        expect(first.ok, first.output.slice(-2000)).toBe(true);
        expect(first.layer).toBe('full');
        const receiptFile = path.join(home, '.event4u', 'agent-config', 'runtime', 'carrier.json');
        const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8')) as Record<string, unknown>;
        delete receipt[USER_PIN_FIELD];
        fs.writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
        fullTotal = measureSessionStartLayer(rules).total;

        // A rule the projector would stub — so keeping it is the preserve path, not the predicate.
        const stubs = build_thin(DIST_RULES, null, null, null, { packageRoot: REPO });
        edited = [...stubs.keys()].sort().find((name) => {
            const src = fs.readFileSync(path.join(DIST_RULES, name), 'utf8');
            return stubs.get(name) !== src && fs.existsSync(path.join(rules, name));
        }) as string;
        expect(edited).toBeDefined();
        fs.appendFileSync(path.join(rules, edited), '\n<!-- my own note -->\n');
        editedBytes = fs.readFileSync(path.join(rules, edited), 'utf8');

        // A preserved user edit is reported as a conflict, which the installer
        // signals with a non-zero exit; the deploy itself completed.
        const upgrade = projectDefaultInstall(REPO, home);
        expect(upgrade.output).toContain(`Preserved user-modified`);
        expect(upgrade.output).toContain(edited);
        expect(upgrade.layer).toBe('thinned');
        afterUpgrade = snapshot(rules);
    }, 600_000);

    afterAll(() => {
        fs.rmSync(home, { recursive: true, force: true });
    });

    it('cuts the session-start layer well below the full form', () => {
        const total = measureSessionStartLayer(rules).total;
        // Measured 2026-11-07 with 26–28 contracts in dist: full ~369k, reduced ~99–107k.
        expect(total).toBeLessThan(fullTotal / 2);
    });

    it('keeps the kernel whole and stubs the rest — contracts where a rule carries one', () => {
        let contracts = 0;
        for (const [name, text] of afterUpgrade) {
            const id = name.replace(/\.md$/, '');
            if (name === edited) continue;
            if (KERNEL_RULE_ID_SET.has(id)) {
                expect(is_thin_entry(text), name).toBe(false);
                continue;
            }
            if (is_thin_entry(text) && /^- \*\*When:\*\*/m.test(text)) contracts += 1;
        }
        expect(contracts).toBeGreaterThan(0);
        expect([...afterUpgrade.values()].filter((t) => is_thin_entry(t)).length).toBeGreaterThan(50);
    });

    it('leaves the rule the consumer edited byte-identical', () => {
        expect(afterUpgrade.get(edited)).toBe(editedBytes);
    });

    it('declares the bodies directory once, in a package-owned index the stubs point through', () => {
        const index = afterUpgrade.get(RULE_BODIES_INDEX) as string;
        expect(index).toContain('package: event4u/agent-config');
        const dir = /The bodies are in `([^`]+)\/`/.exec(index)?.[1] as string;
        const stub = [...afterUpgrade.values()].find((t) => is_thin_entry(t)) as string;
        const pointer = THIN_BODY_POINTER_RE.exec(stub)?.[1] as string;
        expect(path.isAbsolute(pointer)).toBe(false);
        expect(fs.existsSync(resolveBodyPointer(pointer, dir))).toBe(true);
    });

    it('every installed contract carries its verified source contract, only the heading removed', () => {
        const index = afterUpgrade.get(RULE_BODIES_INDEX) as string;
        const dir = /The bodies are in `([^`]+)\/`/.exec(index)?.[1] as string;
        let checked = 0;
        for (const name of fs.readdirSync(DIST_RULES).filter((n) => n.endsWith('.md'))) {
            const contract = startupContract(ruleBody(fs.readFileSync(path.join(DIST_RULES, name), 'utf8')));
            const installed = afterUpgrade.get(name);
            if (contract === null || installed === undefined || name === edited) continue;
            expect(installed, name).toContain(contract.replace(/^#{1,6}[^\n]*\n+/, ''));
            const pointer = THIN_BODY_POINTER_RE.exec(installed)?.[1] as string;
            expect(fs.existsSync(resolveBodyPointer(pointer, dir)), name).toBe(true);
            checked += 1;
        }
        expect(checked).toBeGreaterThanOrEqual(20);
    });

    it('a second upgrade changes nothing', () => {
        const again = projectDefaultInstall(REPO, home);
        expect(again.layer).toBe('thinned');
        expect(snapshot(rules)).toEqual(afterUpgrade);
    }, 300_000);

    it('an install that keeps the layer full reaps the index with the stubs', () => {
        const pinned = projectDefaultInstall(REPO, home, ['--full']);
        expect(pinned.layer).toBe('full');
        expect(fs.existsSync(path.join(rules, RULE_BODIES_INDEX))).toBe(false);
        expect([...snapshot(rules).values()].some((t) => is_thin_entry(t))).toBe(false);
    }, 300_000);
});
