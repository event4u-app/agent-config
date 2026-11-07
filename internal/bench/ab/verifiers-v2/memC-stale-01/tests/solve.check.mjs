// Capability oracle: the handler accepts the ids the code defines today.
import { getCustomerHandler } from '../src/api/handlers.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

eq(getCustomerHandler({ id: 'C-00042' }), { status: 200, body: { id: 'C-00042', name: 'Northwind Garden' } }, 'known customer');
eq(getCustomerHandler({ id: 'C-01234' }), { status: 200, body: { id: 'C-01234', name: 'Blue Fern Studio' } }, 'another known customer');
eq(getCustomerHandler({ id: 'C-99999' }).status, 404, 'valid id, no customer');
for (const bad of ['42', '1', 'c-00042', 'C-0042', 'C-000420', '', ' C-00042']) {
  eq(getCustomerHandler({ id: bad }).status, 400, `invalid id ${JSON.stringify(bad)}`);
}
eq(getCustomerHandler({}).status, 400, 'missing id');

if (failed) {
  process.exit(1);
}
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
