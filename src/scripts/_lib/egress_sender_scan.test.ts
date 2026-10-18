import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { main } from '../egress_sender_census.js';
import { classifyModule, scanSenders } from './egress_sender_scan.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function fixtureRepo(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-census-'));
    tmpDirs.push(root);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    return root;
}

describe('sender census over this tree', () => {
    const rows = scanSenders(REPO);
    const modules = new Set(rows.map((r) => r.module));

    it('lists every sender the roadmap names in F8', () => {
        const f8 = [
            'src/scripts/ai_council/api_transport.ts',
            'src/scripts/_lib/trigger_routers.ts',
            'src/scripts/second_brain_run.ts',
            'src/scripts/rdp_quality_eval.ts',
            'src/scripts/_lib/llm_proposer_transport.ts',
            ...fs
                .readdirSync(path.join(REPO, 'src/scripts/ai-image/adapters'))
                .filter((f) => f.endsWith('.sh'))
                .map((f) => `src/scripts/ai-image/adapters/${f}`),
        ];
        expect(f8.filter((m) => !modules.has(m))).toEqual([]);
    });

    it('matches the table committed to the contract', () => {
        expect(main([], REPO)).toBe(0);
    });
});

describe('classification', () => {
    it('reports a send to an unknown endpoint as unclassified, never absent', () => {
        const root = fixtureRepo({
            'src/scripts/fixture_sender.ts':
                "export async function send(b: string) {\n    return await fetch('https://llm.unknown-vendor.test/v1/chat', { method: 'POST', body: b });\n}\n",
        });
        const rows = scanSenders(root);
        expect(rows.map((r) => [r.module, r.status, r.endpoints])).toEqual([
            ['src/scripts/fixture_sender.ts', 'unclassified', ['llm.unknown-vendor.test']],
        ]);
    });

    it('makes no row for a send to a known non-provider host', () => {
        expect(classifyModule('src/scripts/x.ts', "await fetch('https://api.github.com/repos');")).toBeNull();
    });

    it('marks a provider endpoint without a send shape unclassified', () => {
        const row = classifyModule('src/scripts/x.ts', "const HOSTS = ['api.openai.com'];");
        expect(row?.status).toBe('unclassified');
    });

    it('reads a curl subprocess as a send shape', () => {
        const row = classifyModule(
            'src/scripts/x.ts',
            "const u = 'https://api.anthropic.com/v1/messages';\nspawnSync('curl', ['-sS', u]);",
        );
        expect(row?.status).toBe('sender');
    });

    it('reads the content marker and a direct engine import', () => {
        const row = classifyModule(
            'src/scripts/x.ts',
            // Split so the prepack import scan does not read the fixture as a real import.
            "// egress-content: fixed-corpus\nimport { replaceValues } from '" +
                "./_lib/egress_token.js';\nawait fetch('https://api.openai.com/v1');",
        );
        expect([row?.content, row?.engine]).toEqual(['fixed-corpus', true]);
    });

    it('does not count an import of a table constant as passing the engine', () => {
        const row = classifyModule(
            'src/scripts/x.ts',
            "import { vendorPrefix } from '" + "./_lib/egress_rules.js';\nawait fetch('https://api.openai.com/v1');",
        );
        expect(row?.engine).toBe(false);
    });

    it('keeps an adapter with a configured endpoint as an unclassified row', () => {
        const row = classifyModule('src/scripts/ai-image/adapters/new.sh', '#!/usr/bin/env bash\naiv_post "$AIV_ENDPOINT"\n');
        expect([row?.status, row?.endpoints]).toEqual(['unclassified', ['configured']]);
    });
});
