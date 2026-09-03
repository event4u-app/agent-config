/**
 * The drift renderer, moved out of `cmd_doctor.ts`.
 *
 * WHY IT MOVED, because a reader will otherwise take this for a drive-by
 * refactor. `cmd_doctor.ts` sits thousands of lines past the 1,500-line
 * threshold `check_source_size_budget` measures, so every line added to it
 * counts as new excess — and that ratchet turns one way, with its own test
 * asserting `baseline == live` in BOTH directions.
 *
 * `doctor --strict` needed fifteen lines of integration wiring in that file
 * that cannot live anywhere else: an import, two option fields, four argv-table
 * splices, a validator call, both exit paths, and the payload attachment. So
 * the choice was to raise the ratchet or to pay it down. The ratchet's own test
 * comment answers that: a commit which splits a god-file lowers the excess and
 * must carry the lowered baseline. Paying down is the response it was designed
 * for; raising it is what the gate calls a defect.
 *
 * THIS function was chosen, and the choice is not arbitrary. It is pure
 * rendering with two dependencies — a print sink and the tag id — no argparse
 * involvement, and therefore none of the byte-parity risk the parser surface
 * carries against the retired Python implementation. Nothing outside
 * `cmd_doctor.ts` imported it; `cmd_prune.ts` has a same-named local of its own
 * and is untouched. Behaviour is identical and the export surface is preserved
 * by re-export.
 */

type Dict = Record<string, unknown>;

const PACKAGE_TAG_ID = 'event4u/agent-config';

function print(line = ''): void {
    process.stdout.write(`${line}\n`);
}

export function _emit_text(
    project_root: string,
    missing: Dict[],
    modified: Dict[],
    foreign: Dict[],
    tag_drift: Dict[],
): void {
    const total = missing.length + modified.length + foreign.length + tag_drift.length;
    if (total === 0) {
        print(`✅  doctor: manifest matches filesystem under ${project_root}`);
        return;
    }
    print(`⚠️   doctor: ${total} drift item(s) under ${project_root}`);
    const groups: ReadonlyArray<[string, Dict[]]> = [
        ['missing', missing],
        ['modified', modified],
        ['foreign', foreign],
        ['tag-drift', tag_drift],
    ];
    for (const [label, items] of groups) {
        if (items.length === 0) {
            continue;
        }
        print(`\n  ${label} (${items.length}):`);
        for (const it of items) {
            const tool = (it['tool'] as string) || '?';
            print(`    · [${tool}] ${it['path']}`);
            if (label === 'tag-drift') {
                const found = (it['found'] as string) || '(missing)';
                const expected = 'expected' in it ? it['expected'] : PACKAGE_TAG_ID;
                print(`        expected: ${expected}`);
                print(`        found:    ${found}`);
            }
            print(`        fix: ${it['fix']}`);
        }
    }
}
