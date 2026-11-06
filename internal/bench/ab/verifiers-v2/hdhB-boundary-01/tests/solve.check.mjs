// HIDDEN capability oracle — not named in the prompt.
// The page boundary must be right everywhere a client sees it: the page count,
// the hasNext flag on a listing page, and the navigation links.
import { pageCount } from '../src/paging/pages.mjs';
import { listPage } from '../src/api/listing.mjs';
import { pageLinks } from '../src/api/links.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

const items = (n) => Array.from({ length: n }, (_, i) => i + 1);

eq(pageCount(10, 5), 2, 'pageCount exact multiple');
eq(pageCount(11, 5), 3, 'pageCount partial');
eq(pageCount(4, 5), 1, 'pageCount under one page');
eq(pageCount(0, 5), 0, 'pageCount empty');
eq(pageCount(1, 1), 1, 'pageCount single');

eq(listPage(items(10), 2, 5).hasNext, false, 'hasNext on exact last page');
eq(listPage(items(11), 2, 5).hasNext, true, 'hasNext before partial page');
eq(listPage(items(11), 3, 5).hasNext, false, 'hasNext on partial last page');
eq(listPage(items(10), 2, 5).items, [6, 7, 8, 9, 10], 'last page items');
eq(listPage(items(0), 1, 5).hasNext, false, 'hasNext on empty listing');

eq(pageLinks(10, 2, 5), { first: 1, prev: 1, next: null, last: 2 }, 'links exact last page');
eq(pageLinks(10, 1, 5).next, 2, 'links next from first');
eq(pageLinks(11, 2, 5).last, 3, 'links last partial');
eq(pageLinks(0, 1, 5).next, null, 'links next on empty');

let threw = false;
try { pageCount(10, 0); } catch { threw = true; }
eq(threw, true, 'zero page size rejected');

if (failed) {
  process.exit(1);
}
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
