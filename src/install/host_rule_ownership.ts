/**
 * Which host-rule files this package may delete or overwrite.
 *
 * The defect this closes: `_cleanDir` removed every entry under
 * `.cursor/rules` and `.windsurf/rules` whose NAME was not one this run had
 * just emitted, and `.windsurfrules` was overwritten unconditionally. A rule
 * file another agent package wrote — or one the consumer wrote by hand — was
 * destroyed on every install, which is the opposite of what the uninstall
 * claim promises.
 *
 * Ownership is read from the installed-tools manifest's `files[]` inventory,
 * never from a marker inside the file. The `.mdc` emitter writes no package
 * tag (`condense.ts` `_emit_cursor_mdc`), so a tag-based gate would classify
 * every file this package ever wrote as foreign and therefore never remove a
 * stale one — it would read as conservative and in fact be inert. The manifest
 * is the record of what this installer actually put on disk, so it is the
 * thing that can answer the question.
 *
 * This module only READS that manifest. It never rewrites it: the available
 * reader (`installed_tools.read_manifest`) drops nested `files[]` by design,
 * so a read-modify-write through it would erase every other tool's inventory —
 * the failure `manifestFiles.ts` documents at length.
 *
 * The consequence, stated rather than implied: a consumer whose manifest does
 * not claim a path gets that path KEPT. Unproven means kept, never deleted.
 * That is the safe direction for this lane and it is also a real limit — a
 * stale file of ours sitting under an unclaimed path stays until something
 * claims it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { sha256OfFile } from './fsPrimitives.js';
import { classifyOwnership, recordedHashesForRoot, type RecordedHashes } from './recordedOwnership.js';

/** The first line every `.windsurfrules` this package generates carries. */
export const WINDSURFRULES_HEADER = '# Auto-generated from .augment/rules/ — do not edit directly';

export interface CleanResult {
    /** Entry names removed from the directory. */
    removed: string[];
    /** Entries kept because nothing proves this package wrote them. */
    kept: number;
}

/** Every file path beneath `full`, or `[full]` when it is a file. */
function filesUnder(full: string): string[] {
    let stat: fs.Stats;
    try {
        stat = fs.lstatSync(full);
    } catch {
        return [];
    }
    if (!stat.isDirectory()) return [full];
    const out: string[] = [];
    for (const name of fs.readdirSync(full)) {
        out.push(...filesUnder(path.join(full, name)));
    }
    return out;
}

/**
 * Is this exact file ours AND still carrying the bytes we wrote?
 *
 * The recorded digest is the point, not the path. A path-membership test
 * answers "did we ever write here", which merges two materially different
 * trees: a generated file still as we left it, and one the consumer has since
 * edited. Deleting the second loses their work, and `recordedOwnership` exists
 * to tell them apart — importing its map and then ignoring its hashes was the
 * defect an independent review named here.
 */
function isUnchangedOurs(file: string, owned: RecordedHashes): boolean {
    const target = path.resolve(file);
    if (!owned.has(target)) return false;
    return classifyOwnership(owned.get(target), sha256OfFile(target)) === 'recorded-unchanged';
}

/**
 * Remove the stale entries of ours from `dir`, keeping everything else.
 *
 * An entry is removable only when every file it contains is ours AND
 * unmodified: one unclaimed or edited file inside a directory keeps the whole
 * directory, because removing it would take that file with it.
 */
export function cleanOwnedOnly(
    dir: string,
    valid: ReadonlySet<string>,
    owned: RecordedHashes,
): CleanResult {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return { removed: [], kept: 0 };
    }
    const removed: string[] = [];
    let kept = 0;
    for (const name of entries) {
        if (name === 'README.md' || valid.has(name)) continue;
        const full = path.join(dir, name);
        const contained = filesUnder(full);
        const ours = contained.length > 0 && contained.every((f) => isUnchangedOurs(f, owned));
        if (!ours) {
            kept += 1;
            continue;
        }
        try {
            fs.rmSync(full, { recursive: true, force: true });
            removed.push(name);
        } catch {
            kept += 1;
        }
    }
    return { removed, kept };
}

/**
 * May this package write `.windsurfrules` at `target`?
 *
 * Yes when the file is absent, or when it still carries the header this
 * package generates. Nothing else.
 *
 * A manifest claim is deliberately NOT a second route in. The file is
 * generated and overwritten on every install, so the header IS the ownership
 * signal and it is content-derived: if the header is gone, something replaced
 * the file, and "the manifest says we wrote here once" is exactly the stale
 * fact that would let us overwrite a neighbour's replacement. An independent
 * review caught that route open, with a fixture asserting it.
 */
export function mayWriteWindsurfRules(target: string, owned: RecordedHashes): boolean {
    void owned;
    if (!fs.existsSync(target)) return true;
    let head: string;
    try {
        head = fs.readFileSync(target, 'utf-8').split('\n', 1)[0] ?? '';
    } catch {
        // Unreadable is unproven, and unproven means do not touch it.
        return false;
    }
    return head.trim() === WINDSURFRULES_HEADER;
}

/**
 * May this package write a rule file at `target`?
 *
 * The cleanup pass is not enough on its own, and an independent review found
 * the hole: `_cleanDir` skips every name this run just emitted, so a
 * neighbour's `foo.mdc` that happens to share a basename with one of our
 * rules was already OVERWRITTEN by the time ownership was consulted. The
 * check has to run BEFORE the write, which is what this is for.
 *
 * Absent, or ours and unmodified → write. Anything else is someone's file or
 * someone's edit, and is left exactly as it is.
 */
export function mayWriteRuleFile(target: string, owned: RecordedHashes): boolean {
    if (!fs.existsSync(target)) return true;
    return isUnchangedOurs(target, owned);
}

/** The manifest's claimed paths for a consumer root; empty when none resolves. */
export function ownedPaths(projectRoot: string): RecordedHashes {
    return recordedHashesForRoot(projectRoot);
}

/** The one line the emitter prints when it kept a neighbour's files. */
export function keptLine(kept: number): string | null {
    if (kept <= 0) return null;
    return `kept: ${kept} neighbour file(s)`;
}
