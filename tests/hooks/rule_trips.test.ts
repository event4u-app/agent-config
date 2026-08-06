/**
 * Rule-trip counting (road-to-credible-install Phase 6.3): a concern that
 * BLOCKs or WARNs during dispatch increments its counter in
 * agents/runtime/state/rule-trips.json. Seeded violation → count appears;
 * schema is fixed-field only (PII-exclusion-by-construction).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUNDLE = path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js');

describe('rule-trip counting', () => {
    it('a seeded block-no-verify violation increments the block counter', () => {
        if (!fs.existsSync(BUNDLE)) {
            // Bundle absent on a fresh checkout — build:hooks produces it; the
            // CI Static Checks job builds before tests that need dist/.
            console.warn('dist/hooks/dispatch.js missing — run `npm run build:hooks`; skipping');
            return;
        }
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-trips-'));
        try {
            const payload = JSON.stringify({
                session_id: 'trips-test',
                cwd: workspace,
                hook_event_name: 'PreToolUse',
                tool_name: 'Bash',
                tool_input: { command: 'git commit --no-verify -m x' },
            });
            let status = 0;
            try {
                execFileSync(
                    process.execPath,
                    [BUNDLE, '--platform', 'claude', '--event', 'pre_tool_use', '--project-dir', workspace],
                    { input: payload, encoding: 'utf-8' },
                );
            } catch (e) {
                status = (e as { status?: number }).status ?? 0;
            }
            // The violation was caught (BLOCK). The dispatch is `--platform claude
            // --event pre_tool_use`, so the exit code is the HOST-native one, not
            // the internal ladder: on Claude Code a policy refusal must exit 2
            // ("only exit code 2 blocks the action"; exit 1 is a non-blocking
            // error and the tool would proceed). Translation lives in
            // hooks/host_semantics.ts; the internal EXIT_BLOCK = 1 is unchanged
            // and still asserted directly against `_reduce` in
            // tests/scripts/hooks/dispatch_hook.test.ts.
            expect(status).toBe(2);

            const target = path.join(workspace, 'agents', 'runtime', 'state', 'rule-trips.json');
            expect(fs.existsSync(target)).toBe(true);
            const doc = JSON.parse(fs.readFileSync(target, 'utf-8')) as {
                schema_version: number;
                concerns: Record<string, { block: number; warn: number; last_trip: string }>;
            };
            expect(doc.schema_version).toBe(1);
            expect(doc.concerns['block-no-verify']?.block).toBeGreaterThanOrEqual(1);

            // PII-exclusion-by-construction: fixed fields only, no free-form
            // content field anywhere in the schema.
            for (const [name, entry] of Object.entries(doc.concerns)) {
                expect(Object.keys(entry).sort(), name).toEqual(['block', 'last_trip', 'warn']);
                expect(typeof entry.block).toBe('number');
                expect(typeof entry.warn).toBe('number');
                expect(entry.last_trip).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
        } finally {
            fs.rmSync(workspace, { recursive: true, force: true });
        }
    });

    it('a clean allow dispatch records no trips', () => {
        if (!fs.existsSync(BUNDLE)) return;
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-trips-clean-'));
        try {
            const payload = JSON.stringify({
                session_id: 'trips-test',
                cwd: workspace,
                hook_event_name: 'PreToolUse',
                tool_name: 'Read',
                tool_input: { file_path: path.join(workspace, 'x') },
            });
            execFileSync(
                process.execPath,
                [BUNDLE, '--platform', 'claude', '--event', 'pre_tool_use', '--project-dir', workspace],
                { input: payload, encoding: 'utf-8' },
            );
            const target = path.join(workspace, 'agents', 'runtime', 'state', 'rule-trips.json');
            expect(fs.existsSync(target)).toBe(false);
        } finally {
            fs.rmSync(workspace, { recursive: true, force: true });
        }
    });
});
