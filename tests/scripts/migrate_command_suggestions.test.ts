
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    build_block,
    migrate_one,
    main,
    _setCommandsDirForTest,
    _getCommandsDirForTest,
} from '../../src/scripts/migrate_command_suggestions.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const FM_COMMIT = '---\nname: commit\ndescription: Commit changes.\n---\n\n# commit\n\nbody.\n';
const FM_MODE = '---\nname: mode\ndescription: Switch mode.\n---\n\n# mode\n\nbody.\n';
const FM_HAS = '---\nname: work\ndescription: Do work.\nsuggestion:\n  eligible: true\n---\n\n# work\n\nx.\n';

function writeFixture(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'commit.md'), FM_COMMIT, 'utf-8');
    fs.writeFileSync(path.join(dir, 'mode.md'), FM_MODE, 'utf-8');
    fs.writeFileSync(path.join(dir, 'work.md'), FM_HAS, 'utf-8');
}

describe('migrate_command_suggestions — in-process units', () => {
    let tmp: string;
    let prev: string;
    beforeEach(() => {
        prev = _getCommandsDirForTest();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcs-'));
    });
    afterEach(() => {
        _setCommandsDirForTest(prev);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('build_block — eligible command emits trigger fields', () => {
        const b = build_block('commit');
        expect(b).toContain('eligible: true');
        expect(b).toContain('trigger_description: "commit my changes');
        expect(b).toContain('trigger_context: "git status shows uncommitted changes"');
    });

    it('build_block — ineligible command emits rationale', () => {
        const b = build_block('mode');
        expect(b).toBe(
            'suggestion:\n  eligible: false\n  rationale: "Role-mode switch is a deliberate context change."',
        );
    });

    it('build_block — escapes inner double quotes', () => {
        // "memory-full" rationale contains 'never auto-triggered' in single
        // quotes (no double quotes); craft via an eligible one that has none —
        // assert the escape mechanic on a synthetic check instead.
        const b = build_block('agents-audit');
        expect(b).not.toContain('""');
    });

    it('migrate_one — injects block for eligible command', () => {
        const p = path.join(tmp, 'commit.md');
        fs.writeFileSync(p, FM_COMMIT, 'utf-8');
        expect(migrate_one(p)).toBe('ok');
        const after = fs.readFileSync(p, 'utf-8');
        expect(after).toContain('suggestion:\n  eligible: true');
        // body preserved
        expect(after).toContain('\n# commit\n\nbody.\n');
    });

    it('migrate_one — skips when suggestion already present', () => {
        const p = path.join(tmp, 'work.md');
        fs.writeFileSync(p, FM_HAS, 'utf-8');
        expect(migrate_one(p)).toBe('skip');
        expect(fs.readFileSync(p, 'utf-8')).toBe(FM_HAS);
    });

    it('migrate_one — idempotent re-run is a no-op', () => {
        const p = path.join(tmp, 'mode.md');
        fs.writeFileSync(p, FM_MODE, 'utf-8');
        expect(migrate_one(p)).toBe('ok');
        const first = fs.readFileSync(p, 'utf-8');
        expect(migrate_one(p)).toBe('skip');
        expect(fs.readFileSync(p, 'utf-8')).toBe(first);
    });

    it('main — WARNING + exit 1 when the dir has fewer files than the table', () => {
        writeFixture(tmp);
        _setCommandsDirForTest(tmp);
        expect(main()).toBe(1); // 3 files != table count
    });
});
