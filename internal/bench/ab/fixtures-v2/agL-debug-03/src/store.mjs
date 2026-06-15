// Transactional in-memory store with NESTED savepoints.
//
// The store does not know about accounts or balances. It offers a generic
// "undo journal": callers register an inverse closure for every mutation they
// make (via `onRollback`). `begin()` opens a savepoint; `rollback()` replays
// the inverse closures recorded since the matching `begin()` (newest first),
// then discards them; `commit()` folds the savepoint's closures into the parent
// so an outer rollback can still undo them.
//
// Savepoints nest: begin/begin/rollback undoes only the inner block; a later
// rollback of the outer block undoes whatever the inner block committed up.
//
// Invariant the store promises its callers:
//   After rollback() of a savepoint, EVERY inverse closure registered while
//   that savepoint (and any savepoint nested inside it) was open has run
//   exactly once, in reverse registration order.

export class TxStore {
  constructor() {
    // Flat undo log: { fn } in registration order.
    this.undo = [];
    // Stack of savepoint marks. Each mark is the undo-log length at begin().
    this.marks = [];
  }

  begin() {
    this.marks.push(this.undo.length);
  }

  // Register an inverse operation for the mutation the caller just performed.
  // Outside any savepoint the closure is dropped (nothing to roll back to).
  onRollback(fn) {
    if (this.marks.length === 0) {
      return;
    }
    this.undo.push({ fn });
  }

  commit() {
    if (this.marks.length === 0) {
      throw new Error('commit() with no open savepoint');
    }
    // Fold into the parent: just drop the mark. The closures stay in the undo
    // log so an enclosing savepoint can still replay them on its own rollback.
    this.marks.pop();
  }

  rollback() {
    if (this.marks.length === 0) {
      throw new Error('rollback() with no open savepoint');
    }
    const mark = this.marks.pop();
    // Replay every inverse closure registered since this savepoint opened,
    // newest first, then truncate the log back to the mark.
    for (let i = this.undo.length - 1; i > mark; i--) {
      this.undo[i].fn();
    }
    this.undo.length = mark;
  }

  // Depth of the open savepoint stack (0 == fully committed).
  depth() {
    return this.marks.length;
  }
}
