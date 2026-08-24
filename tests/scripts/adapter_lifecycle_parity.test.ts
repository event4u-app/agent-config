// Adapter lifecycle parity — the second pass of lint_media_policy_linkage.
//
// road-to-skill-link-integrity-and-manifest-sync Phase 3 Step 2. It closes the
// hole docs/contracts/provider-lifecycle.md:101 names in its own words: "Editing
// an adapter and leaving its header `Lifecycle:` comment out of sync with
// agents/templates/.ai-video.xml.example → violation (CI does not catch this;
// the agent must)."
//
// The check is EXPECTED GREEN on the real tree — the roadmap's premise of a live
// contradiction was refuted, the two obliged surfaces agree at `stable`. A check
// that finds nothing on the day it ships can rot unnoticed, exactly like the
// rule it replaces, so its sensitivity is proven by fixtures that must be red
// asserted in the same file as the real-tree green.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    adapter_lifecycle_findings,
    count_adapters,
    parse_example_lifecycles,
} from '../../src/scripts/lint_media_policy_linkage.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');

let tmp: string;
let adapters: string;
let xmlPath: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'alp-'));
    adapters = path.join(tmp, 'adapters');
    fs.mkdirSync(adapters, { recursive: true });
    xmlPath = path.join(tmp, '.ai-video.xml.example');
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function adapter(id: string, tier: string | null): void {
    const header = tier === null ? '# no tier here\n' : `# Lifecycle: ${tier} — reason\n`;
    fs.writeFileSync(path.join(adapters, `${id}.sh`), `#!/usr/bin/env bash\n${header}\n`, 'utf-8');
}

function xml(entries: Array<[string, string]>): void {
    const body = entries
        .map(([id, tier]) => `  <provider id="${id}" kind="video">\n    <lifecycle>${tier}</lifecycle>\n  </provider>`)
        .join('\n');
    fs.writeFileSync(xmlPath, `<ai-video>\n${body}\n</ai-video>\n`, 'utf-8');
}

describe('adapter lifecycle parity', () => {
    it('is green on the real tree', () => {
        expect(count_adapters()).toBeGreaterThan(0);
        expect(adapter_lifecycle_findings()).toEqual([]);
    });

    it('is RED on a fixture whose header and xml disagree', () => {
        adapter('kling', 'stable');
        xml([['kling', 'experimental']]);
        const f = adapter_lifecycle_findings(adapters, xmlPath);
        expect(f).toHaveLength(1);
        expect(f[0]).toContain('kling.sh');
        expect(f[0]).toContain('`stable`');
        expect(f[0]).toContain('<lifecycle>experimental</lifecycle>');
    });

    it('is RED on a shipped adapter the example never declares', () => {
        adapter('ghost', 'stable');
        xml([['kling', 'stable']]);
        const f = adapter_lifecycle_findings(adapters, xmlPath);
        expect(f).toHaveLength(1);
        expect(f[0]).toContain('no <provider id="ghost">');
    });

    it('is RED on an adapter with no Lifecycle header', () => {
        adapter('kling', null);
        xml([['kling', 'stable']]);
        const f = adapter_lifecycle_findings(adapters, xmlPath);
        expect(f).toEqual(['adapters/kling.sh: no `# Lifecycle:` header comment']);
    });

    it('is green when every header matches', () => {
        adapter('kling', 'stable');
        adapter('comfyui', 'experimental');
        xml([
            ['kling', 'stable'],
            ['comfyui', 'experimental'],
            // A provider with no adapter is NOT a finding — the example declares
            // allin1 and whisperx, neither of which has one.
            ['allin1', 'experimental'],
        ]);
        expect(adapter_lifecycle_findings(adapters, xmlPath)).toEqual([]);
    });

    it('first declaration wins, so a repeated placeholder id cannot overwrite a real entry', () => {
        xml([
            ['my-future-backend', 'stable'],
            ['my-future-backend', 'experimental'],
        ]);
        expect(parse_example_lifecycles(fs.readFileSync(xmlPath, 'utf-8')).get('my-future-backend')).toBe(
            'stable',
        );
    });

    // The § 5 day-one table must never be able to fail this check: it records
    // `higgsfield` as `experimental` while both live surfaces say `stable`.
    it('the day-one table is not an input — its stale row does not produce a finding', () => {
        const contract = fs.readFileSync(
            path.join(REPO, 'docs', 'contracts', 'provider-lifecycle.md'),
            'utf-8',
        );
        expect(contract).toContain('| `higgsfield` | image+video | `experimental` |');
        expect(adapter_lifecycle_findings()).toEqual([]);
    });
});
