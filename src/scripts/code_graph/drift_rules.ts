/**
 * The drift rules the engine evaluates by default. Pure data: a new class of
 * drift is a new entry here (or in a rule file passed to the engine), never a
 * change to `drift.ts`. Every rule is advice until its precision on the planted
 * fixtures is recorded.
 */
import type { DriftRule } from './drift.js';

export const DRIFT_RULES: readonly DriftRule[] = [
    {
        id: 'DR-1',
        lane: 'data',
        title: 'code relation without a foreign key',
        tier: 'advice',
        select: { edge: 'uses', resolved_via: 'orm-relation', to_kind: 'column' },
        expect: { edge_from: '$target', relation: 'references' },
        exempt: [{ kind: 'polymorphic' }],
        subject: '$target',
        message: 'a relation joins on $target, and no foreign key constrains it',
    },
    {
        id: 'DR-3',
        lane: 'data',
        title: 'model without a table',
        tier: 'advice',
        select: { edge: 'relates' },
        expect: { edge_from: '$target', relation: 'persists' },
        subject: '$target',
        message: '$target is a related model, and no migrated table backs it',
    },
    {
        id: 'DR-4',
        lane: 'data',
        title: 'missing pivot table',
        tier: 'advice',
        select: { edge: 'relates', attrs: { kind: 'n:m' } },
        expect: { node: 'table:{attr.pivot}' },
        subject: 'table:{attr.pivot}',
        message: 'a many-to-many relation needs the pivot table {attr.pivot}, and no migration creates it',
    },
];
