import { describe, expect, it } from 'vitest';

import { segmentVerdict } from '../../src/scripts/_lib/credential_files.js';
import { lineFeedsAnother, narrowedSegmentVerdict } from '../../src/scripts/_lib/credential_operands.js';

/**
 * Must-allow: the credential token is a search pattern, a jq filter, a commit
 * message or an echo argument. The first three are redacted from refusals
 * found in local transcript stores on 2026-11-21 (paths and values replaced);
 * the rest are the retro's F3 shapes.
 */
const MUST_ALLOW: readonly string[] = [
    'grep -n "w.key\\|\\.key)" src/Modules/*.lua',
    `gh search repos "addon" --json fullName,license --jq '.[] | "\\(.fullName)\\t\\(.license.key)"'`,
    'grep -rn "APP_ENV\\|.env" core/includes',
    'rg ".env" src',
    'echo .env',
    'git commit -m "docs: mention .env"',
    "gh api repos/o/r -q '.licenseInfo.key'",
    "jq '.private.key' data.json",
    "sed 's/ .env / x /' README.txt",
    "awk '{print \".env\"}' notes.txt",
    'rg -n -e ".env" src',
    'git commit -am "drop .env from docs"',
];

/** Must-refuse: the credential is a file the command reads, under every shape the narrowing touches. */
const MUST_REFUSE: readonly string[] = [
    'cat .env',
    'grep KEY .env',
    'source .env',
    'cp .env x',
    'grep -n "^DB_" .env.testing',
    'grep -f .env src',
    'grep -e KEY .env',
    'rg --file=.env src',
    'grep --exclude-from .env KEY src',
    'sed -n p .env',
    'sed -e p .env',
    "awk '{print}' .env",
    'awk -f .env data.txt',
    'jq . .env',
    "jq --rawfile a .env -n '$a'",
    'jq -f .env data.json',
    'echo $(cat .env)',
    "printf '%s' \"$(cat .env)\"",
    'grep KEY < .env',
    'sudo grep KEY .env',
    'git commit -F .env',
    'rg -g .env KEY',
    'grep -Z KEY .env',
];

describe('credential operands', () => {
    it.each(MUST_ALLOW)('the live guard refuses %s (unwired gap)', (cmd) => {
        expect(segmentVerdict(cmd)).not.toBeNull();
    });

    it.each(MUST_ALLOW)('narrowing allows %s', (cmd) => {
        expect(narrowedSegmentVerdict(cmd, lineFeedsAnother(cmd))).toBeNull();
    });

    it.each(MUST_REFUSE)('narrowing still refuses %s', (cmd) => {
        expect(segmentVerdict(cmd)).not.toBeNull();
        expect(narrowedSegmentVerdict(cmd, lineFeedsAnother(cmd))).not.toBeNull();
    });

    it('does not narrow echo on a line that feeds another command', () => {
        expect(lineFeedsAnother('echo .env | xargs cat')).toBe(true);
        expect(narrowedSegmentVerdict('echo .env', true)).not.toBeNull();
        expect(lineFeedsAnother('npm test || echo failed')).toBe(false);
    });

    it('never refuses what the live guard allows', () => {
        for (const cmd of ['grep -rn "\\.env" src', 'ls -la', 'git status']) {
            expect(segmentVerdict(cmd)).toBeNull();
            expect(narrowedSegmentVerdict(cmd, false)).toBeNull();
        }
    });
});
