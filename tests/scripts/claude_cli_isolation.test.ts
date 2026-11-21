// Guard: a script that sandboxes the `claude` CLI with a throwaway HOME must
// sandbox CLAUDE_CONFIG_DIR too. The CLI resolves its config from
// CLAUDE_CONFIG_DIR first; a session started through a config-dir wrapper
// exports it, so a HOME-only sandbox writes marketplace sources and enabled
// plugins into the developer's REAL config. `task ci` did exactly that via
// smoke_host_loadability.sh until this guard existed.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

// Subcommands that write host state. `validate` / `list` only read.
const MUTATING = /\bplugin\s+(?:marketplace\s+(?:add|remove|update)|install|uninstall|enable|disable|update)\b/;
const HOME_OVERRIDE = /(?:^|[\s;(])HOME=/;

/** Lines that override HOME for a mutating `claude plugin` call without CLAUDE_CONFIG_DIR. */
export function unisolatedLines(text: string): number[] {
    const hits: number[] = [];
    text.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('#')) return;
        if (MUTATING.test(line) && HOME_OVERRIDE.test(line) && !line.includes('CLAUDE_CONFIG_DIR=')) {
            hits.push(i + 1);
        }
    });
    return hits;
}

function scanTargets(): string[] {
    const out: string[] = [];
    const walk = (dir: string, exts: string[]): void => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name !== 'node_modules') walk(p, exts);
            } else if (exts.some((x) => e.name.endsWith(x))) {
                out.push(p);
            }
        }
    };
    walk(path.join(REPO_ROOT, 'src', 'scripts'), ['.sh', '.ts']);
    walk(path.join(REPO_ROOT, 'taskfiles'), ['.yml', '.yaml']);
    walk(path.join(REPO_ROOT, '.github', 'workflows'), ['.yml', '.yaml']);
    for (const f of ['Taskfile.yml']) {
        const p = path.join(REPO_ROOT, f);
        if (fs.existsSync(p)) out.push(p);
    }
    return out;
}

describe('claude CLI sandbox isolation', () => {
    it('flags a HOME-only sandbox (the shape that leaked into the real config)', () => {
        expect(unisolatedLines('HOME="$TMP_HOME" "$CLAUDE_BIN" plugin marketplace add "$REPO_ROOT"')).toEqual([1]);
        expect(unisolatedLines('HOME="$T" claude plugin install a@b')).toEqual([1]);
    });

    it('accepts a sandbox that sets CLAUDE_CONFIG_DIR, and read-only calls', () => {
        expect(
            unisolatedLines('HOME="$T" CLAUDE_CONFIG_DIR="$T/.claude" "$CLAUDE_BIN" plugin install a@b'),
        ).toEqual([]);
        expect(unisolatedLines('HOME="$T" "$CLAUDE_BIN" plugin list')).toEqual([]);
        expect(unisolatedLines('# HOME="$T" claude plugin install a@b')).toEqual([]);
    });

    it('no script, task or workflow sandboxes HOME without CLAUDE_CONFIG_DIR', () => {
        const targets = scanTargets();
        expect(targets.length).toBeGreaterThan(0);
        const offenders = targets.flatMap((f) =>
            unisolatedLines(fs.readFileSync(f, 'utf8')).map((n) => `${path.relative(REPO_ROOT, f)}:${n}`),
        );
        expect(offenders).toEqual([]);
    });

    it('the host-loadability smoke routes every mutating call through the isolated helper', () => {
        const smoke = fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'smoke_host_loadability.sh'), 'utf8');
        expect(smoke).toMatch(/tmp_claude\(\)\s*\{[^}]*CLAUDE_CONFIG_DIR="\$TMP_HOME\/\.claude"/);
        const direct = smoke
            .split('\n')
            .filter((l) => !l.trimStart().startsWith('#') && /"\$CLAUDE_BIN"/.test(l) && MUTATING.test(l));
        expect(direct).toEqual([]);
    });
});
