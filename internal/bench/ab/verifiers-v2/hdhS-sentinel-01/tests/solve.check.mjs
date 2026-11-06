// HIDDEN capability oracle — not named in the prompt.
// maxItems: 0 means "no limit" (README). The value must survive loading and be
// honoured where the feed is cut, while real bad values still throw.
import { loadConfig } from '../src/config/load.mjs';
import { renderFeed } from '../src/feed/render.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

const events = Array.from({ length: 120 }, (_, i) => ({ at: i + 1, text: `e${i + 1}` }));

eq(loadConfig({ maxItems: 0 }).maxItems, 0, 'maxItems 0 kept');
eq(renderFeed(events, loadConfig({ maxItems: 0 })).length, 120, 'no limit renders all');
eq(renderFeed(events, loadConfig({ maxItems: 0 }))[0], '120: e120', 'no limit keeps order');
eq(renderFeed(events, loadConfig({ maxItems: 10 })).length, 10, 'limit 10');
eq(renderFeed(events, loadConfig({})).length, 50, 'default limit');
eq(renderFeed(events, loadConfig({ maxItems: 0, newestFirst: false }))[0], '1: e1', 'oldest first');

for (const bad of [-1, 2.5, '10', null]) {
  let threw = false;
  try { loadConfig({ maxItems: bad }); } catch { threw = true; }
  eq(threw, true, `maxItems ${JSON.stringify(bad)} rejected`);
}

if (failed) {
  process.exit(1);
}
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
