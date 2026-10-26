/**
 * Builds a lane's facts and relations with their witnesses. The witness hash
 * covers the text of the witnessed line, so a later confirm can tell whether
 * the line still says what it said when the fact was read.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { spanHash, type LaneFact, type LaneOutput, type LaneRelation, type SourceRung, type Witness } from '../lane_fact.js';

type Attrs = LaneFact['attrs'];

export class Emitter {
    readonly facts: LaneFact[] = [];
    readonly relations: LaneRelation[] = [];
    readonly skipped: { file: string; reason: string }[] = [];
    private readonly lines = new Map<string, string[]>();
    private readonly ids = new Set<string>();
    private readonly relKeys = new Set<string>();

    constructor(private readonly root: string) {}

    /** Read a repository file; null (and a skip entry) when it cannot be read. */
    read(rel: string): string | null {
        try {
            const text = fs.readFileSync(path.join(this.root, rel), 'utf-8');
            this.lines.set(rel, text.split('\n'));
            return text;
        } catch (e) {
            this.skip(rel, `unreadable: ${(e as NodeJS.ErrnoException).code ?? 'error'}`);
            return null;
        }
    }

    skip(file: string, reason: string): void {
        this.skipped.push({ file, reason });
    }

    witness(file: string, line: number): Witness {
        const text = (this.lines.get(file)?.[line - 1] ?? '').trimEnd();
        return { file, line, hash: spanHash(text) };
    }

    has(id: string): boolean {
        return this.ids.has(id);
    }

    /** Emit a fact; the id is `<kind>:<key>`. A second fact with the same id is dropped. */
    fact(kind: string, key: string, name: string, attrs: Attrs, file: string, line: number, rung: SourceRung = 'T1'): string {
        const id = `${kind}:${key}`;
        if (this.ids.has(id)) return id;
        this.ids.add(id);
        this.facts.push({ kind, id, name, attrs, witness: this.witness(file, line), rung, owner: file });
        return id;
    }

    rel(relation: string, from: string, to: string, attrs: Attrs, file: string, line: number, opts: { guess?: boolean; rung?: SourceRung } = {}): void {
        const key = `${relation}\u0000${from}\u0000${to}`;
        if (this.relKeys.has(key)) return;
        this.relKeys.add(key);
        this.relations.push({ relation, from, to, attrs, witness: this.witness(file, line), rung: opts.rung ?? 'T1', owner: file, guess: opts.guess ?? false });
    }

    output(lane: LaneOutput['lane']): LaneOutput {
        return { lane, facts: this.facts, relations: this.relations, skipped: this.skipped };
    }
}

/** Repository-relative path with forward slashes. */
export const posix = (rel: string): string => rel.split(path.sep).join('/');
