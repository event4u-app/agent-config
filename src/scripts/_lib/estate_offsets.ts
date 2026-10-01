/**
 * How a CHANGE touches the roadmap estate — the diff half, read once.
 *
 * `check_estate_count` answers two different questions with two different
 * inputs. The count half reads the TREE and ratchets it against the base ref's
 * tree. This module is the other half: it reads the DIFF and says what the
 * change did — which roadmaps entered the active top level, which left it, which
 * of the arrivals declared an exemption, and what that exemption says.
 *
 * WHY IT LIVES HERE AND NOT IN THE GATE. `check_source_size_budget` scores
 * `Σ max(0, lines(f) − 1500)` over `src/**` and the gate crossed the ceiling
 * when the exemption-shape work landed. That gate does not object to new code;
 * it objects to new code in the file that is already too big to read, and the
 * ratchet was right about which file that was. The seam it forced is the one a
 * reader would draw anyway — tree-reading on one side of it, diff-reading on the
 * other — so the extraction is a correction rather than a concession.
 *
 * `exemptionReason` sits here rather than beside the vocabulary it feeds
 * (`exemption_shape.ts`) because this is the module that READS a change; that
 * one is the module that JUDGES a reason. The split is read-then-judge, and
 * keeping it means the vocabulary module imports no filesystem and no git.
 */
import * as path from 'node:path';

import {
    is_roadmap_candidate as isRoadmapCandidate,
    parse_frontmatter as parseFrontmatter,
} from '../../agent-src/scripts/update_roadmap_progress.js';

/** How a change touched the active roadmap tree, as git reports it. */
export interface OffsetLedger {
    /** Files that entered the active top level: new files, and un-parked ones. */
    added: string[];
    /** Files that left it: deleted, archived, parked or merged away. */
    offsets: string[];
    /** Added files carrying an `estate_offset_exempt:` reason, with the reason. */
    exempt: Array<{ file: string; reason: string }>;
    /**
     * The subset of `offsets` that went to `later/`.
     *
     * Tracked separately because parking is the one offset that RAISES another
     * gated count: active falls by one and later rises by one, which under an
     * exact floor is growth in `later_roadmaps` unless this allowance exists.
     * Kept out of a general "any offset raises any allowance" rule on purpose —
     * an archived roadmap must not buy a new `later/` file.
     */
    parked: string[];
}

/** An `estate_growth_exempt:` reason ADDED to a roadmap in this change. */
export interface GrowthClaim {
    /** The roadmap the claim was added to, as git reports the path. */
    file: string;
    reason: string;
}

/** `agents/roadmaps/<name>.md` — the active top level. code-comment-allow provenance-comment -- operand, not provenance */
function isActiveTopLevel(rel: string): boolean {
    const norm = rel.split(path.sep).join('/');
    if (!norm.startsWith('agents/roadmaps/') || !norm.endsWith('.md')) {
        return false;
    }
    const tail = norm.slice('agents/roadmaps/'.length);
    return !tail.includes('/') && isRoadmapCandidate(norm);
}

/**
 * A disposition directory — where an offset sends a roadmap.
 *
 * `stubs/` is in the set, and it was missing from the first version. Un-stubbing
 * is the documented promotion path, so a stub moved to the top level is an
 * ADDITION that T3 must charge, and a roadmap demoted to a stub is an offset.
 * With `stubs/` unrecognised, a promotion was classified as neither and the lint
 * could never charge it — the one hole that let an active roadmap arrive for free.
 */
function isDisposed(rel: string): boolean {
    const norm = rel.split(path.sep).join('/');
    return /^agents\/roadmaps\/(archive|later|skipped|stubs)\//.test(norm);
}

/** A roadmap parked for later — the one disposition that grows another count. */
function isParked(rel: string): boolean {
    return rel.split(path.sep).join('/').startsWith('agents/roadmaps/later/');
}

/**
 * Read the exemption reason a newly added roadmap declares, if any.
 *
 * The key lives in the file's own frontmatter rather than in a config or a
 * commit trailer, for the reason `RATCHET_RESET_KEY` gives for living inside the
 * baseline JSON: the claim then shows up in the diff of the change that makes
 * it, and a reviewer sees it without being told to look.
 *
 * THE BLOCK SCALAR IS READ HERE AND NOT BY `parseFrontmatter`, which is a flat
 * line parser with no YAML block support: it returns the value as everything
 * after the first colon. Measured 2026-10-01 across the three roadmap trees,
 * **38 of 221 exemptions are written `estate_offset_exempt: >-` with the reason
 * indented beneath**, and for every one of them this function used to return
 * the literal two-character string `>-`. That is non-empty, so the gate
 * accepted it — a key whose whole purpose is that a reviewer sees the claim was
 * being checked against a YAML punctuation mark on one file in six. The fix
 * belongs here rather than in the shared parser because every other caller of
 * that parser reads single-token values (`status`, `complexity`) where block
 * support buys nothing and a rewrite risks the dashboard.
 */
