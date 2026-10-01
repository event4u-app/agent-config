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
import { recordedHashesForRoot } from './recordedOwnership.js';
/** The first line every `.windsurfrules` this package generates carries. */
export const WINDSURFRULES_HEADER = '# Auto-generated from .augment/rules/ — do not edit directly';
/** Every file path beneath `full`, or `[full]` when it is a file. */
function filesUnder(full) {
    let stat;
    try {
        stat = fs.lstatSync(full);
    }
    catch {
        return [];
    }
    if (!stat.isDirectory())
        return [full];
    const out = [];
    for (const name of fs.readdirSync(full)) {
        out.push(...filesUnder(path.join(full, name)));
    }
    return out;
}
/**
 * Remove the stale entries of ours from `dir`, keeping everything else.
 *
 * An entry is removable only when the manifest claims every file it contains:
 * one unclaimed file inside a directory keeps the whole directory, because
 * removing it would take that file with it.
 */
export function cleanOwnedOnly(dir, valid, owned) {
    let entries;
    try {
        entries = fs.readdirSync(dir);
    }
    catch {
        return { removed: [], kept: 0 };
    }
    const removed = [];
    let kept = 0;
    for (const name of entries) {
        if (name === 'README.md' || valid.has(name))
            continue;
        const full = path.join(dir, name);
        const contained = filesUnder(full);
        const ours = contained.length > 0 && contained.every((f) => owned.has(path.resolve(f)));
        if (!ours) {
            kept += 1;
            continue;
        }
        try {
            fs.rmSync(full, { recursive: true, force: true });
            removed.push(name);
        }
        catch {
            kept += 1;
        }
    }
    return { removed, kept };
}
/**
 * May this package write `.windsurfrules` at `target`?
 *
 * Yes when the file is absent, when it still carries the header this package
 * generates, or when the manifest claims the path. A file that is none of
 * those belongs to someone else and is left exactly as it is.
 */
export function mayWriteWindsurfRules(target, owned) {
    if (!fs.existsSync(target))
        return true;
    if (owned.has(path.resolve(target)))
        return true;
    let head;
    try {
        head = fs.readFileSync(target, 'utf-8').split('\n', 1)[0] ?? '';
    }
    catch {
        // Unreadable is unproven, and unproven means do not touch it.
        return false;
    }
    return head.trim() === WINDSURFRULES_HEADER;
}
/** The manifest's claimed paths for a consumer root; empty when none resolves. */
export function ownedPaths(projectRoot) {
    return recordedHashesForRoot(projectRoot);
}
/** The one line the emitter prints when it kept a neighbour's files. */
export function keptLine(kept) {
    if (kept <= 0)
        return null;
    return `kept: ${kept} neighbour file(s)`;
}
//# sourceMappingURL=host_rule_ownership.js.map