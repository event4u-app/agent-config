#!/usr/bin/env tsx
/**
 * build_source_digests — derive the tracked deny digests from the private
 * master (`road-to-source-silence` Phase 1.1, resolution (c)).
 *
 * ## The shape the council chose
 *
 * Humans edit a readable list; the repository never sees it.
 *
 *   src/scripts/external_sources_denylist.private.json   ← gitignored MASTER
 *            │  { "deny": ["<readable pattern>", …] }
 *            ▼  build_source_digests  (needs SOURCE_DENY_KEY)
 *   src/scripts/external_sources_denylist.json           ← tracked, DERIVED
 *               { "deny_digests": ["<64 hex>", …] }
 *
 * "Plaintext in the tree" becomes structurally impossible rather than
 * disciplined away: the tracked artefact is derivational, and the readable list
 * exists in exactly one place, which is private.
 *
 * ## STATUS: this ships DORMANT and changes nothing by itself
 *
 * Running it is one quarter of the maintainer's atomic cutover. The other three
 * quarters — provisioning the CI secret, deleting the tracked plaintext `deny`
 * array, and switching CI to strict mode — are NOT in this change and must not
 * be split from each other. `docs/maintainers/source-deny-digests.md` is the
 * recipe. Until then `deny_digests` is empty, the plaintext gate stays in force,
 * and the digest code path does nothing.
 *
 * Modes:
 *   (default)   write digests into the tracked config from the private master
 *   --check     verify the tracked digests match the master; exit 1 on drift
 *   --stdout    print the digest array instead of writing (for inspection)
 *
 * Exit codes: 0 = done / in sync, 1 = drift (--check), 2 = usage or missing
 * input, 3 = no key (`SOURCE_DENY_KEY` unset).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { digest, DIGEST_RE, EXIT_NO_KEY, KEY_ENV, normalise } from './_lib/source_digest.js';

const _HERE = fileURLToPath(import.meta.url);
const DIR = path.dirname(_HERE);
export const TRACKED_CONFIG = path.join(DIR, 'external_sources_denylist.json');
export const PRIVATE_MASTER = path.join(DIR, 'external_sources_denylist.private.json');

interface Master {
    deny: string[];
}

/**
 * Digests for a master list, sorted and deduplicated.
 *
 * Sorted so the tracked artefact's diff shows an ADDITION as one line rather
 * than a reshuffle, and so two maintainers with the same master produce the
 * same file. Deduplicated because two spellings of one name fold to one digest
 * — `normalise` is not injective and must not be assumed to be.
 */
export function digestsFor(deny: readonly string[], key: string): string[] {
    const out = new Set<string>();
    for (const raw of deny) {
        const bare = normalise(raw.replace(/\\b/g, ''));
        if (bare.length < 3) continue;
        out.add(digest(bare, key));
    }
    return [...out].sort();
}

function readMaster(): Master {
    const raw = fs.readFileSync(PRIVATE_MASTER, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<Master>;
    if (!Array.isArray(parsed.deny) || parsed.deny.length === 0) {
        throw new Error('private master has no non-empty `deny` array');
    }
    return { deny: parsed.deny };
}

export function main(argv: readonly string[]): number {
    const check = argv.includes('--check');
    const toStdout = argv.includes('--stdout');

    const key = process.env[KEY_ENV] ?? '';
    if (key === '') {
        process.stderr.write(
            `❌  ${KEY_ENV} is unset. The digest construction is KEYED on purpose: the candidate\n` +
                '    space is public repository slugs, so an unsalted hash of a slug is a lookup,\n' +
                '    not a secret. Nothing is written without the key.\n',
        );
        return EXIT_NO_KEY;
    }

    let master: Master;
    try {
        master = readMaster();
    } catch (exc) {
        process.stderr.write(
            `❌  cannot read the private master at ${path.basename(PRIVATE_MASTER)}: ` +
                `${(exc as Error).message}\n` +
                '    It is gitignored by design and must be created by the maintainer — see\n' +
                '    docs/maintainers/source-deny-digests.md.\n',
        );
        return 2;
    }

    const digests = digestsFor(master.deny, key);
    if (!digests.every((d) => DIGEST_RE.test(d))) {
        process.stderr.write('❌  internal error: a produced digest is not 64 lowercase hex chars\n');
        return 2;
    }

    if (toStdout) {
        process.stdout.write(JSON.stringify(digests, null, 2) + '\n');
        return 0;
    }

    const cfg = JSON.parse(fs.readFileSync(TRACKED_CONFIG, 'utf-8')) as Record<string, unknown>;
    const current = Array.isArray(cfg.deny_digests) ? (cfg.deny_digests as string[]) : [];

    if (check) {
        const same = current.length === digests.length && current.every((d, i) => d === digests[i]);
        if (same) {
            process.stdout.write(`✅  ${String(digests.length)} deny digest(s) in sync with the private master.\n`);
            return 0;
        }
        process.stderr.write(
            `❌  deny_digests drift: tracked ${String(current.length)}, derived ${String(digests.length)}.\n` +
                '    Re-run without --check to regenerate.\n',
        );
        return 1;
    }

    cfg.deny_digests = digests;
    fs.writeFileSync(TRACKED_CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    process.stdout.write(`✅  wrote ${String(digests.length)} deny digest(s) to ${path.basename(TRACKED_CONFIG)}.\n`);
    process.stdout.write(
        '    This is ONE QUARTER of the cutover. The CI secret, the deletion of the plaintext\n' +
            '    deny array and the switch to strict mode ship in the SAME change or not at all.\n',
    );
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
