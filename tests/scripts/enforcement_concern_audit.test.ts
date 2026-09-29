import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    concernSlotAudit,
    renderConcernAudit,
} from '../../src/scripts/check_enforcement_matrix.js';
import { parseHostLowering } from '../../src/scripts/hooks/host_lowering.js';

/**
 * A minimal two-host tree: one host whose `pre_tool_use` denies, one whose does
 * not, and the same blocking concern bound on both. The audit must name it on
 * exactly one of them — that asymmetry is the whole behaviour, and a fixture
 * with only the failing host could not tell "names the right one" from "names
 * every one".
 */
const LOWERING = `hosts:
  denier:
    surfaces:
      any:
        entry_shape: json
        json_shape: claude
        fail_policy: propagate
        verified:
          docs_at: "2026-09-01"
          expires: "2099-01-01"
        slots:
          pre_tool_use:
            native: PreToolUse
            block_exit: 2
          post_tool_use:
            native: PostToolUse
            block_exit: null
  discarder:
    surfaces:
      any:
        entry_shape: json
        json_shape: claude
        fail_policy: discard
        verified:
          docs_at: "2026-09-01"
          expires: "2099-01-01"
        slots:
          pre_tool_use:
            native: PreToolUse
            block_exit: null
          post_tool_use:
            native: PostToolUse
            block_exit: null
`;

const MANIFEST = `schema_version: 1
concerns:
  a-guard:
    script: src/scripts/hooks/x.ts
    severity: blocking
  a-reporter:
    script: src/scripts/hooks/y.ts
    severity: advisory
  no-severity:
    script: src/scripts/hooks/z.ts
platforms:
  denier:
    pre_tool_use:  [a-guard]
    post_tool_use: [a-reporter]
  discarder:
    pre_tool_use:  [a-guard, no-severity]
    post_tool_use: [a-reporter]
`;

function tree(manifest = MANIFEST): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'concern-audit-'));
    fs.mkdirSync(path.join(dir, 'src', 'scripts', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'), manifest, 'utf-8');
    return dir;
}

const lowering = (): ReturnType<typeof parseHostLowering> => parseHostLowering(LOWERING);

describe('concernSlotAudit — which concerns sit where a refusal cannot go', () => {
    it('counts the denying slots per host', () => {
        const audit = concernSlotAudit(tree(), lowering());
        const byHost = new Map(audit.map((h) => [h.host, h]));
        expect(byHost.get('denier')).toMatchObject({ denySlots: 1, lowerableSlots: 2 });
        expect(byHost.get('discarder')).toMatchObject({ denySlots: 0, lowerableSlots: 2 });
    });

    it('names a blocking concern only on the host whose slot cannot deny', () => {
        const audit = concernSlotAudit(tree(), lowering());
        const byHost = new Map(audit.map((h) => [h.host, h]));

        // The same guard is bound on both hosts. Only the discarding one is a finding.
        expect(byHost.get('denier')!.nullBlock.map((b) => b.concern)).not.toContain('a-guard');
        expect(byHost.get('discarder')!.nullBlock).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ concern: 'a-guard', severity: 'blocking' }),
            ]),
        );
    });

    it('an advisory concern on a null-block slot is reported, not treated as blocking', () => {
        const audit = concernSlotAudit(tree(), lowering());
        const denier = audit.find((h) => h.host === 'denier')!;
        const reporter = denier.nullBlock.find((b) => b.concern === 'a-reporter');
        expect(reporter).toMatchObject({ slot: 'post_tool_use', severity: 'advisory' });
        expect(denier.nullBlock.filter((b) => b.severity === 'blocking')).toEqual([]);
    });

    it('a concern with no declared severity is neither hidden nor called blocking', () => {
        const audit = concernSlotAudit(tree(), lowering());
        const d = audit.find((h) => h.host === 'discarder')!;
        expect(d.nullBlock.find((b) => b.concern === 'no-severity')?.severity).toBe('(undeclared)');
        expect(d.nullBlock.filter((b) => b.severity === 'blocking').map((b) => b.concern)).toEqual([
            'a-guard',
        ]);
    });

    it('blocking bindings sort ahead of the rest', () => {
        const audit = concernSlotAudit(tree(), lowering());
        const d = audit.find((h) => h.host === 'discarder')!;
        expect(d.nullBlock[0]!.severity).toBe('blocking');
    });

    it('a slot the lowering table does not carry is not counted', () => {
        // `session_start` is bound but absent from the lowering fixture: an
        // unlowerable slot is a different finding and belongs to the row gate.
        const audit = concernSlotAudit(
            tree(`${MANIFEST}    session_start: [a-guard]\n`),
            lowering(),
        );
        for (const h of audit) {
            expect(h.nullBlock.map((b) => b.slot)).not.toContain('session_start');
        }
    });

    it('an unreadable manifest yields no audit rather than a crash', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'concern-audit-empty-'));
        expect(concernSlotAudit(dir, lowering())).toEqual([]);
    });
});

describe('renderConcernAudit', () => {
    it('prints a per-host count line and flags each blocking binding', () => {
        const lines = renderConcernAudit(concernSlotAudit(tree(), lowering()));
        const text = lines.join('\n');
        expect(text).toMatch(/denier\s+1\/2 lowerable slot\(s\) deny/);
        expect(text).toMatch(/discarder\s+0\/2 lowerable slot\(s\) deny/);
        expect(text).toContain('a-guard (blocking) on pre_tool_use');
        // The advisory one is counted but not flagged with a warning line.
        expect(text).not.toContain('a-reporter (advisory) on');
    });
});