export function exemptionReason(text: string): string | null {
    const block = blockScalar(text, 'estate_offset_exempt');
    if (block !== null) return block === '' ? null : block;
    const fm = parseFrontmatter(text);
    const raw = (fm as Record<string, unknown>)['estate_offset_exempt'];
    if (typeof raw !== 'string') {
        return null;
    }
    const reason = raw.trim().replace(/^["']|["']$/g, '').trim();
    return reason === '' ? null : reason;
}

/**
 * The folded body of `<key>: >-` / `<key>: |`, or `null` when not that form.
 *
 * Returns `''` — not `null` — for a block header with no body, so the caller can
 * tell "declared and empty" from "not a block scalar". An empty block is the
 * blank-reason case the key already refuses, and collapsing it into `null` here
 * would send it back to the flat parser, which would hand back `>-` and accept it.
 */
function blockScalar(text: string, key: string): string | null {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (m === null) return null;
    const lines = (m[1] as string).split(/\r?\n/);
    const head = new RegExp(`^${key}:[ \\t]*(.*)$`);
    for (let i = 0; i < lines.length; i += 1) {
        const hm = head.exec(lines[i] as string);
        if (hm === null) continue;
        // Only the block indicators. A quoted or bare value is the flat form and
        // stays with the flat parser, which already handles it.
        //
        // THE TRAILING COMMENT IS PART OF THE HEADER, and omitting it was a
        // BYPASS rather than a parse gap. `estate_offset_exempt: >- # offset`
        // failed this test, fell through to the flat parser, and came back as
        // the string `">- # offset"` — which the shape rule then searched for a
        // disposition word and found one, IN THE COMMENT, over a body it never
        // read. The indicator may also be written `>2-` as well as `>-2`, so
        // both orders are accepted; an indentation indicator is never `0`.
        if (!/^[>|](?:[1-9][-+]?|[-+]?[1-9]?)(?:[ \t]+#.*)?$/.test((hm[1] as string).trim())) return null;
        const body: string[] = [];
        for (let j = i + 1; j < lines.length; j += 1) {
            const line = lines[j] as string;
            if (line.trim() === '') continue;
            // The first unindented line ends the block — the next key.
            if (!/^[ \t]/.test(line)) break;
            body.push(line.trim());
        }
        return body.join(' ').replace(/\s+/g, ' ').trim();
    }
    return null;
}

/**
 * Classify the change's effect on the active roadmap tree.
 *
 * Renames carry information a name-only diff loses: `road-to-x.md` →
 * `archive/road-to-x.md` is the wanted direction and counts as an offset, while
 * `later/road-to-x.md` → `road-to-x.md` is an un-parking and counts as an
 * addition. A top-level-to-top-level rename is neither.
 */
export function classifyDiff(
    nameStatus: string,
    readFile: (rel: string) => string | null,
): OffsetLedger {
    const added: string[] = [];
    const offsets: string[] = [];
    const exempt: Array<{ file: string; reason: string }> = [];
    const parked: string[] = [];
    for (const line of nameStatus.split('\n')) {
        if (line.trim() === '') continue;
        const cols = line.split('\t');
        const status = (cols[0] ?? '').trim();
        if (status.startsWith('R') || status.startsWith('C')) {
            const from = cols[1] ?? '';
            const to = cols[2] ?? '';
            if (isActiveTopLevel(from) && isDisposed(to)) {
                offsets.push(from);
                if (isParked(to)) parked.push(to);
            } else if (isDisposed(from) && isActiveTopLevel(to)) {
                added.push(to);
            }
            continue;
        }
        const file = cols[1] ?? '';
        if (!isActiveTopLevel(file)) continue;
        if (status === 'A') {
            added.push(file);
        } else if (status === 'D') {
            offsets.push(file);
        }
    }
    for (const file of added) {
        const text = readFile(file);
        if (text === null) continue;
        const reason = exemptionReason(text);
        if (reason !== null) {
            exempt.push({ file, reason });
        }
    }
    return { added, offsets, exempt, parked };
}

/**
 * The `estate_growth_exempt:` reasons this change ADDS, read from the patch.
 *
 * Read from the diff rather than from the file, and that is the point: a claim
 * sitting in a roadmap authorises nothing on a later change, so an exemption
 * cannot be banked the way surplus in a stored baseline could. It also means a
 * newly added roadmap and an edited one need no separate handling — in a
 * `base...HEAD` patch both arrive as `+` lines.
 *
 * `--unified=0` keeps context lines out, so a claim that merely sits NEAR an
 * edited line is not read as added. Deliberately tolerant of leading whitespace
 * and of quoted values, matching `exemptionReason`; deliberately NOT tolerant of
 * an empty reason, because an exemption whose reason is blank is the silent
 * exception the key exists to replace.
 */
export function growthClaims(patch: string): GrowthClaim[] {
    const out: GrowthClaim[] = [];
    let file = '';
    for (const line of patch.split('\n')) {
        // `+++ b/<path>` names the file the following `+` lines belong to. The
        // `/dev/null` form is a deletion, which cannot carry a claim.
        const head = /^\+\+\+ b\/(.+)$/.exec(line);
        if (head !== null) {
            file = (head[1] ?? '').trim();
            continue;
        }
        if (!line.startsWith('+') || line.startsWith('+++')) continue;
        const m = /^\+\s*estate_growth_exempt:\s*(.+?)\s*$/.exec(line);
        if (m === null) continue;
        const reason = (m[1] ?? '').trim().replace(/^["']|["']$/g, '').trim();
        if (reason !== '') out.push({ file, reason });
    }
    return out;
}
