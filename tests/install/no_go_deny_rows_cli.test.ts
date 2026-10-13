// Tests for src/scripts/no_go_deny_rows.ts —
// road-to-a-project-contract-written-down Phase 2 (2.2, 2.3).
//
// The CLI is what `/agents:init` step 6b actually invokes, and until a review
// said so it had no test at all: the `--apply` gate, the unenforceable-host
// refusal, the pre-write loss check and the temp-file rename all lived in the
// untested half, and both blocker-class defects the review found were in it.
//
// AC-3 — "a no-go naming a path becomes a host deny row only after consent, and
// existing deny entries survive unchanged" — is an acceptance criterion about
// THIS command, so it is discharged here rather than by a prose record of a
// manual run.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../src/scripts/no_go_deny_rows.js';

const tmps: string[] = [];

afterEach(() => {
    vi.restoreAllMocks();
    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});

/** A consumer tree with an AGENTS.md and, optionally, a settings file. */
function tree(noGos: string, settings?: string): { agentsMd: string; settingsPath: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nogo-cli-'));
    tmps.push(root);
    const agentsMd = path.join(root, 'AGENTS.md');
    fs.writeFileSync(agentsMd, `# Demo\n\n## No-gos\n\n${noGos}\n\n## Goal\n\nShip it.\n`, 'utf8');
    const settingsPath = path.join(root, '.claude', 'settings.json');
    if (settings !== undefined) {
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        fs.writeFileSync(settingsPath, settings, 'utf8');
    }
    return { agentsMd, settingsPath };
}

/** Run `main` with stdout and stderr captured. */
function run(argv: string[]): { code: number; out: string; err: string } {
    let out = '';
    let err = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => {
        out += String(c);
        return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((c: string | Uint8Array) => {
        err += String(c);
        return true;
    });
    const code = main(argv);
    vi.restoreAllMocks();
    return { code, out, err };
}

const EXISTING = `{
    "permissions": {
        "allow": ["Bash(npm run lint)"],
        "deny": [
            "Read(./.env)"
        ]
    },
    "model": "opus"
}
`;

describe('without --apply the command writes nothing', () => {
    it('leaves the settings file byte-for-byte unchanged', () => {
        // This is the decline path: a skip is the ABSENCE of a second call, so
        // what has to hold is that the first call never writes.
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', EXISTING);
        const r = run([agentsMd, '--settings', settingsPath]);
        expect(r.code).toBe(0);
        expect(fs.readFileSync(settingsPath, 'utf8')).toBe(EXISTING);
    });

    it('shows the row it would add, and says nothing was written', () => {
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', EXISTING);
        const r = run([agentsMd, '--settings', settingsPath]);
        expect(r.out).toContain('Edit(migrations/**)');
        expect(r.out).toContain('Nothing was written');
    });

    it('creates no settings file when none exists', () => {
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand');
        run([agentsMd, '--settings', settingsPath]);
        expect(fs.existsSync(settingsPath)).toBe(false);
    });
});

describe('with --apply the command appends on consent', () => {
    it('appends the row and preserves the existing entry and the file around it', () => {
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', EXISTING);
        const r = run([agentsMd, '--settings', settingsPath, '--apply']);
        expect(r.code).toBe(0);
        const after = fs.readFileSync(settingsPath, 'utf8');
        const parsed = JSON.parse(after) as {
            permissions: { allow: string[]; deny: string[] };
            model: string;
        };
        expect(parsed.permissions.deny).toEqual(['Read(./.env)', 'Edit(migrations/**)']);
        expect(parsed.permissions.allow).toEqual(['Bash(npm run lint)']);
        expect(parsed.model).toBe('opus');
        expect(after.startsWith(EXISTING.slice(0, EXISTING.indexOf('"deny"')))).toBe(true);
        expect(after.endsWith(EXISTING.slice(EXISTING.indexOf('"model"')))).toBe(true);
    });

    it('creates a readable settings file when none exists', () => {
        // The common case for a fresh repository, and the one shape no
        // existing-file fixture covers. An inline `{}` seed produced a file
        // ending `}}`.
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand');
        expect(run([agentsMd, '--settings', settingsPath, '--apply']).code).toBe(0);
        const after = fs.readFileSync(settingsPath, 'utf8');
        expect(
            (JSON.parse(after) as { permissions: { deny: string[] } }).permissions.deny,
        ).toEqual(['Edit(migrations/**)']);
        expect(after).not.toContain('}}');
        expect(after.endsWith('}\n')).toBe(true);
    });

    it('leaves no temporary file behind', () => {
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', EXISTING);
        run([agentsMd, '--settings', settingsPath, '--apply']);
        expect(fs.existsSync(`${settingsPath}.agent-config.tmp`)).toBe(false);
    });

    it('is idempotent — a second run adds nothing', () => {
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', EXISTING);
        run([agentsMd, '--settings', settingsPath, '--apply']);
        const once = fs.readFileSync(settingsPath, 'utf8');
        const r = run([agentsMd, '--settings', settingsPath, '--apply']);
        expect(fs.readFileSync(settingsPath, 'utf8')).toBe(once);
        expect(r.out).toContain('already present');
    });
});

describe('the command refuses rather than damaging the file', () => {
    it('refuses a settings file whose `permissions` is not an object', () => {
        // The blocker: this used to write a SECOND `permissions` key, report
        // success, and leave the consented rule with no effect.
        const body = '{\n    "permissions": null,\n    "model": "opus"\n}\n';
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', body);
        const r = run([agentsMd, '--settings', settingsPath, '--apply']);
        expect(r.code).toBe(1);
        expect(fs.readFileSync(settingsPath, 'utf8')).toBe(body);
    });

    it('refuses a settings file whose `permissions.deny` is not an array', () => {
        const body = '{\n    "permissions": {\n        "deny": null\n    }\n}\n';
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', body);
        const r = run([agentsMd, '--settings', settingsPath, '--apply']);
        expect(r.code).toBe(1);
        expect(fs.readFileSync(settingsPath, 'utf8')).toBe(body);
    });

    it('refuses a malformed settings file', () => {
        const body = '{ not json\n';
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', body);
        const r = run([agentsMd, '--settings', settingsPath, '--apply']);
        expect(r.code).toBe(1);
        expect(fs.readFileSync(settingsPath, 'utf8')).toBe(body);
    });

    it('exits 1 when the AGENTS.md does not exist', () => {
        expect(run(['/nonexistent/AGENTS.md']).code).toBe(1);
    });

    it('refuses an unknown flag rather than guessing', () => {
        expect(run(['--nope']).code).toBe(2);
    });
});

describe('a host with no established deny list', () => {
    it('writes nothing even with --apply, and says so', () => {
        const { agentsMd, settingsPath } = tree('- Never edit `migrations/` by hand', EXISTING);
        const r = run([agentsMd, '--settings', settingsPath, '--host', 'cowork', '--apply']);
        expect(r.code).toBe(0);
        expect(fs.readFileSync(settingsPath, 'utf8')).toBe(EXISTING);
        expect(r.out).toContain('--apply ignored');
    });
});

describe('a section with nothing enforceable', () => {
    it('writes nothing and reports the bullets as instruction-only', () => {
        const { agentsMd, settingsPath } = tree(
            '- Never add a runtime dependency without an ADR',
            EXISTING,
        );
        const r = run([agentsMd, '--settings', settingsPath, '--apply']);
        expect(r.code).toBe(0);
        expect(fs.readFileSync(settingsPath, 'utf8')).toBe(EXISTING);
        expect(r.out).toContain('nothing to enforce');
    });
});
