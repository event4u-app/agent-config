import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// AC-4 of road-to-map-views-from-the-handover, on the map that is actually
// committed: the bugs-page test plants data in a temp tree, this one reads
// agents/map/ as shipped. A path that merely spells a branch name is a tracked
// file and public already; what may not ship is the local branch chain
// (`--branches`) or any bug-lane payload.

const MAP_DIR = path.resolve('agents/map');

function files(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name !== '.build') files(f, out);
        } else if (/\.(json|html|md)$/.test(e.name)) {
            out.push(f);
        }
    }
    return out;
}

describe('committed map privacy (AC-4)', () => {
    const shipped = files(MAP_DIR);

    it('reads a non-empty committed map', () => {
        expect(shipped.length).toBeGreaterThan(0);
    });

    it.each(shipped.map((f) => [path.relative(MAP_DIR, f), f]))('%s carries no branch chain', (_rel, f) => {
        const body = fs.readFileSync(f, 'utf8');
        expect(body).not.toMatch(/"branches"\s*:\s*\{\s*"chain"/);
        expect(body).not.toMatch(/"(current_branch|currentBranch|headRef|head_ref)"\s*:/);
    });

    // Shapes of a credential a logging or SDK config could leak into a payload
    // (road-to-a-map-that-holds-on-the-real-repo 4.8). Names such as SENTRY_DSN
    // are fine; a value is not.
    const SECRET_SHAPES: Array<[string, RegExp]> = [
        ['DSN with credentials', /https?:\/\/[0-9a-f]{16,}(:[0-9a-f]+)?@[a-z0-9.-]+\/\d+/i],
        ['Slack webhook', /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/],
        ['bearer or API token', /\b(sk-[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16})\b/],
        ['URL with inline password', /[a-z][a-z0-9+.-]*:\/\/[^\s/:@"']+:[^\s/@"']{6,}@[a-z0-9.-]+/i],
    ];
    it.each(shipped.map((f) => [path.relative(MAP_DIR, f), f]))('%s carries no secret shape', (_rel, f) => {
        const body = fs.readFileSync(f, 'utf8');
        for (const [kind, re] of SECRET_SHAPES) expect(re.exec(body)?.[0], kind).toBeUndefined();
    });

    it.each(shipped.map((f) => [path.relative(MAP_DIR, f), f]))('%s carries no bug-lane record', (_rel, f) => {
        const body = fs.readFileSync(f, 'utf8');
        expect(body).not.toMatch(/"bugs"\s*:\s*\[\s*\{\s*"id"/);
        expect(body).not.toMatch(/"reader"\s*:\s*"bugs lane/);
    });
});
