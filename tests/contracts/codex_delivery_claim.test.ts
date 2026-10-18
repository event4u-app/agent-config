// Host covered: codex only. Other hosts sharing the same bundle are a separate
// measurement and are deliberately not asserted here.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const EVIDENCE = 'agents/evidence/analysis/codex-global-delivery-reading-2026-10-18.md';

function row(file: string, label: RegExp): string {
    const line = readFileSync(resolve(ROOT, file), 'utf8')
        .split('\n')
        .find((l) => l.startsWith('|') && label.test(l));
    if (line === undefined) throw new Error(`no ${String(label)} row in ${file}`);
    return line;
}

describe('codex delivery claim agrees with the codex probe', () => {
    it('the evidence record exists and names the build it was taken against', () => {
        const text = readFileSync(resolve(ROOT, EVIDENCE), 'utf8');
        expect(text).toContain('<!-- evidence-type: analysis -->');
        expect(text).toContain('codex-cli 0.148.0');
    });

    it('install-layout says only skills/ is read and the rest is inert', () => {
        const line = row('docs/contracts/install-layout.md', /^\| codex \| `~\/\.codex\/` \|/);
        expect(line).toContain('`skills/`');
        expect(line).toMatch(/read by the host: `skills\/` only/);
        expect(line).toMatch(/`rules\/`, `commands\/` and `personas\/` are delivered but not read/);
        expect(line).toMatch(/no `~\/\.codex\/AGENTS\.md`/);
        expect(line).toContain('codex-global-delivery-reading-2026-10-18.md');
    });

    it('README project row claims AGENTS.md and no native skills or commands', () => {
        const line = row('README.md', /\*\*Codex CLI\*\*/);
        const cells = line.split('|').map((c) => c.trim());
        expect(cells[3]).toBe('—');
        expect(cells[4]).not.toBe('✅');
        expect(cells[5]).toContain('`AGENTS.md`');
    });
});
