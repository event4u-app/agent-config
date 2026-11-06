import { loadConfig } from '../src/config/load.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

eq(loadConfig({}).maxItems, 50, 'default maxItems');
let threw = false;
try { loadConfig({ maxItems: 0 }); } catch { threw = true; }
eq(threw, false, 'maxItems 0 accepted');

if (failed) process.exit(1);
console.log('config tests passed');
