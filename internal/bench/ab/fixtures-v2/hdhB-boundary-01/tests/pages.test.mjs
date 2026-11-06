import { pageCount } from '../src/paging/pages.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

eq(pageCount(11, 5), 3, 'partial last page');
eq(pageCount(10, 5), 2, 'exact multiple');

if (failed) process.exit(1);
console.log('page tests passed');
