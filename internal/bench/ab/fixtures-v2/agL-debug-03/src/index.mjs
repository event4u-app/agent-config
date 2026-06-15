// Wiring: build a ready-to-use ledger with all its collaborators sharing one
// store, one sequence, one journal, one balance index.

import { Sequence } from './clock.mjs';
import { TxStore } from './store.mjs';
import { Accounts } from './accounts.mjs';
import { Journal } from './journal.mjs';
import { Ledger, ABORT } from './ledger.mjs';
import { Reporting } from './reporting.mjs';
import { recomputeBalances, netOf } from './recompute.mjs';

export function createLedger() {
  const store = new TxStore();
  const seq = new Sequence(1);
  const accounts = new Accounts(store);
  const journal = new Journal(store);
  const ledger = new Ledger({ store, accounts, journal, seq });
  const reporting = new Reporting(accounts);
  return { store, seq, accounts, journal, ledger, reporting };
}

export { ABORT, recomputeBalances, netOf };
